# CAVL User Guide

Complete guide to using Computer Architecture Visual Lab.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Using Features](#using-features)
4. [Example Programs](#example-programs)
5. [Tips & Troubleshooting](#tips--troubleshooting)

---

## Getting Started

### Accessing CAVL

1. Open browser to `http://localhost:3000`
2. Welcome screen appears with animated background
3. Click `<<` button (right side) to open menu

### Navigation

**Vertical Tab Menu** (5 tabs):
- **Welcome** - Landing page
- **Editor** - Write and execute code
- **Registers** - View 32 MIPS registers
- **Decoder** - Decode instructions to binary
- **Pipeline** - Simulate 5-stage pipeline

**Controls**: Click tab → Menu closes → Content appears | Press `ESC` to close menu

---

## Interface Overview

### Welcome Screen
- Animated particles and floating icons
- 4 feature cards
- Stats: "4 Tools, 32 Registers, ∞ Possibilities"

### Code Editor
- Monaco editor with MIPS syntax highlighting
- **Examples dropdown** (top-right): Load 5 pre-built programs
- **Execute button** (top-right): Run code
- Toast notifications for success/errors

### Register Display
- 32 MIPS registers in grid layout
- **Indigo glow**: Changed registers
- **HEX/DEC toggle**: Switch number format
- **Dimmed**: Unchanged registers

### Instruction Decoder
- **Input field**: Type any MIPS instruction
- **Quick Examples**: 6 clickable buttons (R/I/J-type)
- **Real-time decoding**: 300ms debounce
- **Visual output**:
  - Format badge (R/I/J-type)
  - 32-bit binary with color-coded fields
  - Field cards with hover tooltips
  - Machine code (hex/decimal) with copy buttons

### Pipeline Visualizer
- **Code input**: Text area for MIPS code
- **Load Example**: Pre-built hazard scenario
- **Enable Forwarding**: Toggle checkbox
- **Simulate button**: Run pipeline simulation
- **Visual output**:
  - 5 pipeline stages (IF → ID → EX → MEM → WB)
  - Hazard alerts (yellow warning box)
  - 8 performance metrics (CPI, efficiency, speedup, stalls, forwards, etc.)

---

## Using Features

### Writing MIPS Code

**Basic Structure**:
```asm
.data
    msg: .asciiz "Hello!\n"

.text
.globl main

main:
    li $v0, 4
    la $a0, msg
    syscall
    
    li $v0, 10
    syscall
```

**Common Instructions**:
- **Arithmetic**: `add`, `sub`, `addi`, `mult`, `div`
- **Logic**: `and`, `or`, `xor`, `nor`, `sll`, `srl`
- **Memory**: `lw`, `sw`, `lb`, `sb`, `la`, `li`
- **Branch**: `beq`, `bne`, `blt`, `bgt`, `j`, `jal`, `jr`
- **System**: `syscall`

**Register Conventions**:
- `$zero`: Always 0
- `$v0-$v1`: Return values
- `$a0-$a3`: Function arguments
- `$t0-$t9`: Temporaries (not preserved)
- `$s0-$s7`: Saved (preserved across calls)
- `$sp`: Stack pointer
- `$ra`: Return address

### Executing Code

1. Write/load code in Editor tab
2. Click **Execute Code** button
3. View results:
   - Green toast: "Execution Complete"
   - Red toast: Error message
4. Switch to **Registers** tab to see changes

### Decoding Instructions

1. Open **Decoder** tab
2. Type instruction (e.g., `add $t0, $t1, $t2`)
3. View real-time breakdown:
   - Format type (R/I/J)
   - Binary fields (color-coded)
   - Machine code (hex/decimal)
4. Click **Quick Examples** for instant loading
5. Hover over fields for descriptions
6. Click copy buttons for hex/decimal values

### Simulating Pipeline

1. Open **Pipeline** tab
2. Enter MIPS code or click **Load Example**
3. Toggle **Enable Forwarding** if desired
4. Click **Simulate Pipeline**
5. View results:
   - Pipeline stages with current instructions
   - Hazard alerts (RAW, load-use, control)
   - Performance metrics grid

---

## Example Programs

### 1. Hello World
Basic syscall demonstration - prints message

### 2. Arithmetic Demo
Simple register operations (li, add)

### 3. Heap Allocator (First-Fit)
malloc/free implementation with fragmentation demonstration
- Allocates 5 blocks (A, B, C, D, E)
- Frees blocks A and B
- Reallocates D in B's space, E in A's space
- Shows fragmentation

### 4. Memory Layout
Demonstrates all 4 memory segments:
- TEXT: Instructions
- DATA: Global variables
- HEAP: Dynamic allocation (grows up)
- STACK: Function calls (grows down)

### 5. Step-by-Step Demo
8 sections covering all instruction types:
- Immediate loading
- Arithmetic operations
- Logical operations
- Memory operations
- Branches
- Loops
- Functions
- Stack operations

---

## Tips & Best Practices

### Writing Clean Code
1. Comment your code with `#`
2. Use meaningful labels
3. Organize: `.data` before `.text`
4. Indent consistently
5. Always include exit syscall

### Debugging
1. Check register values in Register Display
2. Use print syscalls for intermediate values
3. Start simple, test incrementally
4. Watch for infinite loops (timeout errors)

### Common Syscalls

| Code | Service | Arguments |
|------|---------|-----------|
| 1 | Print integer | `$a0` = integer |
| 4 | Print string | `$a0` = string address |
| 5 | Read integer | Result in `$v0` |
| 9 | Allocate memory (sbrk) | `$a0` = size, result in `$v0` |
| 10 | Exit | None |
| 11 | Print character | `$a0` = character |

---

## Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Syntax error at line X" | Invalid MIPS syntax | Check instruction spelling |
| "Execution timeout" | Infinite loop | Check loop conditions |
| "Connection error" | Backend not running | Start backend server |
| "Could not decode" | Invalid instruction | Check instruction format |

### Checklist
- ✅ Backend running on port 8000?
- ✅ Frontend running on port 3000?
- ✅ Java installed for MARS?
- ✅ Code has `.globl main`?
- ✅ Code has exit syscall?

### Getting Help
- Architecture docs: `docs/ARCHITECTURE.md`
- Example programs: `examples/` directory
- MARS documentation: http://courses.missouristate.edu/kenvollmar/mars/

---

## Quick Reference

**MIPS Registers**:
```
$zero=0  $v0-$v1=return  $a0-$a3=args  $t0-$t9=temp
$s0-$s7=saved  $sp=stack  $ra=return  $gp=global
```

**Instruction Formats**:
- **R-type**: `opcode(6) | rs(5) | rt(5) | rd(5) | shamt(5) | funct(6)`
- **I-type**: `opcode(6) | rs(5) | rt(5) | immediate(16)`
- **J-type**: `opcode(6) | address(26)`

**Memory Segments**:
- TEXT: 0x00400000 (instructions)
- DATA: 0x10010000 (static data)
- HEAP: 0x10040000+ (dynamic, grows up)
- STACK: 0x7FFFEFFC (calls, grows down)

---

Happy coding with CAVL! 🚀
