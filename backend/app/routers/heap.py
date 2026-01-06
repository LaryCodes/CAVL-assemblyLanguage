"""
Heap Router - MIPS-Centric Implementation.

IMPORTANT: All allocation logic is performed by MIPS assembly.
This router ONLY:
1. Accepts user input (JSON)
2. Injects input into MIPS template
3. Executes MARS simulator
4. Parses output (registers + memory dump)
5. Returns JSON to frontend

NO ALLOCATION DECISIONS ARE MADE IN PYTHON.
The first-fit search, block splitting, and free list management
are ALL implemented in mips/core/heap_operations.asm.

Endpoints:
- POST /api/heap/allocate - Allocate heap memory via MIPS
- POST /api/heap/free - Free heap memory via MIPS
- POST /api/heap/init - Initialize heap via MIPS
- GET /api/heap/state - Get current heap state
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    AllocateRequest,
    AllocateResponse,
    FreeRequest,
    FreeResponse,
    HeapState,
)
from app.services.asm_injector import get_asm_injector
from app.services.mars_executor import MarsExecutor
from app.services.output_parser import get_output_parser


router = APIRouter(prefix="/api/heap", tags=["heap"])


def _get_executor() -> MarsExecutor:
    """Get MARS executor, handling initialization errors."""
    try:
        return MarsExecutor()
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="MARS simulator not found"
        )


@router.post("/allocate", response_model=AllocateResponse)
async def allocate_memory(request: AllocateRequest) -> AllocateResponse:
    """
    Allocate heap memory using MIPS First-Fit algorithm.
    
    Flow:
    1. Inject size into MIPS template (asm_injector)
    2. Execute MIPS program via MARS (mars_executor)
    3. Read $v0 (allocated address) from MARS output
    4. Parse heap metadata from memory dump
    5. Return result to frontend
    
    ALL ALLOCATION LOGIC IS IN MIPS (heap_operations.asm).
    Python only orchestrates execution and parses results.
    """
    # Validate input
    if request.size <= 0:
        return AllocateResponse(
            success=False,
            error="Invalid allocation size: must be greater than 0"
        )
    
    try:
        injector = get_asm_injector()
        executor = _get_executor()
        parser = get_output_parser()
        
        # Step 1: Inject size into MIPS template
        asm_code = injector.inject_heap_allocate(request.size)
        
        # Step 2: Execute via MARS
        result = executor.execute(asm_code, dump_registers=True)
        
        if not result.success:
            return AllocateResponse(
                success=False,
                error=f"MARS execution failed: {result.error}"
            )
        
        # Step 3: Parse registers ($v0 = address, $v1 = status)
        registers = parser.parse_registers(result.stdout)
        allocated_address = registers.get("$v0", -1)
        status = registers.get("$v1", 1)
        
        # Check if MIPS allocation succeeded
        if status != 0 or allocated_address < 0:
            return AllocateResponse(
                success=False,
                error="Allocation failed: no suitable free block found"
            )
        
        # Step 4: Parse heap state from memory dump
        heap_state = await _get_heap_state_from_execution(
            executor, parser, asm_code
        )
        
        # Step 5: Return result
        return AllocateResponse(
            success=True,
            address=allocated_address,
            heap=heap_state
        )
        
    except FileNotFoundError as e:
        return AllocateResponse(
            success=False,
            error=f"MIPS template not found: {str(e)}"
        )
    except Exception as e:
        return AllocateResponse(
            success=False,
            error=f"Unexpected error: {str(e)}"
        )


@router.post("/free", response_model=FreeResponse)
async def free_memory(request: FreeRequest) -> FreeResponse:
    """
    Free heap memory using MIPS free function.
    
    ALL FREE LOGIC IS IN MIPS (heap_operations.asm).
    Python only orchestrates execution and parses results.
    """
    # Validate input
    if request.address < 0:
        return FreeResponse(
            success=False,
            error="Invalid address: must be non-negative"
        )
    
    try:
        injector = get_asm_injector()
        executor = _get_executor()
        parser = get_output_parser()
        
        # Step 1: Inject address into MIPS template
        asm_code = injector.inject_heap_free(request.address)
        
        # Step 2: Execute via MARS
        result = executor.execute(asm_code, dump_registers=True)
        
        if not result.success:
            return FreeResponse(
                success=False,
                error=f"MARS execution failed: {result.error}"
            )
        
        # Step 3: Parse status from registers
        registers = parser.parse_registers(result.stdout)
        status = registers.get("$v1", 1)
        
        if status != 0:
            return FreeResponse(
                success=False,
                error="Free operation failed"
            )
        
        # Step 4: Parse heap state from memory dump
        heap_state = await _get_heap_state_from_execution(
            executor, parser, asm_code
        )
        
        return FreeResponse(
            success=True,
            heap=heap_state
        )
        
    except FileNotFoundError as e:
        return FreeResponse(
            success=False,
            error=f"MIPS template not found: {str(e)}"
        )
    except Exception as e:
        return FreeResponse(
            success=False,
            error=f"Unexpected error: {str(e)}"
        )


@router.post("/init")
async def init_heap():
    """
    Initialize the heap allocator via MIPS.
    
    This endpoint runs the MIPS heap initialization code
    and returns the initial heap state.
    """
    try:
        injector = get_asm_injector()
        executor = _get_executor()
        parser = get_output_parser()
        
        # Inject init operation
        asm_code = injector.inject_heap_init()
        
        # Execute via MARS
        result = executor.execute(asm_code, dump_registers=True)
        
        if not result.success:
            return {
                "success": False,
                "error": f"MARS execution failed: {result.error}"
            }
        
        # Parse heap state
        heap_state = await _get_heap_state_from_execution(
            executor, parser, asm_code
        )
        
        return {
            "success": True,
            "heap": heap_state.model_dump() if heap_state else None
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def _get_heap_state_from_execution(
    executor: MarsExecutor,
    parser,
    asm_code: str,
) -> HeapState:
    """
    Parse heap state from MARS memory dump.
    
    This helper:
    1. Dumps .data segment to get heap metadata addresses
    2. Extracts heap_start and heap_end from .data
    3. Dumps heap memory region
    4. Parses heap blocks from memory
    
    Returns:
        HeapState parsed from MIPS memory
    """
    # Dump .data segment to get heap bounds
    data_result = executor.dump_memory(asm_code, ".data")
    
    if not data_result.success or not data_result.stdout:
        # Return empty heap state if dump fails
        return HeapState(blocks=[], free_list=[], fragmentation=0.0)
    
    # Parse .data memory
    data_blocks = parser.parse_memory_dump(
        data_result.stdout,
        parser.DATA_START
    )
    
    # Extract heap bounds from .data
    heap_start, heap_end = parser.extract_heap_bounds(data_blocks)
    
    if heap_start == 0 or heap_end == 0:
        # Heap not initialized
        return HeapState(blocks=[], free_list=[], fragmentation=0.0)
    
    # For heap memory, we need to dump starting from heap_start
    # MARS dump command dumps from segment start, so we use the
    # data blocks that fall within heap range
    
    # Filter blocks that are in heap range
    heap_blocks = [
        b for b in data_blocks
        if heap_start <= b.address < heap_end
    ]
    
    # If no heap blocks in data dump, try to infer from heap_start
    # The heap is allocated via sbrk, so it may be in a different region
    if not heap_blocks:
        # Create synthetic blocks based on heap bounds
        # This is a fallback - ideally we'd dump the heap region directly
        return HeapState(
            blocks=[],
            free_list=[],
            fragmentation=0.0
        )
    
    # Build heap state from parsed memory
    return parser.build_heap_state(heap_blocks, heap_start, heap_end)


@router.get("/state")
async def get_heap_state():
    """
    Get current heap state by running init and parsing memory.
    
    Note: In a stateful implementation, this would read from
    a persistent heap. For V1, we re-initialize to show structure.
    """
    try:
        injector = get_asm_injector()
        executor = _get_executor()
        parser = get_output_parser()
        
        # Run init to get heap state
        asm_code = injector.inject_heap_init()
        result = executor.execute(asm_code, dump_registers=True)
        
        if not result.success:
            return {
                "success": False,
                "error": f"Failed to get heap state: {result.error}"
            }
        
        heap_state = await _get_heap_state_from_execution(
            executor, parser, asm_code
        )
        
        return {
            "success": True,
            "heap": heap_state.model_dump()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
