'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, RotateCcw, Code2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import VisualTeachingLab from '@/components/VisualTeachingLab';
import { api, ApiError } from '@/lib/api';
import type { ExecutionState as BackendExecutionState } from '@/lib/types';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full border border-cyan-700/50 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
      <div className="text-cyan-400 text-sm">Loading editor...</div>
    </div>
  ),
});

interface VisualExecutionState {
  timestamp: number;
  instruction: string;
  pc: number;
  registers: Record<string, number>;
  memory: Record<string, number>;
  description: string;
  programOutput?: string;
  instructionAnalysis?: {
    r_type_count: number;
    i_type_count: number;
    load_count: number;
    store_count: number;
    branch_count: number;
    jump_count: number;
    syscall_count: number;
    other_count: number;
    total_analyzed: number;
    register_usage: Record<string, number>;
    analysis_valid: boolean;
  };
  heapBlocks?: Array<{
    address: number;
    size: number;
    isFree: boolean;
  }>;
  memoryAccess?: {
    type: 'read' | 'write';
    address: number;
    value: number;
  };
  aluOperation?: {
    op: string;
    operand1: number;
    operand2: number;
    result: number;
  };
}

const DEFAULT_CODE = `# CAVL Visual Lab - Interactive Demo
# This program demonstrates printing output and register operations

.data
    msg1: .asciiz "Hello from MIPS!\\n"
    msg2: .asciiz "Sum of 42 + 100 = "
    newline: .asciiz "\\n"
    value1: .word 42
    value2: .word 100

.text
.globl main

main:
    # Print welcome message
    li $v0, 4           # syscall 4 = print string
    la $a0, msg1
    syscall
    
    # Load first value
    la $t0, value1
    lw $t1, 0($t0)      # $t1 = 42
    
    # Load second value
    la $t0, value2
    lw $t2, 0($t0)      # $t2 = 100
    
    # Add them
    add $t3, $t1, $t2   # $t3 = 142
    
    # Print result message
    li $v0, 4
    la $a0, msg2
    syscall
    
    # Print the sum
    li $v0, 1           # syscall 1 = print integer
    move $a0, $t3
    syscall
    
    # Print newline
    li $v0, 4
    la $a0, newline
    syscall
    
    # Exit
    li $v0, 10
    syscall
`;

export default function VisualPage() {
  const router = useRouter();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [executionStates, setExecutionStates] = useState<VisualExecutionState[]>([]);
  const [heapData, setHeapData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(true);

  const transformState = useCallback((backendState: BackendExecutionState, index: number): VisualExecutionState => {
    // Get the actual instruction - handle various formats
    let instruction = backendState.currentInstruction || '';
    
    // If instruction indicates final state or is generic, create a meaningful description
    if (!instruction || 
        instruction.trim() === '' || 
        instruction === 'nop' ||
        instruction.includes('final state') ||
        instruction.includes('Program executed')) {
      // Create a description based on the step number and PC
      if (backendState.pc) {
        instruction = `Step ${index + 1} - PC: 0x${backendState.pc.toString(16).toUpperCase()}`;
      } else {
        instruction = `Execution Step ${index + 1}`;
      }
    }
    
    // Clean up the instruction string
    instruction = instruction.trim();

    // Create a meaningful description
    let description = '';
    if (backendState.currentInstruction && !backendState.currentInstruction.includes('final state')) {
      description = `Executing: ${backendState.currentInstruction}`;
    } else {
      description = `Program state at step ${index + 1}`;
    }

    const state: VisualExecutionState = {
      timestamp: Date.now() + index * 100,
      instruction: instruction,
      pc: backendState.pc || 0,
      registers: backendState.registers?.values || {},
      memory: {},
      description: description,
    };

    if (backendState.heap?.blocks) {
      state.heapBlocks = backendState.heap.blocks.map(block => ({
        address: block.address,
        size: block.size,
        isFree: !block.allocated,
      }));
    }

    // Detect memory operations from instruction
    const instr = instruction.toLowerCase();
    if (instr.includes('lw') || instr.includes('sw') || instr.includes('lb') || instr.includes('sb')) {
      const match = instr.match(/0x([0-9a-f]+)/i) || instr.match(/(\d+)\s*\(/);
      if (match) {
        const address = match[1].startsWith('0x') ? parseInt(match[1], 16) : parseInt(match[1]);
        state.memoryAccess = {
          type: (instr.includes('lw') || instr.includes('lb')) ? 'read' : 'write',
          address: address || 0,
          value: 0,
        };
      }
    }

    // Detect ALU operations
    if (instr.includes('add') || instr.includes('sub') || instr.includes('mul') || instr.includes('div')) {
      const registers = instr.match(/\$\w+/g);
      if (registers && registers.length >= 2) {
        const op = instr.includes('add') ? '+' : instr.includes('sub') ? '-' : instr.includes('mul') ? '×' : '÷';
        const destReg = registers[0];
        const srcReg1 = registers.length > 1 ? registers[1] : registers[0];
        const srcReg2 = registers.length > 2 ? registers[2] : null;
        
        const reg1Val = state.registers[srcReg1] || 0;
        const reg2Val = srcReg2 ? (state.registers[srcReg2] || 0) : 0;
        const resultVal = state.registers[destReg] || 0;
        
        state.aluOperation = {
          op,
          operand1: reg1Val,
          operand2: reg2Val,
          result: resultVal,
        };
      }
    }

    return state;
  }, []);

  const handleExecute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setExecutionStates([]);

    try {
      const response = await api.execute(code, 'step');
      
      if (!response.success || !response.state) {
        throw new Error(response.error || 'Execution failed');
      }

      // The backend returns the FINAL state after execution
      // MARS CLI doesn't provide step-by-step tracing
      // So we just show the final state - no fake steps!
      
      // Handle both snake_case (from backend) and camelCase field names
      const backendState = response.state as any;
      const programOutput = backendState.programOutput || backendState.program_output || '';
      const instructionAnalysis = backendState.instructionAnalysis || backendState.instruction_analysis || null;
      
      const finalState: VisualExecutionState = {
        timestamp: Date.now(),
        instruction: 'Program Executed Successfully',
        pc: response.state.pc || 0,
        registers: response.state.registers?.values || {},
        memory: {},
        description: 'Final state after program execution',
        programOutput: programOutput,
        instructionAnalysis: instructionAnalysis,
      };

      // Add heap data if available
      if (response.state.heap?.blocks) {
        finalState.heapBlocks = response.state.heap.blocks.map(block => ({
          address: block.address,
          size: block.size,
          isFree: !block.allocated,
        }));
        
        setHeapData({
          blocks: response.state.heap.blocks.map(b => ({
            address: b.address,
            size: b.size,
            isFree: !b.allocated,
          })),
          totalSize: 1024,
          fragmentationPercent: response.state.heap.fragmentation || 0,
        });
      }

      // Just show the single final state - no fake stepping!
      setExecutionStates([finalState]);
      
    } catch (err) {
      const errorMsg = err instanceof ApiError ? err.message : 'Failed to execute code';
      setError(errorMsg);
      console.error('Execution error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  const handleReset = useCallback(async () => {
    try {
      await api.reset();
      setExecutionStates([]);
      setError(null);
    } catch (err) {
      console.error('Reset error:', err);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-cyan-500/30 px-6 py-4 shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-cyan-300 hover:text-cyan-100 transition-all hover:translate-x-[-4px] duration-200 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:animate-pulse" />
            <span className="font-medium">Back to Classic View</span>
          </button>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setShowEditor(!showEditor)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg transition-all border border-cyan-500/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Code2 className="w-4 h-4" />
              <span>{showEditor ? 'Hide' : 'Show'} Editor</span>
            </motion.button>

            <motion.button
              onClick={handleExecute}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-lg font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute & Visualize</span>
                </>
              )}
            </motion.button>

            <motion.button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-orange-300 rounded-lg transition-all border border-orange-500/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Code Editor Panel */}
        <AnimatePresence>
          {showEditor && (
            <motion.div
              className="w-1/2 border-r border-cyan-500/30 bg-slate-900/50 backdrop-blur-sm"
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-full flex flex-col">
                <div className="px-6 py-3 border-b border-cyan-500/30 bg-slate-800/50">
                  <h2 className="text-lg font-semibold text-cyan-100 flex items-center gap-2">
                    <Code2 className="w-5 h-5" />
                    MIPS Code Editor
                  </h2>
                  <p className="text-sm text-cyan-300/70 mt-1">
                    Write your MIPS assembly code here
                  </p>
                </div>
                <div className="flex-1 p-4">
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    readOnly={isLoading}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visualization Panel */}
        <div className={`${showEditor ? 'w-1/2' : 'w-full'} overflow-auto transition-all duration-300`}>
          {error && (
            <motion.div
              className="m-6 p-4 bg-red-900/30 border border-red-500 rounded-lg"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-red-300 font-semibold mb-1">Execution Error</h3>
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            </motion.div>
          )}

          {executionStates.length === 0 && !error && !isLoading && (
            <motion.div
              className="flex items-center justify-center h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center">
                <motion.div
                  className="text-6xl mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🚀
                </motion.div>
                <h2 className="text-2xl font-bold text-cyan-100 mb-2">
                  Ready to Visualize!
                </h2>
                <p className="text-cyan-300/70 mb-6">
                  Write your MIPS code and click "Execute & Visualize"
                </p>
                <div className="text-sm text-cyan-400/60 space-y-1">
                  <p>💡 The Visual Lab will show:</p>
                  <p>• Final register values after execution</p>
                  <p>• Click registers to see hex/binary formats</p>
                  <p>• Non-zero registers highlighted in green</p>
                </div>
              </div>
            </motion.div>
          )}

          {executionStates.length > 0 && (
            <VisualTeachingLab
              executionStates={executionStates}
              heapData={heapData}
              onAllocate={() => {}}
              onFree={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}
