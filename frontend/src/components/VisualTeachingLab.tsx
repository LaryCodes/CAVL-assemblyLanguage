"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Database, CheckCircle, Info, Terminal } from "lucide-react";
import InstructionAnalysisPanel from "./InstructionAnalysisPanel";

interface InstructionAnalysis {
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
}

interface ExecutionState {
  timestamp: number;
  instruction: string;
  pc: number;
  registers: Record<string, number>;
  memory: Record<string, number>;
  description: string;
  programOutput?: string;
  instructionAnalysis?: InstructionAnalysis;
}

interface VisualTeachingLabProps {
  executionStates: ExecutionState[];
  heapData?: {
    blocks: Array<{
      address: number;
      size: number;
      isFree: boolean;
    }>;
    totalSize: number;
    fragmentationPercent: number;
  };
  onAllocate?: (size: number) => void;
  onFree?: (address: number) => void;
}

// Register categories for organized display
const REGISTER_GROUPS = {
  "Return Values": ["$v0", "$v1"],
  Arguments: ["$a0", "$a1", "$a2", "$a3"],
  Temporaries: [
    "$t0",
    "$t1",
    "$t2",
    "$t3",
    "$t4",
    "$t5",
    "$t6",
    "$t7",
    "$t8",
    "$t9",
  ],
  Saved: ["$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7"],
  Special: ["$sp", "$ra", "$gp", "$fp", "$zero", "$at"],
};

export default function VisualTeachingLab({
  executionStates,
}: VisualTeachingLabProps) {
  const [selectedRegister, setSelectedRegister] = useState<string | null>(null);

  const currentState = executionStates[0] || null;
  const registers = currentState?.registers || {};

  // Get non-zero registers for highlighting
  const nonZeroRegisters = Object.entries(registers)
    .filter(([_, value]) => value !== 0)
    .map(([name]) => name);

  // Format register value for display
  const formatValue = (value: number) => {
    if (value === 0) return "0";
    if (Math.abs(value) > 0xffff) {
      return `0x${value.toString(16).toUpperCase()}`;
    }
    return value.toString();
  };

  if (!currentState) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
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
          <p className="text-cyan-300/70">
            Write MIPS code and click "Execute & Visualize"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Success Header */}
      <motion.div
        className="bg-gradient-to-r from-emerald-900/50 to-green-900/50 border border-emerald-500/50 rounded-xl p-5"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <div>
            <h2 className="text-xl font-bold text-emerald-100">
              Program Executed Successfully
            </h2>
            <p className="text-emerald-300/80 text-sm">
              Final register state shown below • PC: 0x
              {currentState.pc.toString(16).toUpperCase().padStart(8, "0")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Program Output */}
      <motion.div
        className="bg-slate-900/90 rounded-xl border border-amber-500/40 overflow-hidden"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-amber-900/30 px-5 py-3 border-b border-amber-500/30 flex items-center gap-3">
          <Terminal className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-amber-100">Program Output</h3>
          <span className="ml-auto text-xs text-amber-400 bg-amber-900/50 px-2 py-1 rounded">
            stdout
          </span>
        </div>
        <div className="p-4">
          {currentState.programOutput && currentState.programOutput.trim() ? (
            <pre className="font-mono text-sm text-green-400 bg-black/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
              {currentState.programOutput}
            </pre>
          ) : (
            <div className="font-mono text-sm text-slate-500 bg-black/50 rounded-lg p-4 italic">
              No output. Use syscall 1 (print int) or syscall 4 (print string)
              to print values.
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Register Display - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/80 rounded-xl border border-cyan-500/30 overflow-hidden">
            <div className="bg-slate-900/80 px-5 py-3 border-b border-cyan-500/30 flex items-center gap-3">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">CPU Registers</h3>
              <span className="ml-auto text-xs text-cyan-400 bg-cyan-900/50 px-2 py-1 rounded">
                {nonZeroRegisters.length} modified
              </span>
            </div>

            <div className="p-5 space-y-6">
              {Object.entries(REGISTER_GROUPS).map(([groupName, regNames]) => {
                const groupRegs = regNames.filter(
                  (name) => registers[name] !== undefined,
                );
                if (groupRegs.length === 0) return null;

                return (
                  <div key={groupName}>
                    <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3">
                      {groupName}
                    </h4>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {groupRegs.map((regName, idx) => {
                        const value = registers[regName] ?? 0;
                        const isNonZero = value !== 0;
                        const isSelected = selectedRegister === regName;

                        return (
                          <motion.button
                            key={regName}
                            onClick={() =>
                              setSelectedRegister(isSelected ? null : regName)
                            }
                            className={`relative p-3 rounded-lg border-2 text-left transition-all ${
                              isSelected
                                ? "border-cyan-400 bg-cyan-900/50 shadow-lg shadow-cyan-500/20"
                                : isNonZero
                                  ? "border-emerald-500/50 bg-emerald-900/20 hover:border-emerald-400"
                                  : "border-slate-600/50 bg-slate-800/50 hover:border-slate-500"
                            }`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <div
                              className={`text-xs font-mono font-semibold mb-1 ${
                                isNonZero
                                  ? "text-emerald-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {regName}
                            </div>
                            <div
                              className={`text-sm font-mono font-bold truncate ${
                                isNonZero ? "text-white" : "text-slate-600"
                              }`}
                            >
                              {formatValue(value)}
                            </div>

                            {isNonZero && (
                              <motion.div
                                className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info Panel - Takes 1 column */}
        <div className="space-y-4">
          {/* Selected Register Detail */}
          {selectedRegister && registers[selectedRegister] !== undefined && (
            <motion.div
              className="bg-slate-800/80 rounded-xl border border-cyan-500/30 p-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Register Detail
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400">Register</div>
                  <div className="text-2xl font-mono font-bold text-white">
                    {selectedRegister}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Decimal</div>
                  <div className="text-lg font-mono text-emerald-400">
                    {registers[selectedRegister]}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Hexadecimal</div>
                  <div className="text-lg font-mono text-cyan-400">
                    0x
                    {registers[selectedRegister]
                      .toString(16)
                      .toUpperCase()
                      .padStart(8, "0")}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Binary</div>
                  <div className="text-xs font-mono text-purple-400 break-all">
                    {registers[selectedRegister].toString(2).padStart(32, "0")}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Stats */}
          <motion.div
            className="bg-slate-800/80 rounded-xl border border-slate-600/50 p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Execution Summary
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Program Counter</span>
                <span className="font-mono text-cyan-400">
                  0x{currentState.pc.toString(16).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Modified Registers</span>
                <span className="font-mono text-emerald-400">
                  {nonZeroRegisters.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Return Value ($v0)</span>
                <span className="font-mono text-white">
                  {registers["$v0"] ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stack Pointer ($sp)</span>
                <span className="font-mono text-white">
                  {registers["$sp"]
                    ? `0x${registers["$sp"].toString(16).toUpperCase()}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Help Text */}
          <motion.div
            className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-xs text-blue-300/80 leading-relaxed">
              💡 <strong>Tip:</strong> Click on any register to see its value in
              different formats. Green highlighted registers have non-zero
              values after execution.
            </p>
          </motion.div>
        </div>
      </div>

      {/* MIPS Instruction Analysis - CORE FEATURE */}
      {(currentState.instructionAnalysis || (currentState as any).instruction_analysis) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <InstructionAnalysisPanel
            analysis={currentState.instructionAnalysis || (currentState as any).instruction_analysis}
          />
        </motion.div>
      )}
    </div>
  );
}
