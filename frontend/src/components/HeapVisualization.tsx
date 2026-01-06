"use client";

import { HeapState, HeapBlock } from "@/lib/types";

interface HeapVisualizationProps {
  heap: HeapState;
}

/**
 * Formats an address as hex string
 */
function formatAddress(address: number): string {
  return "0x" + (address >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Formats size in bytes with appropriate unit
 */
function formatSize(bytes: number): string {
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Formats fragmentation percentage
 */
function formatFragmentation(fragmentation: number): string {
  return `${fragmentation.toFixed(1)}%`;
}

interface HeapBlockDisplayProps {
  block: HeapBlock;
  maxSize: number;
}

function HeapBlockDisplay({ block, maxSize }: HeapBlockDisplayProps) {
  // Calculate relative width based on block size (min 10%, max 100%)
  const widthPercent = Math.max(10, Math.min(100, (block.size / maxSize) * 100));
  
  return (
    <div
      className={`
        relative rounded p-2 text-xs font-mono transition-all cursor-pointer
        ${block.allocated 
          ? "bg-red-700 hover:bg-red-600" 
          : "bg-green-700 hover:bg-green-600"
        }
        hover:ring-2 hover:ring-white
      `}
      style={{ width: `${widthPercent}%`, minWidth: "80px" }}
      title={`Address: ${formatAddress(block.address)}\nSize: ${formatSize(block.size)}\nStatus: ${block.allocated ? "Allocated" : "Free"}\n${block.allocated ? "🔴 In use" : "🟢 Available"}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-gray-200 truncate">{formatAddress(block.address)}</span>
        <span className="text-white font-semibold">{formatSize(block.size)}</span>
        <span className={`text-xs ${block.allocated ? "text-red-200" : "text-green-200"}`}>
          {block.allocated ? "🔴 Allocated" : "🟢 Free"}
        </span>
      </div>
    </div>
  );
}


export default function HeapVisualization({ heap }: HeapVisualizationProps) {
  // Safely access blocks and freeList with defaults
  const blocks = heap?.blocks ?? [];
  const freeList = heap?.freeList ?? [];
  const fragmentation = heap?.fragmentation ?? 0;
  
  // Calculate max block size for relative sizing
  const maxSize = blocks.length > 0 ? Math.max(...blocks.map(b => b.size), 1) : 1;
  
  // Calculate statistics
  const totalAllocated = blocks
    .filter(b => b.allocated)
    .reduce((sum, b) => sum + b.size, 0);
  const totalFree = blocks
    .filter(b => !b.allocated)
    .reduce((sum, b) => sum + b.size, 0);
  const totalSize = totalAllocated + totalFree;

  // Sort blocks by address (heap grows up)
  const sortedBlocks = [...blocks].sort((a, b) => a.address - b.address);

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-full overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Heap</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Fragmentation:</span>
          <span 
            className={`
              text-sm font-semibold px-2 py-0.5 rounded
              ${fragmentation > 50 
                ? "bg-red-900 text-red-300" 
                : fragmentation > 25 
                  ? "bg-yellow-900 text-yellow-300"
                  : "bg-green-900 text-green-300"
              }
            `}
          >
            {formatFragmentation(fragmentation)}
          </span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Total</div>
          <div className="text-white font-mono">{formatSize(totalSize)}</div>
        </div>
        <div className="bg-red-900/50 rounded p-2">
          <div className="text-red-400">Allocated</div>
          <div className="text-white font-mono">{formatSize(totalAllocated)}</div>
        </div>
        <div className="bg-green-900/50 rounded p-2">
          <div className="text-green-400">Free</div>
          <div className="text-white font-mono">{formatSize(totalFree)}</div>
        </div>
      </div>

      {/* Heap blocks visualization */}
      <div className="space-y-2">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>↑ grows up</span>
        </div>
        
        {sortedBlocks.length === 0 ? (
          <div className="text-gray-500 italic text-sm">No heap blocks</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedBlocks.map((block) => (
              <HeapBlockDisplay
                key={block.address}
                block={block}
                maxSize={maxSize}
              />
            ))}
          </div>
        )}
      </div>

      {/* Free list */}
      {freeList.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Free List:</div>
          <div className="flex flex-wrap gap-2">
            {freeList.map((freeBlock, index) => (
              <div
                key={`${freeBlock.address}-${index}`}
                className="bg-green-900/50 border border-green-600 rounded px-2 py-1 text-xs font-mono"
              >
                <span className="text-green-300">{formatAddress(freeBlock.address)}</span>
                <span className="text-gray-400 mx-1">→</span>
                <span className="text-white">{formatSize(freeBlock.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Legend:</div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-700 rounded"></div>
            <span className="text-gray-300">Allocated</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-700 rounded"></div>
            <span className="text-gray-300">Free</span>
          </div>
        </div>
      </div>
    </div>
  );
}
