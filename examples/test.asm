# Simple test program to verify MARS execution
.data
    msg: .asciiz "Hello MIPS!\n"

.text
.globl main
main:
    # Load immediate value into $t0
    li $t0, 42
    
    # Add two registers
    li $t1, 10
    add $t2, $t0, $t1
    
    # Exit program
    li $v0, 10
    syscall
