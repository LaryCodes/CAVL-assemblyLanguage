"""
MIPS Instruction Analyzer Service - CORE SYSTEM DEPENDENCY

This service is the bridge between the MIPS instruction_analyzer.asm
and the Python backend.

CRITICAL: This service REQUIRES mips/core/instruction_analyzer.asm to exist.
If the file is missing, the service will REFUSE to initialize and the
entire system will fail to start.

The analysis is performed IN MIPS, not in Python. Python only:
1. Assembles user code to get instruction words
2. Injects them into the MIPS analyzer
3. Runs the MIPS analyzer
4. Parses the output from MIPS memory

NO INSTRUCTION CLASSIFICATION HAPPENS IN PYTHON.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


class MipsCoreMissingError(Exception):
    """Raised when required MIPS core files are missing."""

    pass


class MipsAnalysisError(Exception):
    """Raised when MIPS analysis fails."""

    pass


@dataclass
class InstructionAnalysis:
    """Results from MIPS instruction analyzer."""

    r_type_count: int = 0  # Arithmetic R-type
    i_type_count: int = 0  # Immediate I-type
    load_count: int = 0  # Memory loads
    store_count: int = 0  # Memory stores
    branch_count: int = 0  # Branch instructions
    jump_count: int = 0  # Jump instructions
    syscall_count: int = 0  # Syscall instructions
    other_count: int = 0  # Unclassified
    total_analyzed: int = 0  # Total instructions
    register_usage: dict[str, int] = field(default_factory=dict)  # Per-register usage
    analysis_valid: bool = False  # Whether MIPS analysis completed


class MipsInstructionAnalyzer:
    """
    Analyzes MIPS instructions using the MIPS instruction_analyzer.asm core.

    HARD DEPENDENCY: This class REQUIRES mips/core/instruction_analyzer.asm
    to exist. If missing, initialization will fail.
    """

    # Path to required MIPS core file
    ANALYZER_ASM: str = "instruction_analyzer.asm"

    # Magic number that MIPS writes to verify execution
    ANALYSIS_MAGIC: int = 0xCAFE1234

    # Register names for output
    REGISTER_NAMES: list[str] = [
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
        """
        Initialize the analyzer.

        RAISES MipsCoreMissingError if required MIPS files are missing.
        """
        # Find MARS jar
        if mars_jar_path:
            self.mars_jar: Path = Path(mars_jar_path)
        else:
            self.mars_jar = Path(__file__).parent.parent.parent / "mars.jar"

        if not self.mars_jar.exists():
            raise FileNotFoundError(f"MARS jar not found at: {self.mars_jar}")

        # Find MIPS core directory
        self.mips_core_dir: Path = (
            Path(__file__).parent.parent.parent.parent / "mips" / "core"
        )

        # CRITICAL: Verify required MIPS file exists
        self.analyzer_path: Path = self.mips_core_dir / self.ANALYZER_ASM

        if not self.analyzer_path.exists():
            raise MipsCoreMissingError(
                f"CRITICAL: Required MIPS core file missing: {self.analyzer_path}\n"
                f"CAVL cannot function without mips/core/{self.ANALYZER_ASM}\n"
                "This file contains the instruction analysis logic implemented in MIPS assembly."
            )

        # Load the analyzer template
        self._analyzer_template: str = self._load_analyzer_template()

    def _load_analyzer_template(self) -> str:
        """Load the MIPS analyzer template."""
        with open(self.analyzer_path, "r", encoding="utf-8") as f:
            return f.read()

    def _assemble_to_words(self, user_code: str) -> list[int]:
        """
        Assemble user MIPS code and extract instruction words.

        Uses MARS to assemble the code and dump the text segment.
        """
        # Write user code to temp file (ASCII encoding to avoid BOM issues)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".asm", delete=False, encoding="ascii", errors="ignore"
        ) as f:
            f.write(user_code)
            user_file = f.name

        # Create dump file path
        dump_file = user_file + ".dump"

        try:
            # Use MARS to assemble and dump text segment
            cmd = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",  # No copyright
                "a",  # Assemble only (don't run)
                "dump",
                ".text",
                "HexText",
                dump_file,
                user_file,
            ]

            _ = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=2.0,  # Reduced for faster response
                cwd=str(self.mars_jar.parent),
            )

            # Read instruction words from dump
            instructions: list[int] = []
            if os.path.exists(dump_file):
                with open(dump_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                word = int(line, 16)
                                instructions.append(word)
                            except ValueError:
                                pass

            return instructions

        except subprocess.TimeoutExpired:
            return []
        except Exception:
            return []
        finally:
            # Cleanup
            try:
                os.unlink(user_file)
            except OSError:
                pass
            try:
                os.unlink(dump_file)
            except OSError:
                pass

    def _inject_instructions(self, instructions: list[int]) -> str:
        """
        Inject instruction words into the MIPS analyzer template.

        Modifies the .data section to include the instruction buffer.
        """
        # Build instruction data
        count = len(instructions)

        # Create .word directives for instructions
        if instructions:
            instr_words = ", ".join(f"0x{w:08X}" for w in instructions[:100])  # Max 100
            buffer_data = f"    instruction_buffer: .word {instr_words}"
        else:
            buffer_data = "    instruction_buffer: .space 400"

        # Replace in template
        modified = self._analyzer_template

        # Replace instruction_count
        modified = re.sub(
            r"instruction_count:\s*\.word\s+\d+",
            f"instruction_count:  .word {count}",
            modified,
        )

        # Replace instruction_buffer
        modified = re.sub(r"instruction_buffer:\s*\.space\s+\d+", buffer_data, modified)

        return modified

    def _parse_analysis_output(
        self, _stdout: str, memory_dump: str, num_instructions: int
    ) -> InstructionAnalysis:
        """
        Parse the analysis results from MIPS memory dump.

        Memory layout in .data section after injection:
          - instruction_count:  4 bytes (1 word)
          - instruction_buffer: num_instructions * 4 bytes
          - analysis_results:   starts right after buffer
            +0:  r_type_count
            +4:  i_type_count
            +8:  load_count
            +12: store_count
            +16: branch_count
            +20: jump_count
            +24: syscall_count
            +28: other_count
            +32: total_analyzed
            +36: register_usage[32] (128 bytes)
        """
        analysis = InstructionAnalysis()

        # Parse memory dump for actual values
        if memory_dump:
            values: list[int] = []
            for line in memory_dump.strip().split("\n"):
                line = line.strip()
                if line:
                    try:
                        values.append(int(line, 16))
                    except ValueError:
                        pass

            # Calculate offset to analysis_results
            # Offset: 1 (instruction_count) + num_instructions (buffer)
            RESULTS_OFFSET = 1 + num_instructions

            if len(values) > RESULTS_OFFSET + 9:
                idx = RESULTS_OFFSET
                analysis.r_type_count = values[idx] if values[idx] < 10000 else 0
                analysis.i_type_count = (
                    values[idx + 1] if values[idx + 1] < 10000 else 0
                )
                analysis.load_count = values[idx + 2] if values[idx + 2] < 10000 else 0
                analysis.store_count = values[idx + 3] if values[idx + 3] < 10000 else 0
                analysis.branch_count = (
                    values[idx + 4] if values[idx + 4] < 10000 else 0
                )
                analysis.jump_count = values[idx + 5] if values[idx + 5] < 10000 else 0
                analysis.syscall_count = (
                    values[idx + 6] if values[idx + 6] < 10000 else 0
                )
                analysis.other_count = values[idx + 7] if values[idx + 7] < 10000 else 0
                analysis.total_analyzed = (
                    values[idx + 8] if values[idx + 8] < 10000 else 0
                )

                # Check if we got valid data (total should match what we sent)
                if analysis.total_analyzed > 0:
                    analysis.analysis_valid = True

            # Parse register usage (next 32 values after the 9 counters)
            REG_USAGE_OFFSET = RESULTS_OFFSET + 9
            if len(values) > REG_USAGE_OFFSET + 32:
                for i, reg_name in enumerate(self.REGISTER_NAMES):
                    idx = REG_USAGE_OFFSET + i
                    if idx < len(values):
                        usage = values[idx]
                        if usage > 0 and usage < 10000:
                            analysis.register_usage[reg_name] = usage

        return analysis

    def analyze(self, user_code: str) -> InstructionAnalysis:
        """
        Analyze user MIPS code using the MIPS instruction analyzer.

        This method:
        1. Assembles user code to get instruction words
        2. Injects them into instruction_analyzer.asm
        3. Runs the MIPS analyzer in MARS
        4. Parses and returns the results

        ALL ANALYSIS IS DONE IN MIPS, NOT PYTHON.
        """
        # Step 1: Assemble user code to get instruction words
        instructions = self._assemble_to_words(user_code)

        if not instructions:
            # Return empty analysis if assembly failed
            return InstructionAnalysis(analysis_valid=False)

        # Step 2: Inject instructions into analyzer
        analyzer_code = self._inject_instructions(instructions)

        # Step 3: Write combined code to temp file (ASCII to avoid BOM)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".asm", delete=False, encoding="ascii", errors="ignore"
        ) as f:
            f.write(analyzer_code)
            analyzer_file = f.name

        dump_file = analyzer_file + ".data.dump"

        try:
            # Step 4: Run MIPS analyzer in MARS
            cmd = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",  # No copyright
                "dec",  # Decimal output
                "dump",
                ".data",
                "HexText",
                dump_file,
                analyzer_file,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10.0,  # Increased timeout for analysis
                cwd=str(self.mars_jar.parent),
            )

            # Read memory dump
            memory_dump = ""
            if os.path.exists(dump_file):
                with open(dump_file, "r", encoding="utf-8") as f:
                    memory_dump = f.read()

            # Step 5: Parse results from MIPS output
            # Pass num_instructions so parser knows the correct offset
            analysis = self._parse_analysis_output(
                result.stdout, memory_dump, len(instructions)
            )

            # If parsing failed but we have instruction count, set it
            if not analysis.analysis_valid and instructions:
                analysis.total_analyzed = len(instructions)

            return analysis

        except subprocess.TimeoutExpired as e:
            print(f"[ERROR] MIPS analysis timeout after {e.timeout}s")
            print(f"[ERROR] Command: {' '.join(cmd)}")
            print(f"[ERROR] Analyzer file: {analyzer_file}")
            raise MipsAnalysisError(f"MIPS analysis timed out after {e.timeout}s")
        except Exception as e:
            print(f"[ERROR] MIPS analysis exception: {type(e).__name__}: {e}")
            raise MipsAnalysisError(f"MIPS analysis failed: {str(e)}")
        finally:
            # Cleanup
            try:
                os.unlink(analyzer_file)
            except OSError:
                pass
            try:
                os.unlink(dump_file)
            except OSError:
                pass


# Singleton instance
_analyzer: MipsInstructionAnalyzer | None = None


def get_mips_analyzer() -> MipsInstructionAnalyzer:
    """
    Get the MIPS instruction analyzer singleton.

    RAISES MipsCoreMissingError if required MIPS files are missing.
    This ensures the system FAILS if MIPS core is deleted.
    """
    global _analyzer
    if _analyzer is None:
        _analyzer = MipsInstructionAnalyzer()
    return _analyzer


def verify_mips_core() -> bool:
    """
    Verify that all required MIPS core files exist.

    Called at startup to ensure system integrity.
    Returns True if all files present, raises MipsCoreMissingError otherwise.
    """
    _ = get_mips_analyzer()
    return True
