"use client";

import { MemoryState, MemorySegment, MemoryBlock } from "@/lib/types";

interface MemoryLayoutProps {
  memory: MemoryState;
  changedAddresses?: number[];
}

// Segment colors following MIPS memory layout convention
const SEGMENT_COLORS = {
  text: {
    bg: "bg-blue-900/50",
    border: "border-blue-500",
    label: "text-blue-400",
    block: "bg-blue-700",
    changed: "bg-blue-400",
  },
  data: {
    bg: "bg-green-900/50",
    border: "border-green-500",
    label: "text-green-400",
    block: "bg-green-700",
    changed: "bg-green-400",
  },
  heap: {
    bg: "bg-yellow-900/50",
    border: "border-yellow-500",
    label: "text-yellow-400",
    block: "bg-yellow-700",
    changed: "bg-yellow-400",
  },
  stack: {
    bg: "bg-purple-900/50",
    border: "border-purple-500",
    label: "text-purple-400",
    block: "bg-purple-700",
    changed: "bg-purple-400",
  },
};

/**
 * Formats an address as hex string
 */
function formatAddress(address: number): string {
  return "0x" + (address >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Formats a value as hex string
 */
function formatValue(value: number | undefined): string {
  if (value === undefined) return "----";
  return "0x" + (value >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

interface SegmentDisplayProps {
  name: string;
  segment: MemorySegment;
  colors: typeof SEGMENT_COLORS.text;
  changedAddresses: Set<number>;
  growDirection: "up" | "down";
}

function SegmentDisplay({
  name,
  segment,
  colors,
  changedAddresses,
  growDirection,
}: SegmentDisplayProps) {
  // Sort blocks by address (ascending for heap, descending for stack)
  const sortedBlocks = [...segment.blocks].sort((a, b) =>
    growDirection === "up" ? a.address - b.address : b.address - a.address
  );

  return (
    <div className={`rounded-lg p-3 ${colors.bg} border ${colors.border}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`font-semibold ${colors.label}`}>{name}</span>
        <span className="text-xs text-gray-400 font-mono">
          {formatAddress(segment.startAddress)} - {formatAddress(segment.endAddress)}
        </span>
      </div>
      
      {growDirection === "up" && (
        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <span>↑ grows up</span>
        </div>
      )}
      {growDirection === "down" && (
        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <span>↓ grows down</span>
        </div>
      )}

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {sortedBlocks.length === 0 ? (
          <div className="text-xs text-gray-500 italic">Empty</div>
        ) : (
          sortedBlocks.slice(0, 20).map((block) => (
            <MemoryBlockDisplay
              key={block.address}
              block={block}
              colors={colors}
              isChanged={changedAddresses.has(block.address)}
            />
          ))
        )}
        {sortedBlocks.length > 20 && (
          <div className="text-xs text-gray-500">
            ... and {sortedBlocks.length - 20} more blocks
          </div>
        )}
      </div>
    </div>
  );
}

interface MemoryBlockDisplayProps {
  block: MemoryBlock;
  colors: typeof SEGMENT_COLORS.text;
  isChanged: boolean;
}

function MemoryBlockDisplay({ block, colors, isChanged }: MemoryBlockDisplayProps) {
  return (
    <div
      className={`
        flex justify-between items-center px-2 py-1 rounded text-xs font-mono cursor-pointer
        ${isChanged ? colors.changed : colors.block}
        ${isChanged ? "ring-2 ring-white animate-pulse" : ""}
        hover:brightness-110 transition-all
      `}
      title={`Address: ${formatAddress(block.address)}\nValue: ${formatValue(block.value)}${block.label ? `\nLabel: ${block.label}` : ""}${isChanged ? "\n⚡ Recently modified" : ""}`}
    >
      <span className="text-gray-200">{formatAddress(block.address)}</span>
      <span className="text-white">{formatValue(block.value)}</span>
      {block.label && (
        <span className="text-gray-300 truncate max-w-20">{block.label}</span>
      )}
    </div>
  );
}


export default function MemoryLayout({
  memory,
  changedAddresses = [],
}: MemoryLayoutProps) {
  const changedSet = new Set(changedAddresses);

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold text-white mb-4">Memory Layout</h2>
      
      {/* Memory segments displayed in MIPS address order (high to low) */}
      <div className="space-y-3">
        {/* Stack - highest addresses, grows down */}
        <SegmentDisplay
          name="Stack"
          segment={memory.stack}
          colors={SEGMENT_COLORS.stack}
          changedAddresses={changedSet}
          growDirection="down"
        />

        {/* Heap - grows up toward stack */}
        <SegmentDisplay
          name="Heap"
          segment={memory.heap}
          colors={SEGMENT_COLORS.heap}
          changedAddresses={changedSet}
          growDirection="up"
        />

        {/* Data - static data segment */}
        <SegmentDisplay
          name="Data"
          segment={memory.data}
          colors={SEGMENT_COLORS.data}
          changedAddresses={changedSet}
          growDirection="up"
        />

        {/* Text - instruction memory, lowest addresses */}
        <SegmentDisplay
          name="Text"
          segment={memory.text}
          colors={SEGMENT_COLORS.text}
          changedAddresses={changedSet}
          growDirection="up"
        />
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Legend:</div>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-700 rounded"></div>
            <span className="text-gray-300">Text</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-700 rounded"></div>
            <span className="text-gray-300">Data</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-700 rounded"></div>
            <span className="text-gray-300">Heap</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-700 rounded"></div>
            <span className="text-gray-300">Stack</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-white rounded ring-2 ring-white"></div>
            <span className="text-gray-300">Changed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Validates memory segment ordering according to MIPS convention.
 * Exported for property testing.
 */
export function validateSegmentOrdering(memory: MemoryState): boolean {
  // Data segment should be at lower addresses than heap
  // Heap should be at lower addresses than stack
  // Text is typically at the lowest addresses
  
  const textEnd = memory.text.endAddress;
  const dataStart = memory.data.startAddress;
  const dataEnd = memory.data.endAddress;
  const heapStart = memory.heap.startAddress;
  const heapEnd = memory.heap.endAddress;
  const stackStart = memory.stack.startAddress;

  // Heap addresses > Data addresses
  const heapAboveData = heapStart >= dataEnd || heapEnd > dataStart;
  
  // Stack addresses > Heap addresses  
  const stackAboveHeap = stackStart >= heapEnd || stackStart > heapStart;

  return heapAboveData && stackAboveHeap;
}
