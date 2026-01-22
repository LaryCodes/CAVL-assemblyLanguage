"""
Pipeline Router - MIPS 5-Stage Pipeline Visualization API

IMPORTANT: All pipeline simulation logic is performed by MIPS assembly.
This router ONLY:
1. Accepts user MIPS code
2. Passes it to the pipeline simulator service
3. Returns structured JSON for frontend visualization

NO PIPELINE LOGIC IS IN PYTHON.
The hazard detection, forwarding, and stalling are ALL implemented
in mips/core/pipeline_simulator.asm.

Endpoints:
- POST /api/pipeline/simulate - Simulate pipeline for given code
- GET /api/pipeline/info - Get pipeline configuration info
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.pipeline_simulator import (
    PipelineSimulationError,
    PipelineSimulator,
    PipelineState,
    get_pipeline_simulator,
)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


# ============== Request/Response Models ==============


class PipelineSimulateRequest(BaseModel):
    """Request to simulate pipeline for MIPS code."""

    code: str = Field(min_length=1, description="MIPS assembly code to simulate")
    enable_forwarding: bool = Field(
        default=True, description="Enable data forwarding (default: True)"
    )


class PipelineStageResponse(BaseModel):
    """State of a single pipeline stage."""

    name: str = Field(description="Stage name (IF, ID, EX, MEM, WB)")
    instruction: int = Field(description="Instruction word (0 = NOP/bubble)")
    instruction_hex: str = Field(description="Instruction in hex format")
    pc: int = Field(description="Program counter for this instruction")
    pc_hex: str = Field(description="PC in hex format")
    valid: bool = Field(description="True if stage has valid instruction")
    src_reg1: int = Field(description="Source register 1 (-1 = none)")
    src_reg2: int = Field(description="Source register 2 (-1 = none)")
    dest_reg: int = Field(description="Destination register (-1 = none)")
    src_reg1_name: str | None = Field(description="Source register 1 name")
    src_reg2_name: str | None = Field(description="Source register 2 name")
    dest_reg_name: str | None = Field(description="Destination register name")


class HazardInfoResponse(BaseModel):
    """Information about detected hazards."""

    detected: bool = Field(description="Whether any hazard was detected")
    hazard_type: int = Field(description="Hazard type code")
    hazard_type_name: str = Field(description="Human-readable hazard type")
    stall_required: bool = Field(description="Whether pipeline must stall")
    forward_from: int = Field(description="Stage forwarding from (0=none)")
    forward_from_name: str | None = Field(description="Stage name forwarding from")
    forward_to: int = Field(description="Stage forwarding to")
    forward_to_name: str | None = Field(description="Stage name forwarding to")
    forward_reg: int = Field(description="Register being forwarded (-1 = none)")
    forward_reg_name: str | None = Field(description="Register name being forwarded")


class PipelineMetricsResponse(BaseModel):
    """Pipeline performance metrics."""

    total_cycles: int = Field(description="Total clock cycles")
    total_instructions: int = Field(description="Instructions completed")
    stall_cycles: int = Field(description="Cycles spent stalling")
    forward_count: int = Field(description="Number of forwards performed")
    branch_stalls: int = Field(description="Stalls due to branches")
    load_use_stalls: int = Field(description="Stalls due to load-use hazards")
    raw_hazards: int = Field(description="RAW hazards detected")
    cpi: float = Field(description="Cycles per instruction")
    efficiency: float = Field(description="Pipeline efficiency percentage")
    speedup: float = Field(description="Speedup vs non-pipelined (ideal=5)")


class CycleRecordResponse(BaseModel):
    """Record of pipeline state for a single cycle."""

    cycle: int = Field(description="Cycle number")
    stages: dict[str, int] = Field(
        description="Instruction in each stage (IF, ID, EX, MEM, WB)"
    )
    stages_hex: dict[str, str] = Field(description="Instructions in hex format")
    hazard_type: int = Field(description="Hazard type this cycle")
    hazard_type_name: str = Field(description="Human-readable hazard type")
    stall: bool = Field(description="Whether pipeline stalled this cycle")
    forward: bool = Field(description="Whether forwarding occurred this cycle")


class PipelineSimulateResponse(BaseModel):
    """Response from pipeline simulation."""

    success: bool = Field(description="Whether simulation succeeded")
    stages: list[PipelineStageResponse] = Field(
        default_factory=list, description="Current state of each pipeline stage"
    )
    hazard: HazardInfoResponse | None = Field(
        default=None, description="Current hazard information"
    )
    metrics: PipelineMetricsResponse | None = Field(
        default=None, description="Pipeline performance metrics"
    )
    cycle_history: list[CycleRecordResponse] = Field(
        default_factory=list, description="Per-cycle pipeline state for animation"
    )
    simulation_complete: bool = Field(
        default=False, description="Whether simulation finished"
    )
    error: str | None = Field(
        default=None, description="Error message if simulation failed"
    )


# ============== Helper Functions ==============

REGISTER_NAMES = [
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

STAGE_NAMES = {1: "IF", 2: "ID", 3: "EX", 4: "MEM", 5: "WB"}

HAZARD_NAMES = {0: "none", 1: "RAW", 2: "load-use", 3: "control"}


def get_register_name(reg_num: int) -> str | None:
    """Get register name from number."""
    if 0 <= reg_num < 32:
        return REGISTER_NAMES[reg_num]
    return None


def get_stage_name(stage_num: int) -> str | None:
    """Get stage name from number."""
    return STAGE_NAMES.get(stage_num)


def get_hazard_name(hazard_type: int) -> str:
    """Get hazard type name."""
    return HAZARD_NAMES.get(hazard_type, "unknown")


def _get_simulator() -> PipelineSimulator:
    """Get pipeline simulator, handling initialization errors."""
    try:
        return get_pipeline_simulator()
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="MARS simulator not found")
    except PipelineSimulationError as e:
        raise HTTPException(status_code=500, detail=str(e))


def _convert_state_to_response(state: PipelineState) -> PipelineSimulateResponse:
    """Convert internal PipelineState to API response format."""

    # Convert stages
    stages_response = []
    for name in ["IF", "ID", "EX", "MEM", "WB"]:
        stage = state.stages.get(name)
        if stage:
            stages_response.append(
                PipelineStageResponse(
                    name=name,
                    instruction=stage.instruction,
                    instruction_hex=f"0x{stage.instruction:08X}",
                    pc=stage.pc,
                    pc_hex=f"0x{stage.pc:08X}",
                    valid=stage.valid,
                    src_reg1=stage.src_reg1,
                    src_reg2=stage.src_reg2,
                    dest_reg=stage.dest_reg,
                    src_reg1_name=get_register_name(stage.src_reg1),
                    src_reg2_name=get_register_name(stage.src_reg2),
                    dest_reg_name=get_register_name(stage.dest_reg),
                )
            )

    # Convert hazard info
    hazard_response = None
    if state.hazard:
        hazard_response = HazardInfoResponse(
            detected=state.hazard.detected,
            hazard_type=state.hazard.hazard_type,
            hazard_type_name=get_hazard_name(state.hazard.hazard_type),
            stall_required=state.hazard.stall_required,
            forward_from=state.hazard.forward_from,
            forward_from_name=get_stage_name(state.hazard.forward_from),
            forward_to=state.hazard.forward_to,
            forward_to_name=get_stage_name(state.hazard.forward_to),
            forward_reg=state.hazard.forward_reg,
            forward_reg_name=get_register_name(state.hazard.forward_reg),
        )

    # Convert metrics
    metrics_response = None
    if state.metrics:
        cpi = state.metrics.cpi if state.metrics.cpi > 0 else 1.0
        efficiency = (1.0 / cpi) * 100.0 if cpi > 0 else 100.0
        speedup = 5.0 / cpi if cpi > 0 else 5.0  # Ideal pipeline is 5x faster

        metrics_response = PipelineMetricsResponse(
            total_cycles=state.metrics.total_cycles,
            total_instructions=state.metrics.total_instructions,
            stall_cycles=state.metrics.stall_cycles,
            forward_count=state.metrics.forward_count,
            branch_stalls=state.metrics.branch_stalls,
            load_use_stalls=state.metrics.load_use_stalls,
            raw_hazards=state.metrics.raw_hazards,
            cpi=round(cpi, 2),
            efficiency=round(efficiency, 1),
            speedup=round(speedup, 2),
        )

    # Convert cycle history
    history_response = []
    for record in state.cycle_history:
        history_response.append(
            CycleRecordResponse(
                cycle=record.cycle,
                stages={
                    "IF": record.if_instruction,
                    "ID": record.id_instruction,
                    "EX": record.ex_instruction,
                    "MEM": record.mem_instruction,
                    "WB": record.wb_instruction,
                },
                stages_hex={
                    "IF": f"0x{record.if_instruction:08X}",
                    "ID": f"0x{record.id_instruction:08X}",
                    "EX": f"0x{record.ex_instruction:08X}",
                    "MEM": f"0x{record.mem_instruction:08X}",
                    "WB": f"0x{record.wb_instruction:08X}",
                },
                hazard_type=record.hazard_type,
                hazard_type_name=get_hazard_name(record.hazard_type),
                stall=record.stall,
                forward=record.forward,
            )
        )

    return PipelineSimulateResponse(
        success=True,
        stages=stages_response,
        hazard=hazard_response,
        metrics=metrics_response,
        cycle_history=history_response,
        simulation_complete=state.simulation_complete,
        error=None,
    )


# ============== API Endpoints ==============


@router.post("/simulate", response_model=PipelineSimulateResponse)
async def simulate_pipeline(
    request: PipelineSimulateRequest,
) -> PipelineSimulateResponse:
    """
    Simulate the MIPS 5-stage pipeline for the given code.

    ALL PIPELINE LOGIC IS IN MIPS (pipeline_simulator.asm).
    Python only orchestrates execution and parses results.

    Returns:
    - Pipeline stage states (IF, ID, EX, MEM, WB)
    - Hazard information (RAW, load-use, control)
    - Performance metrics (CPI, stall count, forward count)
    - Cycle-by-cycle history for animation
    """
    if not request.code or not request.code.strip():
        return PipelineSimulateResponse(
            success=False, error="MIPS code cannot be empty"
        )

    try:
        simulator = _get_simulator()
        state = simulator.simulate(request.code, request.enable_forwarding)

        if not state.simulation_complete and state.metrics.total_instructions == 0:
            return PipelineSimulateResponse(
                success=False,
                error="Pipeline simulation produced no results. Check your MIPS code.",
            )

        return _convert_state_to_response(state)

    except PipelineSimulationError as e:
        return PipelineSimulateResponse(success=False, error=str(e))
    except HTTPException as e:
        return PipelineSimulateResponse(success=False, error=e.detail)
    except Exception as e:
        return PipelineSimulateResponse(
            success=False, error=f"Unexpected error: {str(e)}"
        )


@router.get("/info")
async def get_pipeline_info() -> dict[str, Any]:
    """
    Get information about the pipeline simulator.

    Returns pipeline configuration and feature support.
    """
    return {
        "name": "MIPS 5-Stage Pipeline Simulator",
        "stages": ["IF", "ID", "EX", "MEM", "WB"],
        "stage_descriptions": {
            "IF": "Instruction Fetch - Fetch instruction from memory",
            "ID": "Instruction Decode - Decode instruction, read registers",
            "EX": "Execute - ALU operation or address calculation",
            "MEM": "Memory Access - Load/Store memory operations",
            "WB": "Write Back - Write results to register file",
        },
        "hazard_types": {
            "RAW": "Read After Write - Data dependency hazard",
            "load-use": "Load-Use - Special RAW requiring stall (load followed by use)",
            "control": "Control - Branch/Jump hazard",
        },
        "features": {
            "forwarding": True,
            "hazard_detection": True,
            "branch_prediction": False,  # Not implemented in v1
            "cycle_history": True,
        },
        "max_instructions": 100,
        "max_cycles": 500,
        "implementation": "MIPS Assembly (mips/core/pipeline_simulator.asm)",
        "mips_centric": True,
    }
