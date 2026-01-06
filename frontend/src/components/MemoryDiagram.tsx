'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface MemoryBlock {
  address: number;
  size: number;
  type: 'heap' | 'stack' | 'free' | 'allocated';
  label?: string;
}

interface MemoryDiagramProps {
  heapBlocks: MemoryBlock[];
  stackBlocks: MemoryBlock[];
  highlightedAddress?: number;
  operation?: 'load' | 'store' | null;
}

export default function MemoryDiagram({
  heapBlocks,
  stackBlocks,
  highlightedAddress,
  operation
}: MemoryDiagramProps) {
  const [animatingOp, setAnimatingOp] = useState<'load' | 'store' | null>(null);

  useEffect(() => {
    if (operation) {
      setAnimatingOp(operation);
      const timer = setTimeout(() => setAnimatingOp(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [operation]);

  // Show empty state if no blocks
  const hasData = stackBlocks.length > 0 || heapBlocks.length > 0;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-indigo-500/30 shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">🗄️</span>
        Memory Layout
      </h3>

      {!hasData ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-cyan-300/70">No memory blocks to display</p>
          <p className="text-cyan-400/50 text-sm mt-1">Execute code with memory operations to see visualization</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Stack Section */}
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-300 mb-3 text-center flex items-center justify-center gap-2">
              <span>📚</span> Stack (grows ↓)
            </h4>
            <div className="space-y-2 min-h-[100px]">
              {stackBlocks.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  No stack data
                </div>
              ) : (
                stackBlocks.map((block, idx) => (
                  <motion.div
                    key={`stack-${block.address}-${idx}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`relative p-3 rounded-lg border-2 ${
                      block.address === highlightedAddress
                        ? 'border-yellow-500 bg-yellow-900/30 shadow-lg shadow-yellow-500/30'
                        : 'border-purple-500/50 bg-purple-900/20'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-purple-300 font-mono">
                        0x{block.address.toString(16).toUpperCase().padStart(8, '0')}
                      </span>
                      <span className="font-mono text-sm text-white font-bold">
                        {block.label || `${block.size}B`}
                      </span>
                    </div>
                    
                    {block.address === highlightedAddress && animatingOp === 'load' && (
                      <motion.div
                        className="absolute -right-8 top-1/2 -translate-y-1/2 text-cyan-400"
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ x: 30, opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        →
                      </motion.div>
                    )}

                    {block.address === highlightedAddress && animatingOp === 'store' && (
                      <motion.div
                        className="absolute -left-8 top-1/2 -translate-y-1/2 text-emerald-400"
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ x: -30, opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        ←
                      </motion.div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Heap Section */}
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-300 mb-3 text-center flex items-center justify-center gap-2">
              <span>🏗️</span> Heap (grows ↑)
            </h4>
            <div className="space-y-2 min-h-[100px]">
              {heapBlocks.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  No heap data
                </div>
              ) : (
                heapBlocks.map((block, idx) => (
                  <motion.div
                    key={`heap-${block.address}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative"
                  >
                    <div
                      className={`p-4 rounded-lg border-2 transition-all ${
                        block.type === 'allocated'
                          ? 'border-emerald-500/70 bg-emerald-900/30'
                          : block.type === 'free'
                          ? 'border-slate-500/50 bg-slate-800/50 border-dashed'
                          : 'border-blue-500/70 bg-blue-900/30'
                      } ${
                        block.address === highlightedAddress
                          ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/30'
                          : ''
                      }`}
                      style={{ minHeight: `${Math.max(60, Math.min(block.size / 4, 120))}px` }}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div className="text-xs text-slate-400 font-mono">
                          0x{block.address.toString(16).toUpperCase().padStart(8, '0')}
                        </div>
                        <div className="font-bold text-center text-white text-lg">
                          {block.size}B
                        </div>
                        <div className={`text-xs text-center capitalize font-medium ${
                          block.type === 'allocated' ? 'text-emerald-400' :
                          block.type === 'free' ? 'text-slate-400' :
                          'text-blue-400'
                        }`}>
                          {block.type}
                        </div>
                      </div>

                      {block.address === highlightedAddress && (
                        <motion.div
                          className="absolute inset-0 border-2 border-yellow-400 rounded-lg"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      )}
                    </div>

                    {block.type === 'free' && block.size < 100 && (
                      <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-lg">
                        Gap
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
