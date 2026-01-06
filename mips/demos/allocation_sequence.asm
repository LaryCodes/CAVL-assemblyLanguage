# =============================================================================
# allocation_sequence.asm - Demo: Multiple Allocations and Frees
# =============================================================================
# This demo shows a sequence of heap operations to demonstrate:
# 1. First-fit allocation behavior
# 2. Fragmentation creation
# 3. Block reuse after free
#
# Run this file directly in MARS to see the heap behavior.
# The backend uses heap_operations.asm for single operations.
# =============================================================================

.data
    .align 2
    # Heap metadata
    heap_start_addr:    .word 0
    heap_end_addr:      .word 0
    free_list_head:     .word 0
    
    # Constants
    HEADER_SIZE:        .word 12
    MIN_BLOCK_SIZE:     .word 16
    INITIAL_HEAP_SIZE:  .word 512
    
    # Demo messages
    msg_init:       .asciiz "=== Heap Allocator Demo ===\n"
    msg_alloc:      .asciiz "Allocating: "
    msg_free:       .asciiz "Freeing block at: "
    msg_result:     .asciiz " -> Address: "
    msg_fail:       .asciiz " -> FAILED\n"
    msg_done:       .asciiz "\n=== Demo Complete ===\n"
    newline:        .asciiz "\n"

.text
.globl main

main:
    # Print header
    li $v0, 4
    la $a0, msg_init
    syscall
    
    # Initialize heap
    jal heap_init
    
    # ===== Allocation Sequence =====
    
    # Alloc 1: 32 bytes
    li $a0, 32
    jal print_alloc_start
    li $a0, 32
    jal malloc
    move $s0, $v0           # Save address
    jal print_result
    
    # Alloc 2: 64 bytes
    li $a0, 64
    jal print_alloc_start
    li $a0, 64
    jal malloc
    move $s1, $v0
    jal print_result
    
    # Alloc 3: 32 bytes
    li $a0, 32
    jal print_alloc_start
    li $a0, 32
    jal malloc
    move $s2, $v0
    jal print_result

    # Free block 2 (creates hole in middle)
    move $a0, $s1
    jal print_free_start
    move $a0, $s1
    jal free
    
    # Alloc 4: 48 bytes - should fit in freed block 2 (first-fit)
    li $a0, 48
    jal print_alloc_start
    li $a0, 48
    jal malloc
    move $s3, $v0
    jal print_result
    
    # Free block 1
    move $a0, $s0
    jal print_free_start
    move $a0, $s0
    jal free
    
    # Alloc 5: 16 bytes - should use freed block 1 (first-fit)
    li $a0, 16
    jal print_alloc_start
    li $a0, 16
    jal malloc
    move $s4, $v0
    jal print_result
    
    # Print done
    li $v0, 4
    la $a0, msg_done
    syscall
    
    # Exit
    li $v0, 10
    syscall

# ===== Helper Functions =====

print_alloc_start:
    move $t9, $a0       # Save size
    li $v0, 4
    la $a0, msg_alloc
    syscall
    li $v0, 1
    move $a0, $t9
    syscall
    jr $ra

print_free_start:
    move $t9, $a0       # Save address
    li $v0, 4
    la $a0, msg_free
    syscall
    li $v0, 1
    move $a0, $t9
    syscall
    li $v0, 4
    la $a0, newline
    syscall
    jr $ra

print_result:
    bltz $v0, print_fail
    move $t9, $v0
    li $v0, 4
    la $a0, msg_result
    syscall
    li $v0, 1
    move $a0, $t9
    syscall
    li $v0, 4
    la $a0, newline
    syscall
    jr $ra

print_fail:
    li $v0, 4
    la $a0, msg_fail
    syscall
    jr $ra

# ===== Include heap functions =====
# (Copy from heap_operations.asm or use .include if MARS supports it)

heap_init:
    addi $sp, $sp, -4
    sw $ra, 0($sp)
    li $v0, 9
    lw $a0, INITIAL_HEAP_SIZE
    syscall
    move $t0, $v0
    sw $t0, heap_start_addr
    lw $t1, INITIAL_HEAP_SIZE
    add $t1, $t0, $t1
    sw $t1, heap_end_addr
    lw $t2, INITIAL_HEAP_SIZE
    sw $t2, 0($t0)
    sw $zero, 4($t0)
    sw $zero, 8($t0)
    sw $t0, free_list_head
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra


malloc:
    addi $sp, $sp, -20
    sw $ra, 16($sp)
    sw $s0, 12($sp)
    sw $s1, 8($sp)
    sw $s2, 4($sp)
    sw $s3, 0($sp)
    
    lw $t0, HEADER_SIZE
    add $s0, $a0, $t0
    addi $s0, $s0, 3
    li $t0, -4
    and $s0, $s0, $t0
    lw $t0, MIN_BLOCK_SIZE
    bge $s0, $t0, malloc_size_ok
    move $s0, $t0
malloc_size_ok:
    lw $s1, free_list_head
    li $s2, 0

malloc_search:
    beqz $s1, malloc_extend
    lw $t0, 0($s1)
    bge $t0, $s0, malloc_found
    move $s2, $s1
    lw $s1, 8($s1)
    j malloc_search

malloc_found:
    lw $t0, 0($s1)
    sub $t1, $t0, $s0
    lw $t2, MIN_BLOCK_SIZE
    blt $t1, $t2, malloc_no_split
    
    add $t3, $s1, $s0
    sw $t1, 0($t3)
    sw $zero, 4($t3)
    lw $t4, 8($s1)
    sw $t4, 8($t3)
    sw $s0, 0($s1)
    beqz $s2, malloc_update_head_split
    sw $t3, 8($s2)
    j malloc_mark
malloc_update_head_split:
    sw $t3, free_list_head
    j malloc_mark

malloc_no_split:
    lw $t0, 8($s1)
    beqz $s2, malloc_update_head_nosplit
    sw $t0, 8($s2)
    j malloc_mark
malloc_update_head_nosplit:
    sw $t0, free_list_head

malloc_mark:
    li $t0, 1
    sw $t0, 4($s1)
    sw $zero, 8($s1)
    lw $t0, HEADER_SIZE
    add $v0, $s1, $t0
    j malloc_done

malloc_extend:
    move $s3, $s0
    li $v0, 9
    move $a0, $s0
    syscall
    bltz $v0, malloc_fail
    beqz $v0, malloc_fail
    move $t0, $v0
    lw $t1, heap_end_addr
    add $t1, $t1, $s3
    sw $t1, heap_end_addr
    sw $s3, 0($t0)
    li $t1, 1
    sw $t1, 4($t0)
    sw $zero, 8($t0)
    lw $t1, HEADER_SIZE
    add $v0, $t0, $t1
    j malloc_done

malloc_fail:
    li $v0, -1

malloc_done:
    lw $s3, 0($sp)
    lw $s2, 4($sp)
    lw $s1, 8($sp)
    lw $s0, 12($sp)
    lw $ra, 16($sp)
    addi $sp, $sp, 20
    jr $ra

free:
    addi $sp, $sp, -8
    sw $ra, 4($sp)
    sw $s0, 0($sp)
    lw $t0, HEADER_SIZE
    sub $s0, $a0, $t0
    lw $t0, 4($s0)
    beqz $t0, free_done
    sw $zero, 4($s0)
    lw $t0, free_list_head
    sw $t0, 8($s0)
    sw $s0, free_list_head
free_done:
    lw $s0, 0($sp)
    lw $ra, 4($sp)
    addi $sp, $sp, 8
    jr $ra
