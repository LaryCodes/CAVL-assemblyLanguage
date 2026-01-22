"""
MIPS Instruction Decoder Service.

Decodes MIPS assembly instructions to show their binary/hexadecimal encoding.
This is an educational tool to help students understand machine code representation.

IMPORTANT: This is a SUPPLEMENTARY feature for visualization.
The actual instruction execution is still done by MARS simulator.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


class InstructionFormat(Enum):
    """MIPS instruction formats."""

    R_TYPE = "R"  # Register format
    I_TYPE = "I"  # Immediate format
    J_TYPE = "J"  # Jump format


@dataclass
class DecodedInstruction:
    """Decoded MIPS instruction with binary encoding."""

    original: str  # Original assembly instruction
    format: InstructionFormat
    opcode: int
    opcode_bin: str  # 6-bit binary
    fields: dict[str, tuple[int, str]]  # field_name -> (value, binary)
    machine_code: int  # 32-bit instruction word
    machine_code_hex: str
    machine_code_bin: str
    description: str


class MIPSInstructionDecoder:
    """
    Decodes MIPS assembly instructions to binary/hex representation.

    Supports common MIPS instructions used in educational contexts.
    """

    # Register name to number mapping
    REGISTERS = {
        "$zero": 0,
        "$0": 0,
        "$at": 1,
        "$v0": 2,
        "$v1": 3,
        "$a0": 4,
        "$a1": 5,
        "$a2": 6,
        "$a3": 7,
        "$t0": 8,
        "$t1": 9,
        "$t2": 10,
        "$t3": 11,
        "$t4": 12,
        "$t5": 13,
        "$t6": 14,
        "$t7": 15,
        "$s0": 16,
        "$s1": 17,
        "$s2": 18,
        "$s3": 19,
        "$s4": 20,
        "$s5": 21,
        "$s6": 22,
        "$s7": 23,
        "$t8": 24,
        "$t9": 25,
        "$k0": 26,
        "$k1": 27,
        "$gp": 28,
        "$sp": 29,
        "$fp": 30,
        "$ra": 31,
    }

    # R-type instructions: opcode=0, funct varies
    R_TYPE_FUNCT = {
        "add": 0x20,
        "addu": 0x21,
        "sub": 0x22,
        "subu": 0x23,
        "and": 0x24,
        "or": 0x25,
        "xor": 0x26,
        "nor": 0x27,
        "slt": 0x2A,
        "sltu": 0x2B,
        "sll": 0x00,
        "srl": 0x02,
        "sra": 0x03,
        "sllv": 0x04,
        "srlv": 0x06,
        "srav": 0x07,
        "jr": 0x08,
        "jalr": 0x09,
        "mult": 0x18,
        "multu": 0x19,
        "div": 0x1A,
        "divu": 0x1B,
        "mfhi": 0x10,
        "mflo": 0x12,
        "mthi": 0x11,
        "mtlo": 0x13,
    }

    # I-type instructions: opcode varies
    I_TYPE_OPCODE = {
        "addi": 0x08,
        "addiu": 0x09,
        "andi": 0x0C,
        "ori": 0x0D,
        "xori": 0x0E,
        "slti": 0x0A,
        "sltiu": 0x0B,
        "lui": 0x0F,
        "lw": 0x23,
        "lh": 0x21,
        "lhu": 0x25,
        "lb": 0x20,
        "lbu": 0x24,
        "sw": 0x2B,
        "sh": 0x29,
        "sb": 0x28,
        "beq": 0x04,
        "bne": 0x05,
        "blez": 0x06,
        "bgtz": 0x07,
    }

    # J-type instructions: opcode varies
    J_TYPE_OPCODE = {
        "j": 0x02,
        "jal": 0x03,
    }

    def decode(self, instruction: str) -> DecodedInstruction | None:
        """
        Decode a MIPS assembly instruction.

        Args:
            instruction: Assembly instruction (e.g., "add $t0, $t1, $t2")

        Returns:
            DecodedInstruction object, or None if instruction not recognized
        """
        # Clean up instruction
        instruction = instruction.strip().lower()
        if not instruction or instruction.startswith("#"):
            return None

        # Remove comments
        if "#" in instruction:
            instruction = instruction.split("#")[0].strip()

        # Parse instruction mnemonic
        parts = re.split(r"[,\s]+", instruction)
        if not parts:
            return None

        mnemonic = parts[0]

        # Determine instruction type and decode
        if mnemonic in self.R_TYPE_FUNCT:
            return self._decode_r_type(mnemonic, parts[1:], instruction)
        elif mnemonic in self.I_TYPE_OPCODE:
            return self._decode_i_type(mnemonic, parts[1:], instruction)
        elif mnemonic in self.J_TYPE_OPCODE:
            return self._decode_j_type(mnemonic, parts[1:], instruction)

        return None

    def _decode_r_type(
        self, mnemonic: str, operands: list[str], original: str
    ) -> DecodedInstruction:
        """Decode R-type instruction."""
        opcode = 0  # R-type always has opcode 0
        funct = self.R_TYPE_FUNCT[mnemonic]

        # Default values
        rs = rt = rd = shamt = 0

        # Parse operands based on instruction
        if mnemonic in ["sll", "srl", "sra"]:
            # Shift: rd, rt, shamt
            if len(operands) >= 3:
                rd = self._get_register_number(operands[0])
                rt = self._get_register_number(operands[1])
                shamt = int(operands[2]) & 0x1F
        elif mnemonic in ["sllv", "srlv", "srav"]:
            # Variable shift: rd, rt, rs
            if len(operands) >= 3:
                rd = self._get_register_number(operands[0])
                rt = self._get_register_number(operands[1])
                rs = self._get_register_number(operands[2])
        elif mnemonic == "jr":
            # Jump register: rs
            if len(operands) >= 1:
                rs = self._get_register_number(operands[0])
        elif mnemonic == "jalr":
            # Jump and link register: rd, rs
            if len(operands) >= 2:
                rd = self._get_register_number(operands[0])
                rs = self._get_register_number(operands[1])
            elif len(operands) == 1:
                rs = self._get_register_number(operands[0])
                rd = 31  # Default to $ra
        elif mnemonic in ["mfhi", "mflo"]:
            # Move from HI/LO: rd
            if len(operands) >= 1:
                rd = self._get_register_number(operands[0])
        elif mnemonic in ["mthi", "mtlo"]:
            # Move to HI/LO: rs
            if len(operands) >= 1:
                rs = self._get_register_number(operands[0])
        elif mnemonic in ["mult", "multu", "div", "divu"]:
            # Multiply/Divide: rs, rt
            if len(operands) >= 2:
                rs = self._get_register_number(operands[0])
                rt = self._get_register_number(operands[1])
        else:
            # Standard R-type: rd, rs, rt
            if len(operands) >= 3:
                rd = self._get_register_number(operands[0])
                rs = self._get_register_number(operands[1])
                rt = self._get_register_number(operands[2])

        # Encode instruction
        machine_code = (
            (opcode << 26) | (rs << 21) | (rt << 16) | (rd << 11) | (shamt << 6) | funct
        )

        return DecodedInstruction(
            original=original,
            format=InstructionFormat.R_TYPE,
            opcode=opcode,
            opcode_bin=self._to_binary(opcode, 6),
            fields={
                "rs": (rs, self._to_binary(rs, 5)),
                "rt": (rt, self._to_binary(rt, 5)),
                "rd": (rd, self._to_binary(rd, 5)),
                "shamt": (shamt, self._to_binary(shamt, 5)),
                "funct": (funct, self._to_binary(funct, 6)),
            },
            machine_code=machine_code,
            machine_code_hex=f"0x{machine_code:08X}",
            machine_code_bin=self._to_binary(machine_code, 32),
            description=f"R-type: opcode={opcode}, rs={rs}, rt={rt}, rd={rd}, shamt={shamt}, funct={funct}",
        )

    def _decode_i_type(
        self, mnemonic: str, operands: list[str], original: str
    ) -> DecodedInstruction:
        """Decode I-type instruction."""
        opcode = self.I_TYPE_OPCODE[mnemonic]
        rs = rt = 0
        immediate = 0

        # Parse operands based on instruction
        if mnemonic in ["lw", "lh", "lhu", "lb", "lbu", "sw", "sh", "sb"]:
            # Load/Store: rt, offset(base)
            if len(operands) >= 2:
                rt = self._get_register_number(operands[0])
                # Parse offset(base) format
                offset_base = operands[1]
                match = re.match(r"(-?\d+)\((\$\w+)\)", offset_base)
                if match:
                    immediate = int(match.group(1)) & 0xFFFF
                    rs = self._get_register_number(match.group(2))
        elif mnemonic in ["beq", "bne"]:
            # Branch: rs, rt, offset
            if len(operands) >= 3:
                rs = self._get_register_number(operands[0])
                rt = self._get_register_number(operands[1])
                # For now, treat offset as immediate value
                immediate = self._parse_immediate(operands[2]) & 0xFFFF
        elif mnemonic in ["blez", "bgtz"]:
            # Branch: rs, offset
            if len(operands) >= 2:
                rs = self._get_register_number(operands[0])
                immediate = self._parse_immediate(operands[1]) & 0xFFFF
        elif mnemonic == "lui":
            # Load upper immediate: rt, immediate
            if len(operands) >= 2:
                rt = self._get_register_number(operands[0])
                immediate = self._parse_immediate(operands[1]) & 0xFFFF
        else:
            # Standard I-type: rt, rs, immediate
            if len(operands) >= 3:
                rt = self._get_register_number(operands[0])
                rs = self._get_register_number(operands[1])
                immediate = self._parse_immediate(operands[2]) & 0xFFFF

        # Encode instruction
        machine_code = (opcode << 26) | (rs << 21) | (rt << 16) | immediate

        return DecodedInstruction(
            original=original,
            format=InstructionFormat.I_TYPE,
            opcode=opcode,
            opcode_bin=self._to_binary(opcode, 6),
            fields={
                "rs": (rs, self._to_binary(rs, 5)),
                "rt": (rt, self._to_binary(rt, 5)),
                "immediate": (immediate, self._to_binary(immediate, 16)),
            },
            machine_code=machine_code,
            machine_code_hex=f"0x{machine_code:08X}",
            machine_code_bin=self._to_binary(machine_code, 32),
            description=f"I-type: opcode={opcode}, rs={rs}, rt={rt}, imm={immediate}",
        )

    def _decode_j_type(
        self, mnemonic: str, operands: list[str], original: str
    ) -> DecodedInstruction:
        """Decode J-type instruction."""
        opcode = self.J_TYPE_OPCODE[mnemonic]
        address = 0

        # Parse target address
        if len(operands) >= 1:
            address = self._parse_immediate(operands[0]) & 0x3FFFFFF

        # Encode instruction
        machine_code = (opcode << 26) | address

        return DecodedInstruction(
            original=original,
            format=InstructionFormat.J_TYPE,
            opcode=opcode,
            opcode_bin=self._to_binary(opcode, 6),
            fields={
                "address": (address, self._to_binary(address, 26)),
            },
            machine_code=machine_code,
            machine_code_hex=f"0x{machine_code:08X}",
            machine_code_bin=self._to_binary(machine_code, 32),
            description=f"J-type: opcode={opcode}, address={address}",
        )

    def _get_register_number(self, reg_name: str) -> int:
        """Get register number from name."""
        reg_name = reg_name.strip().lower()
        return self.REGISTERS.get(reg_name, 0)

    def _parse_immediate(self, value: str) -> int:
        """Parse immediate value (decimal or hex)."""
        value = value.strip()
        try:
            if value.startswith("0x"):
                return int(value, 16)
            else:
                return int(value)
        except ValueError:
            return 0

    def _to_binary(self, value: int, bits: int) -> str:
        """Convert value to binary string with specified bit width."""
        return format(value & ((1 << bits) - 1), f"0{bits}b")

    def decode_program(self, code: str) -> list[DecodedInstruction]:
        """
        Decode an entire MIPS program.

        Args:
            code: MIPS assembly code (multiple lines)

        Returns:
            List of decoded instructions
        """
        decoded: list[DecodedInstruction] = []

        for line in code.split("\n"):
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("."):
                continue

            result = self.decode(line)
            if result:
                decoded.append(result)

        return decoded


# Singleton instance
_decoder: MIPSInstructionDecoder | None = None


def get_instruction_decoder() -> MIPSInstructionDecoder:
    """Get the instruction decoder singleton."""
    global _decoder
    if _decoder is None:
        _decoder = MIPSInstructionDecoder()
    return _decoder
