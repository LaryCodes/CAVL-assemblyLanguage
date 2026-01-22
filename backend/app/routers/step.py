"""
Step Execution Router.
API endpoints for true step-by-step MIPS code execution.

This router provides instruction-by-instruction stepping through MIPS code,
capturing register state at each step for educational visualization.

Endpoints:
- POST /api/step/load - Load and prepare program for stepping
- POST /api/step/forward - Execute next instruction
- POST /api/step/backward - Go to previous instruction state
- POST /api/step/reset - Reset to initial state
- POST /api/step/goto - Go to specific step number
- GET /api/step/state - Get current execution state
- GET /api/step/all - Get all execution steps
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.step_executor import (
    ExecutionStep,
    StepExecutionState,
    StepExecutor,
    get_step_executor,
    reset_step_executor,
)

router = APIRouter(prefix="/api/step", tags=["step-execution"])


# ============== Request/Response Models ==============


class LoadProgramRequest(BaseModel):
    """Request to load a program for step execution."""

    code: str = Field(min_length=1, description="MIPS assembly code to execute")
    max_steps: int = Field(
        default=200, ge=1, le=1000, description="Maximum steps to execute"
    )
    session_id: str = Field(default="default", description="Session identifier")


class GotoStepRequest(BaseModel):
    """Request to go to a specific step."""

    step_number: int = Field(ge=0, description="Step number to go to")
    session_id: str = Field(default="default", description="Session identifier")


class SessionRequest(BaseModel):
    """Request with session ID only."""

    session_id: str = Field(default="default", description="Session identifier")


class RegisterValueResponse(BaseModel):
    """Register value in response."""

    name: str
    value: int
    value_hex: str
    value_unsigned: int


class ExecutionStepResponse(BaseModel):
    """Single execution step response."""

    step_number: int = Field(description="Step number (0 = initial state)")
    pc: int = Field(description="Program counter value")
    pc_hex: str = Field(description="PC in hexadecimal")
    instruction: str = Field(description="Instruction text")
    instruction_hex: str = Field(description="Instruction in hexadecimal")
    registers: list[RegisterValueResponse] = Field(description="All register values")
    changed_registers: list[str] = Field(
        description="Registers that changed in this step"
    )
    description: str = Field(description="Human-readable description of the step")
    is_complete: bool = Field(description="Whether execution is complete")


class StepExecutionResponse(BaseModel):
    """Response for step execution operations."""

    success: bool = Field(description="Whether operation succeeded")
    current_step: ExecutionStepResponse | None = Field(
        default=None, description="Current step state"
    )
    total_steps: int = Field(default=0, description="Total number of steps")
    current_step_number: int = Field(default=0, description="Current step number")
    is_complete: bool = Field(default=False, description="Whether at last step")
    error: str | None = Field(default=None, description="Error message if failed")


class AllStepsResponse(BaseModel):
    """Response containing all execution steps."""

    success: bool = Field(description="Whether operation succeeded")
    steps: list[ExecutionStepResponse] = Field(
        default_factory=list, description="All execution steps"
    )
    total_steps: int = Field(default=0, description="Total number of steps")
    error: str | None = Field(default=None, description="Error message if failed")


# ============== Helper Functions ==============

# Register display order
REGISTER_ORDER = [
    "$zero",
    "$at",
    "$v0",
    "$v1",
    "$a0",
    "$a1",
    "$a2",
    "$a3",
    "$t0",
    "$t1",
    "$t2",
    "$t3",
    "$t4",
    "$t5",
    "$t6",
    "$t7",
    "$s0",
    "$s1",
    "$s2",
    "$s3",
    "$s4",
    "$s5",
    "$s6",
    "$s7",
    "$t8",
    "$t9",
    "$k0",
    "$k1",
    "$gp",
    "$sp",
    "$fp",
    "$ra",
]


def _convert_step_to_response(step: ExecutionStep) -> ExecutionStepResponse:
    """Convert internal ExecutionStep to API response format."""
    # Convert registers to response format
    registers_response = []
    for name in REGISTER_ORDER:
        value = step.registers.get(name, 0)
        # Handle signed to unsigned conversion
        unsigned = value & 0xFFFFFFFF
        registers_response.append(
            RegisterValueResponse(
                name=name,
                value=value,
                value_hex=f"0x{unsigned:08X}",
                value_unsigned=unsigned,
            )
        )

    return ExecutionStepResponse(
        step_number=step.step_number,
        pc=step.pc,
        pc_hex=step.pc_hex,
        instruction=step.instruction,
        instruction_hex=step.instruction_hex,
        registers=registers_response,
        changed_registers=step.changed_registers,
        description=step.description,
        is_complete=step.is_complete,
    )


def _build_response(
    executor: StepExecutor, success: bool = True, error: str | None = None
) -> StepExecutionResponse:
    """Build standard response from executor state."""
    current = executor.get_current_step()
    state = executor.get_state()

    return StepExecutionResponse(
        success=success,
        current_step=_convert_step_to_response(current) if current else None,
        total_steps=state.total_steps if state else 0,
        current_step_number=state.current_step if state else 0,
        is_complete=executor.is_complete(),
        error=error,
    )


# ============== API Endpoints ==============


@router.post("/load", response_model=StepExecutionResponse)
async def load_program(request: LoadProgramRequest) -> StepExecutionResponse:
    """
    Load a MIPS program for step-by-step execution.

    This endpoint:
    1. Assembles the code
    2. Executes it instruction by instruction
    3. Captures register state at each step
    4. Returns the initial state ready for stepping

    After loading, use /forward, /backward, /reset, /goto to navigate.
    """
    if not request.code.strip():
        return StepExecutionResponse(success=False, error="Code cannot be empty")

    try:
        # Reset and get fresh executor
        reset_step_executor(request.session_id)
        executor = get_step_executor(request.session_id)

        # Load and execute program
        state = executor.load_program(request.code, request.max_steps)

        if state.error:
            return StepExecutionResponse(success=False, error=state.error)

        if not state.is_loaded:
            return StepExecutionResponse(success=False, error="Failed to load program")

        return _build_response(executor)

    except FileNotFoundError:
        return StepExecutionResponse(success=False, error="MARS simulator not found")
    except Exception as e:
        return StepExecutionResponse(success=False, error=f"Load error: {str(e)}")


@router.post("/forward", response_model=StepExecutionResponse)
async def step_forward(request: SessionRequest) -> StepExecutionResponse:
    """
    Execute next instruction and return new state.

    Advances to the next instruction in the execution trace.
    If already at the last step, returns the current (final) state.
    """
    try:
        executor = get_step_executor(request.session_id)
        state = executor.get_state()

        if not state or not state.is_loaded:
            return StepExecutionResponse(
                success=False, error="No program loaded. Use /load first."
            )

        executor.step_forward()
        return _build_response(executor)

    except Exception as e:
        return StepExecutionResponse(
            success=False, error=f"Step forward error: {str(e)}"
        )


@router.post("/backward", response_model=StepExecutionResponse)
async def step_backward(request: SessionRequest) -> StepExecutionResponse:
    """
    Go to previous instruction state.

    Returns to the state before the current instruction was executed.
    If already at the first step (initial state), stays there.
    """
    try:
        executor = get_step_executor(request.session_id)
        state = executor.get_state()

        if not state or not state.is_loaded:
            return StepExecutionResponse(
                success=False, error="No program loaded. Use /load first."
            )

        executor.step_backward()
        return _build_response(executor)

    except Exception as e:
        return StepExecutionResponse(
            success=False, error=f"Step backward error: {str(e)}"
        )


@router.post("/reset", response_model=StepExecutionResponse)
async def reset_execution(request: SessionRequest) -> StepExecutionResponse:
    """
    Reset to initial state (step 0).

    Returns to the state before any instructions were executed.
    The program remains loaded and ready for stepping.
    """
    try:
        executor = get_step_executor(request.session_id)
        state = executor.get_state()

        if not state or not state.is_loaded:
            return StepExecutionResponse(
                success=False, error="No program loaded. Use /load first."
            )

        executor.reset()
        return _build_response(executor)

    except Exception as e:
        return StepExecutionResponse(success=False, error=f"Reset error: {str(e)}")


@router.post("/goto", response_model=StepExecutionResponse)
async def goto_step(request: GotoStepRequest) -> StepExecutionResponse:
    """
    Go to a specific step number.

    Allows jumping directly to any step in the execution history.
    Step 0 is the initial state, step 1 is after the first instruction, etc.
    """
    try:
        executor = get_step_executor(request.session_id)
        state = executor.get_state()

        if not state or not state.is_loaded:
            return StepExecutionResponse(
                success=False, error="No program loaded. Use /load first."
            )

        executor.goto_step(request.step_number)
        return _build_response(executor)

    except Exception as e:
        return StepExecutionResponse(success=False, error=f"Goto error: {str(e)}")


@router.get("/state", response_model=StepExecutionResponse)
async def get_state(session_id: str = "default") -> StepExecutionResponse:
    """
    Get current execution state without changing step.

    Returns the current step state and execution metadata.
    """
    try:
        executor = get_step_executor(session_id)
        state = executor.get_state()

        if not state or not state.is_loaded:
            return StepExecutionResponse(
                success=False, error="No program loaded. Use /load first."
            )

        return _build_response(executor)

    except Exception as e:
        return StepExecutionResponse(success=False, error=f"State error: {str(e)}")


@router.get("/all", response_model=AllStepsResponse)
async def get_all_steps(session_id: str = "default") -> AllStepsResponse:
    """
    Get all execution steps for visualization.

    Returns the complete execution trace with state at each step.
    Useful for timeline visualization and step scrubbing.
    """
    try:
        executor = get_step_executor(session_id)
        state = executor.get_state()

        if not state or not state.is_loaded:
            return AllStepsResponse(
                success=False, error="No program loaded. Use /load first."
            )

        steps = executor.get_all_steps()
        steps_response = [_convert_step_to_response(step) for step in steps]

        return AllStepsResponse(
            success=True,
            steps=steps_response,
            total_steps=len(steps_response),
            error=None,
        )

    except Exception as e:
        return AllStepsResponse(success=False, error=f"Get all steps error: {str(e)}")


@router.get("/info")
async def get_step_info() -> dict[str, Any]:
    """
    Get information about step execution capabilities.

    Returns supported features and usage instructions.
    """
    return {
        "name": "MIPS Step-by-Step Executor",
        "description": "Execute MIPS code one instruction at a time",
        "features": {
            "forward_stepping": True,
            "backward_stepping": True,
            "goto_step": True,
            "register_tracking": True,
            "changed_register_detection": True,
            "instruction_decoding": True,
        },
        "usage": {
            "1_load": "POST /api/step/load with {code: '...'}",
            "2_step": "POST /api/step/forward to execute next instruction",
            "3_back": "POST /api/step/backward to go back",
            "4_reset": "POST /api/step/reset to return to start",
            "5_goto": "POST /api/step/goto with {step_number: N}",
            "6_state": "GET /api/step/state to get current state",
            "7_all": "GET /api/step/all to get complete trace",
        },
        "max_steps": 1000,
        "default_max_steps": 200,
    }
