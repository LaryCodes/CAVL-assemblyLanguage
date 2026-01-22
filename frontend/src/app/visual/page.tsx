'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, RotateCcw, Code2, Loader2, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import VisualTeachingLab from '@/components/VisualTeachingLab';
import { api, ApiError } from '@/lib/api';
import type { ExecutionState as BackendExecutionState } from '@/lib/types';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full code-editor-wrapper bg-slate-900/80 flex items-center justify-center">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-violet-400 text-sm flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Loading editor...
      </motion.div>
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

  const handleExecute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setExecutionStates([]);

    try {
      console.log('[DEBUG] Executing code...');
      const response = await api.execute(code, 'step');
      console.log('[DEBUG] Raw API response:', response);

      if (!response.success || !response.state) {
        throw new Error(response.error || 'Execution failed');
      }

      const backendState = response.state as any;
      const programOutput = backendState.programOutput || backendState.program_output || '';
      const instructionAnalysis = backendState.instructionAnalysis || backendState.instruction_analysis || null;
      
      console.log('[DEBUG] Full response:', JSON.stringify(response, null, 2));
      console.log('[DEBUG] Backend state keys:', Object.keys(backendState));
      console.log('[DEBUG] instructionAnalysis value:', instructionAnalysis);
      console.log('[DEBUG] Has instruction_analysis?', 'instruction_analysis' in backendState);
      console.log('[DEBUG] Has instructionAnalysis?', 'instructionAnalysis' in backendState);

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
    <div className="min-h-screen animated-bg relative">
      {/* Animated Particles - Fixed for hydration */}
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

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass sticky top-0 z-40 border-b border-violet-500/10 px-6 py-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ x: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-violet-300 hover:text-violet-100 transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:transition-transform group-hover:-translate-x-1" />
            <span className="font-semibold text-sm">Back to Classic View</span>
          </motion.button>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEditor(!showEditor)}
              className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/5 text-violet-300 rounded-xl transition-all border border-violet-500/20 text-sm font-bold"
            >
              <Code2 className="w-4 h-4" />
              <span>{showEditor ? 'Hide' : 'Show'} Editor</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExecute}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
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
                  <Zap className="w-3.5 h-3.5 ml-1 text-violet-200" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)] relative z-10 overflow-hidden">
        {/* Code Editor Panel */}
        <AnimatePresence>
          {showEditor && (
            <motion.div
              className="w-1/2 border-r border-violet-500/10 glass"
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="h-full flex flex-col">
                <div className="px-6 py-5 border-b border-violet-500/10">
                  <h2 className="text-md font-bold text-gray-200 flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-violet-400" />
                    MIPS Code Editor
                  </h2>
                </div>
                <div className="flex-1 p-5 overflow-hidden">
                  <div className="h-full rounded-xl overflow-hidden border border-violet-500/10 shadow-inner">
                    <CodeEditor
                      code={code}
                      onChange={setCode}
                      readOnly={isLoading}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visualization Panel */}
        <div className={`${showEditor ? 'w-1/2' : 'w-full'} overflow-auto transition-all duration-300 p-6`}>
          {error && (
            <motion.div
              className="mb-8 p-5 bg-red-500/5 border border-red-500/20 rounded-xl backdrop-blur-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-start gap-4">
                <span className="text-xl">⚠️</span>
                <div>
                  <h3 className="text-red-400 font-bold mb-1">Execution Error</h3>
                  <p className="text-red-200/70 text-sm leading-relaxed">{error}</p>
                </div>
              </div>
            </motion.div>
          )}

          {executionStates.length === 0 && !error && !isLoading && (
            <motion.div
              className="flex flex-col items-center justify-center h-full text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="text-7xl mb-8"
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, 2, -2, 0],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                🚀
              </motion.div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Visualize!
              </h2>
              <p className="text-violet-300/60 mb-8 max-w-sm text-lg font-medium">
                Write your MIPS assembly code and click the execute button to analyze it.
              </p>

              <div className="glass rounded-2xl p-6 text-left border border-violet-500/10 max-w-md w-full">
                <div className="text-xs text-violet-300/80 space-y-4 font-bold uppercase tracking-wider">
                  <p className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
                    Detailed Register Analysis
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
                    Memory Segment Visualization
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]" />
                    Heatmap of Static Code Analysis
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {executionStates.length > 0 && (
            <VisualTeachingLab
              executionStates={executionStates}
              heapData={heapData}
              onAllocate={() => { }}
              onFree={() => { }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
