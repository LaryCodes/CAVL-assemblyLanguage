"use client";

/**
 * CAVL - Computer Architecture Visual Lab
 * Main application page
 * 
 * Requirements: 8.1, 8.4, 2.4, 2.5, 7.5, 8.5
 */

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";

// Dynamic import Monaco Editor with SSR disabled to prevent hydration mismatch
// Monaco adds js-focus-visible class to document which causes hydration errors
const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full border border-gray-700 rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading editor...</div>
    </div>
  ),
});
import ExecutionControls from "@/components/ExecutionControls";
import MemoryLayout from "@/components/MemoryLayout";
import RegisterDisplay from "@/components/RegisterDisplay";
import HeapVisualization from "@/components/HeapVisualization";
import Legend, { MEMORY_LEGEND_ITEMS, HEAP_LEGEND_ITEMS, REGISTER_LEGEND_ITEMS } from "@/components/Legend";
import { ToastContainer, useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import type { ExecutionState, MemoryState, HeapState, RegisterState } from "@/lib/types";

// Error type classification for better user feedback
type ErrorCategory = "syntax" | "timeout" | "network" | "server" | "unknown";

interface ParsedError {
  category: ErrorCategory;
  title: string;
  message: string;
  lineNumber?: number;
}

/**
 * Parse error messages to extract useful information
 * Requirements: 2.4, 2.5, 7.5
 */
function parseError(error: unknown): ParsedError {
  if (error instanceof ApiError) {
    const message = error.message.toLowerCase();
    
    // Timeout errors (Requirement 2.5)
    if (message.includes("timeout") || message.includes("exceeded") || error.statusCode === 408) {
      return {
        category: "timeout",
        title: "Execution Timeout",
        message: "Program execution exceeded the 2-second limit. Check for infinite loops or reduce program complexity.",
      };
    }
    
    // Syntax errors (Requirement 2.4)
    if (message.includes("syntax") || message.includes("error at line") || message.includes("parse")) {
      const lineMatch = error.message.match(/line\s*(\d+)/i);
      return {
        category: "syntax",
        title: "Syntax Error",
        message: error.message,
        lineNumber: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      };
    }
    
    // Server errors
    if (error.statusCode && error.statusCode >= 500) {
      return {
        category: "server",
        title: "Server Error",
        message: "The server encountered an error. Please try again later.",
      };
    }
    
    // API validation errors
    if (error.statusCode === 400) {
      return {
        category: "syntax",
        title: "Invalid Request",
        message: error.message,
      };
    }
    
    return {
      category: "unknown",
      title: "Error",
      message: error.message,
    };
  }
  
  // Network errors
  if (error instanceof TypeError && String(error).includes("fetch")) {
    return {
      category: "network",
      title: "Connection Error",
      message: "Unable to connect to the server. Please check your connection and ensure the backend is running.",
    };
  }
  
  return {
    category: "unknown",
    title: "Unexpected Error",
    message: error instanceof Error ? error.message : "An unexpected error occurred.",
  };
}

// Example programs for the selector
const EXAMPLE_PROGRAMS: Record<string, { name: string; description: string; code: string }> = {
  step_demo: {
    name: "Step Execution Demo",
    description: "Demonstrates register changes, arithmetic, branches, and loops",
    code: `# Step Execution Demo Program
# Demonstrates step-by-step instruction execution

.data
    .align 2
    value1:     .word 100
    value2:     .word 200
    result:     .word 0
    array:      .word 10, 20, 30, 40, 50

.text
.globl main

main:
    # Section 1: Immediate Value Loading
    li $t0, 42
    li $t1, 0xFF
    li $t2, -10
    
    # Section 2: Arithmetic Operations
    add $t4, $t0, $t1       # $t4 = 42 + 255 = 297
    sub $t5, $t0, $t2       # $t5 = 42 - (-10) = 52
    addi $t6, $t0, 100      # $t6 = 42 + 100 = 142
    
    # Section 3: Memory Load/Store
    la $t0, value1
    lw $t1, 0($t0)          # $t1 = 100
    la $t2, value2
    lw $t3, 0($t2)          # $t3 = 200
    add $t4, $t1, $t3       # $t4 = 300
    la $t5, result
    sw $t4, 0($t5)          # Store 300
    
    # Section 4: Loop - Sum array
    la $s0, array
    li $s1, 0               # sum = 0
    li $s2, 0               # i = 0
    li $s3, 5               # length = 5
    
loop_start:
    bge $s2, $s3, loop_end
    sll $t0, $s2, 2
    add $t1, $s0, $t0
    lw $t2, 0($t1)
    add $s1, $s1, $t2       # sum += array[i]
    addi $s2, $s2, 1
    j loop_start
    
loop_end:
    # $s1 = 150 (sum of array)
    li $v0, 10
    syscall
`,
  },
  memory_layout: {
    name: "Memory Layout Demo",
    description: "Shows Text, Data, Heap, and Stack segments",
    code: `# Memory Layout Demo Program
# Demonstrates the four main memory segments in MIPS

.data
    .align 2
    global_int:     .word 0x12345678
    global_array:   .word 1, 2, 3, 4, 5
    buffer:         .space 16

.text
.globl main

main:
    # Part 1: DATA SEGMENT access
    la $t0, global_int
    lw $t1, 0($t0)              # Load from data segment
    
    la $t2, global_array
    lw $t3, 8($t2)              # Load array[2] = 3
    
    li $t4, 0xDEADBEEF
    sw $t4, 0($t0)              # Modify data segment
    
    # Part 2: HEAP SEGMENT (sbrk)
    li $v0, 9
    li $a0, 32                  # Request 32 bytes
    syscall
    move $t5, $v0               # $t5 = heap address
    
    li $t6, 0xCAFEBABE
    sw $t6, 0($t5)              # Write to heap
    
    li $v0, 9
    li $a0, 16                  # Request 16 more bytes
    syscall
    move $t7, $v0               # $t7 = second allocation
    
    # Part 3: STACK SEGMENT
    move $s0, $sp               # Save original $sp
    
    li $a0, 10
    jal stack_demo_func
    
    # Store segment addresses for visualization
    la $s2, main                # Text segment
    la $s3, global_int          # Data segment
    move $s4, $t5               # Heap segment
    move $s5, $sp               # Stack segment
    
    li $v0, 10
    syscall

stack_demo_func:
    addi $sp, $sp, -16
    sw $ra, 12($sp)
    sw $a0, 4($sp)
    
    move $s1, $sp               # Record $sp inside function
    
    lw $t0, 4($sp)
    addi $t0, $t0, 5
    sw $t0, 0($sp)
    
    lw $ra, 12($sp)
    addi $sp, $sp, 16
    jr $ra
`,
  },
  heap_allocator: {
    name: "Heap Allocator Demo",
    description: "First-Fit malloc/free implementation with fragmentation",
    code: `# Heap Allocator Demo - First-Fit Implementation
# Demonstrates dynamic memory allocation

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
    
    # Free Block B (creates fragmentation)
    beqz $s1, skip_free_b
    move $a0, $s1
    jal free
skip_free_b:
    
    # Allocate Block C (24 bytes) - reuses B's space
    li $a0, 24
    jal malloc
    move $s2, $v0
    beqz $s2, skip_c
    li $t0, 0xCCCCCCCC
    sw $t0, 0($s2)
skip_c:
    
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
    j mark_alloc
update_head_split:
    sw $t3, free_list_head
    j mark_alloc
no_split:
    lw $t0, 8($s1)
    beqz $s2, update_head_no
    sw $t0, 8($s2)
    j mark_alloc
update_head_no:
    sw $t0, free_list_head
mark_alloc:
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
`,
  },
};

// Default empty states
const DEFAULT_MEMORY_STATE: MemoryState = {
  text: { startAddress: 0x00400000, endAddress: 0x00400000, blocks: [] },
  data: { startAddress: 0x10010000, endAddress: 0x10010000, blocks: [] },
  heap: { startAddress: 0x10040000, endAddress: 0x10040000, blocks: [] },
  stack: { startAddress: 0x7fffeffc, endAddress: 0x7fffeffc, blocks: [] },
};

const DEFAULT_HEAP_STATE: HeapState = {
  blocks: [],
  freeList: [],
  fragmentation: 0,
};

const DEFAULT_REGISTER_STATE: RegisterState = {
  values: {},
};

// Default code shown in editor
const DEFAULT_CODE = `# CAVL - Computer Architecture Visual Lab
# Enter your MIPS assembly code here or select an example program

.data
    message: .asciiz "Hello, CAVL!\\n"

.text
.globl main

main:
    # Load immediate values
    li $t0, 42
    li $t1, 100
    
    # Arithmetic
    add $t2, $t0, $t1
    
    # Exit
    li $v0, 10
    syscall
`;

export default function Home() {
  const router = useRouter();
  
  // Code editor state
  const [code, setCode] = useState(DEFAULT_CODE);
  const [selectedExample, setSelectedExample] = useState<string>("");
  
  // Execution state
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Error state for code editor (syntax errors)
  const [syntaxError, setSyntaxError] = useState<{ line?: number; message: string } | null>(null);
  
  // Toast notifications
  const { toasts, dismissToast, showError, showSuccess, showWarning } = useToast();
  
  // Legend visibility state
  const [showLegend, setShowLegend] = useState(false);

  // Track previous memory state for change detection
  const [prevMemory, setPrevMemory] = useState<MemoryState | null>(null);
  
  // Derived state
  const memory = executionState?.memory ?? DEFAULT_MEMORY_STATE;
  const heap = executionState?.heap ?? DEFAULT_HEAP_STATE;
  const registers = executionState?.registers ?? DEFAULT_REGISTER_STATE;
  const changedRegisters = executionState?.changedRegisters ?? [];
  const isComplete = executionState?.isComplete ?? false;
  const currentPC = executionState?.pc ?? 0;
  const currentInstruction = executionState?.currentInstruction ?? "";
  
  // Compute changed memory addresses by comparing current and previous memory
  const changedAddresses = useMemo(() => {
    if (!prevMemory || !executionState?.memory) return [];
    
    const changes: number[] = [];
    const currentMem = executionState.memory;
    
    // Helper to find changed addresses in a segment
    const findChanges = (prevSeg: typeof prevMemory.text, currSeg: typeof currentMem.text) => {
      const prevMap = new Map(prevSeg.blocks.map(b => [b.address, b.value]));
      const currMap = new Map(currSeg.blocks.map(b => [b.address, b.value]));
      
      // Check for changed or new values
      currSeg.blocks.forEach(block => {
        const prevValue = prevMap.get(block.address);
        if (prevValue !== block.value) {
          changes.push(block.address);
        }
      });
    };
    
    findChanges(prevMemory.text, currentMem.text);
    findChanges(prevMemory.data, currentMem.data);
    findChanges(prevMemory.heap, currentMem.heap);
    findChanges(prevMemory.stack, currentMem.stack);
    
    return changes;
  }, [prevMemory, executionState?.memory]);

  /**
   * Handle errors with proper categorization and user feedback
   * Requirements: 2.4, 2.5, 7.5
   */
  const handleError = useCallback((error: unknown, context: string) => {
    const parsed = parseError(error);
    
    // Set syntax error for code editor highlighting
    if (parsed.category === "syntax") {
      setSyntaxError({
        line: parsed.lineNumber,
        message: parsed.message,
      });
    }
    
    // Show toast notification
    showError(parsed.title, parsed.message);
    
    console.error(`[${context}]`, error);
  }, [showError]);

  // Handle example program selection
  const handleExampleSelect = useCallback((exampleKey: string) => {
    if (exampleKey && EXAMPLE_PROGRAMS[exampleKey]) {
      setCode(EXAMPLE_PROGRAMS[exampleKey].code);
      setSelectedExample(exampleKey);
      // Reset execution state when loading new example
      setExecutionState(null);
      setPrevMemory(null);
      setIsLoaded(false);
      setSyntaxError(null);  // Clear any syntax errors
    }
  }, []);

  // Load code for execution
  const handleLoad = useCallback(async () => {
    setSyntaxError(null);  // Clear previous syntax errors
    setIsRunning(true);
    setIsLoading(true);
    setPrevMemory(null);  // Clear previous memory on new load
    
    try {
      const response = await api.execute(code, "step");
      
      if (response.success && response.state) {
        setExecutionState(response.state);
        setIsLoaded(true);
        showSuccess("Program Executed", "Showing final state after execution. Register values and memory are displayed.");
      } else {
        handleError(new ApiError(response.error ?? "Failed to load program"), "Load");
        setIsLoaded(false);
      }
    } catch (err) {
      handleError(err, "Load");
      setIsLoaded(false);
    } finally {
      setIsRunning(false);
      setIsLoading(false);
    }
  }, [code, handleError, showSuccess]);

  // Step execution
  const handleStep = useCallback(async () => {
    if (!isLoaded || isComplete) return;
    
    setIsRunning(true);
    
    // Save current memory state before stepping
    if (executionState?.memory) {
      setPrevMemory(executionState.memory);
    }
    
    try {
      const response = await api.step();
      
      if (response.success && response.state) {
        setExecutionState(response.state);
        if (response.state.isComplete) {
          showSuccess("Execution Complete", "Program has finished executing.");
        }
      } else {
        handleError(new ApiError(response.error ?? "Step execution failed"), "Step");
      }
    } catch (err) {
      handleError(err, "Step");
    } finally {
      setIsRunning(false);
    }
  }, [isLoaded, isComplete, handleError, showSuccess, executionState?.memory]);

  // Run to completion - In V1, this just shows the final state
  const handleRun = useCallback(async () => {
    if (!isLoaded) return;
    
    // In V1, execution is already complete after Load
    // The "Run" button just confirms the final state
    if (isComplete) {
      showSuccess("Execution Complete", "Program has already finished executing.");
      return;
    }
    
    setIsRunning(true);
    
    try {
      // Try one step to advance to final state
      const response = await api.step();
      
      if (response.success && response.state) {
        setExecutionState(response.state);
        showSuccess("Execution Complete", "Program has finished executing.");
      } else if (response.error?.includes("already complete")) {
        showSuccess("Execution Complete", "Program has already finished executing.");
      } else {
        handleError(new ApiError(response.error ?? "Execution failed"), "Run");
      }
    } catch (err) {
      handleError(err, "Run");
    } finally {
      setIsRunning(false);
    }
  }, [isLoaded, isComplete, handleError, showSuccess]);

  // Reset execution
  const handleReset = useCallback(async () => {
    if (!isLoaded) return;
    
    setIsRunning(true);
    setPrevMemory(null);  // Clear previous memory on reset
    
    try {
      const response = await api.reset();
      
      if (response.success && response.state) {
        setExecutionState(response.state);
        showSuccess("Reset Complete", "Program restored to initial state.");
      } else {
        handleError(new ApiError(response.error ?? "Reset failed"), "Reset");
      }
    } catch (err) {
      handleError(err, "Reset");
    } finally {
      setIsRunning(false);
    }
  }, [isLoaded, handleError, showSuccess]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header - Responsive for desktop sizes (Requirement 8.3) */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-shrink-0">
            <h1 className="text-xl font-bold text-blue-400">CAVL</h1>
            <span className="text-sm text-gray-400 hidden sm:inline">Computer Architecture Visual Lab</span>
            
            {/* Legend Toggle Button */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`ml-2 px-2 py-1 text-xs rounded transition-colors ${
                showLegend 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              title="Toggle color legend"
            >
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <span className="hidden sm:inline">Legend</span>
              </span>
            </button>
            
            {/* Visual Teaching Lab Button */}
            <motion.button
              onClick={() => router.push('/visual')}
              className="ml-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 transition-all font-semibold shadow-xl hover:shadow-2xl hover:shadow-cyan-500/50"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              title="Switch to Visual Teaching Lab"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">🧠 Visual Lab</span>
                <span className="sm:hidden">Visual</span>
              </span>
            </motion.button>
          </div>
          
          {/* Example Program Selector and Status */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="example-select" className="text-sm text-gray-400 hidden lg:inline">
                Examples:
              </label>
              <select
                id="example-select"
                value={selectedExample}
                onChange={(e) => handleExampleSelect(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                disabled={isRunning}
              >
                <option value="">Select example...</option>
                {Object.entries(EXAMPLE_PROGRAMS).map(([key, program]) => (
                  <option key={key} value={key}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Status indicator - hidden on smaller screens */}
            {currentPC > 0 && (
              <div className="text-sm font-mono hidden xl:block">
                <span className="text-gray-400">PC: </span>
                <span className="text-green-400">0x{currentPC.toString(16).toUpperCase().padStart(8, "0")}</span>
              </div>
            )}
            {currentInstruction && (
              <div className="text-sm font-mono max-w-xs truncate hidden xl:block">
                <span className="text-gray-400">Instruction: </span>
                <span className="text-yellow-400">{currentInstruction}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Toast Notifications - Requirements: 2.4, 2.5, 7.5 */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Legend Panel */}
      {showLegend && (
        <div className="absolute top-16 left-4 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 w-80">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-white">Color Legend</h3>
            <button
              onClick={() => setShowLegend(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-gray-400 mb-2">Memory Segments</div>
              <Legend items={MEMORY_LEGEND_ITEMS} compact />
            </div>
            
            <div className="border-t border-gray-700 pt-3">
              <div className="text-xs font-medium text-gray-400 mb-2">Heap Blocks</div>
              <Legend items={HEAP_LEGEND_ITEMS} compact />
            </div>
            
            <div className="border-t border-gray-700 pt-3">
              <div className="text-xs font-medium text-gray-400 mb-2">Registers</div>
              <Legend items={REGISTER_LEGEND_ITEMS} compact />
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-500">
            <p>💡 Hover over any block for detailed information</p>
          </div>
        </div>
      )}

      {/* Execution Controls */}
      <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <ExecutionControls
          onStep={handleStep}
          onRun={handleRun}
          onReset={handleReset}
          onLoad={handleLoad}
          isRunning={isRunning}
          isComplete={isComplete}
          isLoading={isLoading}
        />
      </div>

      {/* Main Content - Responsive layout (Requirement 8.3) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left Panel - Code Editor */}
        <div className="lg:w-1/2 w-full flex flex-col border-r border-gray-800 min-h-[300px] lg:min-h-0">
          <div className="px-4 py-2 bg-gray-900/30 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-300">MIPS Code Editor</h2>
            {syntaxError && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {syntaxError.line ? `Error at line ${syntaxError.line}` : "Syntax error"}
                </span>
              </div>
            )}
          </div>
          {/* Syntax Error Banner */}
          {syntaxError && (
            <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-300 text-sm flex-shrink-0">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Syntax Error: </span>
                  <span className="opacity-90 break-words">{syntaxError.message}</span>
                </div>
                <button
                  onClick={() => setSyntaxError(null)}
                  className="text-red-400 hover:text-red-300 flex-shrink-0"
                  aria-label="Dismiss error"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 p-2 min-h-0">
            <CodeEditor
              code={code}
              onChange={(newCode) => {
                setCode(newCode);
                setSyntaxError(null);  // Clear syntax error when code changes
              }}
              readOnly={isRunning}
              errorLine={syntaxError?.line}
            />
          </div>
        </div>

        {/* Right Panel - Visualizations */}
        <div className="lg:w-1/2 w-full flex flex-col overflow-hidden min-h-0">
          {/* Top: Memory Layout */}
          <div className="flex-1 border-b border-gray-800 overflow-auto min-h-[200px]">
            <MemoryLayout memory={memory} changedAddresses={changedAddresses} />
          </div>

          {/* Middle: Heap Visualization */}
          <div className="h-48 lg:h-64 border-b border-gray-800 overflow-auto flex-shrink-0">
            <HeapVisualization heap={heap} />
          </div>

          {/* Bottom: Registers */}
          <div className="h-56 lg:h-72 overflow-auto flex-shrink-0">
            <RegisterDisplay
              registers={registers}
              changedRegisters={changedRegisters}
            />
          </div>
        </div>
      </main>

      {/* Footer - Responsive (Requirement 8.3) */}
      <footer className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-xs text-gray-500 flex-shrink-0">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <span>CAVL V1 - Powered by MARS Simulator</span>
          <span>
            {isLoaded ? (
              isComplete ? "Execution Complete" : "Program Loaded"
            ) : (
              "Click 'Load' to start"
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
