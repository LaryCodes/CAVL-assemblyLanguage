"""
Trace Parser Service.
Parses MARS simulator output into structured data.
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from app.models.schemas import (
    RegisterState,
    MemoryBlock,
    MemorySegment,
    MemoryState,
    HeapState,
    HeapBlock,
    FreeBlock,
    ExecutionState,
    MIPS_REGISTERS,
)


@dataclass
class ParsedTrace:
    """Parsed trace data from MARS output."""
    registers: Dict[str, int]
    memory_blocks: List[MemoryBlock]
    pc: int
    instructions: List[Tuple[int, str]]  # (address, instruction text)
    error: Optional[str] = None


class TraceParser:
    """
    Parses MARS output into structured data.
    
    MARS output formats:
    - Register dump: $t0     42  (tab-separated name and decimal value)
    - Memory dump (HexText): 0x00000001 (one hex value per line)
    - Instruction trace: 0x00400000: addi $t0, $zero, 5
    """
    
    # Regex patterns for parsing
    REGISTER_PATTERN = re.compile(r'\$(\w+)\s+(-?\d+)')
    MEMORY_HEX_PATTERN = re.compile(r'0x([0-9a-fA-F]+)')
    INSTRUCTION_PATTERN = re.compile(r'0x([0-9a-fA-F]+):\s+(.+)')
    
    # MIPS memory layout constants (default MARS configuration)
    TEXT_START = 0x00400000
    DATA_START = 0x10010000
    HEAP_START = 0x10040000  # Approximate, grows upward
    STACK_START = 0x7FFFEFFC  # Grows downward
    
    def parse_register_dump(self, output: str) -> Dict[str, int]:
        """
        Parse register dump from MARS output.
        
        Args:
            output: MARS stdout containing register values
            
        Returns:
            Dictionary mapping register names to values
        """
        registers = {}
        
        for line in output.strip().split('\n'):
            match = self.REGISTER_PATTERN.search(line)
            if match:
                reg_name = f"${match.group(1)}"
                value = int(match.group(2))
                registers[reg_name] = value
        
        return registers
    
    def parse_memory_dump(
        self,
        output: str,
        start_address: int,
        word_size: int = 4,
    ) -> List[MemoryBlock]:
        """
        Parse memory dump from MARS HexText output.
        
        Args:
            output: Memory dump content (one hex value per line)
            start_address: Starting address of the dump
            word_size: Size of each memory word in bytes
            
        Returns:
            List of MemoryBlock objects
        """
        blocks = []
        address = start_address
        
        for line in output.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
                
            match = self.MEMORY_HEX_PATTERN.match(line)
            if match:
                value = int(match.group(1), 16)
                blocks.append(MemoryBlock(
                    address=address,
                    size=word_size,
                    value=value,
                ))
                address += word_size
        
        return blocks

    
    def create_register_state(self, registers: Dict[str, int]) -> RegisterState:
        """
        Create a complete RegisterState from parsed registers.
        
        Fills in missing registers with 0 and ensures $zero is always 0.
        
        Args:
            registers: Parsed register values
            
        Returns:
            Complete RegisterState with all 32 registers
        """
        values = {}
        for reg in MIPS_REGISTERS:
            if reg == "$zero":
                values[reg] = 0  # $zero is always 0
            else:
                values[reg] = registers.get(reg, 0)
        
        return RegisterState(values=values)
    
    def create_memory_state(
        self,
        text_blocks: List[MemoryBlock] = None,
        data_blocks: List[MemoryBlock] = None,
        heap_blocks: List[MemoryBlock] = None,
        stack_blocks: List[MemoryBlock] = None,
    ) -> MemoryState:
        """
        Create a MemoryState from parsed memory blocks.
        
        Args:
            text_blocks: Blocks in text segment
            data_blocks: Blocks in data segment
            heap_blocks: Blocks in heap segment
            stack_blocks: Blocks in stack segment
            
        Returns:
            Complete MemoryState
        """
        text_blocks = text_blocks or []
        data_blocks = data_blocks or []
        heap_blocks = heap_blocks or []
        stack_blocks = stack_blocks or []
        
        def calc_end(blocks: List[MemoryBlock], start: int) -> int:
            if not blocks:
                return start
            return max(b.address + b.size for b in blocks)
        
        return MemoryState(
            text=MemorySegment(
                start_address=self.TEXT_START,
                end_address=calc_end(text_blocks, self.TEXT_START),
                blocks=text_blocks,
            ),
            data=MemorySegment(
                start_address=self.DATA_START,
                end_address=calc_end(data_blocks, self.DATA_START),
                blocks=data_blocks,
            ),
            heap=MemorySegment(
                start_address=self.HEAP_START,
                end_address=calc_end(heap_blocks, self.HEAP_START),
                blocks=heap_blocks,
            ),
            stack=MemorySegment(
                start_address=self.STACK_START - 1024,  # Stack grows down
                end_address=self.STACK_START,
                blocks=stack_blocks,
            ),
        )
    
    def create_initial_heap_state(self) -> HeapState:
        """Create an empty initial heap state."""
        return HeapState(
            blocks=[],
            free_list=[],
            fragmentation=0.0,
        )
    
    def detect_changed_registers(
        self,
        prev_registers: Dict[str, int],
        curr_registers: Dict[str, int],
    ) -> List[str]:
        """
        Detect which registers changed between two states.
        
        Args:
            prev_registers: Previous register values
            curr_registers: Current register values
            
        Returns:
            List of register names that changed (never includes $zero)
        """
        changed = []
        for reg in MIPS_REGISTERS:
            if reg == "$zero":
                continue  # $zero never changes
            prev_val = prev_registers.get(reg, 0)
            curr_val = curr_registers.get(reg, 0)
            if prev_val != curr_val:
                changed.append(reg)
        return changed

    
    def create_execution_state(
        self,
        registers: Dict[str, int],
        pc: int = 0,
        current_instruction: str = "",
        changed_registers: List[str] = None,
        memory_state: MemoryState = None,
        heap_state: HeapState = None,
        is_complete: bool = False,
        program_output: str = "",
        instruction_analysis = None,
    ) -> ExecutionState:
        """
        Create a complete ExecutionState.
        
        Args:
            registers: Register values
            pc: Program counter value
            current_instruction: Current instruction text
            changed_registers: List of changed register names
            memory_state: Memory state (created if None)
            heap_state: Heap state (created if None)
            is_complete: Whether execution is complete
            program_output: Program stdout output from MARS
            instruction_analysis: MIPS-computed instruction analysis
            
        Returns:
            Complete ExecutionState
        """
        return ExecutionState(
            pc=pc,
            current_instruction=current_instruction,
            registers=self.create_register_state(registers),
            changed_registers=changed_registers or [],
            memory=memory_state or self.create_memory_state(),
            heap=heap_state or self.create_initial_heap_state(),
            is_complete=is_complete,
            program_output=program_output,
            instruction_analysis=instruction_analysis,
        )
    
    def serialize_registers(self, register_state: RegisterState) -> str:
        """
        Serialize register state back to MARS-like format.
        
        Args:
            register_state: RegisterState to serialize
            
        Returns:
            String in MARS register dump format
        """
        lines = []
        for reg, value in register_state.values.items():
            # Remove $ prefix for MARS format
            reg_name = reg
            lines.append(f"{reg_name}\t{value}")
        return '\n'.join(lines)
    
    def serialize_memory_blocks(self, blocks: List[MemoryBlock]) -> str:
        """
        Serialize memory blocks back to MARS HexText format.
        
        Args:
            blocks: List of MemoryBlock to serialize
            
        Returns:
            String in MARS HexText format
        """
        lines = []
        for block in blocks:
            if block.value is not None:
                lines.append(f"0x{block.value:08x}")
        return '\n'.join(lines)


# Singleton instance for convenience
_parser = None


def get_trace_parser() -> TraceParser:
    """Get singleton TraceParser instance."""
    global _parser
    if _parser is None:
        _parser = TraceParser()
    return _parser
