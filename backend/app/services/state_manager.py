"""
State Manager Service.
Manages execution state between requests, supporting step-by-step replay.

Per the design document:
- Stores full execution trace as array of states
- /api/step advances an index through stored states
- Supports reset to initial state
"""

from __future__ import annotations

from copy import deepcopy

from app.models.schemas import MIPS_REGISTERS, ExecutionState


class StateManager:
    """
    Manages execution state for step-by-step replay.

    The State Manager maintains a single active execution session (V1).
    It stores the full trace as an array of states and advances through
    them on each step request.
    """

    def __init__(self):
        """Initialize empty state manager."""
        self._states: list[ExecutionState] = []
        self._current_index: int = 0
        self._initial_state: ExecutionState | None = None

    def load_trace(self, states: list[ExecutionState]) -> None:
        """
        Load a full execution trace.

        Args:
            states: List of ExecutionState objects representing the full trace
        """
        if not states:
            raise ValueError("Cannot load empty trace")

        self._states = states
        self._current_index = 0
        # Store deep copy of initial state for reset
        self._initial_state = deepcopy(states[0])

    def get_current_state(self) -> ExecutionState | None:
        """
        Get the current execution state.

        Returns:
            Current ExecutionState or None if no trace loaded
        """
        if not self._states:
            return None
        return self._states[self._current_index]

    def step(self) -> ExecutionState | None:
        """
        Advance to the next state in the trace.

        Returns:
            The new current state, or None if no trace loaded.
            If already at the end, returns the final state with is_complete=True.
            The returned state includes changed_registers populated with registers
            that differ from the previous state.
        """
        if not self._states:
            return None

        # Get previous state for change detection
        prev_state = self._states[self._current_index]

        # Advance index if not at end
        if self._current_index < len(self._states) - 1:
            self._current_index += 1

        current_state = self._states[self._current_index]

        # Detect changed registers between previous and current state
        changed_registers = self._detect_changed_registers(
            prev_state.registers.values, current_state.registers.values
        )

        # Update the current state with changed registers
        # Create a new state with updated changed_registers
        updated_state = ExecutionState(
            pc=current_state.pc,
            current_instruction=current_state.current_instruction,
            registers=current_state.registers,
            changed_registers=changed_registers,
            memory=current_state.memory,
            heap=current_state.heap,
            is_complete=current_state.is_complete,
        )

        return updated_state

    def _detect_changed_registers(
        self,
        prev_registers: dict[str, int],
        curr_registers: dict[str, int],
    ) -> list[str]:
        """
        Detect which registers changed between two states.

        Args:
            prev_registers: Previous register values
            curr_registers: Current register values

        Returns:
            List of register names that changed (never includes $zero)
        """
        changed: list[str] = []
        for reg in MIPS_REGISTERS:
            if reg == "$zero":
                continue  # $zero never changes
            prev_val = prev_registers.get(reg, 0)
            curr_val = curr_registers.get(reg, 0)
            if prev_val != curr_val:
                changed.append(reg)
        return changed

    def reset(self) -> ExecutionState | None:
        """
        Reset to the initial state.

        Returns:
            The initial state, or None if no trace loaded.
        """
        if not self._states or self._initial_state is None:
            return None

        self._current_index = 0
        # Restore initial state from snapshot
        self._states[0] = deepcopy(self._initial_state)
        return self._states[0]

    def get_step_index(self) -> int:
        """
        Get the current step index.

        Returns:
            Current index in the trace (0-based)
        """
        return self._current_index

    def get_total_steps(self) -> int:
        """
        Get the total number of steps in the trace.

        Returns:
            Total number of states in the trace
        """
        return len(self._states)

    def is_complete(self) -> bool:
        """
        Check if execution has reached the end.

        Returns:
            True if at the last state in the trace
        """
        if not self._states:
            return True
        return self._current_index >= len(self._states) - 1

    def has_trace(self) -> bool:
        """
        Check if a trace is loaded.

        Returns:
            True if a trace has been loaded
        """
        return len(self._states) > 0

    def clear(self) -> None:
        """Clear all state and trace data."""
        self._states = []
        self._current_index = 0
        self._initial_state = None


# Singleton instance for the application
_state_manager: StateManager | None = None


def get_state_manager() -> StateManager:
    """Get singleton StateManager instance."""
    global _state_manager
    if _state_manager is None:
        _state_manager = StateManager()
    return _state_manager
