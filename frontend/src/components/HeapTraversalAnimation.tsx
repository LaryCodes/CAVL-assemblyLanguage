'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface FreeBlock {
  address: number;
  size: number;
  next?: number;
}

interface HeapTraversalAnimationProps {
  freeList: FreeBlock[];
  requestedSize: number;
  onAnimationComplete?: () => void;
}

type AnimationPhase = 'traversing' | 'comparing' | 'match' | 'too-small' | 'complete';

export default function HeapTraversalAnimation({
  freeList,
  requestedSize,
  onAnimationComplete,
}: HeapTraversalAnimationProps) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [phase, setPhase] = useState<AnimationPhase>('traversing');

  useEffect(() => {
    if (freeList.length === 0) return;

    const animateTraversal = async () => {
      for (let i = 0; i < freeList.length; i++) {
        setCurrentBlockIndex(i);
        setPhase('traversing');
        await new Promise(resolve => setTimeout(resolve, 500));

        setPhase('comparing');
        await new Promise(resolve => setTimeout(resolve, 800));

        const block = freeList[i];
        if (block.size >= requestedSize) {
          setPhase('match');
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        } else {
          setPhase('too-small');
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }

      setPhase('complete');
      setTimeout(() => onAnimationComplete?.(), 500);
    };

    animateTraversal();
  }, [freeList, requestedSize, onAnimationComplete]);

  if (freeList.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <p className="text-gray-400 text-center">No free blocks to visualize</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-emerald-500/30 shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">🔍</span>
        First-Fit Algorithm Animation
      </h3>

      <div className="mb-5 p-4 bg-slate-900/80 rounded-lg border border-cyan-500/20 shadow-inner">
        <div className="text-sm text-cyan-100">
          <span className="text-cyan-400 font-medium">Requested Size:</span>{' '}
          <span className="font-mono font-bold text-cyan-300 text-lg">{requestedSize} bytes</span>
        </div>
      </div>

      <div className="space-y-3">
        {freeList.map((block, idx) => {
          const isCurrent = idx === currentBlockIndex;
          const isPast = idx < currentBlockIndex;
          const isFit = block.size >= requestedSize;

          return (
            <motion.div
              key={`${block.address}-${idx}`}
              className={`relative p-5 rounded-xl border-2 transition-all shadow-lg ${
                isCurrent && phase === 'match'
                  ? 'border-emerald-500 bg-emerald-900/40 shadow-emerald-500/50'
                  : isCurrent && phase === 'too-small'
                  ? 'border-red-500 bg-red-900/40 shadow-red-500/50'
                  : isCurrent
                  ? 'border-cyan-500 bg-cyan-900/40 shadow-cyan-500/50'
                  : isPast
                  ? 'border-slate-600 bg-slate-800/50 opacity-60'
                  : 'border-slate-600 bg-slate-800/80'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400">Address:</div>
                  <div className="font-mono text-sm text-white">
                    0x{block.address.toString(16).toUpperCase().padStart(8, '0')}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">Size:</div>
                  <div className="font-mono text-lg font-bold text-white">
                    {block.size} bytes
                  </div>
                </div>

                {isCurrent && phase === 'comparing' && (
                  <motion.div
                    className="text-2xl"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    🔍
                  </motion.div>
                )}

                {isCurrent && phase === 'match' && (
                  <motion.div
                    className="text-3xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    ✅
                  </motion.div>
                )}

                {isCurrent && phase === 'too-small' && (
                  <motion.div
                    className="text-3xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    ❌
                  </motion.div>
                )}
              </div>

              {isCurrent && phase === 'comparing' && (
                <motion.div
                  className="mt-2 text-xs text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="text-gray-400">Comparing: </span>
                  <span className="font-mono text-white">
                    {block.size} {isFit ? '≥' : '<'} {requestedSize}
                  </span>
                </motion.div>
              )}

              {isCurrent && phase === 'traversing' && (
                <motion.div
                  className="absolute -left-3 top-1/2 transform -translate-y-1/2"
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <div className="text-2xl">👉</div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {phase === 'complete' && (
        <motion.div
          className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ✅ Allocation complete! Block found and allocated.
        </motion.div>
      )}
    </div>
  );
}
