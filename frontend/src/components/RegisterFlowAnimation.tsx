'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface RegisterState {
  [key: string]: number;
}

interface RegisterFlowAnimationProps {
  registers: RegisterState;
  changedRegisters?: string[];
  operation?: string;
  showALU?: boolean;
}

export default function RegisterFlowAnimation({
  registers,
  changedRegisters = [],
  operation,
  showALU = false
}: RegisterFlowAnimationProps) {
  const [aluPulse, setAluPulse] = useState(false);

  useEffect(() => {
    if (showALU && (operation?.includes('add') || operation?.includes('sub'))) {
      setAluPulse(true);
      const timer = setTimeout(() => setAluPulse(false), 800);
      return () => clearTimeout(timer);
    }
  }, [showALU, operation]);

  // Get all registers that have values
  const allRegisters = Object.keys(registers).filter(reg => registers[reg] !== undefined);
  
  // Prioritize important registers
  const importantRegisters = ['$v0', '$v1', '$a0', '$a1', '$a2', '$a3', '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$s0', '$s1', '$sp', '$ra', '$gp', '$fp'];
  const displayRegisters = importantRegisters.filter(reg => allRegisters.includes(reg));
  
  // Add any other registers not in the priority list
  allRegisters.forEach(reg => {
    if (!displayRegisters.includes(reg)) {
      displayRegisters.push(reg);
    }
  });

  // Limit to reasonable number
  const visibleRegisters = displayRegisters.slice(0, 12);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-green-500/30 shadow-2xl">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">📊</span>
        Registers
      </h3>
      
      {visibleRegisters.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-slate-400 text-sm">No register data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {visibleRegisters.map(reg => {
            const isChanged = changedRegisters.includes(reg);
            const value = registers[reg];
            
            return (
              <motion.div
                key={reg}
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  isChanged
                    ? 'border-emerald-500 bg-emerald-900/30 shadow-lg shadow-emerald-500/20'
                    : 'border-slate-600/50 bg-slate-800/50'
                }`}
                animate={{
                  scale: isChanged ? [1, 1.1, 1] : 1,
                }}
                transition={{ duration: 0.4 }}
              >
                <div className="text-xs text-cyan-400 font-mono font-semibold mb-1">{reg}</div>
                <div className="text-sm font-bold font-mono text-white truncate" title={value?.toString()}>
                  {value !== undefined ? (
                    value >= 0x10000 ? `0x${value.toString(16).toUpperCase()}` : value.toString()
                  ) : '---'}
                </div>
                
                <AnimatePresence>
                  {isChanged && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute -top-2 -right-2 text-lg"
                    >
                      ✨
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {showALU && (
        <motion.div
          className={`mt-4 p-4 rounded-lg border-2 text-center transition-all ${
            aluPulse 
              ? 'border-orange-500 bg-orange-900/30 shadow-lg shadow-orange-500/30' 
              : 'border-slate-600/50 bg-slate-800/50'
          }`}
          animate={{
            scale: aluPulse ? [1, 1.15, 1] : 1,
          }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-lg font-bold text-white">⚡ ALU</div>
          {operation && <div className="text-xs text-orange-300 mt-1 font-mono">{operation}</div>}
        </motion.div>
      )}
    </div>
  );
}
