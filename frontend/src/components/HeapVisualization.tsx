"use client";

import { motion } from "framer-motion";
import { HeapState, HeapBlock } from "@/lib/types";

interface HeapVisualizationProps {
  heap: HeapState;
}

function formatAddress(address: number): string {
  return "0x" + (address >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function formatSize(bytes: number): string {
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

interface HeapBlockDisplayProps {
  block: HeapBlock;
  maxSize: number;
  index: number;
}

function HeapBlockDisplay({ block, maxSize, index }: HeapBlockDisplayProps) {
  const widthPercent = Math.max(15, Math.min(100, (block.size / maxSize) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        relative rounded-lg p-2.5 text-[10px] font-mono cursor-pointer overflow-hidden
        transition-all duration-300 border
        ${block.allocated
          ? "bg-violet-600/20 border-violet-500/30 text-violet-200"
          : "bg-slate-800/20 border-white/5 text-gray-400"
        }
        hover:border-white/20
      `}
      style={{ width: `${widthPercent}%`, minWidth: "90px" }}
      title={`Address: ${formatAddress(block.address)}\nSize: ${formatSize(block.size)}\nStatus: ${block.allocated ? "Allocated" : "Free"}`}
    >
      <div className="relative flex flex-col gap-0.5">
        <span className="opacity-60">{formatAddress(block.address)}</span>
        <span className="font-bold text-[11px]">{formatSize(block.size)}</span>
        <span className="opacity-80 flex items-center gap-1 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${block.allocated ? "bg-violet-400" : "bg-gray-500"}`} />
          {block.allocated ? "Allocated" : "Free"}
        </span>
      </div>
    </motion.div>
  );
}

export default function HeapVisualization({ heap }: HeapVisualizationProps) {
  const blocks = heap?.blocks ?? [];
  const fragmentation = heap?.fragmentation ?? 0;
  const maxSize = blocks.length > 0 ? Math.max(...blocks.map(b => b.size), 1) : 1;
  const sortedBlocks = [...blocks].sort((a, b) => a.address - b.address);

  return (
    <div className="glass rounded-xl p-5 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-md font-bold text-gray-200 flex items-center gap-2">
          <span>🔶</span>
          Heap
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Fragmentation</span>
          <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            {fragmentation.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {sortedBlocks.length === 0 ? (
          <div className="text-gray-500 italic text-[11px] text-center py-10 bg-black/10 rounded-xl border border-dashed border-white/5">
            No heap blocks allocated
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedBlocks.map((block, index) => (
              <HeapBlockDisplay
                key={block.address}
                block={block}
                maxSize={maxSize}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="flex gap-4 text-[10px] text-gray-500 font-semibold uppercase tracking-tighter">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-violet-600/40 border border-violet-500/30" />
            <span>Allocated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-slate-800/40 border border-white/10" />
            <span>Free</span>
          </div>
        </div>
      </div>
    </div>
  );
}
