# =============================================================================
# pipeline_simulator.asm - MIPS 5-Stage Pipeline Simulator
# =============================================================================
# CAVL CORE DEPENDENCY - Pipeline Visualization Feature
#
# This MIPS program simulates the classic 5-stage MIPS pipeline:
#   IF  - Instruction Fetch
#   ID  - Instruction Decode / Register Read
#   EX  - Execute / ALU Operation
#   MEM - Memory Access
#   WB  - Write Back
#
# It detects hazards and calculates pipeline performance metrics.
# ALL PIPELINE LOGIC IS IN MIPS, NOT PYTHON.
#
# INPUT CONTRACT (injected by FastAPI into .data):
#   instruction_buffer: Array of 32-bit instruction words
#   instruction_count:  Number of instructions to simulate
#
# OUTPUT CONTRACT (read by FastAPI from memory):
#   pipeline_state:     Current state of each pipeline stage
#   hazard_info:        Detected hazards and their types
#   pipeline_metrics:   CPI, stall count, forward count, etc.
#   cycle_history:      Per-cycle pipeline state (for animation)
#
# HAZARD TYPES DETECTED:
#   1. RAW (Read After Write) - Data hazard
#   2. Load-Use hazard - Special RAW requiring stall
#   3. Control hazard - Branch/Jump
#
# =============================================================================

.data
    .align 2

    # ===== INPUT BUFFER (injected by FastAPI) =====
    instruction_count:      .word 0         # Number of instructions
    instruction_buffer:     .space 400      # Up to 100 instructions (100 * 4 bytes)

    # ===== PIPELINE CONFIGURATION =====
    enable_forwarding:      .word 1         # 1 = forwarding enabled, 0 = disabled
    enable_branch_predict:  .word 0         # 1 = predict not-taken, 0 = always stall

    # ===== PIPELINE STATE (5 stages) =====
    # Each stage holds: [instruction_word, pc, valid, src_reg1, src_reg2, dest_reg]
    # 6 words per stage = 24 bytes per stage
    pipeline_stages:
    stage_IF:               .space 24       # Instruction Fetch
    stage_ID:               .space 24       # Instruction Decode
    stage_EX:               .space 24       # Execute
    stage_MEM:              .space 24       # Memory Access
    stage_WB:               .space 24       # Write Back

    # Stage offsets within each stage structure
    # OFFSET_INSTR = 0      (instruction word)
    # OFFSET_PC = 4         (program counter)
    # OFFSET_VALID = 8      (1 if stage has valid instruction)
    # OFFSET_SRC1 = 12      (source register 1, -1 if none)
    # OFFSET_SRC2 = 16      (source register 2, -1 if none)
    # OFFSET_DEST = 20      (destination register, -1 if none)

    # ===== HAZARD DETECTION OUTPUT =====
    hazard_info:
    hazard_detected:        .word 0         # 1 if any hazard this cycle
    hazard_type:            .word 0         # 0=none, 1=RAW, 2=load-use, 3=control
    hazard_stage:           .word 0         # Which stage detected hazard
    stall_required:         .word 0         # 1 if pipeline must stall
    forward_from:           .word 0         # Stage to forward from (0=none)
    forward_to:             .word 0         # Stage to forward to
    forward_reg:            .word 0         # Register being forwarded

    # ===== PIPELINE METRICS =====
    pipeline_metrics:
    total_cycles:           .word 0         # Total clock cycles
    total_instructions:     .word 0         # Instructions completed
    stall_cycles:           .word 0         # Cycles spent stalling
    forward_count:          .word 0         # Number of forwards performed
    branch_stalls:          .word 0         # Stalls due to branches
    load_use_stalls:        .word 0         # Stalls due to load-use
    raw_hazards:            .word 0         # RAW hazards detected
    cpi_numerator:          .word 0         # For CPI calculation (cycles * 100)
    cpi_denominator:        .word 0         # For CPI calculation (instructions)

    # ===== CYCLE HISTORY (for visualization) =====
    # Each cycle record: [cycle_num, IF_instr, ID_instr, EX_instr, MEM_instr, WB_instr,
    #                     hazard_type, stall, forward]
    # 9 words = 36 bytes per cycle, max 50 cycles = 1800 bytes
    max_history_cycles:     .word 50
    history_count:          .word 0         # Number of cycles recorded
    cycle_history:          .space 1800     # 50 cycles * 36 bytes

    # ===== REGISTER SCOREBOARD =====
    # Tracks which stage will produce each register's value
    # 0 = available, 1 = IF, 2 = ID, 3 = EX, 4 = MEM, 5 = WB
    register_scoreboard:    .space 128      # 32 registers * 4 bytes

    # ===== SIMULATION STATE =====
    current_cycle:          .word 0         # Current simulation cycle
    pc_current:             .word 0         # Current PC (instruction index)
    simulation_done:        .word 0         # 1 when all instructions complete
    pipeline_magic:         .word 0         # Set to 0xPIPE5678 when done

    # ===== CONSTANTS =====
    STAGE_SIZE:             .word 24        # Bytes per stage
    HISTORY_ENTRY_SIZE:     .word 36        # Bytes per history entry

    # Hazard type constants
    HAZARD_NONE:            .word 0
    HAZARD_RAW:             .word 1
    HAZARD_LOAD_USE:        .word 2
    HAZARD_CONTROL:         .word 3

.text
.globl main

# =============================================================================
# main - Entry point for pipeline simulation
# =============================================================================
main:
    # Initialize pipeline
    jal init_pipeline

    # Load instruction count
    lw $s0, instruction_count       # $s0 = total instructions
    beqz $s0, simulation_complete   # No instructions, exit

    # Initialize simulation state
    sw $zero, current_cycle
    sw $zero, pc_current
    sw $zero, simulation_done

    # Main simulation loop
simulation_loop:
    # Check if simulation is done
    lw $t0, simulation_done
    bnez $t0, simulation_complete

    # Increment cycle counter
    lw $t0, current_cycle
    addi $t0, $t0, 1
    sw $t0, current_cycle

    # Update total cycles metric
    lw $t1, total_cycles
    addi $t1, $t1, 1
    sw $t1, total_cycles

    # Process pipeline stages (in reverse order to avoid overwrites)
    # WB -> MEM -> EX -> ID -> IF

    jal process_WB_stage
    jal process_MEM_stage
    jal detect_hazards          # Check for hazards before EX
    jal process_EX_stage
    jal process_ID_stage
    jal process_IF_stage

    # Record cycle history for visualization
    jal record_cycle_history

    # Check termination condition
    jal check_simulation_done

    # Limit cycles to prevent infinite loop
    lw $t0, current_cycle
    li $t1, 500                 # Max 500 cycles
    bge $t0, $t1, simulation_complete

    j simulation_loop

simulation_complete:
    # Calculate final metrics
    jal calculate_metrics

    # Set magic number to indicate completion
    li $t0, 0x50495045          # "PIPE" in hex
    sw $t0, pipeline_magic

    # Exit
    li $v0, 10
    syscall

# =============================================================================
# init_pipeline - Initialize all pipeline state
# =============================================================================
init_pipeline:
    # Clear all pipeline stages
    la $t0, pipeline_stages
    li $t1, 120                 # 5 stages * 24 bytes
    li $t2, 0
clear_stages:
    beqz $t1, clear_scoreboard
    sw $zero, 0($t0)
    addi $t0, $t0, 4
    addi $t1, $t1, -4
    j clear_stages

clear_scoreboard:
    # Clear register scoreboard
    la $t0, register_scoreboard
    li $t1, 128                 # 32 registers * 4 bytes
clear_sb_loop:
    beqz $t1, clear_metrics
    sw $zero, 0($t0)
    addi $t0, $t0, 4
    addi $t1, $t1, -4
    j clear_sb_loop

clear_metrics:
    # Clear all metrics
    sw $zero, total_cycles
    sw $zero, total_instructions
    sw $zero, stall_cycles
    sw $zero, forward_count
    sw $zero, branch_stalls
    sw $zero, load_use_stalls
    sw $zero, raw_hazards
    sw $zero, history_count

    jr $ra

# =============================================================================
# process_IF_stage - Instruction Fetch stage
# =============================================================================
process_IF_stage:
    addi $sp, $sp, -4
    sw $ra, 0($sp)

    # Check if we should stall
    lw $t0, stall_required
    bnez $t0, if_stall

    # Get current PC (instruction index)
    lw $t0, pc_current
    lw $t1, instruction_count

    # Check if we've fetched all instructions
    bge $t0, $t1, if_no_more

    # Fetch instruction from buffer
    la $t2, instruction_buffer
    sll $t3, $t0, 2             # offset = pc * 4
    add $t2, $t2, $t3
    lw $t4, 0($t2)              # $t4 = instruction word

    # Store in IF stage
    la $t5, stage_IF
    sw $t4, 0($t5)              # instruction
    sll $t6, $t0, 2             # PC as byte address
    lui $t7, 0x0040             # Base: 0x00400000
    add $t6, $t6, $t7
    sw $t6, 4($t5)              # pc
    li $t7, 1
    sw $t7, 8($t5)              # valid = 1

    # Increment PC
    addi $t0, $t0, 1
    sw $t0, pc_current

    j if_done

if_stall:
    # On stall, IF stage keeps its current instruction
    # Update stall counter
    lw $t0, stall_cycles
    addi $t0, $t0, 1
    sw $t0, stall_cycles
    j if_done

if_no_more:
    # No more instructions to fetch - insert bubble
    la $t5, stage_IF
    sw $zero, 0($t5)            # instruction = 0 (NOP)
    sw $zero, 4($t5)            # pc = 0
    sw $zero, 8($t5)            # valid = 0

if_done:
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# process_ID_stage - Instruction Decode stage
# =============================================================================
process_ID_stage:
    addi $sp, $sp, -4
    sw $ra, 0($sp)

    # Check if stalling
    lw $t0, stall_required
    bnez $t0, id_stall

    # Move IF -> ID
    la $t0, stage_IF
    la $t1, stage_ID

    # Copy all 6 words (24 bytes)
    lw $t2, 0($t0)
    sw $t2, 0($t1)              # instruction
    lw $t2, 4($t0)
    sw $t2, 4($t1)              # pc
    lw $t2, 8($t0)
    sw $t2, 8($t1)              # valid

    # Decode instruction to extract registers
    lw $a0, 0($t1)              # instruction word
    lw $t3, 8($t1)              # valid flag
    beqz $t3, id_done           # Skip if not valid

    jal decode_instruction      # Returns: $v0=src1, $v1=src2, $a0=dest (after call)

    # Store decoded register info
    la $t1, stage_ID
    sw $v0, 12($t1)             # src1
    sw $v1, 16($t1)             # src2
    sw $a1, 20($t1)             # dest (returned in $a1)

    j id_done

id_stall:
    # On stall, insert bubble into ID (don't advance from IF)
    la $t1, stage_ID
    sw $zero, 0($t1)            # NOP
    sw $zero, 4($t1)            # pc = 0
    sw $zero, 8($t1)            # valid = 0
    li $t2, -1
    sw $t2, 12($t1)             # no src1
    sw $t2, 16($t1)             # no src2
    sw $t2, 20($t1)             # no dest

id_done:
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# process_EX_stage - Execute stage
# =============================================================================
process_EX_stage:
    addi $sp, $sp, -4
    sw $ra, 0($sp)

    # Check if stalling
    lw $t0, stall_required
    bnez $t0, ex_stall

    # Move ID -> EX
    la $t0, stage_ID
    la $t1, stage_EX

    # Copy all 6 words
    li $t2, 0
ex_copy_loop:
    lw $t3, 0($t0)
    sw $t3, 0($t1)
    addi $t0, $t0, 4
    addi $t1, $t1, 4
    addi $t2, $t2, 4
    blt $t2, 24, ex_copy_loop

    # Update scoreboard - mark dest register as being produced in EX
    la $t1, stage_EX
    lw $t2, 20($t1)             # dest register
    bltz $t2, ex_done           # No dest register

    # Update scoreboard: register $t2 will be ready after EX
    la $t3, register_scoreboard
    sll $t4, $t2, 2
    add $t3, $t3, $t4
    li $t5, 3                   # 3 = EX stage
    sw $t5, 0($t3)

    j ex_done

ex_stall:
    # Insert bubble
    la $t1, stage_EX
    sw $zero, 0($t1)
    sw $zero, 4($t1)
    sw $zero, 8($t1)
    li $t2, -1
    sw $t2, 12($t1)
    sw $t2, 16($t1)
    sw $t2, 20($t1)

ex_done:
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# process_MEM_stage - Memory Access stage
# =============================================================================
process_MEM_stage:
    addi $sp, $sp, -4
    sw $ra, 0($sp)

    # Move EX -> MEM (always, no stalling at this point)
    la $t0, stage_EX
    la $t1, stage_MEM

    # Copy all 6 words
    li $t2, 0
mem_copy_loop:
    lw $t3, 0($t0)
    sw $t3, 0($t1)
    addi $t0, $t0, 4
    addi $t1, $t1, 4
    addi $t2, $t2, 4
    blt $t2, 24, mem_copy_loop

    # Update scoreboard
    la $t1, stage_MEM
    lw $t2, 20($t1)             # dest register
    bltz $t2, mem_done

    la $t3, register_scoreboard
    sll $t4, $t2, 2
    add $t3, $t3, $t4
    li $t5, 4                   # 4 = MEM stage
    sw $t5, 0($t3)

mem_done:
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# process_WB_stage - Write Back stage
# =============================================================================
process_WB_stage:
    addi $sp, $sp, -4
    sw $ra, 0($sp)

    # Check if current WB has valid instruction completing
    la $t0, stage_WB
    lw $t1, 8($t0)              # valid flag
    beqz $t1, wb_move

    # Instruction completing - increment counter
    lw $t2, total_instructions
    addi $t2, $t2, 1
    sw $t2, total_instructions

    # Clear scoreboard for dest register
    lw $t3, 20($t0)             # dest register
    bltz $t3, wb_move

    la $t4, register_scoreboard
    sll $t5, $t3, 2
    add $t4, $t4, $t5
    sw $zero, 0($t4)            # Register now available

wb_move:
    # Move MEM -> WB
    la $t0, stage_MEM
    la $t1, stage_WB

    li $t2, 0
wb_copy_loop:
    lw $t3, 0($t0)
    sw $t3, 0($t1)
    addi $t0, $t0, 4
    addi $t1, $t1, 4
    addi $t2, $t2, 4
    blt $t2, 24, wb_copy_loop

    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# detect_hazards - Check for data and control hazards
# =============================================================================
detect_hazards:
    addi $sp, $sp, -8
    sw $ra, 4($sp)
    sw $s0, 0($sp)

    # Reset hazard info
    sw $zero, hazard_detected
    sw $zero, hazard_type
    sw $zero, stall_required
    sw $zero, forward_from
    sw $zero, forward_to

    # Get ID stage info (instruction about to enter EX)
    la $t0, stage_ID
    lw $t1, 8($t0)              # valid
    beqz $t1, no_hazard         # No instruction in ID, no hazard

    lw $s0, 0($t0)              # instruction word
    lw $t2, 12($t0)             # src1
    lw $t3, 16($t0)             # src2

    # Check if src1 has RAW hazard
    bltz $t2, check_src2        # No src1
    beqz $t2, check_src2        # $zero never has hazard

    # Check scoreboard for src1
    la $t4, register_scoreboard
    sll $t5, $t2, 2
    add $t4, $t4, $t5
    lw $t6, 0($t4)              # Stage producing this register
    beqz $t6, check_src2        # Register is available

    # RAW hazard detected on src1
    li $t7, 1
    sw $t7, hazard_detected
    sw $t7, raw_hazards         # Update metric

    # Check if it's a load-use hazard (EX stage has load, we need result)
    li $t7, 3                   # EX stage
    bne $t6, $t7, try_forward_src1

    # Check if EX has a load instruction
    la $t8, stage_EX
    lw $t8, 0($t8)              # EX instruction
    jal is_load_instruction
    beqz $v0, try_forward_src1

    # Load-use hazard - must stall
    li $t7, 2                   # HAZARD_LOAD_USE
    sw $t7, hazard_type
    li $t7, 1
    sw $t7, stall_required
    lw $t7, load_use_stalls
    addi $t7, $t7, 1
    sw $t7, load_use_stalls
    j hazard_done

try_forward_src1:
    # Can we forward?
    lw $t7, enable_forwarding
    beqz $t7, must_stall

    # Forward from MEM or WB stage
    li $t7, 4                   # MEM stage
    beq $t6, $t7, forward_from_mem
    li $t7, 5                   # WB stage
    beq $t6, $t7, forward_from_wb

    # EX stage but not load - forward from EX
    li $t7, 3
    beq $t6, $t7, forward_from_ex
    j must_stall

forward_from_ex:
    li $t7, 3
    sw $t7, forward_from
    li $t7, 2                   # to ID
    sw $t7, forward_to
    sw $t2, forward_reg
    lw $t7, forward_count
    addi $t7, $t7, 1
    sw $t7, forward_count
    li $t7, 1                   # HAZARD_RAW (but forwarded)
    sw $t7, hazard_type
    j check_src2

forward_from_mem:
    li $t7, 4
    sw $t7, forward_from
    li $t7, 2
    sw $t7, forward_to
    sw $t2, forward_reg
    lw $t7, forward_count
    addi $t7, $t7, 1
    sw $t7, forward_count
    li $t7, 1
    sw $t7, hazard_type
    j check_src2

forward_from_wb:
    li $t7, 5
    sw $t7, forward_from
    li $t7, 2
    sw $t7, forward_to
    sw $t2, forward_reg
    lw $t7, forward_count
    addi $t7, $t7, 1
    sw $t7, forward_count
    j check_src2

must_stall:
    # No forwarding - must stall
    li $t7, 1
    sw $t7, stall_required
    li $t7, 1                   # HAZARD_RAW
    sw $t7, hazard_type
    j hazard_done

check_src2:
    # Similar check for src2
    bltz $t3, check_control     # No src2
    beqz $t3, check_control     # $zero

    la $t4, register_scoreboard
    sll $t5, $t3, 2
    add $t4, $t4, $t5
    lw $t6, 0($t4)
    beqz $t6, check_control     # Available

    # RAW on src2
    li $t7, 1
    sw $t7, hazard_detected

    # Check for load-use
    li $t7, 3
    bne $t6, $t7, try_forward_src2

    la $t8, stage_EX
    lw $t8, 0($t8)
    move $a0, $t8
    jal is_load_instruction
    beqz $v0, try_forward_src2

    # Load-use stall
    li $t7, 2
    sw $t7, hazard_type
    li $t7, 1
    sw $t7, stall_required
    lw $t7, load_use_stalls
    addi $t7, $t7, 1
    sw $t7, load_use_stalls
    j hazard_done

try_forward_src2:
    lw $t7, enable_forwarding
    beqz $t7, must_stall_src2

    # Forward handling for src2 (simplified)
    lw $t7, forward_count
    addi $t7, $t7, 1
    sw $t7, forward_count
    j check_control

must_stall_src2:
    li $t7, 1
    sw $t7, stall_required
    li $t7, 1
    sw $t7, hazard_type
    j hazard_done

check_control:
    # Check for control hazards (branches/jumps)
    move $a0, $s0
    jal is_branch_instruction
    beqz $v0, no_hazard

    # Branch detected - control hazard
    li $t7, 1
    sw $t7, hazard_detected
    li $t7, 3                   # HAZARD_CONTROL
    sw $t7, hazard_type

    # Branch prediction handling
    lw $t7, enable_branch_predict
    bnez $t7, branch_predict

    # No prediction - stall until branch resolves
    li $t7, 1
    sw $t7, stall_required
    lw $t7, branch_stalls
    addi $t7, $t7, 1
    sw $t7, branch_stalls
    j hazard_done

branch_predict:
    # Predict not-taken - no stall, but may need flush later
    # For simplicity, we just count it
    lw $t7, branch_stalls
    addi $t7, $t7, 1
    sw $t7, branch_stalls
    j hazard_done

no_hazard:
    sw $zero, hazard_detected
    sw $zero, hazard_type
    sw $zero, stall_required

hazard_done:
    lw $s0, 0($sp)
    lw $ra, 4($sp)
    addi $sp, $sp, 8
    jr $ra

# =============================================================================
# decode_instruction - Extract register operands from instruction
# =============================================================================
# Input: $a0 = instruction word
# Output: $v0 = src1 (-1 if none), $v1 = src2 (-1 if none), $a1 = dest (-1 if none)
# =============================================================================
decode_instruction:
    li $v0, -1                  # Default: no src1
    li $v1, -1                  # Default: no src2
    li $a1, -1                  # Default: no dest

    beqz $a0, decode_done       # NOP

    # Extract opcode (bits 31-26)
    srl $t0, $a0, 26
    andi $t0, $t0, 0x3F

    # R-type (opcode = 0)
    bnez $t0, not_r_type

    # R-type: src1=rs (25-21), src2=rt (20-16), dest=rd (15-11)
    srl $t1, $a0, 21
    andi $v0, $t1, 0x1F         # rs = src1

    srl $t1, $a0, 16
    andi $v1, $t1, 0x1F         # rt = src2

    srl $t1, $a0, 11
    andi $a1, $t1, 0x1F         # rd = dest

    # Check for special cases (jr uses rs, no dest)
    andi $t2, $a0, 0x3F         # funct
    li $t3, 8                   # jr
    beq $t2, $t3, jr_decode
    li $t3, 9                   # jalr
    beq $t2, $t3, jalr_decode
    j decode_done

jr_decode:
    li $v1, -1                  # No src2
    li $a1, -1                  # No dest
    j decode_done

jalr_decode:
    li $v1, -1                  # No src2
    # dest = rd (already set)
    j decode_done

not_r_type:
    # I-type loads: lw, lb, lh, lbu, lhu (opcodes 32-37)
    li $t1, 32
    blt $t0, $t1, not_load
    li $t1, 38
    bge $t0, $t1, not_load

    # Load: src1=rs (base), dest=rt
    srl $t1, $a0, 21
    andi $v0, $t1, 0x1F         # rs = src1 (base address)
    li $v1, -1                  # No src2
    srl $t1, $a0, 16
    andi $a1, $t1, 0x1F         # rt = dest
    j decode_done

not_load:
    # I-type stores: sw, sb, sh (opcodes 40-43)
    li $t1, 40
    blt $t0, $t1, not_store
    li $t1, 44
    bge $t0, $t1, not_store

    # Store: src1=rs (base), src2=rt (value), no dest
    srl $t1, $a0, 21
    andi $v0, $t1, 0x1F         # rs = src1
    srl $t1, $a0, 16
    andi $v1, $t1, 0x1F         # rt = src2
    li $a1, -1                  # No dest
    j decode_done

not_store:
    # Branches: beq(4), bne(5), blez(6), bgtz(7)
    li $t1, 4
    blt $t0, $t1, not_branch
    li $t1, 8
    bge $t0, $t1, not_branch

    # Branch: src1=rs, src2=rt (for beq/bne), no dest
    srl $t1, $a0, 21
    andi $v0, $t1, 0x1F         # rs = src1
    srl $t1, $a0, 16
    andi $v1, $t1, 0x1F         # rt = src2
    li $a1, -1                  # No dest
    j decode_done

not_branch:
    # J-type: j(2), jal(3)
    li $t1, 2
    beq $t0, $t1, j_decode
    li $t1, 3
    beq $t0, $t1, jal_decode

    # Other I-type (addi, andi, ori, etc.): src1=rs, dest=rt
    srl $t1, $a0, 21
    andi $v0, $t1, 0x1F         # rs = src1
    li $v1, -1                  # No src2 (immediate)
    srl $t1, $a0, 16
    andi $a1, $t1, 0x1F         # rt = dest
    j decode_done

j_decode:
    # j: no registers
    li $v0, -1
    li $v1, -1
    li $a1, -1
    j decode_done

jal_decode:
    # jal: dest = $ra (31)
    li $v0, -1
    li $v1, -1
    li $a1, 31                  # $ra
    j decode_done

decode_done:
    jr $ra

# =============================================================================
# is_load_instruction - Check if instruction is a load
# =============================================================================
# Input: $a0 = instruction word
# Output: $v0 = 1 if load, 0 otherwise
# =============================================================================
is_load_instruction:
    srl $t0, $a0, 26
    andi $t0, $t0, 0x3F         # opcode

    # Load opcodes: 32 (lb), 33 (lh), 35 (lw), 36 (lbu), 37 (lhu)
    li $t1, 32
    beq $t0, $t1, is_load_yes
    li $t1, 33
    beq $t0, $t1, is_load_yes
    li $t1, 35
    beq $t0, $t1, is_load_yes
    li $t1, 36
    beq $t0, $t1, is_load_yes
    li $t1, 37
    beq $t0, $t1, is_load_yes

    li $v0, 0
    jr $ra

is_load_yes:
    li $v0, 1
    jr $ra

# =============================================================================
# is_branch_instruction - Check if instruction is a branch or jump
# =============================================================================
# Input: $a0 = instruction word
# Output: $v0 = 1 if branch/jump, 0 otherwise
# =============================================================================
is_branch_instruction:
    srl $t0, $a0, 26
    andi $t0, $t0, 0x3F         # opcode

    # J-type: j(2), jal(3)
    li $t1, 2
    beq $t0, $t1, is_branch_yes
    li $t1, 3
    beq $t0, $t1, is_branch_yes

    # Branches: beq(4), bne(5), blez(6), bgtz(7)
    li $t1, 4
    beq $t0, $t1, is_branch_yes
    li $t1, 5
    beq $t0, $t1, is_branch_yes
    li $t1, 6
    beq $t0, $t1, is_branch_yes
    li $t1, 7
    beq $t0, $t1, is_branch_yes

    # R-type jumps: jr(8), jalr(9)
    bnez $t0, is_branch_no      # Not R-type
    andi $t2, $a0, 0x3F         # funct
    li $t1, 8
    beq $t2, $t1, is_branch_yes
    li $t1, 9
    beq $t2, $t1, is_branch_yes

is_branch_no:
    li $v0, 0
    jr $ra

is_branch_yes:
    li $v0, 1
    jr $ra

# =============================================================================
# record_cycle_history - Record current pipeline state for visualization
# =============================================================================
record_cycle_history:
    addi $sp, $sp, -4
    sw $ra, 0($sp)

    # Check if we have room
    lw $t0, history_count
    lw $t1, max_history_cycles
    bge $t0, $t1, history_full

    # Calculate offset into history array
    lw $t2, HISTORY_ENTRY_SIZE
    mul $t3, $t0, $t2            # offset = count * 36
    la $t4, cycle_history
    add $t4, $t4, $t3            # $t4 = address of this entry

    # Store cycle number
    lw $t5, current_cycle
    sw $t5, 0($t4)

    # Store IF instruction
    la $t6, stage_IF
    lw $t7, 0($t6)
    sw $t7, 4($t4)

    # Store ID instruction
    la $t6, stage_ID
    lw $t7, 0($t6)
    sw $t7, 8($t4)

    # Store EX instruction
    la $t6, stage_EX
    lw $t7, 0($t6)
    sw $t7, 12($t4)

    # Store MEM instruction
    la $t6, stage_MEM
    lw $t7, 0($t6)
    sw $t7, 16($t4)

    # Store WB instruction
    la $t6, stage_WB
    lw $t7, 0($t6)
    sw $t7, 20($t4)

    # Store hazard type
    lw $t7, hazard_type
    sw $t7, 24($t4)

    # Store stall flag
    lw $t7, stall_required
    sw $t7, 28($t4)

    # Store forward flag (1 if forwarding occurred)
    lw $t7, forward_from
    slt $t7, $zero, $t7          # 1 if forward_from > 0 (equivalent to sgtz)
    sw $t7, 32($t4)

    # Increment history count
    addi $t0, $t0, 1
    sw $t0, history_count

history_full:
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# check_simulation_done - Check if simulation should terminate
# =============================================================================
check_simulation_done:
    # Simulation is done when:
    # 1. All instructions fetched (pc >= instruction_count)
    # 2. Pipeline is empty (all stages invalid)

    lw $t0, pc_current
    lw $t1, instruction_count
    blt $t0, $t1, not_done       # Still have instructions to fetch

    # Check if pipeline is empty
    la $t2, stage_IF
    lw $t3, 8($t2)               # IF valid
    bnez $t3, not_done

    la $t2, stage_ID
    lw $t3, 8($t2)               # ID valid
    bnez $t3, not_done

    la $t2, stage_EX
    lw $t3, 8($t2)               # EX valid
    bnez $t3, not_done

    la $t2, stage_MEM
    lw $t3, 8($t2)               # MEM valid
    bnez $t3, not_done

    la $t2, stage_WB
    lw $t3, 8($t2)               # WB valid
    bnez $t3, not_done

    # All done
    li $t0, 1
    sw $t0, simulation_done
    jr $ra

not_done:
    sw $zero, simulation_done
    jr $ra

# =============================================================================
# calculate_metrics - Calculate final pipeline metrics
# =============================================================================
calculate_metrics:
    # CPI = total_cycles / total_instructions
    # Store as fixed point: cpi_numerator = cycles * 100

    lw $t0, total_cycles
    lw $t1, total_instructions

    # Handle division by zero
    beqz $t1, metrics_div_zero

    # cpi_numerator = cycles * 100
    li $t2, 100
    mul $t3, $t0, $t2
    sw $t3, cpi_numerator

    # cpi_denominator = instructions
    sw $t1, cpi_denominator

    jr $ra

metrics_div_zero:
    sw $zero, cpi_numerator
    li $t0, 1
    sw $t0, cpi_denominator
    jr $ra
