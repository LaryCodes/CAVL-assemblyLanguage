"""
Step Execution Service.
Provides true step-by-step execution by running MARS with incremental step limits.

This service enables instruction-by-instruction stepping through MIPS code
by executing with MARS multiple times and capturing state at each step.

IMPORTANT: This provides REAL execution state from MARS, not simulated values.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ExecutionStep:
    """Single step in MIPS execution."""

    step_number: int
    pc: int
    pc_hex: str
    instruction: str
    instruction_hex: str
    registers: dict[str, int]
    changed_registers: list[str]
    description: str
    is_complete: bool = False


@dataclass
class StepExecutionState:
    """Complete state for step-by-step execution."""

    code: str
    steps: list[ExecutionStep] = field(default_factory=list)
    current_step: int = 0
    total_steps: int = 0
    is_loaded: bool = False
    error: str | None = None


class StepExecutor:
    """
    Executes MIPS code step-by-step using MARS.

    This service:
    1. Assembles the code to get instruction list
    2. Executes with MARS using step limits to capture state at each instruction
    3. Allows forward/backward navigation through execution history
    """

    # MIPS register names in order
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

    def __init__(self, mars_jar_path: str | None = None):
        """Initialize step executor."""
        if mars_jar_path:
            self.mars_jar: Path = Path(mars_jar_path)
        else:
            self.mars_jar = Path(__file__).parent.parent.parent / "mars.jar"

        if not self.mars_jar.exists():
            raise FileNotFoundError(f"MARS jar not found at: {self.mars_jar}")

        self._state: StepExecutionState | None = None
        self._temp_file: str | None = None

    def load_program(self, code: str, max_steps: int = 200) -> StepExecutionState:
        """
        Load and execute MIPS program, capturing state at each step.

        Args:
            code: MIPS assembly code
            max_steps: Maximum number of steps to execute (prevents infinite loops)

        Returns:
            StepExecutionState with all captured steps
        """
        self._state = StepExecutionState(code=code)

        # Write code to temp file
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".asm", delete=False, encoding="utf-8"
            ) as f:
                f.write(code)
                self._temp_file = f.name
        except Exception as e:
            self._state.error = f"Failed to write temp file: {e}"
            return self._state

        try:
            # First, get the list of instructions
            instructions = self._get_instruction_list()
            if not instructions:
                self._state.error = "No executable instructions found"
                return self._state

            # Capture initial state (before any execution)
            initial_regs = self._get_initial_registers()
            self._state.steps.append(
                ExecutionStep(
                    step_number=0,
                    pc=0x00400000,
                    pc_hex="0x00400000",
                    instruction="(Initial State)",
                    instruction_hex="0x00000000",
                    registers=initial_regs,
                    changed_registers=[],
                    description="Program loaded, ready to execute",
                    is_complete=False,
                )
            )

            # Execute step by step
            prev_regs = initial_regs.copy()
            step_num = 1

            while step_num <= min(len(instructions), max_steps):
                # Execute with step limit
                regs, success, output = self._execute_with_step_limit(step_num)

                if not success:
                    # Execution completed or error
                    break

                # Find changed registers
                changed = self._find_changed_registers(prev_regs, regs)

                # Get instruction info
                instr_idx = step_num - 1
                if instr_idx < len(instructions):
                    pc, instr_hex, instr_text = instructions[instr_idx]
                else:
                    pc = 0x00400000 + (step_num - 1) * 4
                    instr_hex = "0x00000000"
                    instr_text = "(unknown)"

                # Create step record
                step = ExecutionStep(
                    step_number=step_num,
                    pc=pc,
                    pc_hex=f"0x{pc:08X}",
                    instruction=instr_text,
                    instruction_hex=instr_hex,
                    registers=regs,
                    changed_registers=changed,
                    description=self._generate_description(instr_text, changed, regs),
                    is_complete=False,
                )
                self._state.steps.append(step)

                prev_regs = regs.copy()
                step_num += 1

                # Check if program completed (syscall 10)
                if "syscall" in instr_text.lower() and regs.get("$v0", 0) == 10:
                    step.is_complete = True
                    break

            # Mark last step as complete
            if self._state.steps:
                self._state.steps[-1].is_complete = True

            self._state.total_steps = len(self._state.steps)
            self._state.is_loaded = True
            self._state.current_step = 0

        except Exception as e:
            self._state.error = f"Execution error: {str(e)}"
        finally:
            # Clean up temp file
            if self._temp_file:
                try:
                    os.unlink(self._temp_file)
                except OSError:
                    pass
                self._temp_file = None

        return self._state

    def _get_instruction_list(self) -> list[tuple[int, str, str]]:
        """
        Get list of instructions from the program.

        Returns:
            List of (pc, hex, text) tuples
        """
        if not self._temp_file:
            return []

        try:
            # Use MARS to dump text segment
            dump_file = self._temp_file + ".text"
            cmd = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",
                "a",
                "dump",
                ".text",
                "HexText",
                dump_file,
                self._temp_file,
            ]

            subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5.0,
                cwd=str(self.mars_jar.parent),
            )

            instructions: list[tuple[int, str, str]] = []
            if os.path.exists(dump_file):
                with open(dump_file, "r") as f:
                    pc = 0x00400000
                    for line in f:
                        line = line.strip()
                        if line:
                            hex_val = f"0x{line.upper()}"
                            # Decode instruction (simplified)
                            instr_text = self._decode_instruction_simple(int(line, 16))
                            instructions.append((pc, hex_val, instr_text))
                            pc += 4
                os.unlink(dump_file)

            return instructions

        except Exception:
            return []

    def _execute_with_step_limit(self, steps: int) -> tuple[dict[str, int], bool, str]:
        """
        Execute program with a specific step limit.

        Args:
            steps: Number of instructions to execute

        Returns:
            Tuple of (registers, success, output)
        """
        if not self._temp_file:
            return {}, False, ""

        try:
            cmd = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",  # No copyright
                "dec",  # Decimal register values
                str(steps),  # Step limit
                self._temp_file,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5.0,
                cwd=str(self.mars_jar.parent),
            )

            # Parse register values from output
            registers = self._parse_register_dump(result.stdout)

            # Check if execution actually happened
            success = bool(registers) and "Error" not in result.stdout

            return registers, success, result.stdout

        except subprocess.TimeoutExpired:
            return {}, False, "Timeout"
        except Exception as e:
            return {}, False, str(e)

    def _parse_register_dump(self, output: str) -> dict[str, int]:
        """Parse register values from MARS output."""
        registers: dict[str, int] = {}
        pattern = re.compile(r"\$(\w+)\s+(-?\d+)")

        for line in output.split("\n"):
            match = pattern.search(line)
            if match:
                reg_name = f"${match.group(1)}"
                value = int(match.group(2))
                registers[reg_name] = value

        return registers

    def _get_initial_registers(self) -> dict[str, int]:
        """Get initial register values (all zeros except $sp, $gp)."""
        regs = {name: 0 for name in self.REGISTER_NAMES}
        regs["$sp"] = 0x7FFFEFFC  # Default stack pointer
        regs["$gp"] = 0x10008000  # Default global pointer
        return regs

    def _find_changed_registers(
        self, prev: dict[str, int], curr: dict[str, int]
    ) -> list[str]:
        """Find which registers changed between steps."""
        changed = []
        for name in self.REGISTER_NAMES:
            prev_val = prev.get(name, 0)
            curr_val = curr.get(name, 0)
            if prev_val != curr_val:
                changed.append(name)
        return changed

    def _decode_instruction_simple(self, word: int) -> str:
        """Simple instruction decoding for display."""
        if word == 0:
            return "nop"

        opcode = (word >> 26) & 0x3F

        # R-type
        if opcode == 0:
            funct = word & 0x3F
            rs = (word >> 21) & 0x1F
            rt = (word >> 16) & 0x1F
            rd = (word >> 11) & 0x1F
            shamt = (word >> 6) & 0x1F

            funct_names = {
                0x20: "add",
                0x21: "addu",
                0x22: "sub",
                0x23: "subu",
                0x24: "and",
                0x25: "or",
                0x26: "xor",
                0x27: "nor",
                0x2A: "slt",
                0x2B: "sltu",
                0x00: "sll",
                0x02: "srl",
                0x03: "sra",
                0x08: "jr",
                0x09: "jalr",
                0x0C: "syscall",
            }

            name = funct_names.get(funct, f"r-type(0x{funct:02X})")

            if funct == 0x0C:
                return "syscall"
            elif funct == 0x08:
                return f"jr {self._reg_name(rs)}"
            elif funct in [0x00, 0x02, 0x03]:
                return f"{name} {self._reg_name(rd)}, {self._reg_name(rt)}, {shamt}"
            else:
                return f"{name} {self._reg_name(rd)}, {self._reg_name(rs)}, {self._reg_name(rt)}"

        # J-type
        elif opcode == 2:
            return f"j 0x{(word & 0x3FFFFFF) << 2:08X}"
        elif opcode == 3:
            return f"jal 0x{(word & 0x3FFFFFF) << 2:08X}"

        # I-type
        else:
            rs = (word >> 21) & 0x1F
            rt = (word >> 16) & 0x1F
            imm = word & 0xFFFF
            if imm & 0x8000:  # Sign extend
                imm -= 0x10000

            opcode_names = {
                0x08: "addi",
                0x09: "addiu",
                0x0C: "andi",
                0x0D: "ori",
                0x0A: "slti",
                0x0B: "sltiu",
                0x0F: "lui",
                0x23: "lw",
                0x21: "lh",
                0x20: "lb",
                0x25: "lhu",
                0x24: "lbu",
                0x2B: "sw",
                0x29: "sh",
                0x28: "sb",
                0x04: "beq",
                0x05: "bne",
                0x06: "blez",
                0x07: "bgtz",
            }

            name = opcode_names.get(opcode, f"i-type(0x{opcode:02X})")

            if opcode == 0x0F:  # lui
                return f"lui {self._reg_name(rt)}, {imm & 0xFFFF}"
            elif opcode in [0x23, 0x21, 0x20, 0x25, 0x24, 0x2B, 0x29, 0x28]:
                return f"{name} {self._reg_name(rt)}, {imm}({self._reg_name(rs)})"
            elif opcode in [0x04, 0x05]:
                return f"{name} {self._reg_name(rs)}, {self._reg_name(rt)}, {imm}"
            elif opcode in [0x06, 0x07]:
                return f"{name} {self._reg_name(rs)}, {imm}"
            else:
                return f"{name} {self._reg_name(rt)}, {self._reg_name(rs)}, {imm}"

    def _reg_name(self, num: int) -> str:
        """Get register name from number."""
        if 0 <= num < 32:
            return self.REGISTER_NAMES[num]
        return f"${num}"

    def _generate_description(
        self, instruction: str, changed: list[str], regs: dict[str, int]
    ) -> str:
        """Generate human-readable description of what happened."""
        if not changed:
            return f"Executed: {instruction}"

        changes = []
        for reg in changed:
            val = regs.get(reg, 0)
            changes.append(f"{reg}={val} (0x{val & 0xFFFFFFFF:08X})")

        return f"{instruction} → {', '.join(changes)}"

    # === Navigation Methods ===

    def get_current_step(self) -> ExecutionStep | None:
        """Get current step state."""
        if not self._state or not self._state.steps:
            return None
        if self._state.current_step >= len(self._state.steps):
            return self._state.steps[-1]
        return self._state.steps[self._state.current_step]

    def step_forward(self) -> ExecutionStep | None:
        """Move to next step."""
        if not self._state or not self._state.steps:
            return None
        if self._state.current_step < len(self._state.steps) - 1:
            self._state.current_step += 1
        return self.get_current_step()

    def step_backward(self) -> ExecutionStep | None:
        """Move to previous step."""
        if not self._state or not self._state.steps:
            return None
        if self._state.current_step > 0:
            self._state.current_step -= 1
        return self.get_current_step()

    def reset(self) -> ExecutionStep | None:
        """Reset to first step."""
        if not self._state or not self._state.steps:
            return None
        self._state.current_step = 0
        return self.get_current_step()

    def goto_step(self, step_num: int) -> ExecutionStep | None:
        """Go to specific step number."""
        if not self._state or not self._state.steps:
            return None
        self._state.current_step = max(0, min(step_num, len(self._state.steps) - 1))
        return self.get_current_step()

    def get_state(self) -> StepExecutionState | None:
        """Get full execution state."""
        return self._state

    def is_complete(self) -> bool:
        """Check if at last step."""
        if not self._state or not self._state.steps:
            return True
        return self._state.current_step >= len(self._state.steps) - 1

    def get_all_steps(self) -> list[ExecutionStep]:
        """Get all execution steps."""
        if not self._state:
            return []
        return self._state.steps


# Session-based storage for step executors
_executors: dict[str, StepExecutor] = {}


def get_step_executor(session_id: str = "default") -> StepExecutor:
    """Get or create step executor for a session."""
    if session_id not in _executors:
        _executors[session_id] = StepExecutor()
    return _executors[session_id]


def reset_step_executor(session_id: str = "default") -> None:
    """Reset step executor for a session."""
    if session_id in _executors:
        del _executors[session_id]
