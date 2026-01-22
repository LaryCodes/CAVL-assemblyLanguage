"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RegisterState, MIPS_REGISTERS } from "@/lib/types";

interface RegisterDisplayProps {
  registers: RegisterState;
  changedRegisters?: string[];
}

export function toHex(value: number): string {
  const unsigned = value >>> 0;
  return "0x" + unsigned.toString(16).toUpperCase().padStart(8, "0");
}

function formatValue(value: number, displayHex: boolean): string {
  if (displayHex) {
    return toHex(value);
  }
  return value.toString();
}

// Unified Register Theme
const REG_STYLE = {
  text: "text-indigo-200",
  bg: "bg-indigo-500/5",
  border: "border-indigo-500/10",
  accent: "bg-indigo-400",
  changed: {
    bg: "bg-indigo-500/20",
    border: "border-indigo-400/50",
    text: "text-indigo-100",
    glow: "shadow-indigo-500/25",
  }
};

export default function RegisterDisplay({
  registers,
  changedRegisters = [],
}: RegisterDisplayProps) {
  const [displayHex, setDisplayHex] = useState(true);
  const changedSet = new Set(changedRegisters);

  return (
    <div className="glass rounded-xl p-5 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-md font-bold text-gray-200 flex items-center gap-2">
          <span>📊</span>
          Registers
        </h2>
        <button
          onClick={() => setDisplayHex(!displayHex)}
          className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded border border-white/10 transition-all"
        >
          {displayHex ? "HEX" : "DEC"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {MIPS_REGISTERS.map((regName, index) => {
            const value = registers.values[regName] ?? 0;
            const isChanged = changedSet.has(regName);
            const isNonZero = value !== 0;

            return (
              <motion.div
                key={regName}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01 }}
                className={`
                  relative flex flex-col p-2.5 rounded-lg text-[11px] font-mono border transition-all
                  ${isChanged
                    ? `${REG_STYLE.changed.bg} ${REG_STYLE.changed.border} ${REG_STYLE.changed.glow}`
                    : "bg-black/20 border-white/5"
                  }
                `}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[10px] font-bold opacity-70 ${isChanged ? "text-indigo-300" : "text-gray-500"}`}>
                    {regName}
                  </span>
                  {isNonZero && !isChanged && (
                    <div className="w-1 h-1 rounded-full bg-indigo-500/50" />
                  )}
                </div>
                <span className={`truncate font-semibold ${isChanged ? REG_STYLE.changed.text : isNonZero ? "text-gray-100" : "text-gray-600"}`}>
                  {formatValue(value, displayHex)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
