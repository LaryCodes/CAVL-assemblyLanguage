"""
Property-based tests for trace parser.
Feature: cavl-v1
"""

import pytest
from hypothesis import given, strategies as st, settings, assume

from app.services.trace_parser import TraceParser, get_trace_parser
from app.models.schemas import (
    RegisterState,
    MemoryBlock,
    MIPS_REGISTERS,
)


# ============== Strategies ==============

@st.composite
def register_values_strategy(draw):
    """Generate valid register values (32-bit signed integers)."""
    values = {}
    for reg in MIPS_REGISTERS:
        if reg == "$zero":
            values[reg] = 0
        else:
            values[reg] = draw(st.integers(min_value=-(2**31), max_value=(2**31) - 1))
    return values


@st.composite
def mars_register_output_strategy(draw):
    """Generate MARS-style register output."""
    lines = []
    values = {}
    for reg in MIPS_REGISTERS:
        if reg == "$zero":
            value = 0
        else:
            value = draw(st.integers(min_value=0, max_value=(2**31) - 1))
        values[reg] = value
        lines.append(f"{reg}\t{value}")
    return '\n'.join(lines), values


@st.composite
def memory_block_strategy(draw):
    """Generate a valid memory block."""
    address = draw(st.integers(min_value=0, max_value=0x7FFFFFFF)) & ~3  # Word-aligned
    value = draw(st.integers(min_value=0, max_value=0xFFFFFFFF))
    return MemoryBlock(address=address, size=4, value=value)


@st.composite
def memory_blocks_strategy(draw, min_size=1, max_size=10):
    """Generate a list of memory blocks with sequential addresses."""
    start_address = draw(st.integers(min_value=0x10010000, max_value=0x10020000)) & ~3
    count = draw(st.integers(min_value=min_size, max_value=max_size))
    blocks = []
    for i in range(count):
        value = draw(st.integers(min_value=0, max_value=0xFFFFFFFF))
        blocks.append(MemoryBlock(
            address=start_address + (i * 4),
            size=4,
            value=value,
        ))
    return blocks


# ============== Property Tests ==============

class TestTraceParsingRoundTrip:
    """
    Property 9: MARS Trace Parsing Round-Trip
    
    *For any* valid MARS execution output, parsing the trace into structured data 
    and serializing back SHALL preserve all register values and memory addresses.
    
    **Validates: Requirements 2.2, 2.3**
    """

    @given(data=mars_register_output_strategy())
    @settings(max_examples=100)
    def test_register_parsing_preserves_values(self, data):
        """
        Feature: cavl-v1, Property 9: MARS Trace Parsing Round-Trip
        
        For any MARS register output, parsing should preserve all register values.
        """
        output, expected_values = data
        parser = TraceParser()
        
        parsed = parser.parse_register_dump(output)
        
        for reg, expected_val in expected_values.items():
            assert reg in parsed, f"Register {reg} not found in parsed output"
            assert parsed[reg] == expected_val, f"Register {reg}: expected {expected_val}, got {parsed[reg]}"


    @given(blocks=memory_blocks_strategy())
    @settings(max_examples=100)
    def test_memory_serialization_round_trip(self, blocks):
        """
        Feature: cavl-v1, Property 9: MARS Trace Parsing Round-Trip
        
        For any memory blocks, serializing and parsing should preserve addresses and values.
        """
        parser = TraceParser()
        
        # Serialize to MARS format
        serialized = parser.serialize_memory_blocks(blocks)
        
        # Parse back
        start_address = blocks[0].address if blocks else 0x10010000
        parsed_blocks = parser.parse_memory_dump(serialized, start_address)
        
        # Verify values preserved
        assert len(parsed_blocks) == len(blocks)
        for orig, parsed in zip(blocks, parsed_blocks):
            assert parsed.value == orig.value, f"Value mismatch at {orig.address}"
            assert parsed.address == orig.address, f"Address mismatch"

    @given(values=register_values_strategy())
    @settings(max_examples=100)
    def test_register_state_creation_preserves_values(self, values):
        """
        Feature: cavl-v1, Property 9: MARS Trace Parsing Round-Trip
        
        For any register values, creating RegisterState should preserve all values.
        """
        parser = TraceParser()
        
        state = parser.create_register_state(values)
        
        for reg in MIPS_REGISTERS:
            if reg == "$zero":
                assert state.values[reg] == 0
            else:
                assert state.values[reg] == values.get(reg, 0)

    @given(values=register_values_strategy())
    @settings(max_examples=100)
    def test_register_serialization_round_trip(self, values):
        """
        Feature: cavl-v1, Property 9: MARS Trace Parsing Round-Trip
        
        For any register state, serializing and parsing should preserve values.
        """
        parser = TraceParser()
        
        # Create state
        state = parser.create_register_state(values)
        
        # Serialize
        serialized = parser.serialize_registers(state)
        
        # Parse back
        parsed = parser.parse_register_dump(serialized)
        
        # Verify all values preserved
        for reg in MIPS_REGISTERS:
            expected = 0 if reg == "$zero" else values.get(reg, 0)
            assert parsed.get(reg, 0) == expected, f"Register {reg} mismatch"


class TestTraceParserUnit:
    """Unit tests for TraceParser."""

    def test_parse_mars_register_output(self):
        """Parse actual MARS register output format."""
        output = """$t0\t42
$t1\t10
$t2\t52
$v0\t10
$sp\t2147479548"""
        
        parser = TraceParser()
        result = parser.parse_register_dump(output)
        
        assert result["$t0"] == 42
        assert result["$t1"] == 10
        assert result["$t2"] == 52
        assert result["$v0"] == 10
        assert result["$sp"] == 2147479548

    def test_parse_memory_hex_dump(self):
        """Parse MARS HexText memory dump format."""
        output = """0x00000001
0x00000002
0x00000003"""
        
        parser = TraceParser()
        blocks = parser.parse_memory_dump(output, start_address=0x10010000)
        
        assert len(blocks) == 3
        assert blocks[0].address == 0x10010000
        assert blocks[0].value == 1
        assert blocks[1].address == 0x10010004
        assert blocks[1].value == 2
        assert blocks[2].address == 0x10010008
        assert blocks[2].value == 3

    def test_detect_changed_registers(self):
        """Detect register changes between states."""
        parser = TraceParser()
        
        prev = {"$t0": 0, "$t1": 10, "$zero": 0}
        curr = {"$t0": 42, "$t1": 10, "$zero": 0}
        
        changed = parser.detect_changed_registers(prev, curr)
        
        assert "$t0" in changed
        assert "$t1" not in changed
        assert "$zero" not in changed

    def test_singleton_parser(self):
        """Test singleton pattern."""
        parser1 = get_trace_parser()
        parser2 = get_trace_parser()
        assert parser1 is parser2
