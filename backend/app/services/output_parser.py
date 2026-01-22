"""
Output Parser Service.
Parses MARS simulator output into structured data.

IMPORTANT: This service is READ-ONLY.
It does NOT perform any allocation logic or decisions.
All it does is parse the output from MARS execution.

Per the MIPS-centric architecture:
- MIPS performs all allocation/free logic
- MARS outputs register values and memory dumps
- This service parses that output into Python data structures
- The parsed data is sent to the frontend for visualization
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.models.schemas import (
    FreeBlock,
    HeapBlock,
    HeapState,
    MemoryBlock,
)


@dataclass
class ParsedHeapBlock:
    """Parsed heap block from MIPS memory."""

    address: int
    size: int
    allocated: bool
    next_ptr: int


class OutputParser:
    """
    Parses MARS output into structured data for visualization.

    This parser reads:
    1. Register values from MARS stdout
    2. Memory dumps from MARS HexText output
    3. Heap metadata from known memory locations

    It does NOT:
    - Make allocation decisions
    - Modify heap state
    - Perform any algorithmic logic
    """

    # Regex patterns
    REGISTER_PATTERN: re.Pattern[str] = re.compile(r"\$(\w+)\s+(-?\d+)")
    HEX_VALUE_PATTERN: re.Pattern[str] = re.compile(r"^([0-9a-fA-F]+)$")

    # MIPS memory layout (MARS defaults)
    DATA_START: int = 0x10010000
    HEAP_START: int = 0x10040000

    # Heap block header offsets
    HEADER_SIZE: int = 12  # 3 words
    OFFSET_SIZE: int = 0
    OFFSET_ALLOCATED: int = 4
    OFFSET_NEXT: int = 8

    def parse_registers(self, mars_stdout: str) -> dict[str, int]:
        """
        Parse register values from MARS stdout.

        MARS outputs registers in format: $t0     42

        Args:
            mars_stdout: Standard output from MARS execution

        Returns:
            Dictionary mapping register names to integer values
        """
        registers: dict[str, int] = {}

        for line in mars_stdout.strip().split("\n"):
            match = self.REGISTER_PATTERN.search(line)
            if match:
                reg_name = f"${match.group(1)}"
                value = int(match.group(2))
                registers[reg_name] = value

        return registers

    def parse_memory_dump(
        self,
        dump_content: str,
        start_address: int,
        word_size: int = 4,
    ) -> list[MemoryBlock]:
        """
        Parse memory dump from MARS HexText format.

        HexText format: one hex value per line (no 0x prefix in dump file)

        Args:
            dump_content: Content of memory dump file
            start_address: Starting address of the dump
            word_size: Size of each word (default 4 bytes)

        Returns:
            List of MemoryBlock objects
        """
        blocks: list[MemoryBlock] = []
        address = start_address

        for line in dump_content.strip().split("\n"):
            line = line.strip()
            if not line:
                continue

            # Handle both "0x..." format and raw hex
            if line.startswith("0x"):
                value = int(line, 16)
            else:
                match = self.HEX_VALUE_PATTERN.match(line)
                if match:
                    value = int(match.group(1), 16)
                else:
                    continue

            blocks.append(
                MemoryBlock(
                    address=address,
                    size=word_size,
                    value=value,
                )
            )
            address += word_size

        return blocks

    def parse_heap_metadata(
        self,
        memory_blocks: list[MemoryBlock],
        heap_start: int,
        heap_end: int,
    ) -> list[ParsedHeapBlock]:
        """
        Parse heap block metadata from memory dump.

        Reads the heap block headers written by MIPS code:
            Word 0: size
            Word 1: allocated (0 or 1)
            Word 2: next pointer

        Args:
            memory_blocks: Memory blocks from heap segment
            heap_start: Starting address of heap
            heap_end: Ending address of heap

        Returns:
            List of ParsedHeapBlock objects
        """
        if not memory_blocks:
            return []

        # Build address -> value map
        mem_map = {b.address: b.value for b in memory_blocks if b.value is not None}

        blocks: list[ParsedHeapBlock] = []
        current = heap_start

        while current < heap_end:
            # Read block header
            size = mem_map.get(current + self.OFFSET_SIZE)
            allocated = mem_map.get(current + self.OFFSET_ALLOCATED)
            next_ptr = mem_map.get(current + self.OFFSET_NEXT)

            # Stop if we can't read header or size is invalid
            if size is None or size <= 0:
                break

            blocks.append(
                ParsedHeapBlock(
                    address=current,
                    size=size,
                    allocated=bool(allocated) if allocated is not None else False,
                    next_ptr=next_ptr if next_ptr else 0,
                )
            )

            # Move to next block
            current += size

        return blocks

    def build_heap_state(
        self,
        memory_blocks: list[MemoryBlock],
        heap_start: int,
        heap_end: int,
    ) -> HeapState:
        """
        Build complete HeapState from parsed memory.

        This method ONLY reads and structures data.
        It does NOT make any allocation decisions.

        Args:
            memory_blocks: Memory blocks from heap segment dump
            heap_start: Starting address of heap
            heap_end: Ending address of heap

        Returns:
            HeapState with blocks, free_list, and fragmentation
        """
        # Parse raw heap metadata
        parsed_blocks = self.parse_heap_metadata(memory_blocks, heap_start, heap_end)

        # Convert to HeapBlock list
        heap_blocks: list[HeapBlock] = []
        free_blocks: list[FreeBlock] = []

        for pb in parsed_blocks:
            heap_blocks.append(
                HeapBlock(
                    address=pb.address,
                    size=pb.size,
                    allocated=pb.allocated,
                )
            )

            # Build free list from non-allocated blocks
            if not pb.allocated:
                user_size = max(0, pb.size - self.HEADER_SIZE)
                free_blocks.append(
                    FreeBlock(
                        address=pb.address + self.HEADER_SIZE,
                        size=user_size,
                    )
                )

        # Calculate fragmentation (read-only calculation)
        fragmentation = self._calculate_fragmentation(free_blocks)

        return HeapState(
            blocks=heap_blocks,
            free_list=free_blocks,
            fragmentation=fragmentation,
        )

    def _calculate_fragmentation(self, free_blocks: list[FreeBlock]) -> float:
        """
        Calculate fragmentation percentage from free blocks.

        Formula: (total_free - largest_free) / total_free * 100

        This is a pure calculation, not a decision.
        """
        if not free_blocks or len(free_blocks) <= 1:
            return 0.0

        total_free = sum(b.size for b in free_blocks)
        if total_free == 0:
            return 0.0

        largest_free = max(b.size for b in free_blocks)
        return ((total_free - largest_free) / total_free) * 100.0

    def extract_heap_bounds(
        self,
        data_blocks: list[MemoryBlock],
        data_start: int = DATA_START,
    ) -> tuple[int, int]:
        """
        Extract heap_start_addr and heap_end_addr from .data segment.

        These values are written by MIPS code at known offsets.

        Args:
            data_blocks: Memory blocks from .data segment
            data_start: Starting address of .data segment

        Returns:
            Tuple of (heap_start, heap_end)
        """
        mem_map = {b.address: b.value for b in data_blocks if b.value is not None}

        # The heap metadata is stored at the beginning of .data
        # Layout from heap_operations.asm:
        #   operation_type:     .word (offset 0)
        #   requested_size:     .word (offset 4)
        #   free_address:       .word (offset 8)
        #   heap_start_addr:    .word (offset 12)
        #   heap_end_addr:      .word (offset 16)
        #   free_list_head:     .word (offset 20)

        heap_start = mem_map.get(data_start + 12, 0)
        heap_end = mem_map.get(data_start + 16, 0)

        return heap_start, heap_end


# Singleton instance
_output_parser: OutputParser | None = None


def get_output_parser() -> OutputParser:
    """Get singleton OutputParser instance."""
    global _output_parser
    if _output_parser is None:
        _output_parser = OutputParser()
    return _output_parser
