# =============================================================================
# Memory Layout Demo Program
# =============================================================================
# This program demonstrates the four main memory segments in MIPS:
#   1. TEXT SEGMENT   - Contains executable instructions (read-only)
#   2. DATA SEGMENT   - Contains static/global data (.data section)
#   3. HEAP SEGMENT   - Dynamic memory allocation (grows upward)
#   4. STACK SEGMENT  - Function call frames (grows downward)
#
# MIPS Memory Layout (addresses increase upward):
#   0x7FFFFFFF  ┌─────────────────┐
#               │     STACK       │  ← $sp (grows DOWN)
#               │       ↓         │
#               ├─────────────────┤
#               │                 │
#               │   (free space)  │
#               │                 │
#               ├─────────────────┤
#               │       ↑         │
#               │      HEAP       │  ← grows UP (via sbrk syscall)
#   0x10040000  ├─────────────────┤
#               │      DATA       │  ← .data section
#   0x10010000  ├─────────────────┤
#               │      TEXT       │  ← .text section (instructions)
#   0x00400000  └─────────────────┘
#
# Requirements: 1.1, 10.5
# =============================================================================

# -----------------------------------------------------------------------------
# DATA SEGMENT - Static/Global Variables
# -----------------------------------------------------------------------------
# The .data section is loaded at address 0x10010000 by default in MARS.
# Variables declared here exist for the entire program lifetime.
# -----------------------------------------------------------------------------
.data
    # String data
    welcome_msg:    .asciiz "Memory Layout Demo\n"
    data_label:     .asciiz "Data Segment Demo\n"
    heap_label:     .asciiz "Heap Segment Demo\n"
    stack_label:    .asciiz "Stack Segment Demo\n"
    newline:        .asciiz "\n"
    
    # Integer data (word-aligned)
    .align 2
    global_int:     .word 0x12345678      # 4-byte integer
    global_array:   .word 1, 2, 3, 4, 5   # Array of 5 integers
    
    # Byte data
    global_byte:    .byte 0xAB            # Single byte
    
    # Space reservation
    .align 2
    buffer:         .space 16             # Reserve 16 bytes

# -----------------------------------------------------------------------------
# TEXT SEGMENT - Executable Instructions
# -----------------------------------------------------------------------------
# The .text section starts at address 0x00400000 by default in MARS.
# This segment is read-only and contains all program instructions.
# -----------------------------------------------------------------------------
.text
.globl main

main:
    # =========================================================================
    # PART 1: Demonstrate DATA SEGMENT access
    # =========================================================================
    # Load address of global_int into $t0
    la $t0, global_int          # $t0 = address of global_int (in data segment)
    lw $t1, 0($t0)              # $t1 = value at global_int (0x12345678)
    
    # Load array element
    la $t2, global_array        # $t2 = base address of array
    lw $t3, 8($t2)              # $t3 = global_array[2] = 3
    
    # Modify data segment value
    li $t4, 0xDEADBEEF
    sw $t4, 0($t0)              # Store new value to global_int
    
    # =========================================================================
    # PART 2: Demonstrate HEAP SEGMENT (dynamic allocation via sbrk)
    # =========================================================================
    # Request 32 bytes from the heap using sbrk syscall
    li $v0, 9                   # syscall 9 = sbrk (allocate heap memory)
    li $a0, 32                  # Request 32 bytes
    syscall                     # $v0 = address of allocated memory
    
    move $t5, $v0               # $t5 = heap address (first allocation)
    
    # Write to heap memory
    li $t6, 0xCAFEBABE
    sw $t6, 0($t5)              # Store value at heap[0]
    li $t6, 0xFEEDFACE
    sw $t6, 4($t5)              # Store value at heap[4]
    
    # Allocate more heap memory (heap grows upward)
    li $v0, 9
    li $a0, 16                  # Request 16 more bytes
    syscall
    move $t7, $v0               # $t7 = second heap allocation (higher address)
    
    # Verify heap grows upward: $t7 should be > $t5
    # Write marker to second allocation
    li $t6, 0xBEEFCAFE
    sw $t6, 0($t7)
    
    # =========================================================================
    # PART 3: Demonstrate STACK SEGMENT (function calls)
    # =========================================================================
    # The stack pointer ($sp) starts at 0x7FFFEFFC and grows downward.
    # Each function call pushes a new frame onto the stack.
    
    # Save current stack pointer for comparison
    move $s0, $sp               # $s0 = original $sp
    
    # Call a function to demonstrate stack usage
    li $a0, 10                  # Argument for function
    jal stack_demo_func         # Call function (pushes return address)
    
    # After return, $sp should be restored
    # $s1 contains the $sp value inside the function (lower than $s0)
    
    # =========================================================================
    # PART 4: Show all segment addresses in registers for visualization
    # =========================================================================
    # $s2 = Text segment address (PC-relative)
    la $s2, main                # Address in text segment
    
    # $s3 = Data segment address
    la $s3, global_int          # Address in data segment
    
    # $s4 = Heap segment address (from earlier allocation)
    move $s4, $t5               # First heap allocation address
    
    # $s5 = Stack segment address
    move $s5, $sp               # Current stack pointer
    
    # =========================================================================
    # Exit program
    # =========================================================================
    li $v0, 10                  # syscall 10 = exit
    syscall

# -----------------------------------------------------------------------------
# Stack Demo Function
# -----------------------------------------------------------------------------
# Demonstrates stack frame creation and local variable storage.
# Stack grows DOWNWARD - pushing decreases $sp.
# -----------------------------------------------------------------------------
stack_demo_func:
    # Prologue: Create stack frame
    addi $sp, $sp, -16          # Allocate 16 bytes on stack (grows down)
    sw $ra, 12($sp)             # Save return address
    sw $s0, 8($sp)              # Save $s0 (callee-saved)
    sw $a0, 4($sp)              # Save argument
    
    # Record stack pointer inside function for comparison
    move $s1, $sp               # $s1 = $sp inside function (lower than caller's $sp)
    
    # Local computation using stack
    lw $t0, 4($sp)              # Load argument from stack
    addi $t0, $t0, 5            # Add 5
    sw $t0, 0($sp)              # Store result as local variable
    
    # Epilogue: Restore and return
    lw $s0, 8($sp)              # Restore $s0
    lw $ra, 12($sp)             # Restore return address
    addi $sp, $sp, 16           # Deallocate stack frame (grows back up)
    jr $ra                      # Return to caller
