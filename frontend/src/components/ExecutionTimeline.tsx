'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
} from 'lucide-react';

interface ExecutionState {
  timestamp: number;
  instruction: string;
  pc: number;
  registers: Record<string, number>;
  memory: Record<string, number>;
  description: string;
}

interface ExecutionTimelineProps {
  states: ExecutionState[];
  currentIndex: number;
  onSeek: (index: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export default function ExecutionTimeline({
  states,
  currentIndex,
  onSeek,
  isPlaying,
  onPlayPause,
  playbackSpeed,
  onSpeedChange,
}: ExecutionTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const speeds = [0.25, 0.5, 1, 2, 4];

  const handleStepBackward = () => {
    if (currentIndex > 0) {
      onSeek(currentIndex - 1);
    }
  };

  const handleStepForward = () => {
    if (currentIndex < states.length - 1) {
      onSeek(currentIndex + 1);
    }
  };

  const handleSeekToStart = () => {
    onSeek(0);
  };

  const handleSeekToEnd = () => {
    onSeek(states.length - 1);
  };

  const progress = states.length > 0 ? (currentIndex / (states.length - 1)) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-blue-500/30 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">⏱️</span>
          Execution Timeline
        </h3>
        <div className="text-sm text-cyan-300 font-mono bg-slate-900/50 px-3 py-1.5 rounded-lg">
          Step {currentIndex + 1} / {states.length}
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="mb-5">
        <div className="relative h-20 bg-slate-900/80 rounded-lg overflow-hidden border border-cyan-500/20 shadow-inner">
          {/* Progress bar */}
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500/30 to-blue-600/30"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />

          {/* Timeline markers */}
          <div className="absolute inset-0 flex items-center px-2">
            {states.map((state, idx) => {
              const position = states.length > 1 ? (idx / (states.length - 1)) * 100 : 50;
              const isCurrent = idx === currentIndex;
              const isPast = idx < currentIndex;
              const isHovered = idx === hoveredIndex;

              return (
                <div
                  key={idx}
                  className="absolute"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <motion.button
                    className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all shadow-lg ${
                      isCurrent
                        ? 'bg-cyan-400 border-cyan-300 scale-150 shadow-cyan-500/50'
                        : isPast
                        ? 'bg-blue-500 border-blue-400 shadow-blue-500/30'
                        : 'bg-slate-600 border-slate-500'
                    }`}
                    onClick={() => onSeek(idx)}
                    whileHover={{ scale: 2.2 }}
                    animate={isCurrent ? { scale: [1.5, 1.8, 1.5] } : {}}
                    transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
                  />

                  {/* Tooltip */}
                  {isHovered && (
                    <motion.div
                      className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-950 border border-gray-600 rounded px-2 py-1 text-xs whitespace-nowrap z-10"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="text-white font-mono">{state.instruction}</div>
                      <div className="text-gray-400">PC: 0x{state.pc.toString(16)}</div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current instruction display */}
      {states[currentIndex] && (
        <motion.div
          className="mb-4 p-3 bg-gray-800 rounded-lg"
          key={currentIndex}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Current Instruction:</span>
            <span className="text-xs text-blue-400 font-mono">
              PC: 0x{states[currentIndex].pc.toString(16).toUpperCase()}
            </span>
          </div>
          <div className="text-sm font-mono text-white mb-1">
            {states[currentIndex].instruction}
          </div>
          <div className="text-xs text-gray-400">
            {states[currentIndex].description}
          </div>
        </motion.div>
      )}

      {/* Playback controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Seek to start */}
          <button
            onClick={handleSeekToStart}
            disabled={currentIndex === 0}
            className="p-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Seek to start"
          >
            <Rewind className="w-4 h-4 text-white" />
          </button>

          {/* Step backward */}
          <button
            onClick={handleStepBackward}
            disabled={currentIndex === 0}
            className="p-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Step backward"
          >
            <SkipBack className="w-4 h-4 text-white" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            disabled={states.length === 0}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Step forward */}
          <button
            onClick={handleStepForward}
            disabled={currentIndex >= states.length - 1}
            className="p-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Step forward"
          >
            <SkipForward className="w-4 h-4 text-white" />
          </button>

          {/* Seek to end */}
          <button
            onClick={handleSeekToEnd}
            disabled={currentIndex >= states.length - 1}
            className="p-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Seek to end"
          >
            <FastForward className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Speed:</span>
          {speeds.map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                playbackSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
