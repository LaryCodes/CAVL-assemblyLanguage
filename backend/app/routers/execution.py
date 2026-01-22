"""
Execution Router.
API endpoints for MIPS code execution, stepping, and state management.

CRITICAL: This router uses the MIPS instruction analyzer for code analysis.
The analysis is performed IN MIPS (mips/core/instruction_analyzer.asm),
NOT in Python. Python only orchestrates execution and parses output.

Endpoints:
- POST /api/execute - Execute MIPS code
- POST /api/step - Execute single instruction step
- POST /api/reset - Reset to initial state
- GET /api/state - Get current execution state
"""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    ExecuteRequest,
    ExecuteResponse,
    ExecutionState,
    InstructionAnalysis,
    ResetResponse,
    StateResponse,
    StepResponse,
)
from app.services.mars_executor import MarsExecutor, MarsResult
from app.services.mips_analyzer import MipsAnalysisError, get_mips_analyzer
from app.services.state_manager import get_state_manager
from app.services.trace_parser import TraceParser, get_trace_parser

router = APIRouter(prefix="/api", tags=["execution"])


def _get_mars_executor() -> MarsExecutor:
    """Get MARS executor instance, handling initialization errors."""
    try:
        return MarsExecutor()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MARS simulator not configured",
        )


def _build_execution_states(
    mars_result: MarsResult,
    parser: TraceParser,
    code: str,
    _executor: MarsExecutor,
) -> list[ExecutionState]:
    """
    Build execution states from MARS output.

    CRITICAL: This function also runs the MIPS instruction analyzer
    to get instruction classification data. The analysis is performed
    IN MIPS (mips/core/instruction_analyzer.asm), NOT in Python.
    """
    if not mars_result.success:
        return []

    # Parse register values from output
    registers = parser.parse_register_dump(mars_result.stdout)

    # Extract program output (stdout from the MIPS program)
    program_output = _extract_program_output(mars_result.stdout)

    # =========================================================
    # CRITICAL: Run MIPS instruction analyzer
    # This analysis is done IN MIPS, not Python
    # =========================================================
    mips_analysis: InstructionAnalysis | None = None
    try:
        analyzer = get_mips_analyzer()
        analysis_result = analyzer.analyze(code)

        # Convert to Pydantic model
        mips_analysis = InstructionAnalysis(
            r_type_count=analysis_result.r_type_count,
            i_type_count=analysis_result.i_type_count,
            load_count=analysis_result.load_count,
            store_count=analysis_result.store_count,
            branch_count=analysis_result.branch_count,
            jump_count=analysis_result.jump_count,
            syscall_count=analysis_result.syscall_count,
            other_count=analysis_result.other_count,
            total_analyzed=analysis_result.total_analyzed,
            register_usage=analysis_result.register_usage,
            analysis_valid=analysis_result.analysis_valid,
        )
        print(f"[DEBUG] Analysis result: total={mips_analysis.total_analyzed}, r_type={mips_analysis.r_type_count}, valid={mips_analysis.analysis_valid}")
    except MipsAnalysisError as e:
        # Analysis failed but we can still show execution results
        print(f"[DEBUG] MipsAnalysisError: {e}")
        mips_analysis = InstructionAnalysis(analysis_valid=False)
    except Exception as e:
        print(f"[DEBUG] Exception during analysis: {e}")
        mips_analysis = InstructionAnalysis(analysis_valid=False)

    # Get memory dumps for data segment (skip for performance - not critical)
    data_blocks: list = []
    # Memory dumps are expensive (re-execute program), skip for now
    # try:
    #     data_result = executor.dump_memory(code, ".data")
    #     if data_result.success and data_result.stdout:
    #         data_blocks = parser.parse_memory_dump(
    #             data_result.stdout,
    #             parser.DATA_START
    #         )
    # except Exception:
    #     pass  # Memory dump failed, continue with empty

    # Get memory dumps for text segment (skip for performance - not critical)
    text_blocks: list = []
    # try:
    #     text_result = executor.dump_memory(code, ".text")
    #     if text_result.success and text_result.stdout:
    #         text_blocks = parser.parse_memory_dump(
    #             text_result.stdout,
    #             parser.TEXT_START
    #         )
    # except Exception:
    #     pass

    # Create memory state with parsed blocks
    memory_state = parser.create_memory_state(
        text_blocks=text_blocks,
        data_blocks=data_blocks,
        heap_blocks=[],  # Heap requires special parsing
        stack_blocks=[],  # Stack is dynamic
    )

    # Create initial heap state
    heap_state = parser.create_initial_heap_state()

    # Get PC from registers if available (it's stored in special register)
    pc = registers.get("$pc", parser.TEXT_START)
    if pc == 0:
        pc = parser.TEXT_START

    # Create execution state with MIPS analysis
    state = parser.create_execution_state(
        registers=registers,
        pc=pc,
        current_instruction="Program executed - showing final state",
        changed_registers=list(registers.keys()),
        memory_state=memory_state,
        heap_state=heap_state,
        is_complete=True,
        program_output=program_output,
        instruction_analysis=mips_analysis,
    )

    return [state]


def _extract_program_output(mars_stdout: str) -> str:
    """
    Extract program output from MARS stdout.

    MARS stdout contains both:
    1. Register dump lines: "$reg  value" format
    2. Program output: anything printed by syscalls (print_int, print_string, etc.)

    This function filters out register dump lines to get just the program output.
    """
    lines = mars_stdout.strip().split("\n")
    output_lines: list[str] = []

    # Pattern for register dump lines: word (register name) followed by whitespace and number
    # Examples: "$t0  42", "t0	42", "zero     0"
    register_pattern = re.compile(r"^[\$]?\w+\s+-?\d+\s*$")

    for line in lines:
        stripped = line.strip()
        # Skip empty lines and register dump lines
        if not stripped:
            continue
        if register_pattern.match(stripped):
            continue
        # Skip MARS info messages
        if stripped.startswith("MARS") or stripped.startswith("Error"):
            continue
        output_lines.append(line)

    return "\n".join(output_lines)


@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest) -> ExecuteResponse:
    """
    Execute MIPS code.

    Accepts MIPS assembly code and executes it using MARS simulator.
    Returns the execution state including registers and memory.

    Args:
        request: ExecuteRequest with code and mode

    Returns:
        ExecuteResponse with success status and execution state
    """
    # Validate input
    if not request.code or not request.code.strip():
        return ExecuteResponse(success=False, error="MIPS code cannot be empty")

    try:
        executor = _get_mars_executor()
    except HTTPException as e:
        return ExecuteResponse(success=False, error=e.detail)

    parser = get_trace_parser()
    state_manager = get_state_manager()

    # Execute with MARS
    if request.mode == "full":
        result = executor.execute(request.code, dump_registers=True)
    else:
        result = executor.execute_with_trace(request.code)

    # Handle execution errors
    if not result.success:
        error_msg = result.error or "Unknown execution error"
        if result.timeout:
            return ExecuteResponse(
                success=False,
                error="Execution timeout (>5s) - program may have infinite loop",
            )
        return ExecuteResponse(success=False, error=error_msg)

    # Build execution states from trace
    states = _build_execution_states(result, parser, request.code, executor)

    if not states:
        return ExecuteResponse(success=False, error="Failed to parse execution results")

    # Load trace into state manager
    state_manager.load_trace(states)

    # Return initial state
    current_state = state_manager.get_current_state()

    return ExecuteResponse(success=True, state=current_state)


@router.post("/step", response_model=StepResponse)
async def step_execution() -> StepResponse:
    """
    Execute a single instruction step.

    Advances the execution by one instruction and returns the new state.
    Requires a trace to be loaded via /api/execute first.

    Returns:
        StepResponse with success status and new execution state
    """
    state_manager = get_state_manager()

    # Check if trace is loaded
    if not state_manager.has_trace():
        return StepResponse(
            success=False, error="No program loaded. Call /api/execute first."
        )

    # Check if already complete
    if state_manager.is_complete():
        current_state = state_manager.get_current_state()
        return StepResponse(
            success=True, state=current_state, error="Execution already complete"
        )

    # Advance to next state
    new_state = state_manager.step()

    if new_state is None:
        return StepResponse(success=False, error="Failed to advance execution state")

    return StepResponse(success=True, state=new_state)


@router.post("/reset", response_model=ResetResponse)
async def reset_execution() -> ResetResponse:
    """
    Reset execution to initial state.

    Restores the program state (PC, registers, memory) to the initial
    state after loading.

    Returns:
        ResetResponse with success status and initial execution state
    """
    state_manager = get_state_manager()

    # Check if trace is loaded
    if not state_manager.has_trace():
        return ResetResponse(
            success=False, error="No program loaded. Call /api/execute first."
        )

    # Reset to initial state
    initial_state = state_manager.reset()

    if initial_state is None:
        return ResetResponse(success=False, error="Failed to reset execution state")

    return ResetResponse(success=True, state=initial_state)


@router.get("/state", response_model=StateResponse)
async def get_state() -> StateResponse:
    """
    Get current execution state.

    Returns the current state of the execution including registers,
    memory, and heap state.

    Returns:
        StateResponse with success status and current execution state
    """
    state_manager = get_state_manager()

    # Check if trace is loaded
    if not state_manager.has_trace():
        return StateResponse(
            success=False, error="No program loaded. Call /api/execute first."
        )

    current_state = state_manager.get_current_state()

    if current_state is None:
        return StateResponse(success=False, error="Failed to get execution state")

    return StateResponse(success=True, state=current_state)
