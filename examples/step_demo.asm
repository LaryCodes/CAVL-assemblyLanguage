# =============================================================================
# Step Execution Demo Program
# =============================================================================
# This program demonstrates step-by-step instruction execution, showing how
# each instruction affects registers and memory. Designed for use with the
# CAVL step debugger to visualize:
#   - Register value changes
#   - PC advancement
#   - Memory read/write operations
#   - Branch/jump behavior
#
# Each section is clearly marked to help students understand what to observe
# when stepping through the code.
#
# Requirements: 4.1, 4.2, 4.3
# =============================================================================

.data
    # Data for memory operations
    .align 2
    value1:     .word 100           # Initial value: 100
    value2:     .word 200           # Initial value: 200
    result:     .word 0             # Will store computation result
    array:      .word 10, 20, 30, 40, 50    # Array for loop demo
    
    # String for syscall demo
    message:    .asciiz "Step Demo\n"

.text
.globl main

main:
    # =========================================================================
    # SECTION 1: Immediate Value Loading
    # =========================================================================
    # Observe: $t0-$t3 change from 0 to loaded values
    # PC advances by 4 bytes per instruction
    # =========================================================================
    
    li $t0, 42              # Load immediate: $t0 = 42
    li $t1, 0xFF            # Load hex value: $t1 = 255
    li $t2, -10             # Load negative: $t2 = -10 (0xFFFFFFF6)
    li $t3, 0x12345678      # Load large value: $t3 = 0x12345678
    
    # =========================================================================
    # SECTION 2: Arithmetic Operations
    # =========================================================================
    # Observe: Result registers change based on operands
    # $t4 = $t0 + $t1 = 42 + 255 = 297
    # $t5 = $t0 - $t2 = 42 - (-10) = 52
    # =========================================================================
    
    add $t4, $t0, $t1       # $t4 = $t0 + $t1 = 297
    sub $t5, $t0, $t2       # $t5 = $t0 - $t2 = 52
    addi $t6, $t0, 100      # $t6 = $t0 + 100 = 142
    
    # Multiplication and division
    mult $t0, $t1           # HI:LO = $t0 * $t1
    mflo $t7                # $t7 = LO = 42 * 255 = 10710
    
    div $t1, $t0            # LO = $t1 / $t0, HI = $t1 % $t0
    mflo $t8                # $t8 = 255 / 42 = 6
    mfhi $t9                # $t9 = 255 % 42 = 3
    
    # =========================================================================
    # SECTION 3: Logical Operations
    # =========================================================================
    # Observe: Bitwise operations on register values
    # =========================================================================
    
    li $s0, 0x0F0F0F0F      # Pattern: 0000 1111 ...
    li $s1, 0xFF00FF00      # Pattern: 1111 1111 0000 0000 ...
    
    and $s2, $s0, $s1       # $s2 = $s0 AND $s1 = 0x0F000F00
    or $s3, $s0, $s1        # $s3 = $s0 OR $s1 = 0xFF0FFF0F
    xor $s4, $s0, $s1       # $s4 = $s0 XOR $s1 = 0xF00FF00F
    nor $s5, $s0, $zero     # $s5 = NOT $s0 = 0xF0F0F0F0
    
    # Shift operations
    li $s6, 0x00000001
    sll $s6, $s6, 4         # $s6 = 1 << 4 = 16 (0x10)
    srl $s7, $s1, 8         # $s7 = $s1 >> 8 = 0x00FF00FF
    
    # =========================================================================
    # SECTION 4: Memory Load/Store Operations
    # =========================================================================
    # Observe: Memory values change, registers load from memory
    # =========================================================================
    
    la $t0, value1          # $t0 = address of value1
    lw $t1, 0($t0)          # $t1 = memory[value1] = 100
    
    la $t2, value2
    lw $t3, 0($t2)          # $t3 = memory[value2] = 200
    
    # Compute and store result
    add $t4, $t1, $t3       # $t4 = 100 + 200 = 300
    la $t5, result
    sw $t4, 0($t5)          # memory[result] = 300
    
    # Verify store by loading back
    lw $t6, 0($t5)          # $t6 = memory[result] = 300
    
    # =========================================================================
    # SECTION 5: Conditional Branches
    # =========================================================================
    # Observe: PC jumps based on condition (not always +4)
    # =========================================================================
    
    li $t0, 5
    li $t1, 10
    
    # Branch if equal (not taken)
    beq $t0, $t1, skip1     # 5 != 10, so branch NOT taken
    addi $t0, $t0, 1        # This executes: $t0 = 6
skip1:
    
    # Branch if not equal (taken)
    bne $t0, $t1, skip2     # 6 != 10, so branch IS taken
    addi $t0, $t0, 100      # This is SKIPPED
skip2:
    
    # Branch if less than (using slt + beq)
    slt $t2, $t0, $t1       # $t2 = ($t0 < $t1) = (6 < 10) = 1
    beq $t2, $zero, skip3   # $t2 != 0, so branch NOT taken
    addi $t0, $t0, 1        # This executes: $t0 = 7
skip3:
    
    # Branch if greater than or equal
    li $t3, 7
    bge $t0, $t3, skip4     # 7 >= 7, so branch IS taken
    addi $t0, $t0, 100      # This is SKIPPED
skip4:
    
    # =========================================================================
    # SECTION 6: Loop with Array Access
    # =========================================================================
    # Observe: Loop counter changes, array elements accessed
    # Sum of array: 10 + 20 + 30 + 40 + 50 = 150
    # =========================================================================
    
    la $s0, array           # $s0 = base address of array
    li $s1, 0               # $s1 = sum = 0
    li $s2, 0               # $s2 = index i = 0
    li $s3, 5               # $s3 = array length = 5
    
loop_start:
    bge $s2, $s3, loop_end  # if i >= 5, exit loop
    
    # Calculate offset: i * 4 (word size)
    sll $t0, $s2, 2         # $t0 = i * 4
    add $t1, $s0, $t0       # $t1 = &array[i]
    lw $t2, 0($t1)          # $t2 = array[i]
    
    add $s1, $s1, $t2       # sum += array[i]
    addi $s2, $s2, 1        # i++
    
    j loop_start            # repeat loop
    
loop_end:
    # $s1 now contains 150 (sum of array)
    
    # =========================================================================
    # SECTION 7: Function Call (JAL/JR)
    # =========================================================================
    # Observe: $ra changes on jal, PC jumps to function and back
    # =========================================================================
    
    li $a0, 10              # Argument: n = 10
    jal compute_square      # Call function, $ra = return address
    move $s4, $v0           # $s4 = result = 100 (10^2)
    
    li $a0, 7
    jal compute_square      # Call again with n = 7
    move $s5, $v0           # $s5 = result = 49 (7^2)
    
    # =========================================================================
    # SECTION 8: Stack Operations
    # =========================================================================
    # Observe: $sp changes as we push/pop values
    # =========================================================================
    
    # Push values onto stack
    addi $sp, $sp, -12      # Allocate 12 bytes (3 words)
    sw $s1, 8($sp)          # Push sum (150)
    sw $s4, 4($sp)          # Push square1 (100)
    sw $s5, 0($sp)          # Push square2 (49)
    
    # Modify registers
    li $s1, 0
    li $s4, 0
    li $s5, 0
    
    # Pop values from stack (restore)
    lw $s5, 0($sp)          # Pop square2: $s5 = 49
    lw $s4, 4($sp)          # Pop square1: $s4 = 100
    lw $s1, 8($sp)          # Pop sum: $s1 = 150
    addi $sp, $sp, 12       # Deallocate stack space
    
    # =========================================================================
    # Program Complete
    # =========================================================================
    # Final register state summary:
    #   $s1 = 150 (array sum)
    #   $s4 = 100 (10^2)
    #   $s5 = 49 (7^2)
    # =========================================================================
    
    li $v0, 10              # Exit syscall
    syscall

# =============================================================================
# compute_square - Compute n^2
# =============================================================================
# Arguments: $a0 = n
# Returns: $v0 = n * n
# Demonstrates: Function call convention, register usage
# =============================================================================
compute_square:
    # Simple function - no need to save registers for this example
    mult $a0, $a0           # HI:LO = n * n
    mflo $v0                # $v0 = n^2
    jr $ra                  # Return to caller
