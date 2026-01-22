"""
Pydantic models for CAVL V1 API.
Defines data structures for memory state, heap management, registers, and execution state.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ============== Heap Models ==============


class HeapMeta(BaseModel):
    """Metadata for heap blocks parsed from MIPS memory."""

    allocated: bool
    block_size: int = Field(ge=0, description="Size of the block in bytes")


class FreeBlock(BaseModel):
    """Represents a free block in the heap free list."""

    address: int = Field(ge=0, description="Starting address of the free block")
    size: int = Field(ge=0, description="Size of the free block in bytes")


class HeapBlock(BaseModel):
    """Represents a block in the heap (allocated or free)."""

    address: int = Field(ge=0, description="Starting address of the block")
    size: int = Field(ge=0, description="Size of the block in bytes")
    allocated: bool = Field(description="Whether the block is currently allocated")


class HeapState(BaseModel):
    """Complete state of the heap including blocks and fragmentation."""

    blocks: list[HeapBlock] = Field(default_factory=list)
    free_list: list[FreeBlock] = Field(default_factory=list)
    fragmentation: float = Field(
        ge=0, le=100, default=0.0, description="Fragmentation percentage"
    )


# ============== Memory Models ==============


class MemoryBlock(BaseModel):
    """Represents a block of memory with optional metadata."""

    address: int = Field(ge=0, description="Memory address")
    size: int = Field(
        ge=0, default=4, description="Size in bytes (default word-aligned)"
    )
    value: int | None = Field(default=None, description="Memory content value")
    meta: HeapMeta | None = Field(
        default=None, description="Heap metadata (for heap blocks only)"
    )
    label: str | None = Field(
        default=None, description="Optional label for the memory location"
    )


class MemorySegment(BaseModel):
    """Represents a memory segment (Text, Data, Heap, or Stack)."""

    start_address: int = Field(ge=0, description="Starting address of the segment")
    end_address: int = Field(ge=0, description="Ending address of the segment")
    blocks: list[MemoryBlock] = Field(
        default_factory=list, description="Memory blocks in this segment"
    )


class MemoryState(BaseModel):
    """Complete memory state with all four segments."""

    text: MemorySegment = Field(description="Text segment (instructions)")
    data: MemorySegment = Field(description="Data segment (static data)")
    heap: MemorySegment = Field(description="Heap segment (dynamic allocations)")
    stack: MemorySegment = Field(description="Stack segment")


# ============== Register Models ==============

# All 32 MIPS general-purpose register names
MIPS_REGISTERS: list[str] = [
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


class RegisterState(BaseModel):
    """State of all 32 MIPS general-purpose registers."""

    values: dict[str, int] = Field(
        description="Register name to value mapping (e.g., {'$t0': 0, '$s0': 100})"
    )

    @classmethod
    def create_initial(cls) -> RegisterState:
        """Create initial register state with all registers set to 0."""
        return cls(values={reg: 0 for reg in MIPS_REGISTERS})


# ============== MIPS Analysis Models ==============


class InstructionAnalysis(BaseModel):
    """
    Results from MIPS instruction analyzer.

    CRITICAL: This data is produced by mips/core/instruction_analyzer.asm
    NOT by Python. Python only parses the MIPS output.
    """

    r_type_count: int = Field(default=0, description="R-type arithmetic instructions")
    i_type_count: int = Field(default=0, description="I-type immediate instructions")
    load_count: int = Field(
        default=0, description="Memory load instructions (lw, lb, etc.)"
    )
    store_count: int = Field(
        default=0, description="Memory store instructions (sw, sb, etc.)"
    )
    branch_count: int = Field(
        default=0, description="Branch instructions (beq, bne, etc.)"
    )
    jump_count: int = Field(default=0, description="Jump instructions (j, jal, jr)")
    syscall_count: int = Field(default=0, description="Syscall instructions")
    other_count: int = Field(default=0, description="Unclassified instructions")
    total_analyzed: int = Field(default=0, description="Total instructions analyzed")
    register_usage: dict[str, int] = Field(
        default_factory=dict, description="Per-register usage count"
    )
    analysis_valid: bool = Field(
        default=False, description="Whether MIPS analysis completed successfully"
    )


# ============== Execution State Models ==============


class ExecutionState(BaseModel):
    """Complete execution state at a point in time."""

    pc: int = Field(ge=0, description="Program Counter value")
    current_instruction: str = Field(default="", description="Current instruction text")
    registers: RegisterState = Field(description="Current register values")
    changed_registers: list[str] = Field(
        default_factory=list, description="Registers changed in last step"
    )
    memory: MemoryState = Field(description="Current memory state")
    heap: HeapState = Field(description="Current heap state")
    is_complete: bool = Field(
        default=False, description="Whether execution has completed"
    )
    program_output: str = Field(
        default="", description="Program stdout output from MARS execution"
    )
    instruction_analysis: InstructionAnalysis | None = Field(
        default=None, description="MIPS-computed instruction analysis"
    )


# ============== API Request/Response Models ==============


class ExecuteRequest(BaseModel):
    """Request to execute MIPS code."""

    code: str = Field(min_length=1, description="MIPS assembly code to execute")
    mode: str = Field(
        default="step",
        pattern="^(full|step)$",
        description="Execution mode: 'full' or 'step'",
    )


class ExecuteResponse(BaseModel):
    """Response from execution endpoints."""

    success: bool = Field(description="Whether the operation succeeded")
    state: ExecutionState | None = Field(
        default=None, description="Current execution state"
    )
    error: str | None = Field(
        default=None, description="Error message if operation failed"
    )


class StepResponse(BaseModel):
    """Response from step endpoint."""

    success: bool = Field(description="Whether the step succeeded")
    state: ExecutionState | None = Field(
        default=None, description="Current execution state after step"
    )
    error: str | None = Field(default=None, description="Error message if step failed")


class AllocateRequest(BaseModel):
    """Request to allocate heap memory."""

    size: int = Field(gt=0, description="Size in bytes to allocate")


class AllocateResponse(BaseModel):
    """Response from allocate endpoint."""

    success: bool = Field(description="Whether allocation succeeded")
    address: int | None = Field(default=None, description="Address of allocated block")
    heap: HeapState | None = Field(default=None, description="Updated heap state")
    error: str | None = Field(
        default=None, description="Error message if allocation failed"
    )


class FreeRequest(BaseModel):
    """Request to free heap memory."""

    address: int = Field(ge=0, description="Address of block to free")


class FreeResponse(BaseModel):
    """Response from free endpoint."""

    success: bool = Field(description="Whether free succeeded")
    heap: HeapState | None = Field(default=None, description="Updated heap state")
    error: str | None = Field(default=None, description="Error message if free failed")


class StateResponse(BaseModel):
    """Response from get state endpoint."""

    success: bool = Field(description="Whether getting state succeeded")
    state: ExecutionState | None = Field(
        default=None, description="Current execution state"
    )
    error: str | None = Field(default=None, description="Error message if failed")


class ResetResponse(BaseModel):
    """Response from reset endpoint."""

    success: bool = Field(description="Whether reset succeeded")
    state: ExecutionState | None = Field(
        default=None, description="Initial execution state after reset"
    )
    error: str | None = Field(default=None, description="Error message if reset failed")
