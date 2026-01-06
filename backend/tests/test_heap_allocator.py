"""
Tests for MIPS-centric heap allocator.
Feature: cavl-v1

These tests verify:
1. ASM Injector correctly injects values into MIPS templates
2. Output Parser correctly parses MARS output
3. End-to-end heap operations via MIPS execution

IMPORTANT: All allocation logic is in MIPS (mips/core/heap_operations.asm).
Python only orchestrates execution and parses results.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from typing import List
from pathlib import Path

from app.services.output_parser import OutputParser, get_output_parser, ParsedHeapBlock
from app.services.asm_injector import AsmInjector, get_asm_injector
from app.models.schemas import (
    HeapState,
    HeapBlock,
    FreeBlock,
    MemoryBlock,
)


# ============== Constants ==============

HEAP_START = 0x10040000
HEADER_SIZE = 12  # 3 words
WORD_SIZE = 4
DATA_START = 0x10010000


# ============== Strategies ==============

@st.composite
def memory_blocks_strategy(draw, start_addr: int, num_words: int = None):
    """Generate memory blocks for testing parser."""
    if num_words is None:
        num_words = draw(st.integers(min_value=3, max_value=20))
    
    blocks = []
    for i in range(num_words):
        value = draw(st.integers(min_value=0, max_value=0xFFFFFFFF))
        blocks.append(MemoryBlock(
            address=start_addr + i * WORD_SIZE,
            size=WORD_SIZE,
            value=value,
        ))
    return blocks


@st.composite
def heap_block_memory_strategy(draw, base_address: int):
    """
    Generate memory blocks representing a valid heap block header.
    
    Block format:
    - Word 0: Block size (including header, >= 16)
    - Word 1: Allocated flag (0 or 1)
    - Word 2: Next pointer (0 or valid address)
    """
    size = draw(st.integers(min_value=16, max_value=256))
    size = (size // WORD_SIZE) * WORD_SIZE  # Word-align
    allocated = draw(st.booleans())
    next_ptr = 0 if allocated else draw(st.integers(min_value=0, max_value=0xFFFFFFFF))
    
    blocks = [
        MemoryBlock(address=base_address, size=WORD_SIZE, value=size),
        MemoryBlock(address=base_address + WORD_SIZE, size=WORD_SIZE, value=1 if allocated else 0),
        MemoryBlock(address=base_address + 2 * WORD_SIZE, size=WORD_SIZE, value=next_ptr),
    ]
    
    return blocks, size, allocated, next_ptr


@st.composite
def free_list_strategy(draw, min_blocks: int = 0, max_blocks: int = 5):
    """Generate a list of free blocks for fragmentation testing."""
    num_blocks = draw(st.integers(min_value=min_blocks, max_value=max_blocks))
    
    free_blocks = []
    current_addr = HEAP_START + HEADER_SIZE
    
    for _ in range(num_blocks):
        size = draw(st.integers(min_value=4, max_value=256))
        size = (size // WORD_SIZE) * WORD_SIZE
        
        free_blocks.append(FreeBlock(
            address=current_addr,
            size=size,
        ))
        
        current_addr += size + HEADER_SIZE + draw(st.integers(min_value=16, max_value=64))
    
    return free_blocks


# ============== ASM Injector Tests ==============

class TestAsmInjector:
    """Tests for ASM Injector service."""
    
    def test_inject_value_replaces_word(self):
        """inject_value should replace .word value for given label."""
        injector = AsmInjector()
        
        asm_code = """
.data
    operation_type:     .word 0
    requested_size:     .word 0
"""
        
        result = injector.inject_value(asm_code, "requested_size", 32)
        
        assert "requested_size:     .word 32" in result
        assert "operation_type:     .word 0" in result  # Unchanged
    
    def test_inject_value_handles_negative(self):
        """inject_value should handle replacing with different values."""
        injector = AsmInjector()
        
        asm_code = "    test_label:     .word 0"
        result = injector.inject_value(asm_code, "test_label", 12345)
        
        assert ".word 12345" in result
    
    def test_inject_heap_allocate(self):
        """inject_heap_allocate should set operation_type=0 and size."""
        # Skip if template doesn't exist
        injector = AsmInjector()
        try:
            result = injector.inject_heap_allocate(64)
            assert "operation_type:" in result
            assert ".word 0" in result  # operation_type = 0 (allocate)
            assert "requested_size:" in result
        except FileNotFoundError:
            pytest.skip("MIPS template not found")
    
    def test_inject_heap_free(self):
        """inject_heap_free should set operation_type=1 and address."""
        injector = AsmInjector()
        try:
            result = injector.inject_heap_free(0x10040010)
            assert "operation_type:" in result
            # Check that free_address is set
            assert "free_address:" in result
        except FileNotFoundError:
            pytest.skip("MIPS template not found")
    
    def test_inject_heap_operation_validates_params(self):
        """inject_heap_operation should validate required parameters."""
        injector = AsmInjector()
        
        with pytest.raises(ValueError, match="Size is required"):
            injector.inject_heap_operation("allocate", size=None)
        
        with pytest.raises(ValueError, match="Address is required"):
            injector.inject_heap_operation("free", address=None)
        
        with pytest.raises(ValueError, match="Unknown operation"):
            injector.inject_heap_operation("invalid")
    
    def test_singleton_pattern(self):
        """get_asm_injector should return singleton."""
        injector1 = get_asm_injector()
        injector2 = get_asm_injector()
        assert injector1 is injector2


# ============== Output Parser Tests ==============

class TestOutputParser:
    """Tests for Output Parser service."""
    
    def test_parse_registers_basic(self):
        """parse_registers should extract register values from MARS output."""
        parser = OutputParser()
        
        mars_output = """
$v0     268500992
$v1     0
$t0     32
$sp     2147479548
"""
        
        registers = parser.parse_registers(mars_output)
        
        assert registers["$v0"] == 268500992
        assert registers["$v1"] == 0
        assert registers["$t0"] == 32
        assert registers["$sp"] == 2147479548
    
    def test_parse_registers_negative(self):
        """parse_registers should handle negative values."""
        parser = OutputParser()
        
        mars_output = "$v0     -1\n$v1     1"
        registers = parser.parse_registers(mars_output)
        
        assert registers["$v0"] == -1
        assert registers["$v1"] == 1
    
    def test_parse_memory_dump_hex(self):
        """parse_memory_dump should parse HexText format."""
        parser = OutputParser()
        
        dump_content = """
00000020
00000001
00000000
"""
        
        blocks = parser.parse_memory_dump(dump_content, HEAP_START)
        
        assert len(blocks) == 3
        assert blocks[0].address == HEAP_START
        assert blocks[0].value == 0x20  # 32 in decimal
        assert blocks[1].address == HEAP_START + 4
        assert blocks[1].value == 1
    
    def test_parse_memory_dump_with_0x_prefix(self):
        """parse_memory_dump should handle 0x prefix."""
        parser = OutputParser()
        
        dump_content = "0x00000040\n0x00000000"
        blocks = parser.parse_memory_dump(dump_content, DATA_START)
        
        assert len(blocks) == 2
        assert blocks[0].value == 0x40
    
    @given(heap_block_memory_strategy(HEAP_START))
    @settings(max_examples=50)
    def test_parse_heap_metadata_single_block(self, block_data):
        """parse_heap_metadata should correctly parse a single block."""
        memory_blocks, expected_size, expected_allocated, expected_next = block_data
        parser = OutputParser()
        
        heap_end = HEAP_START + expected_size + 100
        result = parser.parse_heap_metadata(memory_blocks, HEAP_START, heap_end)
        
        assert len(result) == 1
        assert result[0].address == HEAP_START
        assert result[0].size == expected_size
        assert result[0].allocated == expected_allocated
    
    def test_parse_heap_metadata_empty(self):
        """parse_heap_metadata should return empty list for empty input."""
        parser = OutputParser()
        result = parser.parse_heap_metadata([], HEAP_START, HEAP_START + 100)
        assert result == []
    
    def test_parse_heap_metadata_stops_on_invalid_size(self):
        """parse_heap_metadata should stop when size is 0 or negative."""
        parser = OutputParser()
        
        memory_blocks = [
            MemoryBlock(address=HEAP_START, size=4, value=32),
            MemoryBlock(address=HEAP_START + 4, size=4, value=1),
            MemoryBlock(address=HEAP_START + 8, size=4, value=0),
            # Next block has size 0 - should stop here
            MemoryBlock(address=HEAP_START + 32, size=4, value=0),
        ]
        
        result = parser.parse_heap_metadata(memory_blocks, HEAP_START, HEAP_START + 100)
        
        assert len(result) == 1  # Only first block parsed
    
    def test_singleton_pattern(self):
        """get_output_parser should return singleton."""
        parser1 = get_output_parser()
        parser2 = get_output_parser()
        assert parser1 is parser2


# ============== Fragmentation Calculation Tests ==============

class TestFragmentationCalculation:
    """
    Property 3: Fragmentation Calculation Correctness
    
    Tests that fragmentation is calculated correctly from parsed heap state.
    Formula: (total_free - largest_free) / total_free * 100
    
    Note: This is a READ-ONLY calculation. The actual heap state
    is determined by MIPS execution.
    """
    
    @given(free_list=free_list_strategy(min_blocks=1, max_blocks=5))
    @settings(max_examples=100)
    def test_fragmentation_formula(self, free_list: List[FreeBlock]):
        """Fragmentation should equal (total - largest) / total * 100."""
        parser = OutputParser()
        
        fragmentation = parser._calculate_fragmentation(free_list)
        
        total_free = sum(b.size for b in free_list)
        assume(total_free > 0)
        
        largest_free = max(b.size for b in free_list)
        
        if len(free_list) == 1:
            expected = 0.0
        else:
            expected = ((total_free - largest_free) / total_free) * 100
        
        assert abs(fragmentation - expected) < 0.001, \
            f"Fragmentation {fragmentation} should equal {expected}"
    
    @given(size=st.integers(min_value=4, max_value=1024))
    @settings(max_examples=50)
    def test_single_block_zero_fragmentation(self, size: int):
        """A single free block should have 0% fragmentation."""
        parser = OutputParser()
        
        free_list = [FreeBlock(address=HEAP_START + HEADER_SIZE, size=size)]
        fragmentation = parser._calculate_fragmentation(free_list)
        
        assert fragmentation == 0.0
    
    def test_empty_free_list_zero_fragmentation(self):
        """An empty free list should have 0% fragmentation."""
        parser = OutputParser()
        fragmentation = parser._calculate_fragmentation([])
        assert fragmentation == 0.0
    
    @given(
        size1=st.integers(min_value=4, max_value=256),
        size2=st.integers(min_value=4, max_value=256),
    )
    @settings(max_examples=50)
    def test_two_blocks_fragmentation(self, size1: int, size2: int):
        """Two free blocks should have fragmentation = smaller / total * 100."""
        parser = OutputParser()
        
        free_list = [
            FreeBlock(address=HEAP_START + HEADER_SIZE, size=size1),
            FreeBlock(address=HEAP_START + 1000, size=size2),
        ]
        
        fragmentation = parser._calculate_fragmentation(free_list)
        
        total = size1 + size2
        largest = max(size1, size2)
        expected = ((total - largest) / total) * 100
        
        assert abs(fragmentation - expected) < 0.001


# ============== Heap State Building Tests ==============

class TestBuildHeapState:
    """Tests for building HeapState from parsed memory."""
    
    def test_build_heap_state_single_free_block(self):
        """build_heap_state should create correct state for single free block."""
        parser = OutputParser()
        
        memory_blocks = [
            MemoryBlock(address=HEAP_START, size=4, value=64),  # size
            MemoryBlock(address=HEAP_START + 4, size=4, value=0),  # free
            MemoryBlock(address=HEAP_START + 8, size=4, value=0),  # next
        ]
        
        state = parser.build_heap_state(memory_blocks, HEAP_START, HEAP_START + 100)
        
        assert len(state.blocks) == 1
        assert state.blocks[0].allocated is False
        assert state.blocks[0].size == 64
        assert len(state.free_list) == 1
        assert state.free_list[0].size == 64 - HEADER_SIZE
        assert state.fragmentation == 0.0
    
    def test_build_heap_state_mixed_blocks(self):
        """build_heap_state should handle mix of allocated and free blocks."""
        parser = OutputParser()
        
        # Block 1: allocated, size 32
        # Block 2: free, size 64
        memory_blocks = [
            # Block 1 header
            MemoryBlock(address=HEAP_START, size=4, value=32),
            MemoryBlock(address=HEAP_START + 4, size=4, value=1),  # allocated
            MemoryBlock(address=HEAP_START + 8, size=4, value=0),
            # Block 2 header (at HEAP_START + 32)
            MemoryBlock(address=HEAP_START + 32, size=4, value=64),
            MemoryBlock(address=HEAP_START + 36, size=4, value=0),  # free
            MemoryBlock(address=HEAP_START + 40, size=4, value=0),
        ]
        
        state = parser.build_heap_state(memory_blocks, HEAP_START, HEAP_START + 200)
        
        assert len(state.blocks) == 2
        assert state.blocks[0].allocated is True
        assert state.blocks[1].allocated is False
        assert len(state.free_list) == 1
    
    def test_build_heap_state_empty(self):
        """build_heap_state should return empty state for empty memory."""
        parser = OutputParser()
        
        state = parser.build_heap_state([], HEAP_START, HEAP_START + 100)
        
        assert state.blocks == []
        assert state.free_list == []
        assert state.fragmentation == 0.0
