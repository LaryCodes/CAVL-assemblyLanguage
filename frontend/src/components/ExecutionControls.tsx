"use client";

import { motion } from "framer-motion";

interface ExecutionControlsProps {
  onLoad: () => void;
  isLoading?: boolean;
}

// Icon components
const PlayIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const SpinnerIcon = () => (
  <motion.svg
    className="w-5 h-5"
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </motion.svg>
);

export default function ExecutionControls({
  onLoad,
  isLoading = false,
}: ExecutionControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl px-6 py-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <motion.button
          onClick={onLoad}
          disabled={isLoading}
          whileHover={isLoading ? {} : { scale: 1.02, y: -1 }}
          whileTap={isLoading ? {} : { scale: 0.98 }}
          className={`
            flex items-center gap-3 px-8 py-3 rounded-xl font-semibold text-white
            bg-gradient-to-r from-violet-600 to-indigo-600
            hover:from-violet-500 hover:to-indigo-500
            shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
            transition-all duration-300
            disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-violet-500/25
          `}
        >
          {isLoading ? <SpinnerIcon /> : <PlayIcon />}
          <span className="text-base">
            {isLoading ? "Executing..." : "Execute Code"}
          </span>
        </motion.button>

        <p className="text-sm text-gray-400">
          {isLoading
            ? "Running your MIPS program..."
            : "Click to compile and run your MIPS program"
          }
        </p>
      </div>

      {/* Status indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30"
        >
          <motion.div
            className="w-2 h-2 bg-violet-500 rounded-full"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-violet-300 font-medium">Processing...</span>
        </motion.div>
      )}
    </motion.div>
  );
}
