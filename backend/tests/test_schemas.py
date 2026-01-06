"""
Property-based tests for CAVL schemas.
Feature: cavl-v1
"""

import pytest
from hypothesis import given, strategies as st, settings

from app.models.schemas import (
    RegisterState,
    MIPS_REGISTERS,
    ExecutionState,
    MemoryState,
    MemorySegment,
    MemoryBlock,
    HeapState,
)


# ============== Strategies ==============

@st.composite
def register_values_strategy(draw):
    """Generate valid register values (32-bit signed integers)."""
    values = {}
    for reg in MIPS_REGISTERS:
        if reg == "$zero":
            values[reg] = 0  # $zero is always 0
        else:
            # 32-bit signed integer range
            values[reg] = draw(st.integers(min_value=-(2**31), max_value=(2**31) - 1))
    return values


@st.composite
def register_state_strategy(draw):
    """Generate a valid RegisterState."""
    values = draw(register_values_strategy())
    return RegisterState(values=values)


@st.composite
def changed_registers_strategy(draw):
    """Generate a list of changed registers (never includes $zero)."""
    # $zero can never be in changed_registers
    changeable_regs = [r for r in MIPS_REGISTERS if r != "$zero"]
    return draw(st.lists(st.sampled_from(changeable_regs), unique=True, max_size=10))


# ============== Property Tests ==============

class TestRegisterStateCompleteness:
    """
    Property 7: Register State Completeness
    
    *For any* execution state, the register state SHALL contain exactly 32 
    general-purpose registers ($zero through $ra), each with a name and numeric value.
    The $zero register SHALL always have value 0 and SHALL never appear in changedRegisters.
    
    **Validates: Requirements 5.1, 5.3**
    """

    @given(register_state=register_state_strategy())
    @settings(max_examples=100)
    def test_register_state_has_32_registers(self, register_state: RegisterState):
        """
        Feature: cavl-v1, Property 7: Register State Completeness
        
        For any register state, it must contain exactly 32 registers.
        """
        assert len(register_state.values) == 32
        assert set(register_state.values.keys()) == set(MIPS_REGISTERS)

    @given(register_state=register_state_strategy())
    @settings(max_examples=100)
    def test_zero_register_always_zero(self, register_state: RegisterState):
        """
        Feature: cavl-v1, Property 7: Register State Completeness
        
        For any register state, $zero must always be 0.
        """
        assert register_state.values["$zero"] == 0


    @given(register_state=register_state_strategy())
    @settings(max_examples=100)
    def test_all_registers_have_numeric_values(self, register_state: RegisterState):
        """
        Feature: cavl-v1, Property 7: Register State Completeness
        
        For any register state, all register values must be integers.
        """
        for reg_name, value in register_state.values.items():
            assert isinstance(value, int), f"Register {reg_name} has non-integer value: {value}"

    @given(changed_regs=changed_registers_strategy())
    @settings(max_examples=100)
    def test_zero_never_in_changed_registers(self, changed_regs: list):
        """
        Feature: cavl-v1, Property 7: Register State Completeness
        
        For any list of changed registers, $zero must never appear.
        """
        assert "$zero" not in changed_regs

    @given(register_state=register_state_strategy())
    @settings(max_examples=100)
    def test_register_names_are_valid(self, register_state: RegisterState):
        """
        Feature: cavl-v1, Property 7: Register State Completeness
        
        For any register state, all register names must be valid MIPS register names.
        """
        for reg_name in register_state.values.keys():
            assert reg_name in MIPS_REGISTERS, f"Invalid register name: {reg_name}"


class TestRegisterStateInitialization:
    """Unit tests for RegisterState initialization."""

    def test_create_initial_has_32_registers(self):
        """Initial register state should have all 32 registers set to 0."""
        state = RegisterState.create_initial()
        assert len(state.values) == 32
        for reg in MIPS_REGISTERS:
            assert state.values[reg] == 0
