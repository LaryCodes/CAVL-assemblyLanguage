"use client";

import { motion } from "framer-motion";
import { MemoryState, MemorySegment, MemoryBlock } from "@/lib/types";

interface MemoryLayoutProps {
  memory: MemoryState;
  changedAddresses?: number[];
}

// Segment colors - Refined cohesive purple palette
const SEGMENT_STYLES = {
  text: {
    gradient: "from-indigo-500/10 to-indigo-600/5",
    border: "border-indigo-500/20",
    glow: "shadow-indigo-500/5",
    label: "text-indigo-300",
    block: "from-indigo-600/40 to-indigo-700/40",
    changed: "from-indigo-400 to-indigo-300",
    icon: "💻",
  },
  data: {
    gradient: "from-violet-500/10 to-violet-600/5",
    border: "border-violet-500/20",
    glow: "shadow-violet-500/5",
    label: "text-violet-300",
    block: "from-violet-600/40 to-violet-700/40",
    changed: "from-violet-400 to-violet-300",
    icon: "📦",
  },
  heap: {
    gradient: "from-purple-500/10 to-purple-600/5",
    border: "border-purple-500/20",
    glow: "shadow-purple-500/5",
    label: "text-purple-300",
    block: "from-purple-600/40 to-purple-700/40",
    changed: "from-purple-400 to-purple-300",
    icon: "🔶",
  },
  stack: {
    gradient: "from-fuchsia-500/10 to-fuchsia-600/5",
    border: "border-fuchsia-500/20",
    glow: "shadow-fuchsia-500/5",
    label: "text-fuchsia-300",
    block: "from-fuchsia-600/40 to-fuchsia-700/40",
    changed: "from-fuchsia-400 to-fuchsia-300",
    icon: "📚",
  },
};

function formatAddress(address: number): string {
  return "0x" + (address >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function formatValue(value: number | undefined): string {
  if (value === undefined) return "----";
  return "0x" + (value >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

interface SegmentDisplayProps {
  name: string;
  segment: MemorySegment;
  styles: typeof SEGMENT_STYLES.text;
  changedAddresses: Set<number>;
  growDirection: "up" | "down";
  index: number;
}

function SegmentDisplay({
  name,
  segment,
  styles,
  changedAddresses,
  growDirection,
  index,
}: SegmentDisplayProps) {
  const sortedBlocks = [...segment.blocks].sort((a, b) =>
    growDirection === "up" ? a.address - b.address : b.address - a.address
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={`
        relative overflow-hidden rounded-xl p-4
        bg-gradient-to-br ${styles.gradient}
        border ${styles.border} shadow-sm ${styles.glow}
        hover:border-white/10 transition-colors duration-300
      `}
    >
      <div className="relative">
        <div className="flex justify-between items-center mb-3">
          <span className={`font-semibold ${styles.label} flex items-center gap-2 text-sm`}>
            <span>{styles.icon}</span>
            {name}
          </span>
          <span className="text-[10px] text-gray-400 font-mono bg-black/30 px-2 py-0.5 rounded border border-white/5">
            {formatAddress(segment.startAddress)}
          </span>
        </div>

        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
          {sortedBlocks.length === 0 ? (
            <div className="text-[10px] text-gray-500 italic py-2 text-center bg-black/10 rounded-lg">
              Empty segment
            </div>
          ) : (
            sortedBlocks.slice(0, 10).map((block, blockIndex) => (
              <MemoryBlockDisplay
                key={block.address}
                block={block}
                styles={styles}
                isChanged={changedAddresses.has(block.address)}
                index={blockIndex}
              />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface MemoryBlockDisplayProps {
  block: MemoryBlock;
  styles: typeof SEGMENT_STYLES.text;
  isChanged: boolean;
  index: number;
}

function MemoryBlockDisplay({ block, styles, isChanged, index }: MemoryBlockDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`
        relative flex justify-between items-center px-2 py-1 rounded text-[11px] font-mono
        ${isChanged ? "bg-indigo-500/30 border border-indigo-400/50" : "bg-black/20 border border-white/5"}
        hover:bg-white/5 transition-colors duration-200
      `}
    >
      <span className="text-gray-400">{formatAddress(block.address)}</span>
      <span className="text-gray-100">{formatValue(block.value)}</span>
    </motion.div>
  );
}

export default function MemoryLayout({
  memory,
  changedAddresses = [],
}: MemoryLayoutProps) {
  const changedSet = new Set(changedAddresses);

  return (
    <div className="glass rounded-xl p-5 h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-md font-bold text-gray-200 flex items-center gap-2">
          <span>🧠</span>
          Memory Layout
        </h2>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">MIPS 32-bit</div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <SegmentDisplay
          name="Stack"
          segment={memory.stack}
          styles={SEGMENT_STYLES.stack}
          changedAddresses={changedSet}
          growDirection="down"
          index={0}
        />

        <SegmentDisplay
          name="Heap"
          segment={memory.heap}
          styles={SEGMENT_STYLES.heap}
          changedAddresses={changedSet}
          growDirection="up"
          index={1}
        />

        <SegmentDisplay
          name="Data"
          segment={memory.data}
          styles={SEGMENT_STYLES.data}
          changedAddresses={changedSet}
          growDirection="up"
          index={2}
        />

        <SegmentDisplay
          name="Text"
          segment={memory.text}
          styles={SEGMENT_STYLES.text}
          changedAddresses={changedSet}
          growDirection="up"
          index={3}
        />
      </div>
    </div>
  );
}
