'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Cpu, 
  ArrowRight, 
  Database, 
  GitBranch, 
  Zap,
  AlertCircle,
  CheckCircle2,
  BarChart3
} from 'lucide-react';

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

interface InstructionAnalysisPanelProps {
  analysis: InstructionAnalysis | null;
}

// Instruction category configuration
const CATEGORIES = [
  { 
    key: 'r_type_count', 
    label: 'R-Type (Arithmetic)', 
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500/50',
    icon: Cpu,
    description: 'add, sub, and, or, slt, etc.'
  },
  { 
    key: 'i_type_count', 
    label: 'I-Type (Immediate)', 
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-900/30',
    borderColor: 'border-purple-500/50',
    icon: Zap,
    description: 'addi, andi, ori, slti, lui, etc.'
  },
  { 
    key: 'load_count', 
    label: 'Memory Loads', 
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500/50',
    icon: Database,
    description: 'lw, lb, lh, lbu, lhu'
  },
  { 
    key: 'store_count', 
    label: 'Memory Stores', 
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500/50',
    icon: Database,
    description: 'sw, sb, sh'
  },
  { 
    key: 'branch_count', 
    label: 'Branches', 
    color: 'from-red-500 to-rose-500',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500/50',
    icon: GitBranch,
    description: 'beq, bne, blez, bgtz'
  },
  { 
    key: 'jump_count', 
    label: 'Jumps', 
    color: 'from-yellow-500 to-lime-500',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500/50',
    icon: ArrowRight,
    description: 'j, jal, jr, jalr'
  },
  { 
    key: 'syscall_count', 
    label: 'Syscalls', 
    color: 'from-teal-500 to-cyan-500',
    bgColor: 'bg-teal-900/30',
    borderColor: 'border-teal-500/50',
    icon: Zap,
    description: 'syscall'
  },
];

export default function InstructionAnalysisPanel({ analysis }: InstructionAnalysisPanelProps) {
  if (!analysis) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-600/50 p-6">
        <div className="flex items-center gap-3 text-slate-400">
          <AlertCircle className="w-5 h-5" />
          <span>No instruction analysis available</span>
        </div>
      </div>
    );
  }

  const total = analysis.total_analyzed || 1;
  
  // Get top used registers
  const topRegisters = Object.entries(analysis.register_usage || {})
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header with MIPS verification badge */}
      <motion.div
        className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/50 rounded-xl p-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Instruction Analysis</h3>
              <p className="text-sm text-indigo-300/70">
                Analyzed by MIPS assembly • {total} instructions
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            analysis.analysis_valid 
              ? 'bg-green-900/50 text-green-400 border border-green-500/50'
              : 'bg-red-900/50 text-red-400 border border-red-500/50'
          }`}>
            {analysis.analysis_valid ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                MIPS Verified
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                Analysis Pending
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Instruction Category Breakdown */}
      <div className="bg-slate-800/80 rounded-xl border border-cyan-500/30 overflow-hidden">
        <div className="bg-slate-900/80 px-5 py-3 border-b border-cyan-500/30">
          <h4 className="text-sm font-semibold text-cyan-100">Instruction Categories</h4>
        </div>
        <div className="p-4 space-y-3">
          {CATEGORIES.map((cat, idx) => {
            const count = (analysis as any)[cat.key] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            const Icon = cat.icon;
            
            return (
              <motion.div
                key={cat.key}
                className={`${cat.bgColor} ${cat.borderColor} border rounded-lg p-3`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-sm font-medium text-white">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{count}</span>
                    <span className="text-xs text-white/50">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${cat.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                  />
                </div>
                
                <p className="text-xs text-white/40 mt-1">{cat.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Register Usage Heatmap */}
      {topRegisters.length > 0 && (
        <div className="bg-slate-800/80 rounded-xl border border-amber-500/30 overflow-hidden">
          <div className="bg-slate-900/80 px-5 py-3 border-b border-amber-500/30">
            <h4 className="text-sm font-semibold text-amber-100">Register Usage (Top 8)</h4>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-2">
              {topRegisters.map(([reg, count], idx) => {
                const maxCount = topRegisters[0]?.[1] || 1;
                const intensity = count / maxCount;
                
                return (
                  <motion.div
                    key={reg}
                    className="relative p-3 rounded-lg border border-amber-500/30 text-center"
                    style={{
                      backgroundColor: `rgba(245, 158, 11, ${intensity * 0.3})`,
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-xs font-mono font-bold text-amber-400">{reg}</div>
                    <div className="text-lg font-bold text-white">{count}</div>
                    <div className="text-xs text-amber-300/50">uses</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MIPS Dependency Notice */}
      <motion.div
        className="bg-slate-900/50 border border-slate-600/30 rounded-lg p-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xs text-slate-400 text-center">
          🔒 This analysis is computed by <code className="text-cyan-400">mips/core/instruction_analyzer.asm</code>
          <br />
          <span className="text-slate-500">The system cannot function without this MIPS core file.</span>
        </p>
      </motion.div>
    </div>
  );
}
