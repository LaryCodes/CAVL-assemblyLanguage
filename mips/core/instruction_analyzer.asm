# =============================================================================
# instruction_analyzer.asm - MANDATORY SYSTEM CORE
# =============================================================================
# CAVL CORE DEPENDENCY - SYSTEM WILL NOT FUNCTION WITHOUT THIS FILE
#
# This MIPS program analyzes user code and produces metrics that the
# frontend REQUIRES for visualization. This is NOT a demo - it is a
# hard runtime dependency.
#
# WHAT THIS DOES:
#   1. Receives instruction opcodes in input buffer (injected by backend)
#   2. Classifies each instruction (R-type, I-type, J-type, memory, branch)
#   3. Counts instructions by category
#   4. Tracks register usage frequency
#   5. Outputs structured analysis data
#
# INPUT CONTRACT (injected by FastAPI into .data):
#   instruction_buffer: Array of 32-bit instruction words
#   instruction_count:  Number of instructions to analyze
#
# OUTPUT CONTRACT (read by FastAPI from memory):
#   analysis_results: Starting at known address
#     +0:  r_type_count      (arithmetic: add, sub, and, or, slt, etc.)
#     +4:  i_type_count      (immediate: addi, andi, ori, slti, etc.)
#     +8:  load_count        (memory loads: lw, lb, lh, lbu, lhu)
#     +12: store_count       (memory stores: sw, sb, sh)
#     +16: branch_count      (branches: beq, bne, blez, bgtz, etc.)
#     +20: jump_count        (jumps: j, jal, jr, jalr)
#     +24: syscall_count     (syscall instructions)
#     +28: other_count       (unclassified)
#     +32: total_analyzed    (total instructions processed)
#     +36: register_usage[32] (128 bytes - usage count per register)
#
# ALGORITHM: Pure MIPS instruction classification
#   - Extract opcode (bits 31-26)
#   - For R-type (opcode=0), extract funct (bits 5-0)
#   - Classify and increment counters
#   - Track destination register usage
#
# =============================================================================

.data
    .align 2
    
    # ===== INPUT BUFFER (injected by FastAPI) =====
    instruction_count:  .word 0             # Number of instructions to analyze
    instruction_buffer: .space 400          # Up to 100 instructions (100 * 4 bytes)
    
    # ===== OUTPUT: ANALYSIS RESULTS =====
    # This is the critical output that frontend visualizes
    analysis_results:
    r_type_count:       .word 0             # +0:  R-type arithmetic
    i_type_count:       .word 0             # +4:  I-type immediate
    load_count:         .word 0             # +8:  Memory loads
    store_count:        .word 0             # +12: Memory stores
    branch_count:       .word 0             # +16: Branch instructions
    jump_count:         .word 0             # +20: Jump instructions
    syscall_count:      .word 0             # +24: Syscall instructions
    other_count:        .word 0             # +28: Other/unknown
    total_analyzed:     .word 0             # +32: Total processed
    
    # Register usage frequency (32 registers * 4 bytes = 128 bytes)
    register_usage:     .space 128          # +36: Usage count per register
    
    # ===== ANALYSIS COMPLETE FLAG =====
    analysis_complete:  .word 0             # Set to 1 when done (for verification)
    analysis_magic:     .word 0             # Set to 0xCAVL1234 to verify execution

.text
.globl main

# =============================================================================
# main - Entry point for instruction analysis
# =============================================================================
main:
    # Initialize all counters to zero
    jal init_counters
    
    # Load instruction count
    lw $s0, instruction_count       # $s0 = number of instructions
    beqz $s0, analysis_done         # If no instructions, skip
    
    # Setup pointers
    la $s1, instruction_buffer      # $s1 = pointer to current instruction
    li $s2, 0                       # $s2 = current index
    
analyze_loop:
    bge $s2, $s0, analysis_done     # If index >= count, done
    
    # Load current instruction word
    lw $a0, 0($s1)                  # $a0 = instruction word
    
    # Analyze this instruction
    jal analyze_instruction
    
    # Move to next instruction
    addi $s1, $s1, 4                # Next instruction address
    addi $s2, $s2, 1                # Increment index
    
    # Update total count
    lw $t0, total_analyzed
    addi $t0, $t0, 1
    sw $t0, total_analyzed
    
    j analyze_loop

analysis_done:
    # Set completion flag and magic number
    li $t0, 1
    sw $t0, analysis_complete
    
    li $t0, 0xCAFE1234              # Magic number to verify execution
    sw $t0, analysis_magic
    
    # Exit
    li $v0, 10
    syscall

# =============================================================================
# init_counters - Initialize all counters to zero
# =============================================================================
init_counters:
    # Clear instruction counters
    sw $zero, r_type_count
    sw $zero, i_type_count
    sw $zero, load_count
    sw $zero, store_count
    sw $zero, branch_count
    sw $zero, jump_count
    sw $zero, syscall_count
    sw $zero, other_count
    sw $zero, total_analyzed
    sw $zero, analysis_complete
    sw $zero, analysis_magic
    
    # Clear register usage array (32 words)
    la $t0, register_usage
    li $t1, 0                       # Counter
    li $t2, 32                      # 32 registers
    
clear_reg_loop:
    bge $t1, $t2, clear_done
    sw $zero, 0($t0)
    addi $t0, $t0, 4
    addi $t1, $t1, 1
    j clear_reg_loop
    
clear_done:
    jr $ra

# =============================================================================
# analyze_instruction - Classify a single instruction
# =============================================================================
# Input: $a0 = 32-bit instruction word
# Modifies: $t0-$t7
# =============================================================================
analyze_instruction:
    addi $sp, $sp, -4
    sw $ra, 0($sp)
    
    # Extract opcode (bits 31-26)
    srl $t0, $a0, 26                # $t0 = opcode (6 bits)
    andi $t0, $t0, 0x3F             # Mask to 6 bits
    
    # Check opcode categories
    
    # Opcode 0 = R-type (check funct field)
    beqz $t0, check_r_type
    
    # Opcode 2 = j (jump)
    li $t1, 2
    beq $t0, $t1, is_jump
    
    # Opcode 3 = jal (jump and link)
    li $t1, 3
    beq $t0, $t1, is_jump
    
    # Opcode 4 = beq (branch equal)
    li $t1, 4
    beq $t0, $t1, is_branch
    
    # Opcode 5 = bne (branch not equal)
    li $t1, 5
    beq $t0, $t1, is_branch
    
    # Opcode 6 = blez
    li $t1, 6
    beq $t0, $t1, is_branch
    
    # Opcode 7 = bgtz
    li $t1, 7
    beq $t0, $t1, is_branch
    
    # Opcode 8 = addi
    li $t1, 8
    beq $t0, $t1, is_i_type
    
    # Opcode 9 = addiu
    li $t1, 9
    beq $t0, $t1, is_i_type
    
    # Opcode 10 = slti
    li $t1, 10
    beq $t0, $t1, is_i_type
    
    # Opcode 11 = sltiu
    li $t1, 11
    beq $t0, $t1, is_i_type
    
    # Opcode 12 = andi
    li $t1, 12
    beq $t0, $t1, is_i_type
    
    # Opcode 13 = ori
    li $t1, 13
    beq $t0, $t1, is_i_type
    
    # Opcode 14 = xori
    li $t1, 14
    beq $t0, $t1, is_i_type
    
    # Opcode 15 = lui
    li $t1, 15
    beq $t0, $t1, is_i_type
    
    # Opcode 32 = lb (load byte)
    li $t1, 32
    beq $t0, $t1, is_load
    
    # Opcode 33 = lh (load half)
    li $t1, 33
    beq $t0, $t1, is_load
    
    # Opcode 35 = lw (load word)
    li $t1, 35
    beq $t0, $t1, is_load
    
    # Opcode 36 = lbu (load byte unsigned)
    li $t1, 36
    beq $t0, $t1, is_load
    
    # Opcode 37 = lhu (load half unsigned)
    li $t1, 37
    beq $t0, $t1, is_load
    
    # Opcode 40 = sb (store byte)
    li $t1, 40
    beq $t0, $t1, is_store
    
    # Opcode 41 = sh (store half)
    li $t1, 41
    beq $t0, $t1, is_store
    
    # Opcode 43 = sw (store word)
    li $t1, 43
    beq $t0, $t1, is_store
    
    # Default: other/unknown
    j is_other

check_r_type:
    # R-type: extract funct field (bits 5-0)
    andi $t1, $a0, 0x3F             # $t1 = funct
    
    # Funct 8 = jr (jump register)
    li $t2, 8
    beq $t1, $t2, is_jump
    
    # Funct 9 = jalr (jump and link register)
    li $t2, 9
    beq $t1, $t2, is_jump
    
    # Funct 12 = syscall
    li $t2, 12
    beq $t1, $t2, is_syscall
    
    # All other R-type are arithmetic
    j is_r_type

is_r_type:
    lw $t0, r_type_count
    addi $t0, $t0, 1
    sw $t0, r_type_count
    
    # Track destination register (rd: bits 15-11)
    srl $t1, $a0, 11
    andi $t1, $t1, 0x1F
    jal track_register
    j analyze_done_instr

is_i_type:
    lw $t0, i_type_count
    addi $t0, $t0, 1
    sw $t0, i_type_count
    
    # Track destination register (rt: bits 20-16)
    srl $t1, $a0, 16
    andi $t1, $t1, 0x1F
    jal track_register
    j analyze_done_instr

is_load:
    lw $t0, load_count
    addi $t0, $t0, 1
    sw $t0, load_count
    
    # Track destination register (rt: bits 20-16)
    srl $t1, $a0, 16
    andi $t1, $t1, 0x1F
    jal track_register
    j analyze_done_instr

is_store:
    lw $t0, store_count
    addi $t0, $t0, 1
    sw $t0, store_count
    j analyze_done_instr

is_branch:
    lw $t0, branch_count
    addi $t0, $t0, 1
    sw $t0, branch_count
    j analyze_done_instr

is_jump:
    lw $t0, jump_count
    addi $t0, $t0, 1
    sw $t0, jump_count
    j analyze_done_instr

is_syscall:
    lw $t0, syscall_count
    addi $t0, $t0, 1
    sw $t0, syscall_count
    j analyze_done_instr

is_other:
    lw $t0, other_count
    addi $t0, $t0, 1
    sw $t0, other_count
    j analyze_done_instr

analyze_done_instr:
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# track_register - Increment usage count for a register
# =============================================================================
# Input: $t1 = register number (0-31)
# =============================================================================
track_register:
    # Calculate offset: register_usage + (reg_num * 4)
    la $t2, register_usage
    sll $t3, $t1, 2                 # $t3 = reg_num * 4
    add $t2, $t2, $t3               # $t2 = address of counter
    
    # Increment counter
    lw $t3, 0($t2)
    addi $t3, $t3, 1
    sw $t3, 0($t2)
    
    jr $ra
