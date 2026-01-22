"""
MARS Executor Service.
Handles subprocess execution of MARS simulator for MIPS code.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MarsResult:
    """Result from MARS execution."""

    success: bool
    stdout: str
    stderr: str
    error: str | None = None
    timeout: bool = False


@dataclass
class StepTrace:
    """Single step in execution trace."""

    step_number: int
    pc: int
    instruction: str
    registers: dict[str, int]
    changed_registers: list[str]


class MarsExecutor:
    """
    Executes MIPS code using MARS simulator via CLI.

    MARS CLI execution modes:
    - Full execution with register dump: java -jar mars.jar nc dec program.asm
    - Memory dump: java -jar mars.jar nc dec dump .data HexText program.asm
    """

    DEFAULT_TIMEOUT: float = 5.0  # 5 seconds timeout for complex programs

    def __init__(self, mars_jar_path: str | None = None):
        """
        Initialize MARS executor.

        Args:
            mars_jar_path: Path to mars.jar. If None, looks in backend directory.
        """
        if mars_jar_path:
            self.mars_jar: Path = Path(mars_jar_path)
        else:
            # Default: look for mars.jar in backend directory
            self.mars_jar = Path(__file__).parent.parent.parent / "mars.jar"

        if not self.mars_jar.exists():
            raise FileNotFoundError(f"MARS jar not found at: {self.mars_jar}")

    def execute_with_trace(
        self,
        code: str,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> MarsResult:
        """
        Execute MIPS code with instruction trace enabled.

        Args:
            code: MIPS assembly code to execute
            timeout: Maximum execution time in seconds

        Returns:
            MarsResult with execution output including trace
        """
        # Write code to temporary file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".asm",
            delete=False,
            encoding="utf-8",
        ) as f:
            f.write(code)
            temp_file = f.name

        try:
            # Build MARS command with trace enabled
            # Format: java -jar mars.jar nc dec [MaxSteps] program.asm
            # MaxSteps limits execution steps to prevent infinite loops
            cmd = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",  # No copyright banner
                "dec",  # Decimal display
                "1000",  # Max 1000 steps to prevent infinite loops
                temp_file,
            ]

            # Execute MARS
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.mars_jar.parent),
            )

            # Check for errors in output
            error = self._check_for_errors(result.stdout, result.stderr)

            return MarsResult(
                success=error is None,
                stdout=result.stdout,
                stderr=result.stderr,
                error=error,
                timeout=False,
            )

        except subprocess.TimeoutExpired:
            return MarsResult(
                success=False,
                stdout="",
                stderr="",
                error="Execution timeout exceeded",
                timeout=True,
            )
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file)
            except OSError:
                pass

    def execute(
        self,
        code: str,
        timeout: float = DEFAULT_TIMEOUT,
        dump_registers: bool = True,
        dump_memory: bool = False,
    ) -> MarsResult:
        """
        Execute MIPS code and return results.

        Args:
            code: MIPS assembly code to execute
            timeout: Maximum execution time in seconds
            dump_registers: Whether to dump register values
            dump_memory: Whether to dump memory contents

        Returns:
            MarsResult with execution output
        """
        # Write code to temporary file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".asm",
            delete=False,
            encoding="utf-8",
        ) as f:
            f.write(code)
            temp_file = f.name

        try:
            # Build MARS command
            cmd = self._build_command(temp_file, dump_registers, dump_memory)

            # Execute MARS
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.mars_jar.parent),
            )

            # Check for errors in output
            error = self._check_for_errors(result.stdout, result.stderr)

            return MarsResult(
                success=error is None,
                stdout=result.stdout,
                stderr=result.stderr,
                error=error,
                timeout=False,
            )

        except subprocess.TimeoutExpired:
            return MarsResult(
                success=False,
                stdout="",
                stderr="",
                error=f"Execution timeout (>{timeout}s)",
                timeout=True,
            )
        except Exception as e:
            return MarsResult(
                success=False,
                stdout="",
                stderr=str(e),
                error=f"Execution error: {str(e)}",
                timeout=False,
            )
        finally:
            # Clean up temp file
            try:
                _ = os.unlink(temp_file)
            except OSError:
                pass

    def execute_with_trace(
        self,
        code: str,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> MarsResult:
        """
        Execute MIPS code with full instruction trace for step-by-step replay.

        Args:
            code: MIPS assembly code to execute
            timeout: Maximum execution time in seconds

        Returns:
            MarsResult with trace output including all register states
        """
        # Write code to temporary file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".asm",
            delete=False,
            encoding="utf-8",
        ) as f:
            f.write(code)
            temp_file = f.name

        try:
            # Build command for trace mode
            # nc = no copyright, dec = decimal output
            # We request all registers to be dumped
            cmd: list[str] = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",  # No copyright notice
                "dec",  # Decimal output
                temp_file,
            ]

            # Add all register names to dump
            registers = [
                "zero",
                "at",
                "v0",
                "v1",
                "a0",
                "a1",
                "a2",
                "a3",
                "t0",
                "t1",
                "t2",
                "t3",
                "t4",
                "t5",
                "t6",
                "t7",
                "s0",
                "s1",
                "s2",
                "s3",
                "s4",
                "s5",
                "s6",
                "s7",
                "t8",
                "t9",
                "k0",
                "k1",
                "gp",
                "sp",
                "fp",
                "ra",
            ]
            for reg in registers:
                cmd.append(reg)

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.mars_jar.parent),
            )

            error = self._check_for_errors(result.stdout, result.stderr)

            return MarsResult(
                success=error is None,
                stdout=result.stdout,
                stderr=result.stderr,
                error=error,
                timeout=False,
            )

        except subprocess.TimeoutExpired:
            return MarsResult(
                success=False,
                stdout="",
                stderr="",
                error=f"Execution timeout (>{timeout}s)",
                timeout=True,
            )
        except Exception as e:
            return MarsResult(
                success=False,
                stdout="",
                stderr=str(e),
                error=f"Execution error: {str(e)}",
                timeout=False,
            )
        finally:
            try:
                _ = os.unlink(temp_file)
            except OSError:
                pass

    def dump_memory(
        self,
        code: str,
        segment: str = ".data",
        timeout: float = DEFAULT_TIMEOUT,
    ) -> MarsResult:
        """
        Execute MIPS code and dump memory segment.

        Args:
            code: MIPS assembly code to execute
            segment: Memory segment to dump (.text, .data)
            timeout: Maximum execution time in seconds

        Returns:
            MarsResult with memory dump output
        """
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".asm",
            delete=False,
            encoding="utf-8",
        ) as f:
            f.write(code)
            temp_file = f.name

        # Create temp file for memory dump
        dump_file = temp_file + ".dump"

        try:
            cmd: list[str] = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",
                "dec",
                "dump",
                segment,
                "HexText",
                dump_file,
                temp_file,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.mars_jar.parent),
            )

            # Read dump file if it exists
            dump_content = ""
            if os.path.exists(dump_file):
                with open(dump_file, "r", encoding="utf-8") as df:
                    dump_content = df.read()

            error = self._check_for_errors(result.stdout, result.stderr)

            return MarsResult(
                success=error is None,
                stdout=dump_content if dump_content else result.stdout,
                stderr=result.stderr,
                error=error,
                timeout=False,
            )

        except subprocess.TimeoutExpired:
            return MarsResult(
                success=False,
                stdout="",
                stderr="",
                error=f"Execution timeout (>{timeout}s)",
                timeout=True,
            )
        except Exception as e:
            return MarsResult(
                success=False,
                stdout="",
                stderr=str(e),
                error=f"Execution error: {str(e)}",
                timeout=False,
            )
        finally:
            try:
                _ = os.unlink(temp_file)
            except OSError:
                pass
            try:
                _ = os.unlink(dump_file)
            except OSError:
                pass

    def _build_command(
        self,
        asm_file: str,
        dump_registers: bool,
        _dump_memory: bool,
    ) -> list[str]:
        """Build MARS CLI command."""
        cmd: list[str] = [
            "java",
            "-jar",
            str(self.mars_jar),
            "nc",  # No copyright notice
            "dec",  # Decimal output
        ]

        if dump_registers:
            # Add all register names
            registers = [
                "zero",
                "at",
                "v0",
                "v1",
                "a0",
                "a1",
                "a2",
                "a3",
                "t0",
                "t1",
                "t2",
                "t3",
                "t4",
                "t5",
                "t6",
                "t7",
                "s0",
                "s1",
                "s2",
                "s3",
                "s4",
                "s5",
                "s6",
                "s7",
                "t8",
                "t9",
                "k0",
                "k1",
                "gp",
                "sp",
                "fp",
                "ra",
            ]
            cmd.extend(registers)

        cmd.append(asm_file)
        return cmd

    def _check_for_errors(self, stdout: str, stderr: str) -> str | None:
        """Check MARS output for errors."""
        # Check stderr first
        if stderr and ("Error" in stderr or "error" in stderr.lower()):
            return stderr.strip()

        # Check stdout for error messages (not warnings)
        if "Error" in stdout:
            # Extract error lines (exclude warnings)
            error_lines = [
                line
                for line in stdout.split("\n")
                if "Error" in line and "Warning" not in line
            ]
            if error_lines:
                return "\n".join(error_lines)

        return None
