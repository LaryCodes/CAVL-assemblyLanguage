'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FragmentationVisualizerProps {
  heapBlocks: Array<{
    address: number;
    size: number;
    isFree: boolean;
  }>;
  fragmentationPercent: number;
  totalHeapSize: number;
}

interface Gap {
  address: number;
  size: number;
  index: number;
}

export default function FragmentationVisualizer({
  heapBlocks,
  fragmentationPercent,
  totalHeapSize,
}: FragmentationVisualizerProps) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [decayLevel, setDecayLevel] = useState(0);

  useEffect(() => {
    // Calculate gaps (free blocks that create fragmentation)
    const freeBlocks = heapBlocks
      .filter(b => b.isFree)
      .map((b, idx) => ({ ...b, index: idx }));
    
    setGaps(freeBlocks);
    
    // Decay level based on fragmentation
    setDecayLevel(Math.min(fragmentationPercent / 100, 1));
  }, [heapBlocks, fragmentationPercent]);

  const getDecayColor = (level: number) => {
    if (level < 0.2) return '#10b981'; // emerald
    if (level < 0.4) return '#84cc16'; // lime
    if (level < 0.6) return '#fbbf24'; // amber
    if (level < 0.8) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getDecayGradient = (level: number) => {
    if (level < 0.2) return 'from-emerald-500 to-green-600';
    if (level < 0.4) return 'from-lime-500 to-yellow-600';
    if (level < 0.6) return 'from-amber-500 to-orange-600';
    if (level < 0.8) return 'from-orange-500 to-red-600';
    return 'from-red-500 to-rose-700';
  };

  const getDecayMessage = (level: number) => {
    if (level < 0.2) return 'Healthy';
    if (level < 0.4) return 'Minor Fragmentation';
    if (level < 0.6) return 'Moderate Fragmentation';
    if (level < 0.8) return 'High Fragmentation';
    return 'Critical Fragmentation';
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-purple-500/30 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Heap Fragmentation
        </h3>
        <motion.div
          className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r ${getDecayGradient(decayLevel)}`}
          animate={{ scale: decayLevel > 0.6 ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 1, repeat: decayLevel > 0.6 ? Infinity : 0 }}
        >
          {fragmentationPercent.toFixed(1)}%
        </motion.div>
      </div>

      {/* Visual Decay Representation */}
      <div className="mb-6">
        <div className="relative h-32 bg-gray-800 rounded-lg overflow-hidden">
          {/* Background grid showing "ideal" state */}
          <div className="absolute inset-0 grid grid-cols-20 gap-px">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="bg-gray-700 opacity-20" />
            ))}
          </div>

          {/* Heap blocks visualization */}
          <div className="absolute inset-0 flex items-end p-2 gap-1">
            {heapBlocks.map((block, idx) => {
              const widthPercent = (block.size / totalHeapSize) * 100;
              return (
                <motion.div
                  key={`${block.address}-${idx}`}
                  className="relative"
                  style={{ width: `${widthPercent}%` }}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '100%', opacity: 1 }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                >
                  <motion.div
                    className={`h-full rounded-t ${
                      block.isFree
                        ? 'bg-gray-600 border-2 border-dashed border-gray-500'
                        : 'bg-blue-500'
                    }`}
                    animate={
                      block.isFree && decayLevel > 0.4
                        ? {
                            opacity: [0.5, 0.8, 0.5],
                            borderColor: [
                              getDecayColor(decayLevel),
                              '#6b7280',
                              getDecayColor(decayLevel),
                            ],
                          }
                        : {}
                    }
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {/* Gap indicator for free blocks */}
                    {block.isFree && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          className="text-xs font-bold text-gray-400"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          GAP
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              );
            })}
          </div>

          {/* Decay overlay effect */}
          <AnimatePresence>
            {decayLevel > 0.5 && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                style={{
                  background: `radial-gradient(circle, transparent 0%, ${getDecayColor(
                    decayLevel
                  )}40 100%)`,
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Status message */}
        <motion.div
          className="mt-3 text-center text-sm font-medium"
          style={{ color: getDecayColor(decayLevel) }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {getDecayMessage(decayLevel)}
        </motion.div>
      </div>

      {/* Gap details */}
      {gaps.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-400 font-medium">
            Free Blocks ({gaps.length}):
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {gaps.map((gap, idx) => (
              <motion.div
                key={`gap-${gap.address}-${idx}`}
                className="flex items-center justify-between text-xs bg-gray-800 rounded px-3 py-2"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <span className="text-gray-400">
                  0x{gap.address.toString(16).toUpperCase().padStart(8, '0')}
                </span>
                <span className="text-gray-300 font-mono">{gap.size} bytes</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Fragmentation explanation */}
      {decayLevel > 0.3 && (
        <motion.div
          className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs text-yellow-200"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <strong>⚠️ Fragmentation detected:</strong> Multiple small free blocks
          exist but cannot satisfy larger allocation requests. Consider
          defragmentation.
        </motion.div>
      )}
    </div>
  );
}
