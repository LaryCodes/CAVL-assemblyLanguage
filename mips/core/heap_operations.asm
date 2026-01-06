# =============================================================================
# heap_operations.asm - Input-Parameterized Heap Operations
# =============================================================================
# CAVL Core MIPS Program - ALL ALLOCATION LOGIC IS HERE
#
# INPUT CONTRACT (values injected by FastAPI into .data section):
#   operation_type: .word 0    # 0 = allocate, 1 = free, 2 = init_only
#   requested_size: .word 0    # Size for allocation (bytes)
#   free_address:   .word 0    # Address to free (user data pointer)
#
# OUTPUT CONTRACT (read by FastAPI from registers):
#   $v0 = result_address       # Allocated address, or -1 on failure
#   $v1 = status_code          # 0 = success, 1 = failure
#
# HEAP METADATA CONTRACT (read by FastAPI from memory dump):
#   heap_start_addr:  Starting address of heap
#   heap_end_addr:    Current end of heap (break)
#   free_list_head:   Head of free list (0 = empty)
#   Block format at each heap address:
#     Word 0 (+0):  Block size (including 12-byte header)
#     Word 1 (+4):  Allocated flag (0 = free, 1 = allocated)
#     Word 2 (+8):  Next free block pointer (0 = end of list)
#     Word 3+ (+12): User data begins here
#
# ALGORITHM: First-Fit Allocation (implemented entirely in MIPS)
#   1. Traverse free list looking for first block >= requested size
#   2. If found and large enough, split block
#   3. If not found, extend heap via sbrk
#   4. Update free list pointers
#
# =============================================================================

.data
    .align 2
    
    # ===== INPUT PARAMETERS (injected by FastAPI) =====
    operation_type:     .word 0         # 0=malloc, 1=free, 2=init_only
    requested_size:     .word 0         # Size to allocate (bytes)
    free_address:       .word 0         # Address to free
    
    # ===== HEAP STATE (persistent, read by FastAPI) =====
    heap_start_addr:    .word 0         # Start of managed heap
    heap_end_addr:      .word 0         # Current heap break
    free_list_head:     .word 0         # Head of free list
    
    # ===== CONSTANTS =====
    HEADER_SIZE:        .word 12        # 3 words: size, allocated, next
    MIN_BLOCK_SIZE:     .word 16        # Minimum block (header + 4 bytes)
    INITIAL_HEAP_SIZE:  .word 1024      # Initial heap request (bytes)
    
    # ===== OPERATION RESULT (for debugging) =====
    last_operation:     .word 0         # Last operation performed
    last_result:        .word 0         # Last operation result

.text
.globl main

# =============================================================================
# main - Entry point, dispatches based on operation_type
# =============================================================================
main:
    # Initialize heap if not already done
    lw $t0, heap_start_addr
    bnez $t0, heap_ready
    jal heap_init
    
heap_ready:
    # Load and dispatch based on operation type
    lw $t0, operation_type
    sw $t0, last_operation      # Record operation for debugging
    
    # operation_type == 0: allocate
    beqz $t0, do_allocate
    
    # operation_type == 1: free
    li $t1, 1
    beq $t0, $t1, do_free
    
    # operation_type == 2: init only (just initialize heap, return)
    li $t1, 2
    beq $t0, $t1, do_init_only
    
    # Invalid operation type
    li $v0, -1
    li $v1, 1                   # Status: failure
    j exit_program

do_init_only:
    # Heap already initialized above, just return success
    lw $v0, heap_start_addr     # Return heap start as result
    li $v1, 0                   # Status: success
    j exit_program

do_allocate:
    # Load requested size and call malloc
    lw $a0, requested_size
    jal malloc
    # $v0 now contains allocated address (or -1 on failure)
    sw $v0, last_result         # Record result
    
    # Set status based on result
    bltz $v0, alloc_failed
    li $v1, 0                   # Status: success
    j exit_program
    
alloc_failed:
    li $v1, 1                   # Status: failure
    j exit_program

do_free:
    # Load address and call free
    lw $a0, free_address
    jal free
    # free doesn't return a meaningful value
    li $v0, 0                   # Return 0 for free
    sw $v0, last_result
    li $v1, 0                   # Status: success
    j exit_program

exit_program:
    # Exit syscall - $v0 and $v1 contain results for FastAPI to read
    # We need to preserve $v0/$v1, so save them first
    move $t0, $v0
    move $t1, $v1
    
    # Store final results in memory for parsing
    sw $t0, last_result
    
    # Exit
    li $v0, 10
    syscall

# =============================================================================
# heap_init - Initialize the heap allocator
# =============================================================================
# Creates initial heap space and sets up the first free block.
# Called automatically on first operation if heap not initialized.
#
# Modifies: $t0-$t3, $v0, $a0
# =============================================================================
heap_init:
    addi $sp, $sp, -4
    sw $ra, 0($sp)
    
    # Request initial heap memory using sbrk syscall
    li $v0, 9                       # sbrk syscall number
    lw $a0, INITIAL_HEAP_SIZE       # Request initial size
    syscall
    move $t0, $v0                   # $t0 = heap start address
    
    # Store heap boundaries
    sw $t0, heap_start_addr
    
    # Calculate and store heap end
    lw $t1, INITIAL_HEAP_SIZE
    add $t1, $t0, $t1               # heap_end = heap_start + size
    sw $t1, heap_end_addr
    
    # Initialize first free block (entire heap is one free block)
    # Block header format: [size][allocated][next]
    lw $t2, INITIAL_HEAP_SIZE
    sw $t2, 0($t0)                  # size = INITIAL_HEAP_SIZE
    sw $zero, 4($t0)                # allocated = 0 (free)
    sw $zero, 8($t0)                # next = 0 (end of free list)
    
    # Set free list head to this block
    sw $t0, free_list_head
    
    lw $ra, 0($sp)
    addi $sp, $sp, 4
    jr $ra

# =============================================================================
# malloc - Allocate memory using First-Fit strategy
# =============================================================================
# ALGORITHM (First-Fit):
#   1. Calculate total size needed (requested + header, aligned)
#   2. Traverse free list from head
#   3. For each free block, check if size >= needed
#   4. First block that fits: allocate it
#   5. If block is large enough, split it
#   6. If no fit found, extend heap with sbrk
#
# Arguments:
#   $a0 = requested size in bytes (user data only)
#
# Returns:
#   $v0 = pointer to user data area, or -1 if allocation failed
#
# Modifies: $t0-$t7, $s0-$s3, $v0
# =============================================================================
malloc:
    addi $sp, $sp, -20
    sw $ra, 16($sp)
    sw $s0, 12($sp)
    sw $s1, 8($sp)
    sw $s2, 4($sp)
    sw $s3, 0($sp)
    
    # =========================================================================
    # Step 1: Calculate total size needed
    # total = requested + HEADER_SIZE, aligned to 4 bytes
    # =========================================================================
    lw $t0, HEADER_SIZE
    add $s0, $a0, $t0               # $s0 = requested + header
    
    # Align to 4 bytes (round up): size = (size + 3) & ~3
    addi $s0, $s0, 3
    li $t0, -4                      # ~3 in two's complement
    and $s0, $s0, $t0               # $s0 = aligned total size
    
    # Ensure minimum block size
    lw $t0, MIN_BLOCK_SIZE
    bge $s0, $t0, size_ok
    move $s0, $t0                   # Use minimum size
size_ok:

    # =========================================================================
    # Step 2-4: First-Fit Search
    # Traverse free list looking for first block >= $s0
    # =========================================================================
    lw $s1, free_list_head          # $s1 = current block pointer
    li $s2, 0                       # $s2 = previous block (for list update)
    
first_fit_loop:
    beqz $s1, no_fit_found          # End of free list, no fit
    
    # Load current block's size
    lw $t0, 0($s1)                  # $t0 = block size
    
    # FIRST-FIT CHECK: Is this block large enough?
    bge $t0, $s0, found_fit         # If size >= needed, use this block
    
    # Move to next block in free list
    move $s2, $s1                   # prev = current
    lw $s1, 8($s1)                  # current = current->next
    j first_fit_loop

found_fit:
    # =========================================================================
    # Step 5: Found a fit at $s1, check if we should split
    # Split if: remaining_size >= MIN_BLOCK_SIZE
    # =========================================================================
    lw $t0, 0($s1)                  # $t0 = block size
    sub $t1, $t0, $s0               # $t1 = remaining size after allocation
    lw $t2, MIN_BLOCK_SIZE
    blt $t1, $t2, no_split          # Don't split if remainder too small
    
    # ----- SPLIT THE BLOCK -----
    # New free block starts at: $s1 + $s0
    add $t3, $s1, $s0               # $t3 = address of new free block
    
    # Set up new free block header
    sw $t1, 0($t3)                  # new_block.size = remaining
    sw $zero, 4($t3)                # new_block.allocated = 0
    lw $t4, 8($s1)                  # $t4 = original next pointer
    sw $t4, 8($t3)                  # new_block.next = original next
    
    # Update allocated block size to exact needed size
    sw $s0, 0($s1)                  # allocated_block.size = needed
    
    # Update free list to point to new block instead of allocated block
    beqz $s2, update_head_split
    sw $t3, 8($s2)                  # prev->next = new_block
    j mark_allocated
    
update_head_split:
    sw $t3, free_list_head          # head = new_block
    j mark_allocated

no_split:
    # ----- USE ENTIRE BLOCK (no split) -----
    # Remove this block from free list entirely
    lw $t0, 8($s1)                  # $t0 = current->next
    beqz $s2, update_head_no_split
    sw $t0, 8($s2)                  # prev->next = current->next
    j mark_allocated
    
update_head_no_split:
    sw $t0, free_list_head          # head = current->next

mark_allocated:
    # Mark block as allocated
    li $t0, 1
    sw $t0, 4($s1)                  # block.allocated = 1
    sw $zero, 8($s1)                # Clear next pointer
    
    # Return pointer to user data (after header)
    lw $t0, HEADER_SIZE
    add $v0, $s1, $t0               # $v0 = block + HEADER_SIZE
    j malloc_done

no_fit_found:
    # =========================================================================
    # Step 6: No fit found - extend heap using sbrk
    # =========================================================================
    # Save needed size
    move $s3, $s0
    
    # Request more memory from OS
    li $v0, 9                       # sbrk syscall
    move $a0, $s0                   # Request exactly needed size
    syscall
    
    # Check if sbrk failed (returns -1 or 0 on some systems)
    bltz $v0, malloc_fail
    beqz $v0, malloc_fail
    
    move $t0, $v0                   # $t0 = new block address
    
    # Update heap end
    lw $t1, heap_end_addr
    add $t1, $t1, $s3
    sw $t1, heap_end_addr
    
    # Set up new block header (already allocated)
    sw $s3, 0($t0)                  # size = requested
    li $t1, 1
    sw $t1, 4($t0)                  # allocated = 1
    sw $zero, 8($t0)                # next = 0
    
    # Return pointer to user data
    lw $t1, HEADER_SIZE
    add $v0, $t0, $t1
    j malloc_done

malloc_fail:
    li $v0, -1                      # Return -1 on failure

malloc_done:
    lw $s3, 0($sp)
    lw $s2, 4($sp)
    lw $s1, 8($sp)
    lw $s0, 12($sp)
    lw $ra, 16($sp)
    addi $sp, $sp, 20
    jr $ra

# =============================================================================
# free - Free allocated memory and add to free list
# =============================================================================
# Arguments:
#   $a0 = pointer to user data area (NOT the block header)
#
# Returns: nothing (void)
#
# Modifies: $t0-$t2, $s0
# =============================================================================
free:
    addi $sp, $sp, -8
    sw $ra, 4($sp)
    sw $s0, 0($sp)
    
    # Calculate block header address (user_ptr - HEADER_SIZE)
    lw $t0, HEADER_SIZE
    sub $s0, $a0, $t0               # $s0 = block header address
    
    # Verify block is currently allocated
    lw $t0, 4($s0)                  # $t0 = allocated flag
    beqz $t0, free_done             # Already free, do nothing
    
    # Mark block as free
    sw $zero, 4($s0)                # allocated = 0
    
    # Add to front of free list (simple strategy)
    lw $t0, free_list_head          # $t0 = old head
    sw $t0, 8($s0)                  # block.next = old_head
    sw $s0, free_list_head          # head = block
    
    # Note: Coalescing (merging adjacent free blocks) is not implemented
    # in V1. This intentionally allows fragmentation to accumulate,
    # which is useful for demonstrating the concept in the visualization.

free_done:
    lw $s0, 0($sp)
    lw $ra, 4($sp)
    addi $sp, $sp, 8
    jr $ra
