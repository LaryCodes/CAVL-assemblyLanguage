"""
Property-based tests for state manager.
Feature: cavl-v1
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from copy import deepcopy

from app.services.state_manager import StateManager, get_state_manager
from app.models.schemas import (
    ExecutionState,
    RegisterState,
    MemoryState,
    MemorySegment,
    MemoryBlock,
    HeapState,
    HeapBlock,
    FreeBlock,
    MIPS_REGISTERS,
)


# ============== Strategies ==============

@st.composite
def register_state_strategy(draw):
    """Generate a valid RegisterState with all 32 MIPS registers."""
    values = {}
    for reg in MIPS_REGISTERS:
        if reg == "$zero":
            values[reg] = 0
        else:
            values[reg] = draw(st.integers(min_value=0, max_value=(2**31) - 1))
    return RegisterState(values=values)


@st.composite
def memory_block_strategy(draw, base_address):
    """Generate a valid memory block at a given base address."""
    return MemoryBlock(
        address=base_address,
        size=4,
        value=draw(st.integers(min_value=0, max_value=0xFFFFFFFF)),
    )


@st.composite
def memory_segment_strategy(draw, start_addr, end_addr):
    """Generate a valid memory segment."""
    num_blocks = draw(st.integers(min_value=0, max_value=5))
    blocks = []
    for i in range(num_blocks):
        addr = start_addr + (i * 4)
        if addr < end_addr:
            blocks.append(MemoryBlock(
                address=addr,
                size=4,
                value=draw(st.integers(min_value=0, max_value=0xFFFFFFFF)),
            ))
    return MemorySegment(
        start_address=start_addr,
        end_address=end_addr,
        blocks=blocks,
    )


@st.composite
def memory_state_strategy(draw):
    """Generate a valid MemoryState with all four segments."""
    return MemoryState(
        text=draw(memory_segment_strategy(0x00400000, 0x00410000)),
        data=draw(memory_segment_strategy(0x10010000, 0x10020000)),
        heap=draw(memory_segment_strategy(0x10040000, 0x10050000)),
        stack=draw(memory_segment_strategy(0x7FFEF000, 0x7FFFEFFC)),
    )


@st.composite
def heap_state_strategy(draw):
    """Generate a valid HeapState."""
    num_blocks = draw(st.integers(min_value=0, max_value=3))
    blocks = []
    free_list = []
    base_addr = 0x10040000
    
    for i in range(num_blocks):
        size = draw(st.integers(min_value=4, max_value=64)) * 4  # Word-aligned
        allocated = draw(st.booleans())
        block = HeapBlock(
            address=base_addr + (i * 256),
            size=size,
            allocated=allocated,
        )
        blocks.append(block)
        if not allocated:
            free_list.append(FreeBlock(address=block.address, size=block.size))
    
    # Calculate fragmentation
    total_free = sum(b.size for b in free_list)
    largest_free = max((b.size for b in free_list), default=0)
    fragmentation = 0.0
    if total_free > 0 and len(free_list) > 1:
        fragmentation = ((total_free - largest_free) / total_free) * 100
    
    return HeapState(
        blocks=blocks,
        free_list=free_list,
        fragmentation=fragmentation,
    )


@st.composite
def execution_state_strategy(draw):
    """Generate a valid ExecutionState."""
    return ExecutionState(
        pc=draw(st.integers(min_value=0x00400000, max_value=0x00410000)) & ~3,
        current_instruction=draw(st.text(min_size=0, max_size=50, alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')))),
        registers=draw(register_state_strategy()),
        changed_registers=draw(st.lists(
            st.sampled_from([r for r in MIPS_REGISTERS if r != "$zero"]),
            min_size=0,
            max_size=5,
            unique=True,
        )),
        memory=draw(memory_state_strategy()),
        heap=draw(heap_state_strategy()),
        is_complete=draw(st.booleans()),
    )


@st.composite
def execution_trace_strategy(draw, min_size=1, max_size=10):
    """Generate a list of ExecutionStates representing a trace."""
    size = draw(st.integers(min_value=min_size, max_value=max_size))
    states = []
    for i in range(size):
        state = draw(execution_state_strategy())
        # Mark last state as complete
        if i == size - 1:
            state = ExecutionState(
                pc=state.pc,
                current_instruction=state.current_instruction,
                registers=state.registers,
                changed_registers=state.changed_registers,
                memory=state.memory,
                heap=state.heap,
                is_complete=True,
            )
        states.append(state)
    return states


@st.composite
def sequential_pc_trace_strategy(draw, min_size=2, max_size=10):
    """
    Generate a trace with sequential PC values (simulating real execution).
    Each state has PC = base + (index * 4), simulating sequential instruction execution.
    """
    size = draw(st.integers(min_value=min_size, max_value=max_size))
    base_pc = 0x00400000
    states = []
    
    for i in range(size):
        pc = base_pc + (i * 4)  # Each instruction is 4 bytes
        instruction = draw(st.sampled_from([
            f"addi $t{i % 10}, $zero, {i}",
            f"add $t{i % 10}, $t{(i+1) % 10}, $t{(i+2) % 10}",
            f"lw $t{i % 10}, 0($sp)",
            f"sw $t{i % 10}, 0($sp)",
            "nop",
        ]))
        
        state = ExecutionState(
            pc=pc,
            current_instruction=instruction,
            registers=draw(register_state_strategy()),
            changed_registers=[],
            memory=draw(memory_state_strategy()),
            heap=draw(heap_state_strategy()),
            is_complete=(i == size - 1),
        )
        states.append(state)
    
    return states


@st.composite
def trace_with_register_changes_strategy(draw, min_size=2, max_size=5):
    """
    Generate a trace where register values change between states.
    This allows testing register change detection.
    """
    size = draw(st.integers(min_value=min_size, max_value=max_size))
    base_pc = 0x00400000
    states = []
    
    # Generate initial register values
    prev_registers = {}
    for reg in MIPS_REGISTERS:
        if reg == "$zero":
            prev_registers[reg] = 0
        else:
            prev_registers[reg] = draw(st.integers(min_value=0, max_value=(2**31) - 1))
    
    for i in range(size):
        pc = base_pc + (i * 4)
        
        # Copy previous registers
        curr_registers = prev_registers.copy()
        
        # Randomly change some registers (not $zero)
        changeable_regs = [r for r in MIPS_REGISTERS if r != "$zero"]
        num_changes = draw(st.integers(min_value=0, max_value=3))
        regs_to_change = draw(st.lists(
            st.sampled_from(changeable_regs),
            min_size=num_changes,
            max_size=num_changes,
            unique=True,
        ))
        
        for reg in regs_to_change:
            # Change to a different value
            new_val = draw(st.integers(min_value=0, max_value=(2**31) - 1))
            # Ensure it's actually different
            while new_val == curr_registers[reg]:
                new_val = draw(st.integers(min_value=0, max_value=(2**31) - 1))
            curr_registers[reg] = new_val
        
        state = ExecutionState(
            pc=pc,
            current_instruction=f"instruction_{i}",
            registers=RegisterState(values=curr_registers.copy()),
            changed_registers=[],  # Will be computed by StateManager
            memory=draw(memory_state_strategy()),
            heap=draw(heap_state_strategy()),
            is_complete=(i == size - 1),
        )
        states.append(state)
        
        # Update prev_registers for next iteration
        prev_registers = curr_registers.copy()
    
    return states


# ============== Property Tests ==============

class TestStepExecutionAdvancesPC:
    """
    Property 4: Step Execution Advances PC
    
    *For any* non-terminated program state, executing a single step SHALL advance 
    the PC to the next instruction address, and the returned state SHALL contain 
    the correct PC value and instruction text.
    
    **Validates: Requirements 4.1, 4.2, 4.3**
    """

    @given(trace=sequential_pc_trace_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_step_advances_to_next_state_pc(self, trace):
        """
        Feature: cavl-v1, Property 4: Step Execution Advances PC
        
        For any non-terminated trace, stepping should advance to the next state's PC.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Get initial state
        initial_state = manager.get_current_state()
        assume(not initial_state.is_complete)  # Skip if already complete
        
        # Step
        new_state = manager.step()
        
        # Verify PC advanced to next state's PC
        expected_pc = trace[1].pc
        assert new_state.pc == expected_pc, \
            f"PC not advanced correctly: expected {hex(expected_pc)}, got {hex(new_state.pc)}"

    @given(trace=sequential_pc_trace_strategy(min_size=3, max_size=10))
    @settings(max_examples=100)
    def test_step_returns_correct_instruction_text(self, trace):
        """
        Feature: cavl-v1, Property 4: Step Execution Advances PC
        
        For any step, the returned state should contain the correct instruction text.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Step once
        new_state = manager.step()
        
        # Verify instruction text matches the trace
        expected_instruction = trace[1].current_instruction
        assert new_state.current_instruction == expected_instruction, \
            f"Instruction mismatch: expected '{expected_instruction}', got '{new_state.current_instruction}'"

    @given(trace=sequential_pc_trace_strategy(min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_multiple_steps_advance_pc_sequentially(self, trace):
        """
        Feature: cavl-v1, Property 4: Step Execution Advances PC
        
        For any trace, multiple steps should advance PC through each state sequentially.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Step through all states and verify PC at each step
        for i in range(len(trace) - 1):
            state = manager.step()
            expected_pc = trace[i + 1].pc
            assert state.pc == expected_pc, \
                f"Step {i+1}: PC mismatch - expected {hex(expected_pc)}, got {hex(state.pc)}"

    @given(trace=sequential_pc_trace_strategy(min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_step_at_end_returns_complete_state(self, trace):
        """
        Feature: cavl-v1, Property 4: Step Execution Advances PC
        
        For any trace, stepping at the end should return a state with is_complete=True.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Step to the end
        for _ in range(len(trace)):
            state = manager.step()
        
        # Verify is_complete
        assert state.is_complete, "Final state should have is_complete=True"


class TestRegisterChangeDetection:
    """
    Property 5: Register Change Detection
    
    *For any* step execution, the `changedRegisters` list SHALL contain exactly 
    the registers whose values differ between the previous and current state.
    
    **Validates: Requirements 4.4**
    """

    @given(trace=trace_with_register_changes_strategy(min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_changed_registers_contains_exactly_changed_values(self, trace):
        """
        Feature: cavl-v1, Property 5: Register Change Detection
        
        For any step, changedRegisters should contain exactly the registers
        whose values differ between previous and current state.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Step and check changed registers
        prev_state = manager.get_current_state()
        new_state = manager.step()
        
        # Compute expected changed registers
        expected_changed = set()
        for reg in MIPS_REGISTERS:
            if reg == "$zero":
                continue  # $zero never changes
            prev_val = prev_state.registers.values.get(reg, 0)
            curr_val = new_state.registers.values.get(reg, 0)
            if prev_val != curr_val:
                expected_changed.add(reg)
        
        actual_changed = set(new_state.changed_registers)
        
        assert actual_changed == expected_changed, \
            f"Changed registers mismatch: expected {expected_changed}, got {actual_changed}"

    @given(trace=trace_with_register_changes_strategy(min_size=3, max_size=5))
    @settings(max_examples=100)
    def test_zero_register_never_in_changed_list(self, trace):
        """
        Feature: cavl-v1, Property 5: Register Change Detection
        
        For any step, $zero should never appear in changedRegisters.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Step through all states
        for _ in range(len(trace) - 1):
            state = manager.step()
            assert "$zero" not in state.changed_registers, \
                "$zero should never appear in changedRegisters"

    @given(trace=trace_with_register_changes_strategy(min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_unchanged_registers_not_in_changed_list(self, trace):
        """
        Feature: cavl-v1, Property 5: Register Change Detection
        
        For any step, registers with unchanged values should not appear in changedRegisters.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        prev_state = manager.get_current_state()
        new_state = manager.step()
        
        # Check that unchanged registers are not in the list
        for reg in MIPS_REGISTERS:
            if reg == "$zero":
                continue
            prev_val = prev_state.registers.values.get(reg, 0)
            curr_val = new_state.registers.values.get(reg, 0)
            if prev_val == curr_val:
                assert reg not in new_state.changed_registers, \
                    f"Unchanged register {reg} should not be in changedRegisters"

    @given(trace=trace_with_register_changes_strategy(min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_all_changed_registers_actually_changed(self, trace):
        """
        Feature: cavl-v1, Property 5: Register Change Detection
        
        For any step, all registers in changedRegisters should have actually changed.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        prev_state = manager.get_current_state()
        new_state = manager.step()
        
        # Verify each register in changedRegisters actually changed
        for reg in new_state.changed_registers:
            prev_val = prev_state.registers.values.get(reg, 0)
            curr_val = new_state.registers.values.get(reg, 0)
            assert prev_val != curr_val, \
                f"Register {reg} in changedRegisters but value didn't change: {prev_val} -> {curr_val}"


class TestResetRestoresInitialState:
    """
    Property 6: Reset Restores Initial State
    
    *For any* execution sequence, calling reset SHALL restore the program state 
    (PC, registers, memory) to be identical to the initial state after loading.
    
    **Validates: Requirements 4.6**
    """

    @given(trace=execution_trace_strategy(min_size=2, max_size=10))
    @settings(max_examples=100)
    def test_reset_restores_initial_state(self, trace):
        """
        Feature: cavl-v1, Property 6: Reset Restores Initial State
        
        For any execution trace, after stepping through and resetting,
        the state should be identical to the initial state.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Capture initial state
        initial_state = manager.get_current_state()
        initial_pc = initial_state.pc
        initial_registers = deepcopy(initial_state.registers.values)
        initial_memory_text = deepcopy(initial_state.memory.text)
        initial_memory_data = deepcopy(initial_state.memory.data)
        initial_memory_heap = deepcopy(initial_state.memory.heap)
        initial_memory_stack = deepcopy(initial_state.memory.stack)
        
        # Step through some states
        num_steps = len(trace) // 2 + 1
        for _ in range(num_steps):
            manager.step()
        
        # Reset
        reset_state = manager.reset()
        
        # Verify PC restored
        assert reset_state.pc == initial_pc, \
            f"PC not restored: expected {initial_pc}, got {reset_state.pc}"
        
        # Verify registers restored
        for reg in MIPS_REGISTERS:
            assert reset_state.registers.values[reg] == initial_registers[reg], \
                f"Register {reg} not restored: expected {initial_registers[reg]}, got {reset_state.registers.values[reg]}"
        
        # Verify memory segments restored
        assert reset_state.memory.text.start_address == initial_memory_text.start_address
        assert reset_state.memory.text.end_address == initial_memory_text.end_address
        assert len(reset_state.memory.text.blocks) == len(initial_memory_text.blocks)
        
        assert reset_state.memory.data.start_address == initial_memory_data.start_address
        assert reset_state.memory.heap.start_address == initial_memory_heap.start_address
        assert reset_state.memory.stack.start_address == initial_memory_stack.start_address

    @given(trace=execution_trace_strategy(min_size=1, max_size=5))
    @settings(max_examples=100)
    def test_reset_returns_to_index_zero(self, trace):
        """
        Feature: cavl-v1, Property 6: Reset Restores Initial State
        
        For any trace, reset should return the step index to 0.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # Step forward
        for _ in range(len(trace)):
            manager.step()
        
        # Reset
        manager.reset()
        
        # Verify index is 0
        assert manager.get_step_index() == 0, \
            f"Step index not reset: expected 0, got {manager.get_step_index()}"

    @given(trace=execution_trace_strategy(min_size=2, max_size=5))
    @settings(max_examples=100)
    def test_multiple_resets_produce_same_state(self, trace):
        """
        Feature: cavl-v1, Property 6: Reset Restores Initial State
        
        For any trace, multiple resets should always produce the same initial state.
        """
        manager = StateManager()
        manager.load_trace(trace)
        
        # First reset after stepping
        manager.step()
        manager.step()
        first_reset = manager.reset()
        first_pc = first_reset.pc
        first_registers = deepcopy(first_reset.registers.values)
        
        # Step again and reset
        manager.step()
        second_reset = manager.reset()
        
        # Verify same state
        assert second_reset.pc == first_pc
        for reg in MIPS_REGISTERS:
            assert second_reset.registers.values[reg] == first_registers[reg]


class TestStateManagerUnit:
    """Unit tests for StateManager."""

    def test_load_trace_sets_initial_state(self):
        """Loading a trace should set the initial state."""
        manager = StateManager()
        
        state = ExecutionState(
            pc=0x00400000,
            current_instruction="addi $t0, $zero, 5",
            registers=RegisterState.create_initial(),
            changed_registers=[],
            memory=MemoryState(
                text=MemorySegment(start_address=0x00400000, end_address=0x00400004, blocks=[]),
                data=MemorySegment(start_address=0x10010000, end_address=0x10010000, blocks=[]),
                heap=MemorySegment(start_address=0x10040000, end_address=0x10040000, blocks=[]),
                stack=MemorySegment(start_address=0x7FFEF000, end_address=0x7FFFEFFC, blocks=[]),
            ),
            heap=HeapState(blocks=[], free_list=[], fragmentation=0.0),
            is_complete=False,
        )
        
        manager.load_trace([state])
        
        assert manager.has_trace()
        assert manager.get_current_state() == state
        assert manager.get_step_index() == 0

    def test_step_advances_index(self):
        """Step should advance to the next state."""
        manager = StateManager()
        
        states = [
            ExecutionState(
                pc=0x00400000 + (i * 4),
                current_instruction=f"instruction_{i}",
                registers=RegisterState.create_initial(),
                changed_registers=[],
                memory=MemoryState(
                    text=MemorySegment(start_address=0x00400000, end_address=0x00400004, blocks=[]),
                    data=MemorySegment(start_address=0x10010000, end_address=0x10010000, blocks=[]),
                    heap=MemorySegment(start_address=0x10040000, end_address=0x10040000, blocks=[]),
                    stack=MemorySegment(start_address=0x7FFEF000, end_address=0x7FFFEFFC, blocks=[]),
                ),
                heap=HeapState(blocks=[], free_list=[], fragmentation=0.0),
                is_complete=(i == 2),
            )
            for i in range(3)
        ]
        
        manager.load_trace(states)
        
        assert manager.get_step_index() == 0
        manager.step()
        assert manager.get_step_index() == 1
        manager.step()
        assert manager.get_step_index() == 2

    def test_step_at_end_stays_at_end(self):
        """Step at the end should stay at the last state."""
        manager = StateManager()
        
        state = ExecutionState(
            pc=0x00400000,
            current_instruction="syscall",
            registers=RegisterState.create_initial(),
            changed_registers=[],
            memory=MemoryState(
                text=MemorySegment(start_address=0x00400000, end_address=0x00400004, blocks=[]),
                data=MemorySegment(start_address=0x10010000, end_address=0x10010000, blocks=[]),
                heap=MemorySegment(start_address=0x10040000, end_address=0x10040000, blocks=[]),
                stack=MemorySegment(start_address=0x7FFEF000, end_address=0x7FFFEFFC, blocks=[]),
            ),
            heap=HeapState(blocks=[], free_list=[], fragmentation=0.0),
            is_complete=True,
        )
        
        manager.load_trace([state])
        
        manager.step()
        assert manager.get_step_index() == 0
        assert manager.is_complete()

    def test_clear_removes_all_state(self):
        """Clear should remove all state data."""
        manager = StateManager()
        
        state = ExecutionState(
            pc=0x00400000,
            current_instruction="nop",
            registers=RegisterState.create_initial(),
            changed_registers=[],
            memory=MemoryState(
                text=MemorySegment(start_address=0x00400000, end_address=0x00400004, blocks=[]),
                data=MemorySegment(start_address=0x10010000, end_address=0x10010000, blocks=[]),
                heap=MemorySegment(start_address=0x10040000, end_address=0x10040000, blocks=[]),
                stack=MemorySegment(start_address=0x7FFEF000, end_address=0x7FFFEFFC, blocks=[]),
            ),
            heap=HeapState(blocks=[], free_list=[], fragmentation=0.0),
            is_complete=False,
        )
        
        manager.load_trace([state])
        manager.clear()
        
        assert not manager.has_trace()
        assert manager.get_current_state() is None

    def test_load_empty_trace_raises_error(self):
        """Loading an empty trace should raise ValueError."""
        manager = StateManager()
        
        with pytest.raises(ValueError, match="Cannot load empty trace"):
            manager.load_trace([])

    def test_singleton_pattern(self):
        """Test singleton pattern for get_state_manager."""
        manager1 = get_state_manager()
        manager2 = get_state_manager()
        assert manager1 is manager2
