"use client";

interface LegendItem {
  color: string;
  label: string;
  description?: string;
}

interface LegendProps {
  title?: string;
  items: LegendItem[];
  compact?: boolean;
}

/**
 * Legend component for explaining color coding
 * Requirements: 8.2
 */
export default function Legend({ title, items, compact = false }: LegendProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-3 text-xs">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5" title={item.description}>
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-300">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      {title && (
        <div className="text-xs font-semibold text-gray-400 mb-2">{title}</div>
      )}
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded flex-shrink-0" 
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-white">{item.label}</span>
              {item.description && (
                <span className="text-xs text-gray-400 ml-2">{item.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pre-defined legend configurations
export const MEMORY_LEGEND_ITEMS: LegendItem[] = [
  { color: "#1d4ed8", label: "Text", description: "Instruction memory (read-only)" },
  { color: "#15803d", label: "Data", description: "Static/global variables" },
  { color: "#a16207", label: "Heap", description: "Dynamic memory (grows up)" },
  { color: "#7e22ce", label: "Stack", description: "Function call frames (grows down)" },
  { color: "#ffffff", label: "Changed", description: "Recently modified" },
];

export const HEAP_LEGEND_ITEMS: LegendItem[] = [
  { color: "#b91c1c", label: "Allocated", description: "Memory in use" },
  { color: "#15803d", label: "Free", description: "Available for allocation" },
];

export const REGISTER_LEGEND_ITEMS: LegendItem[] = [
  { color: "#854d0e", label: "Changed", description: "Modified by last instruction" },
];
