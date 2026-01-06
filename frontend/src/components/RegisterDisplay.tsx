"use client";

import { useState } from "react";
import { RegisterState, MIPS_REGISTERS } from "@/lib/types";

interface RegisterDisplayProps {
  registers: RegisterState;
  changedRegisters?: string[];
}

/**
 * Converts a number to hexadecimal string (8 digits, uppercase)
 */
export function toHex(value: number): string {
  // Handle negative numbers by converting to unsigned 32-bit
  const unsigned = value >>> 0;
  return "0x" + unsigned.toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Converts a hexadecimal string to decimal number
 */
export function fromHex(hex: string): number {
  const cleanHex = hex.replace(/^0x/i, "");
  const unsigned = parseInt(cleanHex, 16);
  // Convert to signed 32-bit if necessary
  if (unsigned > 0x7FFFFFFF) {
    return unsigned - 0x100000000;
  }
  return unsigned;
}

/**
 * Formats a register value for display
 */
function formatValue(value: number, displayHex: boolean): string {
  if (displayHex) {
    return toHex(value);
  }
  return value.toString();
}

export default function RegisterDisplay({
  registers,
  changedRegisters = [],
}: RegisterDisplayProps) {
  const [displayHex, setDisplayHex] = useState(true);

  const changedSet = new Set(changedRegisters);

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-full overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Registers</h2>
        <button
          onClick={() => setDisplayHex(!displayHex)}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          {displayHex ? "Decimal" : "Hex"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {MIPS_REGISTERS.map((regName) => {
          const value = registers.values[regName] ?? 0;
          const isChanged = changedSet.has(regName);

          return (
            <div
              key={regName}
              className={`
                flex flex-col p-2 rounded text-sm font-mono
                ${isChanged 
                  ? "bg-yellow-900/50 border border-yellow-500" 
                  : "bg-gray-800"
                }
              `}
            >
              <span className={`text-xs ${isChanged ? "text-yellow-400" : "text-gray-400"}`}>
                {regName}
              </span>
              <span className={`truncate ${isChanged ? "text-yellow-200" : "text-white"}`}>
                {formatValue(value, displayHex)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
