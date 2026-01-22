"""
Pipeline Simulator Service - MIPS 5-Stage Pipeline Visualization

This service orchestrates the MIPS pipeline_simulator.asm core file.
ALL PIPELINE LOGIC IS IN MIPS, NOT PYTHON.

Python only:
1. Injects instruction words into the MIPS template
2. Executes MARS simulator
3. Parses output from MIPS memory dump
4. Returns structured data for frontend visualization

The actual pipeline simulation (hazard detection, forwarding, stalling)
is implemented in mips/core/pipeline_simulator.asm
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


class PipelineSimulationError(Exception):
    """Raised when pipeline simulation fails."""

    pass


@dataclass
class PipelineStage:
    """State of a single pipeline stage."""

    instruction: int = 0  # Instruction word (0 = NOP/bubble)
    pc: int = 0  # Program counter for this instruction
    valid: bool = False  # True if stage has valid instruction
    src_reg1: int = -1  # Source register 1 (-1 = none)
    src_reg2: int = -1  # Source register 2 (-1 = none)
    dest_reg: int = -1  # Destination register (-1 = none)


@dataclass
class HazardInfo:
    """Information about detected hazards."""

    detected: bool = False
    hazard_type: int = 0  # 0=none, 1=RAW, 2=load-use, 3=control
    stall_required: bool = False
    forward_from: int = 0  # Stage forwarding from (0=none, 3=EX, 4=MEM, 5=WB)
    forward_to: int = 0  # Stage forwarding to
    forward_reg: int = -1  # Register being forwarded

    @property
    def hazard_type_name(self) -> str:
        """Human-readable hazard type."""
        names = {0: "none", 1: "RAW", 2: "load-use", 3: "control"}
        return names.get(self.hazard_type, "unknown")


@dataclass
class PipelineMetrics:
    """Pipeline performance metrics."""

    total_cycles: int = 0
    total_instructions: int = 0
    stall_cycles: int = 0
    forward_count: int = 0
    branch_stalls: int = 0
    load_use_stalls: int = 0
    raw_hazards: int = 0
    cpi: float = 0.0  # Cycles per instruction

    @property
    def efficiency(self) -> float:
        """Pipeline efficiency percentage (ideal CPI=1)."""
        if self.cpi == 0:
            return 0.0
        return (1.0 / self.cpi) * 100.0


@dataclass
class CycleRecord:
    """Record of pipeline state for a single cycle."""

    cycle: int
    if_instruction: int  # Instruction in IF stage
    id_instruction: int  # Instruction in ID stage
    ex_instruction: int  # Instruction in EX stage
    mem_instruction: int  # Instruction in MEM stage
    wb_instruction: int  # Instruction in WB stage
    hazard_type: int
    stall: bool
    forward: bool


@dataclass
class PipelineState:
    """Complete pipeline simulation state."""

    stages: dict[str, PipelineStage] = field(default_factory=dict)
    hazard: HazardInfo = field(default_factory=HazardInfo)
    metrics: PipelineMetrics = field(default_factory=PipelineMetrics)
    cycle_history: list[CycleRecord] = field(default_factory=list)
    simulation_complete: bool = False

    def __post_init__(self):
        if not self.stages:
            self.stages = {
                "IF": PipelineStage(),
                "ID": PipelineStage(),
                "EX": PipelineStage(),
                "MEM": PipelineStage(),
                "WB": PipelineStage(),
            }


class PipelineSimulator:
    """
    Simulates MIPS 5-stage pipeline using pipeline_simulator.asm.

    CRITICAL: All simulation logic is in MIPS assembly.
    This Python class only orchestrates execution and parses results.
    """

    SIMULATOR_ASM = "pipeline_simulator.asm"
    PIPELINE_MAGIC = 0x50495045  # "PIPE" in hex

    def __init__(self, mars_jar_path: str | None = None):
        """Initialize the pipeline simulator."""
        if mars_jar_path:
            self.mars_jar: Path = Path(mars_jar_path)
        else:
            self.mars_jar = Path(__file__).parent.parent.parent / "mars.jar"

        if not self.mars_jar.exists():
            raise FileNotFoundError(f"MARS jar not found at: {self.mars_jar}")

        self.mips_core_dir: Path = (
            Path(__file__).parent.parent.parent.parent / "mips" / "core"
        )

        self.simulator_path: Path = self.mips_core_dir / self.SIMULATOR_ASM

        if not self.simulator_path.exists():
            raise PipelineSimulationError(
                f"Pipeline simulator not found: {self.simulator_path}\n"
                f"CAVL requires mips/core/{self.SIMULATOR_ASM} for pipeline visualization."
            )

        self._simulator_template = self._load_simulator_template()

    def _load_simulator_template(self) -> str:
        """Load the MIPS pipeline simulator template."""
        with open(self.simulator_path, "r", encoding="utf-8") as f:
            return f.read()

    def _assemble_to_words(self, user_code: str) -> list[int]:
        """
        Assemble user MIPS code and extract instruction words.

        Uses MARS to assemble the code and dump the text segment.
        """
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".asm", delete=False, encoding="ascii", errors="ignore"
        ) as f:
            f.write(user_code)
            user_file = f.name

        dump_file = user_file + ".dump"

        try:
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
                user_file,
            ]

            _ = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5.0,
                cwd=str(self.mars_jar.parent),
            )

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
            try:
                os.unlink(user_file)
            except OSError:
                pass
            try:
                os.unlink(dump_file)
            except OSError:
                pass

    def _inject_instructions(
        self, instructions: list[int], enable_forwarding: bool = True
    ) -> str:
        """
        Inject instruction words into the MIPS pipeline simulator template.
        """
        count = len(instructions)

        if instructions:
            instr_words = ", ".join(f"0x{w:08X}" for w in instructions[:100])
            buffer_data = f"    instruction_buffer:     .word {instr_words}"
        else:
            buffer_data = "    instruction_buffer:     .space 400"

        modified = self._simulator_template

        # Replace instruction_count
        modified = re.sub(
            r"instruction_count:\s*\.word\s+\d+",
            f"instruction_count:      .word {count}",
            modified,
        )

        # Replace instruction_buffer
        modified = re.sub(r"instruction_buffer:\s*\.space\s+\d+", buffer_data, modified)

        # Set forwarding flag
        fwd_val = 1 if enable_forwarding else 0
        modified = re.sub(
            r"enable_forwarding:\s*\.word\s+\d+",
            f"enable_forwarding:      .word {fwd_val}",
            modified,
        )

        return modified

    def _parse_simulation_output(
        self, memory_dump: str, num_instructions: int
    ) -> PipelineState:
        """
        Parse the simulation results from MIPS memory dump.

        Memory layout in .data section:
        - instruction_count: 1 word
        - instruction_buffer: variable size based on injected instructions
        - enable_forwarding: 1 word
        - enable_branch_predict: 1 word
        - pipeline_stages: 5 * 6 = 30 words
        - hazard_info: 7 words
        - pipeline_metrics: 9 words
        - max_history_cycles: 1 word
        - history_count: 1 word
        - cycle_history: variable
        - register_scoreboard: 32 words
        - current_cycle: 1 word
        - pc_current: 1 word
        - simulation_done: 1 word
        - pipeline_magic: 1 word
        """
        state = PipelineState()

        if not memory_dump:
            return state

        values: list[int] = []
        for line in memory_dump.strip().split("\n"):
            line = line.strip()
            if line:
                try:
                    values.append(int(line, 16))
                except ValueError:
                    pass

        if len(values) < 50:
            return state

        # Calculate offsets based on data layout
        # instruction_count: offset 0
        # instruction_buffer: offset 1, length = actual num_instructions
        # When we inject instructions, the buffer size is exactly num_instructions words
        # When no instructions (template), it's .space 400 = 100 words
        buffer_words = num_instructions if num_instructions > 0 else 100
        base_offset = 1 + buffer_words

        # enable_forwarding: base_offset
        # enable_branch_predict: base_offset + 1
        config_offset = base_offset
        stages_offset = config_offset + 2

        # Parse pipeline stages (5 stages * 6 words each = 30 words)
        stage_names = ["IF", "ID", "EX", "MEM", "WB"]
        for i, name in enumerate(stage_names):
            stage_base = stages_offset + (i * 6)
            if stage_base + 5 < len(values):
                state.stages[name] = PipelineStage(
                    instruction=values[stage_base],
                    pc=values[stage_base + 1],
                    valid=values[stage_base + 2] != 0,
                    src_reg1=self._signed(values[stage_base + 3]),
                    src_reg2=self._signed(values[stage_base + 4]),
                    dest_reg=self._signed(values[stage_base + 5]),
                )

        # Parse hazard info (7 words)
        hazard_offset = stages_offset + 30
        if hazard_offset + 6 < len(values):
            state.hazard = HazardInfo(
                detected=values[hazard_offset] != 0,
                hazard_type=values[hazard_offset + 1],
                stall_required=values[hazard_offset + 3] != 0,
                forward_from=values[hazard_offset + 4],
                forward_to=values[hazard_offset + 5],
                forward_reg=self._signed(values[hazard_offset + 6]),
            )

        # Parse metrics (9 words)
        metrics_offset = hazard_offset + 7
        if metrics_offset + 8 < len(values):
            total_cycles = values[metrics_offset]
            total_instructions = values[metrics_offset + 1]
            cpi_num = values[metrics_offset + 7]
            cpi_den = values[metrics_offset + 8]

            cpi = 0.0
            if cpi_den > 0:
                cpi = cpi_num / (cpi_den * 100.0) if cpi_num > 0 else 0.0
            elif total_instructions > 0:
                cpi = total_cycles / total_instructions

            state.metrics = PipelineMetrics(
                total_cycles=total_cycles,
                total_instructions=total_instructions,
                stall_cycles=values[metrics_offset + 2],
                forward_count=values[metrics_offset + 3],
                branch_stalls=values[metrics_offset + 4],
                load_use_stalls=values[metrics_offset + 5],
                raw_hazards=values[metrics_offset + 6],
                cpi=round(cpi, 2) if cpi > 0 else 1.0,
            )

        # Parse cycle history
        history_meta_offset = metrics_offset + 9
        if history_meta_offset + 1 < len(values):
            max_cycles = values[history_meta_offset]
            history_count = values[history_meta_offset + 1]
            history_data_offset = history_meta_offset + 2

            # Each history entry is 9 words
            for i in range(min(history_count, max_cycles, 50)):
                entry_offset = history_data_offset + (i * 9)
                if entry_offset + 8 < len(values):
                    state.cycle_history.append(
                        CycleRecord(
                            cycle=values[entry_offset],
                            if_instruction=values[entry_offset + 1],
                            id_instruction=values[entry_offset + 2],
                            ex_instruction=values[entry_offset + 3],
                            mem_instruction=values[entry_offset + 4],
                            wb_instruction=values[entry_offset + 5],
                            hazard_type=values[entry_offset + 6],
                            stall=values[entry_offset + 7] != 0,
                            forward=values[entry_offset + 8] != 0,
                        )
                    )

        # Check simulation complete
        # Find pipeline_magic in the dump
        for i in range(len(values) - 1, max(0, len(values) - 100), -1):
            if values[i] == self.PIPELINE_MAGIC:
                state.simulation_complete = True
                break

        return state

    def _signed(self, value: int) -> int:
        """Convert unsigned 32-bit to signed."""
        if value > 0x7FFFFFFF:
            return value - 0x100000000
        return value

    def simulate(self, user_code: str, enable_forwarding: bool = True) -> PipelineState:
        """
        Simulate the pipeline for user MIPS code.

        ALL SIMULATION LOGIC IS IN MIPS (pipeline_simulator.asm).
        Python only orchestrates execution and parses results.

        Args:
            user_code: MIPS assembly code to simulate
            enable_forwarding: Whether to enable data forwarding (default True)

        Returns:
            PipelineState with simulation results
        """
        # Step 1: Assemble user code to get instruction words
        instructions = self._assemble_to_words(user_code)

        if not instructions:
            return PipelineState()

        # Step 2: Inject instructions into simulator template
        simulator_code = self._inject_instructions(instructions, enable_forwarding)

        # Step 3: Execute simulator in MARS
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".asm", delete=False, encoding="ascii", errors="ignore"
        ) as f:
            f.write(simulator_code)
            simulator_file = f.name

        dump_file = simulator_file + ".data.dump"

        try:
            # CRITICAL: Must execute the program first, then dump memory
            # "nc" = no copyright, "dec" = decimal addresses (unused with HexText)
            # The program must run to completion to populate memory with results
            cmd = [
                "java",
                "-jar",
                str(self.mars_jar),
                "nc",
                simulator_file,
                "dump",
                ".data",
                "HexText",
                dump_file,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10.0,
                cwd=str(self.mars_jar.parent),
            )

            # Read memory dump
            memory_dump = ""
            if os.path.exists(dump_file):
                with open(dump_file, "r", encoding="utf-8") as f:
                    memory_dump = f.read()

            # Step 4: Parse results from MIPS memory
            state = self._parse_simulation_output(memory_dump, len(instructions))

            return state

        except subprocess.TimeoutExpired:
            raise PipelineSimulationError("Pipeline simulation timed out")
        except Exception as e:
            raise PipelineSimulationError(f"Pipeline simulation failed: {str(e)}")
        finally:
            try:
                os.unlink(simulator_file)
            except OSError:
                pass
            try:
                os.unlink(dump_file)
            except OSError:
                pass


# Singleton instance
_simulator: PipelineSimulator | None = None


def get_pipeline_simulator() -> PipelineSimulator:
    """Get the pipeline simulator singleton."""
    global _simulator
    if _simulator is None:
        _simulator = PipelineSimulator()
    return _simulator
