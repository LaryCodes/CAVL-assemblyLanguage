"""
Instruction Decoder Router.
API endpoints for MIPS instruction binary/hex decoding.

This provides educational visualization of how MIPS assembly
instructions are encoded as machine code.

Endpoints:
- POST /api/decode/instruction - Decode a single instruction
- POST /api/decode/program - Decode an entire program
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.instruction_decoder import (
    DecodedInstruction,
    InstructionFormat,
    MIPSInstructionDecoder,
    get_instruction_decoder,
)

router = APIRouter(prefix="/api/decode", tags=["decoder"])


# ============== Request/Response Models ==============


class DecodeInstructionRequest(BaseModel):
    """Request to decode a single MIPS instruction."""

    instruction: str = Field(
        min_length=1, description="MIPS assembly instruction to decode"
    )


class DecodeProgramRequest(BaseModel):
    """Request to decode an entire MIPS program."""

    code: str = Field(min_length=1, description="MIPS assembly code to decode")


class InstructionFieldResponse(BaseModel):
    """Binary field in an instruction."""

    name: str = Field(description="Field name (rs, rt, rd, etc.)")
    value: int = Field(description="Decimal value")
    binary: str = Field(description="Binary representation")
    description: str = Field(description="Human-readable description")


class DecodedInstructionResponse(BaseModel):
    """Decoded MIPS instruction response."""

    original: str = Field(description="Original assembly instruction")
    format: str = Field(description="Instruction format (R, I, or J)")
    opcode: int = Field(description="Opcode value")
    opcode_binary: str = Field(description="6-bit opcode in binary")
    fields: list[InstructionFieldResponse] = Field(
        description="Instruction fields (rs, rt, rd, etc.)"
    )
    machine_code_hex: str = Field(description="32-bit instruction in hexadecimal")
    machine_code_binary: str = Field(description="32-bit instruction in binary")
    machine_code_binary_formatted: str = Field(
        description="Binary formatted with field separators"
    )
    description: str = Field(description="Human-readable description")


class DecodeInstructionResponse(BaseModel):
    """Response for single instruction decode."""

    success: bool = Field(description="Whether decoding succeeded")
    instruction: DecodedInstructionResponse | None = Field(
        default=None, description="Decoded instruction"
    )
    error: str | None = Field(default=None, description="Error message if failed")


class DecodeProgramResponse(BaseModel):
    """Response for program decode."""

    success: bool = Field(description="Whether decoding succeeded")
    instructions: list[DecodedInstructionResponse] = Field(
        default_factory=list, description="List of decoded instructions"
    )
    total_instructions: int = Field(description="Total instructions decoded")
    error: str | None = Field(default=None, description="Error message if failed")


# ============== Helper Functions ==============


def _format_binary_with_separators(binary: str, format_type: InstructionFormat) -> str:
    """
    Format binary string with field separators for readability.

    R-type: opcode(6) | rs(5) | rt(5) | rd(5) | shamt(5) | funct(6)
    I-type: opcode(6) | rs(5) | rt(5) | immediate(16)
    J-type: opcode(6) | address(26)
    """
    if len(binary) != 32:
        return binary

    if format_type == InstructionFormat.R_TYPE:
        # opcode(6) | rs(5) | rt(5) | rd(5) | shamt(5) | funct(6)
        return (
            f"{binary[0:6]} | {binary[6:11]} | {binary[11:16]} | "
            f"{binary[16:21]} | {binary[21:26]} | {binary[26:32]}"
        )
    elif format_type == InstructionFormat.I_TYPE:
        # opcode(6) | rs(5) | rt(5) | immediate(16)
        return f"{binary[0:6]} | {binary[6:11]} | {binary[11:16]} | {binary[16:32]}"
    elif format_type == InstructionFormat.J_TYPE:
        # opcode(6) | address(26)
        return f"{binary[0:6]} | {binary[6:32]}"

    return binary


def _get_field_description(field_name: str, value: int) -> str:
    """Get human-readable description for a field."""
    if field_name in ["rs", "rt", "rd"]:
        # Register field
        register_names = [
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
        if 0 <= value < len(register_names):
            return f"{field_name.upper()} = {register_names[value]} (register {value})"
        return f"{field_name.upper()} = register {value}"
    elif field_name == "shamt":
        return f"Shift amount = {value}"
    elif field_name == "funct":
        return f"Function code = {value}"
    elif field_name == "immediate":
        return f"Immediate value = {value} (0x{value:04X})"
    elif field_name == "address":
        return f"Jump target = {value} (0x{value:07X})"
    else:
        return f"{field_name} = {value}"


def _convert_decoded_to_response(
    decoded: DecodedInstruction,
) -> DecodedInstructionResponse:
    """Convert internal DecodedInstruction to API response format."""

    # Convert fields
    fields_response: list[InstructionFieldResponse] = []
    for field_name, (value, binary) in decoded.fields.items():
        fields_response.append(
            InstructionFieldResponse(
                name=field_name,
                value=value,
                binary=binary,
                description=_get_field_description(field_name, value),
            )
        )

    # Format binary with separators
    binary_formatted = _format_binary_with_separators(
        decoded.machine_code_bin, decoded.format
    )

    return DecodedInstructionResponse(
        original=decoded.original,
        format=decoded.format.value,
        opcode=decoded.opcode,
        opcode_binary=decoded.opcode_bin,
        fields=fields_response,
        machine_code_hex=decoded.machine_code_hex,
        machine_code_binary=decoded.machine_code_bin,
        machine_code_binary_formatted=binary_formatted,
        description=decoded.description,
    )


def _get_decoder() -> MIPSInstructionDecoder:
    """Get decoder instance."""
    return get_instruction_decoder()


# ============== API Endpoints ==============


@router.post("/instruction", response_model=DecodeInstructionResponse)
async def decode_instruction(
    request: DecodeInstructionRequest,
) -> DecodeInstructionResponse:
    """
    Decode a single MIPS assembly instruction to binary/hex.

    This endpoint shows how the instruction is encoded as machine code,
    breaking down each field (opcode, registers, immediate values, etc.)
    in binary format.

    Example:
        Input: "add $t0, $t1, $t2"
        Output: Binary encoding with R-type format breakdown
    """
    try:
        decoder = _get_decoder()
        decoded = decoder.decode(request.instruction)

        if not decoded:
            return DecodeInstructionResponse(
                success=False,
                instruction=None,
                error=f"Could not decode instruction: {request.instruction}",
            )

        return DecodeInstructionResponse(
            success=True,
            instruction=_convert_decoded_to_response(decoded),
            error=None,
        )

    except Exception as e:
        return DecodeInstructionResponse(
            success=False,
            instruction=None,
            error=f"Decoder error: {str(e)}",
        )


@router.post("/program", response_model=DecodeProgramResponse)
async def decode_program(request: DecodeProgramRequest) -> DecodeProgramResponse:
    """
    Decode an entire MIPS program to show binary encoding of all instructions.

    This endpoint processes a complete MIPS assembly program and returns
    the binary/hex encoding for each instruction.

    Useful for understanding machine code representation and instruction formats.
    """
    try:
        decoder = _get_decoder()
        decoded_list = decoder.decode_program(request.code)

        if not decoded_list:
            return DecodeProgramResponse(
                success=False,
                instructions=[],
                total_instructions=0,
                error="No valid instructions found in program",
            )

        instructions_response = [
            _convert_decoded_to_response(decoded) for decoded in decoded_list
        ]

        return DecodeProgramResponse(
            success=True,
            instructions=instructions_response,
            total_instructions=len(instructions_response),
            error=None,
        )

    except Exception as e:
        return DecodeProgramResponse(
            success=False,
            instructions=[],
            total_instructions=0,
            error=f"Decoder error: {str(e)}",
        )


@router.get("/info")
async def get_decoder_info() -> dict[str, Any]:
    """
    Get information about the MIPS instruction decoder.

    Returns supported instructions, formats, and capabilities.
    """
    return {
        "name": "MIPS Instruction Decoder",
        "description": "Decodes MIPS assembly to binary/hex machine code",
        "formats": {
            "R-type": "Register format (opcode | rs | rt | rd | shamt | funct)",
            "I-type": "Immediate format (opcode | rs | rt | immediate)",
            "J-type": "Jump format (opcode | address)",
        },
        "supported_instructions": {
            "R-type": [
                "add",
                "addu",
                "sub",
                "subu",
                "and",
                "or",
                "xor",
                "nor",
                "slt",
                "sltu",
                "sll",
                "srl",
                "sra",
                "sllv",
                "srlv",
                "srav",
                "jr",
                "jalr",
                "mult",
                "multu",
                "div",
                "divu",
                "mfhi",
                "mflo",
                "mthi",
                "mtlo",
            ],
            "I-type": [
                "addi",
                "addiu",
                "andi",
                "ori",
                "xori",
                "slti",
                "sltiu",
                "lui",
                "lw",
                "lh",
                "lhu",
                "lb",
                "lbu",
                "sw",
                "sh",
                "sb",
                "beq",
                "bne",
                "blez",
                "bgtz",
            ],
            "J-type": ["j", "jal"],
        },
        "features": {
            "single_instruction_decode": True,
            "program_decode": True,
            "binary_breakdown": True,
            "hex_encoding": True,
            "field_descriptions": True,
        },
    }
