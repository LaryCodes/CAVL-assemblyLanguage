'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ArrowRight, Database, Zap } from 'lucide-react';

interface InstructionExplainerProps {
  instruction: string;
  pc: number;
  explanation?: string;
  explainMode?: boolean;
  registers?: Record<string, number>;
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

interface InstructionPart {
  type: 'opcode' | 'register' | 'immediate' | 'address';
  value: string;
  description: string;
}

export default function InstructionExplainer({
  instruction,
  pc,
  explanation,
  explainMode = false,
  registers = {},
  memoryAccess,
  aluOperation,
}: InstructionExplainerProps) {
  const [parts, setParts] = useState<InstructionPart[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const parsed = parseInstruction(instruction);
    setParts(parsed);
    
    if (explainMode) {
      setShowDetails(true);
      const timer = setTimeout(() => setShowDetails(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [instruction, explainMode]);

  const parseInstruction = (instr: string): InstructionPart[] => {
    const parts: InstructionPart[] = [];
    
    // Handle special cases where instruction is just a status message
    if (instr.startsWith('Step ') || 
        instr.startsWith('Execution Step') || 
        instr.includes('PC:') ||
        instr.includes('Program Executed') ||
        instr.includes('Final state')) {
      parts.push({
        type: 'address',
        value: instr,
        description: 'Execution status',
      });
      return parts;
    }
    
    const tokens = instr.trim().split(/[\s,()]+/).filter(Boolean);
    
    if (tokens.length === 0) return parts;

    const opcode = tokens[0];
    parts.push({
      type: 'opcode',
      value: opcode,
      description: getOpcodeDescription(opcode),
    });

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith('$')) {
        parts.push({
          type: 'register',
          value: token,
          description: `Register ${token}`,
        });
      } else if (token.startsWith('0x') || /^-?\d+$/.test(token)) {
        parts.push({
          type: 'immediate',
          value: token,
          description: 'Immediate value',
        });
      } else {
        parts.push({
          type: 'address',
          value: token,
          description: 'Memory address/label',
        });
      }
    }

    return parts;
  };

  const getOpcodeDescription = (opcode: string): string => {
    const descriptions: Record<string, string> = {
      'lw': 'Load Word from memory',
      'sw': 'Store Word to memory',
      'add': 'Add two registers',
      'addi': 'Add immediate value',
      'sub': 'Subtract registers',
      'mul': 'Multiply registers',
      'div': 'Divide registers',
      'beq': 'Branch if equal',
      'bne': 'Branch if not equal',
      'bge': 'Branch if greater or equal',
      'blt': 'Branch if less than',
      'j': 'Jump to address',
      'jal': 'Jump and link',
      'jr': 'Jump to register',
      'li': 'Load immediate',
      'la': 'Load address',
      'move': 'Move register value',
    };
    return descriptions[opcode] || 'Unknown operation';
  };

  const getPartColor = (type: string) => {
    switch (type) {
      case 'opcode': return 'text-cyan-400 font-bold text-lg';
      case 'register': return 'text-emerald-400 font-semibold';
      case 'immediate': return 'text-purple-400 font-semibold';
      case 'address': return 'text-orange-400 font-semibold';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-cyan-500/30 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Cpu className="w-6 h-6 text-cyan-400" />
          </motion.div>
          <span className="text-sm text-cyan-300/80 font-medium">
            PC: 0x{pc.toString(16).toUpperCase().padStart(8, '0')}
          </span>
        </div>
        {explainMode && (
          <motion.div
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-xs text-white font-bold shadow-lg"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            🧠 Explain Mode
          </motion.div>
        )}
      </div>

      {/* Instruction Display */}
      <motion.div
        className="bg-slate-900/80 rounded-lg p-4 mb-4 border border-cyan-500/20 shadow-inner"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
      >
        <div className="flex flex-wrap items-center gap-2 font-mono text-base">
          {parts.map((part, idx) => (
            <motion.span
              key={idx}
              className={getPartColor(part.type)}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              title={part.description}
            >
              {part.value}
              {idx < parts.length - 1 && part.type !== 'opcode' && ','}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {explanation && (
        <div className="text-sm text-gray-300 mb-3">{explanation}</div>
      )}

      <AnimatePresence>
        {explainMode && showDetails && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {parts.some(p => p.type === 'register') && (
              <motion.div
                className="bg-green-900/20 border border-green-700 rounded-lg p-3"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-semibold text-green-400">Registers Used:</span>
                </div>
                <div className="space-y-1">
                  {parts
                    .filter(p => p.type === 'register')
                    .map((part, idx) => {
                      const regValue = registers[part.value] ?? 0;
                      return (
                        <motion.div
                          key={idx}
                          className="flex items-center justify-between text-xs"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.2 }}
                        >
                          <span className="text-green-300 font-mono">{part.value}</span>
                          <ArrowRight className="w-3 h-3 text-gray-500" />
                          <motion.span
                            className="text-white font-mono font-bold"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ delay: idx * 0.2 + 0.3 }}
                          >
                            {regValue}
                          </motion.span>
                        </motion.div>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {memoryAccess && (
              <motion.div
                className={`border rounded-lg p-3 ${
                  memoryAccess.type === 'read'
                    ? 'bg-blue-900/20 border-blue-700'
                    : 'bg-purple-900/20 border-purple-700'
                }`}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Database className={`w-4 h-4 ${
                    memoryAccess.type === 'read' ? 'text-blue-400' : 'text-purple-400'
                  }`} />
                  <span className={`text-xs font-semibold ${
                    memoryAccess.type === 'read' ? 'text-blue-400' : 'text-purple-400'
                  }`}>
                    Memory {memoryAccess.type === 'read' ? 'Read' : 'Write'}:
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">
                    0x{memoryAccess.address.toString(16).toUpperCase()}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-500" />
                  <motion.span
                    className="text-white font-mono font-bold"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.5 }}
                  >
                    {memoryAccess.value}
                  </motion.span>
                </div>
              </motion.div>
            )}

            {aluOperation && (
              <motion.div
                className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-400">ALU Operation:</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <motion.span
                    className="text-white font-mono font-bold"
                    animate={{ scale: [1, 1.2, 1] }}
                  >
                    {aluOperation.operand1}
                  </motion.span>
                  <span className="text-yellow-400 font-bold">{aluOperation.op}</span>
                  <motion.span
                    className="text-white font-mono font-bold"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ delay: 0.2 }}
                  >
                    {aluOperation.operand2}
                  </motion.span>
                  <span className="text-gray-500">=</span>
                  <motion.span
                    className="text-green-400 font-mono font-bold text-base"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ delay: 0.4 }}
                  >
                    {aluOperation.result}
                  </motion.span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {explainMode && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold">■</span> Opcode
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold">■</span> Register
          </div>
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-bold">■</span> Immediate
          </div>
        </div>
      )}
    </div>
  );
}
