"use client";

/**
 * CAVL - Computer Architecture Visual Lab
 * Main application page - Redesigned with vertical tab menu
 */

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

// Components
import WelcomeScreen from "@/components/WelcomeScreen";
import VerticalTabMenu, { TabId } from "@/components/VerticalTabMenu";
import RegisterDisplay from "@/components/RegisterDisplay";
import InstructionDecoder from "@/components/InstructionDecoder";
import PipelineVisualizer from "@/components/PipelineVisualizer";
import { ToastContainer, useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import type { ExecutionState, RegisterState } from "@/lib/types";

// Dynamic import Monaco Editor
const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-900/80">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-cyan-400 text-sm flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Loading editor...
      </motion.div>
    </div>
  ),
});

// Example programs
const EXAMPLE_PROGRAMS: Record<string, { name: string; code: string }> = {
  hello_world: {
    name: "Hello World",
    code: `.data
    msg: .asciiz "Hello from MIPS!\\n"

.text
.globl main

main:
    li $v0, 4
    la $a0, msg
    syscall
    
    li $v0, 10
    syscall`,
  },
  arithmetic: {
    name: "Arithmetic Demo",
    code: `.text
.globl main

main:
    li $t0, 42
    li $t1, 100
    add $t2, $t0, $t1
    
    li $v0, 10
    syscall`,
  },
  heap_allocator: {
    name: "Heap Allocator (First-Fit)",
    code: `# =============================================================================
# Heap Allocator Demo - First-Fit Implementation
# Demonstrates malloc/free operations with fragmentation
# =============================================================================

.data
    .align 2
    heap_start_addr:    .word 0
    heap_end_addr:      .word 0
    free_list_head:     .word 0
    HEADER_SIZE:        .word 12
    MIN_BLOCK_SIZE:     .word 16
    INITIAL_HEAP_SIZE:  .word 256

.text
.globl main

main:
    jal heap_init
    
    # Allocate Block A (20 bytes)
    li $a0, 20
    jal malloc
    move $s0, $v0
    beqz $s0, skip_a
    li $t0, 0xAAAAAAAA
    sw $t0, 0($s0)
skip_a:
    
    # Allocate Block B (32 bytes)
    li $a0, 32
    jal malloc
    move $s1, $v0
    beqz $s1, skip_b
    li $t0, 0xBBBBBBBB
    sw $t0, 0($s1)
skip_b:
    
    # Allocate Block C (16 bytes)
    li $a0, 16
    jal malloc
    move $s2, $v0
    beqz $s2, skip_c
    li $t0, 0xCCCCCCCC
    sw $t0, 0($s2)
skip_c:
    
    # Free Block B (creates fragmentation)
    beqz $s1, skip_free_b
    move $a0, $s1
    jal free
skip_free_b:
    
    # Allocate Block D (24 bytes) - reuses Block B
    li $a0, 24
    jal malloc
    move $s3, $v0
    beqz $s3, skip_d
    li $t0, 0xDDDDDDDD
    sw $t0, 0($s3)
skip_d:
    
    # Exit
    li $v0, 10
    syscall

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
    andi $s0, $s0, -4
    lw $t0, MIN_BLOCK_SIZE
    bge $s0, $t0, size_ok
    move $s0, $t0
size_ok:
    lw $s1, free_list_head
    li $s2, 0
search_loop:
    beqz $s1, no_fit
    lw $t0, 0($s1)
    bge $t0, $s0, found_fit
    move $s2, $s1
    lw $s1, 8($s1)
    j search_loop
found_fit:
    lw $t0, 0($s1)
    sub $t1, $t0, $s0
    lw $t2, MIN_BLOCK_SIZE
    blt $t1, $t2, no_split
    add $t3, $s1, $s0
    sw $t1, 0($t3)
    sw $zero, 4($t3)
    lw $t4, 8($s1)
    sw $t4, 8($t3)
    sw $s0, 0($s1)
    beqz $s2, update_head_split
    sw $t3, 8($s2)
    j mark_allocated
update_head_split:
    sw $t3, free_list_head
    j mark_allocated
no_split:
    lw $t0, 8($s1)
    beqz $s2, update_head_no_split
    sw $t0, 8($s2)
    j mark_allocated
update_head_no_split:
    sw $t0, free_list_head
mark_allocated:
    li $t0, 1
    sw $t0, 4($s1)
    sw $zero, 8($s1)
    lw $t0, HEADER_SIZE
    add $v0, $s1, $t0
    j malloc_done
no_fit:
    li $v0, 9
    move $a0, $s0
    syscall
    beqz $v0, malloc_fail
    move $t0, $v0
    lw $t1, heap_end_addr
    add $t1, $t1, $s0
    sw $t1, heap_end_addr
    sw $s0, 0($t0)
    li $t1, 1
    sw $t1, 4($t0)
    sw $zero, 8($t0)
    lw $t1, HEADER_SIZE
    add $v0, $t0, $t1
    j malloc_done
malloc_fail:
    li $v0, 0
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
    jr $ra`,
  },
  memory_layout: {
    name: "Memory Layout (TEXT/DATA/HEAP/STACK)",
    code: `# =============================================================================
# Memory Layout Demo - Shows all 4 memory segments
# TEXT (0x00400000) | DATA (0x10010000) | HEAP (grows up) | STACK (grows down)
# =============================================================================

.data
    welcome_msg:    .asciiz "Memory Layout Demo\\n"
    .align 2
    global_int:     .word 0x12345678
    global_array:   .word 1, 2, 3, 4, 5
    buffer:         .space 16

.text
.globl main

main:
    # =========================================================================
    # PART 1: DATA SEGMENT Access
    # =========================================================================
    la $t0, global_int
    lw $t1, 0($t0)              # $t1 = 0x12345678
    la $t2, global_array
    lw $t3, 8($t2)              # $t3 = array[2] = 3
    li $t4, 0xDEADBEEF
    sw $t4, 0($t0)              # Modify global_int
    
    # =========================================================================
    # PART 2: HEAP SEGMENT (dynamic allocation)
    # =========================================================================
    li $v0, 9                   # sbrk syscall
    li $a0, 32                  # Request 32 bytes
    syscall
    move $t5, $v0               # $t5 = heap address
    
    # Write to heap
    li $t6, 0xCAFEBABE
    sw $t6, 0($t5)
    li $t6, 0xFEEDFACE
    sw $t6, 4($t5)
    
    # Allocate more (heap grows upward)
    li $v0, 9
    li $a0, 16
    syscall
    move $t7, $v0               # $t7 > $t5 (higher address)
    li $t6, 0xBEEFCAFE
    sw $t6, 0($t7)
    
    # =========================================================================
    # PART 3: STACK SEGMENT (function calls)
    # =========================================================================
    move $s0, $sp               # Save original $sp
    li $a0, 10
    jal stack_demo_func         # Call function
    
    # =========================================================================
    # PART 4: Register Summary (for visualization)
    # =========================================================================
    la $s2, main                # TEXT segment address
    la $s3, global_int          # DATA segment address
    move $s4, $t5               # HEAP segment address
    move $s5, $sp               # STACK segment address
    
    # Exit
    li $v0, 10
    syscall

stack_demo_func:
    # Create stack frame (grows downward)
    addi $sp, $sp, -16
    sw $ra, 12($sp)
    sw $s0, 8($sp)
    sw $a0, 4($sp)
    
    move $s1, $sp               # $s1 = $sp inside function (lower than caller)
    
    # Local computation
    lw $t0, 4($sp)
    addi $t0, $t0, 5
    sw $t0, 0($sp)
    
    # Restore and return
    lw $s0, 8($sp)
    lw $ra, 12($sp)
    addi $sp, $sp, 16
    jr $ra`,
  },
  step_demo: {
    name: "Step-by-Step Execution Demo",
    code: `# =============================================================================
# Step Execution Demo - 8 sections demonstrating different instruction types
# Perfect for step-by-step debugging and visualization
# =============================================================================

.data
    .align 2
    value1:     .word 100
    value2:     .word 200
    result:     .word 0
    array:      .word 10, 20, 30, 40, 50

.text
.globl main

main:
    # =========================================================================
    # SECTION 1: Immediate Loading
    # =========================================================================
    li $t0, 42                  # $t0 = 42
    li $t1, 0xFF                # $t1 = 255
    li $t2, -10                 # $t2 = -10
    li $t3, 0x12345678          # $t3 = 0x12345678
    
    # =========================================================================
    # SECTION 2: Arithmetic
    # =========================================================================
    add $t4, $t0, $t1           # $t4 = 42 + 255 = 297
    sub $t5, $t0, $t2           # $t5 = 42 - (-10) = 52
    addi $t6, $t0, 100          # $t6 = 142
    mult $t0, $t1               # HI:LO = 42 * 255
    mflo $t7                    # $t7 = 10710
    div $t1, $t0                # LO = 255/42, HI = 255%42
    mflo $t8                    # $t8 = 6
    mfhi $t9                    # $t9 = 3
    
    # =========================================================================
    # SECTION 3: Logical Operations
    # =========================================================================
    li $s0, 0x0F0F0F0F
    li $s1, 0xFF00FF00
    and $s2, $s0, $s1           # $s2 = 0x0F000F00
    or $s3, $s0, $s1            # $s3 = 0xFF0FFF0F
    xor $s4, $s0, $s1           # $s4 = 0xF00FF00F
    nor $s5, $s0, $zero         # $s5 = 0xF0F0F0F0
    li $s6, 1
    sll $s6, $s6, 4             # $s6 = 16
    srl $s7, $s1, 8             # $s7 = 0x00FF00FF
    
    # =========================================================================
    # SECTION 4: Memory Operations
    # =========================================================================
    la $t0, value1
    lw $t1, 0($t0)              # $t1 = 100
    la $t2, value2
    lw $t3, 0($t2)              # $t3 = 200
    add $t4, $t1, $t3           # $t4 = 300
    la $t5, result
    sw $t4, 0($t5)              # Store 300
    lw $t6, 0($t5)              # Verify: $t6 = 300
    
    # =========================================================================
    # SECTION 5: Branches
    # =========================================================================
    li $t0, 5
    li $t1, 10
    beq $t0, $t1, skip1         # Not taken
    addi $t0, $t0, 1            # $t0 = 6
skip1:
    bne $t0, $t1, skip2         # Taken
    addi $t0, $t0, 100          # Skipped
skip2:
    slt $t2, $t0, $t1           # $t2 = 1 (6 < 10)
    
    # =========================================================================
    # SECTION 6: Array Loop
    # =========================================================================
    la $s0, array
    li $s1, 0                   # sum = 0
    li $s2, 0                   # i = 0
    li $s3, 5                   # length = 5
loop_start:
    bge $s2, $s3, loop_end
    sll $t0, $s2, 2             # offset = i * 4
    add $t1, $s0, $t0
    lw $t2, 0($t1)              # Load array[i]
    add $s1, $s1, $t2           # sum += array[i]
    addi $s2, $s2, 1            # i++
    j loop_start
loop_end:
    # $s1 = 150 (sum)
    
    # =========================================================================
    # SECTION 7: Function Calls
    # =========================================================================
    li $a0, 10
    jal compute_square          # $v0 = 100
    move $s4, $v0
    li $a0, 7
    jal compute_square          # $v0 = 49
    move $s5, $v0
    
    # =========================================================================
    # SECTION 8: Stack Operations
    # =========================================================================
    addi $sp, $sp, -12          # Push 3 values
    sw $s1, 8($sp)
    sw $s4, 4($sp)
    sw $s5, 0($sp)
    li $s1, 0
    li $s4, 0
    li $s5, 0
    lw $s5, 0($sp)              # Pop values
    lw $s4, 4($sp)
    lw $s1, 8($sp)
    addi $sp, $sp, 12
    
    # Exit
    li $v0, 10
    syscall

compute_square:
    mult $a0, $a0
    mflo $v0
    jr $ra`,
  },
};

// Default states
const DEFAULT_REGISTER_STATE: RegisterState = {
  values: {
    $zero: 0, $at: 0, $v0: 0, $v1: 0,
    $a0: 0, $a1: 0, $a2: 0, $a3: 0,
    $t0: 0, $t1: 0, $t2: 0, $t3: 0, $t4: 0, $t5: 0, $t6: 0, $t7: 0,
    $s0: 0, $s1: 0, $s2: 0, $s3: 0, $s4: 0, $s5: 0, $s6: 0, $s7: 0,
    $t8: 0, $t9: 0, $k0: 0, $k1: 0,
    $gp: 268468224, $sp: 2147479548, $fp: 0, $ra: 0,
  },
};

export default function Home() {
  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("welcome");

  // Code editor state
  const [code, setCode] = useState(EXAMPLE_PROGRAMS.hello_world.code);
  const [isRunning, setIsRunning] = useState(false);

  // Execution state
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const registers = executionState?.registers ?? DEFAULT_REGISTER_STATE;
  const changedRegisters = executionState?.changedRegisters ?? [];

  // Toast notifications
  const { toasts, showSuccess, showError, dismissToast } = useToast();

  // Handle tab selection
  const handleTabSelect = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setIsMenuOpen(false); // Auto-close menu
  }, []);

  // Handle example selection
  const handleExampleSelect = useCallback((exampleKey: string) => {
    const example = EXAMPLE_PROGRAMS[exampleKey];
    if (example) {
      setCode(example.code);
      setExecutionState(null);
      showSuccess("Example Loaded", `Loaded: ${example.name}`);
    }
  }, [showSuccess]);

  // Handle code execution
  const handleExecute = useCallback(async () => {
    setIsRunning(true);

    try {
      const response = await api.execute(code, "step");

      if (response.success && response.state) {
        setExecutionState(response.state);
        showSuccess("Execution Complete", "Program executed successfully");
      } else {
        showError("Execution Failed", response.error || "Unknown error");
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Connection error";
      showError("Execution Error", message);
    } finally {
      setIsRunning(false);
    }
  }, [code, showSuccess, showError]);

  return (
    <div className="min-h-screen animated-bg relative overflow-hidden">
      {/* Animated Particles */}
      <div className="particles">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${(i * 5.26) % 100}%`,
              animationDelay: `${(i * 0.75) % 15}s`,
              animationDuration: `${15 + (i * 0.5) % 10}s`,
            }}
          />
        ))}
      </div>

      {/* Main Content Area */}
      <motion.main
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="fixed top-4 left-4 right-20 bottom-4 z-10"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="h-full glass-strong rounded-3xl border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Content based on active tab */}
            {activeTab === "welcome" && <WelcomeScreen />}

            {activeTab === "editor" && (
              <>
                {/* Floating Action Buttons - Top Right */}
                <div className="absolute top-4 right-4 z-20 flex gap-3">
                  {/* Examples Dropdown */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleExampleSelect(e.target.value);
                          e.target.value = ""; // Reset selection
                        }
                      }}
                      value=""
                      className="px-4 py-3 rounded-xl text-white text-sm font-medium cursor-pointer
                        transition-all duration-300
                        focus:outline-none focus:ring-2 focus:ring-cyan-400/50
                        hover:brightness-110"
                      style={{
                        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
                        border: "1px solid rgba(6, 182, 212, 0.3)",
                      }}
                    >
                      <option value="" className="bg-slate-800">📚 Load Example...</option>
                      {Object.entries(EXAMPLE_PROGRAMS).map(([key, program]) => (
                        <option key={key} value={key} className="bg-slate-800">
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </motion.div>

                  {/* Execute Button */}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleExecute}
                    disabled={isRunning}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white
                      transition-all duration-300
                      disabled:opacity-50 disabled:cursor-not-allowed
                      hover:brightness-110"
                    style={{
                      background: isRunning 
                        ? "linear-gradient(135deg, rgba(88, 28, 135, 0.8) 0%, rgba(67, 56, 202, 0.8) 100%)"
                        : "linear-gradient(135deg, rgba(109, 40, 217, 0.85) 0%, rgba(79, 70, 229, 0.85) 100%)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: "0 8px 32px 0 rgba(109, 40, 217, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(139, 92, 246, 0.5)",
                    }}
                  >
                    {isRunning ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>Execute Code</span>
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Code Editor - Full Height */}
                <div className="h-full overflow-hidden">
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    readOnly={isRunning}
                  />
                </div>
              </>
            )}

            {activeTab === "registers" && (
              <div className="h-full overflow-auto p-6">
                <RegisterDisplay
                  registers={registers}
                  changedRegisters={changedRegisters}
                />
              </div>
            )}

            {activeTab === "decoder" && (
              <div className="h-full overflow-auto p-4">
                <InstructionDecoder />
              </div>
            )}

            {activeTab === "pipeline" && (
              <div className="h-full overflow-hidden">
                <PipelineVisualizer />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.main>

      {/* Vertical Tab Menu */}
      <VerticalTabMenu
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
        activeTab={activeTab}
        onTabSelect={handleTabSelect}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
