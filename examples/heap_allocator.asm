# =============================================================================
# Heap Allocator Demo Program - First-Fit Implementation
# =============================================================================
# This program implements a First-Fit heap allocator in MIPS assembly.
# All allocation decisions are made here in assembly - the backend only
# parses the resulting heap metadata for visualization.
#
# Heap Block Format (12-byte header):
#   Word 0 (+0):  Block size (including header, in bytes)
#   Word 1 (+4):  Allocated flag (0 = free, 1 = allocated)
#   Word 2 (+8):  Next free block pointer (valid only if free, 0 = end of list)
#   Word 3+ (+12): User data (starts here)
#
# Memory Layout:
#   heap_start -> [Header][User Data][Header][User Data]...
#
# Free List:
#   Singly-linked list of free blocks, maintained via next pointer in header.
#   free_list_head points to first free block (or 0 if none).
#
# Requirements: 3.1, 3.2, 3.3, 10.4
# =============================================================================

.data
    # Heap management metadata (stored in data segment for backend parsing)
    .align 2
    heap_start_addr:    .word 0         # Starting address of managed heap
    heap_end_addr:      .word 0         # Current end of heap (break)
    free_list_head:     .word 0         # Head of free list (0 = empty)
    
    # Constants
    HEADER_SIZE:        .word 12        # 3 words = 12 bytes
    MIN_BLOCK_SIZE:     .word 16        # Minimum block size (header + 4 bytes data)
    INITIAL_HEAP_SIZE:  .word 256       # Initial heap size to request
    
    # Demo messages
    init_msg:           .asciiz "Initializing heap allocator...\n"
    alloc_msg:          .asciiz "Allocating memory...\n"
    free_msg:           .asciiz "Freeing memory...\n"
    done_msg:           .asciiz "Heap operations complete.\n"
    newline:            .asciiz "\n"

.text
.globl main

# =============================================================================
# Main Program - Demonstrates malloc and free operations
# =============================================================================
main:
    # Initialize heap allocator
    jal heap_init
    
    # =========================================================================
    # Demo: Allocate three blocks
    # =========================================================================
    
    # Allocate 20 bytes (Block A)
    li $a0, 20
    jal malloc
    move $s0, $v0               # $s0 = address of Block A (or 0 if failed)
    
    # Write marker to Block A
    beqz $s0, skip_write_a
    li $t0, 0xAAAAAAAA
    sw $t0, 0($s0)
skip_write_a:
    
    # Allocate 32 bytes (Block B)
    li $a0, 32
    jal malloc
    move $s1, $v0               # $s1 = address of Block B
    
    # Write marker to Block B
    beqz $s1, skip_write_b
    li $t0, 0xBBBBBBBB
    sw $t0, 0($s1)
skip_write_b:
    
    # Allocate 16 bytes (Block C)
    li $a0, 16
    jal malloc
    move $s2, $v0               # $s2 = address of Block C
    
    # Write marker to Block C
    beqz $s2, skip_write_c
    li $t0, 0xCCCCCCCC
    sw $t0, 0($s2)
skip_write_c:
    
    # =========================================================================
    # Demo: Free Block B (creates fragmentation)
    # =========================================================================
    beqz $s1, skip_free_b
    move $a0, $s1
    jal free
skip_free_b:
    
    # =========================================================================
    # Demo: Allocate 24 bytes (Block D) - should use freed Block B (first-fit)
    # =========================================================================
    li $a0, 24
    jal malloc
    move $s3, $v0               # $s3 = address of Block D
    
    # Write marker to Block D
    beqz $s3, skip_write_d
    li $t0, 0xDDDDDDDD
    sw $t0, 0($s3)
skip_write_d:
    
    # =========================================================================
    # Demo: Free Block A
    # =========================================================================
    beqz $s0, skip_free_a
    move $a0, $s0
    jal free
skip_free_a:
    
    # =========================================================================
    # Demo: Allocate 8 bytes (Block E) - should use freed Block A (first-fit)
    # =========================================================================
    li $a0, 8
    jal malloc
    move $s4, $v0               # $s4 = address of Block E
    
    # Write marker to Block E
    beqz $s4, skip_write_e
    li $t0, 0xEEEEEEEE
    sw $t0, 0($s4)
skip_write_e:
    
    # =========================================================================
    # Final state: Blocks C, D, E allocated; some fragmentation may exist
    # Register summary for visualization:
    #   $s0 = Block A address (now freed and reused)
    #   $s1 = Block B address (freed, reused by D)
    #   $s2 = Block C address (still allocated)
    #   $s3 = Block D address (allocated in B's space)
    #   $s4 = Block E address (allocated in A's space)
    # =========================================================================
    
    # Exit program
    li $v0, 10
    syscall

# =============================================================================
# heap_init - Initialize the heap allocator
# =============================================================================
# Requests initial heap memory from OS and sets up free list.
# Returns: nothing
# Modifies: $t0-$t3, $v0, $a0
# =============================================================================
heap_init:
    addi $sp, $sp, -4
    sw $ra, 0($sp)
    
    # Request initial heap memory using sbrk
    li $v0, 9                   # sbrk syscall
    lw $a0, INITIAL_HEAP_SIZE   # Request initial size
    syscall
    move $t0, $v0               # $t0 = heap start address
    
    # Store heap boundaries
    sw $t0, heap_start_addr
    
    # Calculate heap end
    lw $t1, INITIAL_HEAP_SIZE
    add $t1, $t0, $t1           # $t1 = heap_start + size
    sw $t1, heap_end_addr
    
    # Initialize first free block (entire heap is one free block)
    # Block header at heap_start:
    #   Word 0: size = INITIAL_HEAP_SIZE
    #   Word 1: allocated = 0 (free)
    #   Word 2: next = 0 (end of free list)
    
    lw $t2, INITIAL_HEAP_SIZE
    sw $t2, 0($t0)              # size
    sw $zero, 4($t0)            # allocated = 0
    sw $zero, 8($t0)            # next = 0
    
    # Set free list head to this block
    sw $t0, free_list_head
    
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# malloc - Allocate memory using First-Fit strategy
# =============================================================================
# Arguments:
#   $a0 = requested size in bytes
# Returns:
#   $v0 = pointer to allocated memory (user data area), or 0 if failed
# Modifies: $t0-$t7, $v0
# =============================================================================
malloc:
    addi $sp, $sp, -20
    sw $ra, 16($sp)
    sw $s0, 12($sp)
    sw $s1, 8($sp)
    sw $s2, 4($sp)
    sw $s3, 0($sp)
    
    # Calculate total size needed (requested + header, aligned to 4 bytes)
    lw $t0, HEADER_SIZE
    add $s0, $a0, $t0           # $s0 = requested + header
    
    # Align to 4 bytes (round up)
    addi $s0, $s0, 3
    andi $s0, $s0, -4           # $s0 = aligned total size
    
    # Ensure minimum block size
    lw $t0, MIN_BLOCK_SIZE
    bge $s0, $t0, size_ok
    move $s0, $t0               # Use minimum size
size_ok:
    
    # =========================================================================
    # First-Fit Search: Find first free block >= requested size
    # =========================================================================
    lw $s1, free_list_head      # $s1 = current block
    li $s2, 0                   # $s2 = previous block (for list manipulation)
    
search_loop:
    beqz $s1, no_fit_found      # End of free list
    
    # Check if current block fits
    lw $t0, 0($s1)              # $t0 = block size
    bge $t0, $s0, found_fit     # If size >= needed, found a fit
    
    # Move to next block
    move $s2, $s1               # prev = current
    lw $s1, 8($s1)              # current = current->next
    j search_loop
    
found_fit:
    # $s1 = block to allocate
    # $s2 = previous block (or 0 if $s1 is head)
    
    # Check if we should split the block
    lw $t0, 0($s1)              # $t0 = block size
    sub $t1, $t0, $s0           # $t1 = remaining size after allocation
    lw $t2, MIN_BLOCK_SIZE
    blt $t1, $t2, no_split      # Don't split if remainder too small
    
    # =========================================================================
    # Split the block
    # =========================================================================
    # New block starts at $s1 + $s0
    add $t3, $s1, $s0           # $t3 = address of new free block
    
    # Set up new free block header
    sw $t1, 0($t3)              # new block size = remaining
    sw $zero, 4($t3)            # allocated = 0
    lw $t4, 8($s1)              # get original next pointer
    sw $t4, 8($t3)              # new block->next = original next
    
    # Update allocated block size
    sw $s0, 0($s1)              # allocated block size = requested
    
    # Update free list: replace $s1 with new block
    beqz $s2, update_head_split
    sw $t3, 8($s2)              # prev->next = new block
    j mark_allocated
    
update_head_split:
    sw $t3, free_list_head      # head = new block
    j mark_allocated
    
no_split:
    # =========================================================================
    # Use entire block (no split)
    # =========================================================================
    # Remove block from free list
    lw $t0, 8($s1)              # $t0 = current->next
    beqz $s2, update_head_no_split
    sw $t0, 8($s2)              # prev->next = current->next
    j mark_allocated
    
update_head_no_split:
    sw $t0, free_list_head      # head = current->next
    
mark_allocated:
    # Mark block as allocated
    li $t0, 1
    sw $t0, 4($s1)              # allocated = 1
    sw $zero, 8($s1)            # clear next pointer
    
    # Return pointer to user data (after header)
    lw $t0, HEADER_SIZE
    add $v0, $s1, $t0           # $v0 = block + header_size
    j malloc_done
    
no_fit_found:
    # =========================================================================
    # No fit found - extend heap
    # =========================================================================
    # Request more memory from OS
    li $v0, 9                   # sbrk syscall
    move $a0, $s0               # Request needed size
    syscall
    
    beqz $v0, malloc_fail       # sbrk failed
    
    move $t0, $v0               # $t0 = new block address
    
    # Update heap end
    lw $t1, heap_end_addr
    add $t1, $t1, $s0
    sw $t1, heap_end_addr
    
    # Set up new block header (allocated)
    sw $s0, 0($t0)              # size
    li $t1, 1
    sw $t1, 4($t0)              # allocated = 1
    sw $zero, 8($t0)            # next = 0
    
    # Return pointer to user data
    lw $t1, HEADER_SIZE
    add $v0, $t0, $t1
    j malloc_done
    
malloc_fail:
    li $v0, 0                   # Return NULL
    
malloc_done:
    lw $s3, 0($sp)
    lw $s2, 4($sp)
    lw $s1, 8($sp)
    lw $s0, 12($sp)
    lw $ra, 16($sp)
    addi $sp, $sp, 20
    jr $ra

# =============================================================================
# free - Free allocated memory
# =============================================================================
# Arguments:
#   $a0 = pointer to memory to free (user data area, not header)
# Returns: nothing
# Modifies: $t0-$t5
# =============================================================================
free:
    addi $sp, $sp, -8
    sw $ra, 4($sp)
    sw $s0, 0($sp)
    
    # Calculate block header address
    lw $t0, HEADER_SIZE
    sub $s0, $a0, $t0           # $s0 = block header address
    
    # Verify block is allocated
    lw $t0, 4($s0)              # $t0 = allocated flag
    beqz $t0, free_done         # Already free, do nothing
    
    # Mark as free
    sw $zero, 4($s0)            # allocated = 0
    
    # =========================================================================
    # Add to front of free list (simple strategy)
    # =========================================================================
    lw $t0, free_list_head
    sw $t0, 8($s0)              # block->next = old head
    sw $s0, free_list_head      # head = block
    
    # =========================================================================
    # Optional: Coalesce adjacent free blocks
    # For simplicity in V1, we skip coalescing. This means fragmentation
    # can accumulate, which is actually useful for demonstrating the concept.
    # =========================================================================
    
free_done:
    lw $s0, 0($sp)
    lw $ra, 4($sp)
    addi $sp, $sp, 8
    jr $ra
