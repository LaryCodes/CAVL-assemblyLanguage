"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Binary,
  Cpu,
  ChevronRight,
  AlertCircle,
  Info,
  Copy,
  Check,
  Zap,
  Hash,
  RefreshCw,
} from "lucide-react";

// ============== Types ==============

interface InstructionField {
  name: string;
  value: number;
  binary: string;
  description: string;
}

interface DecodedInstruction {
  original: string;
  format: string;
  opcode: number;
  opcode_binary: string;
  fields: InstructionField[];
  machine_code_hex: string;
  machine_code_binary: string;
  machine_code_binary_formatted: string;
  description: string;
}

interface DecodeResponse {
  success: boolean;
  instruction: DecodedInstruction | null;
  error: string | null;
}

interface InstructionDecoderProps {
  initialInstruction?: string;
  onClose?: () => void;
}

// ============== Field Colors ==============

const FIELD_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  opcode: { bg: "bg-red-900/60", border: "border-red-500", text: "text-red-300", glow: "shadow-red-500/30" },
  rs: { bg: "bg-blue-900/60", border: "border-blue-500", text: "text-blue-300", glow: "shadow-blue-500/30" },
  rt: { bg: "bg-green-900/60", border: "border-green-500", text: "text-green-300", glow: "shadow-green-500/30" },
  rd: { bg: "bg-purple-900/60", border: "border-purple-500", text: "text-purple-300", glow: "shadow-purple-500/30" },
  shamt: { bg: "bg-yellow-900/60", border: "border-yellow-500", text: "text-yellow-300", glow: "shadow-yellow-500/30" },
  funct: { bg: "bg-cyan-900/60", border: "border-cyan-500", text: "text-cyan-300", glow: "shadow-cyan-500/30" },
  immediate: { bg: "bg-orange-900/60", border: "border-orange-500", text: "text-orange-300", glow: "shadow-orange-500/30" },
  address: { bg: "bg-pink-900/60", border: "border-pink-500", text: "text-pink-300", glow: "shadow-pink-500/30" },
};

const FORMAT_INFO = {
  R: {
    name: "R-type (Register)",
    description: "Register-to-register operations",
    layout: ["opcode (6)", "rs (5)", "rt (5)", "rd (5)", "shamt (5)", "funct (6)"],
    color: "from-blue-500 to-purple-600",
  },
  I: {
    name: "I-type (Immediate)",
    description: "Operations with immediate values",
    layout: ["opcode (6)", "rs (5)", "rt (5)", "immediate (16)"],
    color: "from-green-500 to-cyan-600",
  },
  J: {
    name: "J-type (Jump)",
    description: "Jump instructions",
    layout: ["opcode (6)", "address (26)"],
    color: "from-orange-500 to-red-600",
  },
};

// ============== Example Instructions ==============

const EXAMPLE_INSTRUCTIONS = [
  { instruction: "add $t0, $t1, $t2", description: "R-type: Add registers" },
  { instruction: "addi $t0, $zero, 10", description: "I-type: Add immediate" },
  { instruction: "lw $t0, 0($sp)", description: "I-type: Load word" },
  { instruction: "beq $t0, $t1, label", description: "I-type: Branch if equal" },
  { instruction: "j main", description: "J-type: Jump" },
  { instruction: "sll $t0, $t1, 5", description: "R-type: Shift left" },
];

// ============== Animated Bit Display ==============

function AnimatedBit({ bit, index, color, delay }: { bit: string; index: number; color: string; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: -10, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: delay + index * 0.02,
        type: "spring",
        stiffness: 500,
        damping: 25
      }}
      className={`inline-block font-mono text-lg ${color}`}
    >
      {bit}
    </motion.span>
  );
}

// ============== Binary Field Box ==============

function BinaryFieldBox({
  field,
  index,
  isHovered,
  onHover
}: {
  field: InstructionField;
  index: number;
  isHovered: boolean;
  onHover: (name: string | null) => void;
}) {
  const colors = FIELD_COLORS[field.name] || FIELD_COLORS.opcode;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1, type: "spring", stiffness: 300 }}
      onMouseEnter={() => onHover(field.name)}
      onMouseLeave={() => onHover(null)}
      className={`
        relative p-3 rounded-lg border-2 cursor-pointer
        ${colors.bg} ${colors.border}
        ${isHovered ? `shadow-lg ${colors.glow} scale-105` : ""}
        transition-all duration-200
      `}
    >
      {/* Field Name */}
      <div className={`text-xs font-bold uppercase tracking-wider ${colors.text} mb-1`}>
        {field.name}
      </div>

      {/* Binary Value */}
      <div className="font-mono text-white text-sm tracking-widest">
        {field.binary.split("").map((bit, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + index * 0.1 + i * 0.03 }}
            className={isHovered ? "text-white" : "text-gray-300"}
          >
            {bit}
          </motion.span>
        ))}
      </div>

      {/* Decimal Value */}
      <div className="text-xs text-gray-400 mt-1">
        = {field.value}
      </div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-10 whitespace-nowrap"
          >
            <div className="text-xs text-gray-300">{field.description}</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800 border-r border-b border-gray-600"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============== Full Binary Display ==============

function FullBinaryDisplay({
  binary,
  format,
  hoveredField
}: {
  binary: string;
  format: string;
  hoveredField: string | null;
}) {
  // Split binary by format
  const getFieldRanges = () => {
    if (format === "R") {
      return [
        { start: 0, end: 6, name: "opcode" },
        { start: 6, end: 11, name: "rs" },
        { start: 11, end: 16, name: "rt" },
        { start: 16, end: 21, name: "rd" },
        { start: 21, end: 26, name: "shamt" },
        { start: 26, end: 32, name: "funct" },
      ];
    } else if (format === "I") {
      return [
        { start: 0, end: 6, name: "opcode" },
        { start: 6, end: 11, name: "rs" },
        { start: 11, end: 16, name: "rt" },
        { start: 16, end: 32, name: "immediate" },
      ];
    } else {
      return [
        { start: 0, end: 6, name: "opcode" },
        { start: 6, end: 32, name: "address" },
      ];
    }
  };

  const ranges = getFieldRanges();

  return (
    <div className="font-mono text-xl tracking-wider flex flex-wrap justify-center gap-1">
      {ranges.map((range, rangeIdx) => {
        const colors = FIELD_COLORS[range.name] || FIELD_COLORS.opcode;
        const isHovered = hoveredField === range.name;
        const bits = binary.slice(range.start, range.end);

        return (
          <motion.div
            key={range.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: rangeIdx * 0.1 }}
            className={`
              px-2 py-1 rounded border
              ${isHovered ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}` : "border-gray-700"}
              transition-all duration-200
            `}
          >
            {bits.split("").map((bit, i) => (
              <AnimatedBit
                key={i}
                bit={bit}
                index={i}
                color={isHovered ? colors.text : "text-gray-400"}
                delay={rangeIdx * 0.1}
              />
            ))}
          </motion.div>
        );
      })}
    </div>
  );
}

// ============== Format Layout Diagram ==============

function FormatLayoutDiagram({ format }: { format: string }) {
  const info = FORMAT_INFO[format as keyof typeof FORMAT_INFO];
  if (!info) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-4"
    >
      <div className={`inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r ${info.color} text-white text-sm font-semibold mb-2`}>
        {info.name}
      </div>
      <div className="text-xs text-gray-400 mb-2">{info.description}</div>
      <div className="flex gap-1 text-xs font-mono">
        {info.layout.map((field, i) => {
          const fieldName = field.split(" ")[0];
          const colors = FIELD_COLORS[fieldName] || FIELD_COLORS.opcode;
          return (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`px-2 py-1 rounded ${colors.bg} ${colors.border} border ${colors.text}`}
            >
              {field}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============== Main Component ==============

export default function InstructionDecoder({
  initialInstruction = "",
  onClose
}: InstructionDecoderProps) {
  const [instruction, setInstruction] = useState(initialInstruction);
  const [decoded, setDecoded] = useState<DecodedInstruction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const decodeInstruction = useCallback(async (instr: string) => {
    if (!instr.trim()) {
      setDecoded(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/decode/instruction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instr }),
      });

      const data: DecodeResponse = await response.json();

      if (data.success && data.instruction) {
        setDecoded(data.instruction);
        setError(null);
      } else {
        setDecoded(null);
        setError(data.error || "Failed to decode instruction");
      }
    } catch (err) {
      setDecoded(null);
      setError("Connection error: Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced decode
  useEffect(() => {
    const timer = setTimeout(() => {
      decodeInstruction(instruction);
    }, 300);

    return () => clearTimeout(timer);
  }, [instruction, decodeInstruction]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExampleClick = (example: string) => {
    setInstruction(example);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900/50 to-purple-900/50 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Binary className="w-8 h-8 text-cyan-400" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">MIPS Instruction Decoder</h2>
              <p className="text-sm text-gray-400">Visualize assembly → machine code encoding</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Input Section */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter MIPS Instruction
          </label>
          <div className="relative">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., add $t0, $t1, $t2"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            {isLoading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <RefreshCw className="w-5 h-5 text-cyan-400" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Example Instructions */}
        <div>
          <div className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Quick Examples
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_INSTRUCTIONS.map((ex, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleExampleClick(ex.instruction)}
                className="px-3 py-1.5 text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 hover:border-cyan-500 transition-all"
                title={ex.description}
              >
                {ex.instruction}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Decoded Result */}
        <AnimatePresence mode="wait">
          {decoded && (
            <motion.div
              key={decoded.machine_code_hex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Format Layout */}
              <FormatLayoutDiagram format={decoded.format} />

              {/* Full Binary with Field Highlighting */}
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  32-bit Binary Encoding
                </div>
                <FullBinaryDisplay
                  binary={decoded.machine_code_binary}
                  format={decoded.format}
                  hoveredField={hoveredField}
                />
              </div>

              {/* Field Breakdown */}
              <div>
                <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Instruction Fields (hover for details)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {/* Opcode always first */}
                  <BinaryFieldBox
                    field={{
                      name: "opcode",
                      value: decoded.opcode,
                      binary: decoded.opcode_binary,
                      description: `Opcode: ${decoded.opcode} (${decoded.format}-type)`,
                    }}
                    index={0}
                    isHovered={hoveredField === "opcode"}
                    onHover={setHoveredField}
                  />
                  {decoded.fields.map((field, index) => (
                    <BinaryFieldBox
                      key={field.name}
                      field={field}
                      index={index + 1}
                      isHovered={hoveredField === field.name}
                      onHover={setHoveredField}
                    />
                  ))}
                </div>
              </div>

              {/* Machine Code Output */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Hex */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Hexadecimal</span>
                    <button
                      onClick={() => handleCopy(decoded.machine_code_hex, "hex")}
                      className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                      {copied === "hex" ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-2xl text-cyan-400 tracking-wider">
                    {decoded.machine_code_hex}
                  </div>
                </motion.div>

                {/* Decimal */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Decimal (32-bit unsigned)</span>
                    <button
                      onClick={() => handleCopy(String(parseInt(decoded.machine_code_hex, 16)), "dec")}
                      className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                      {copied === "dec" ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-2xl text-purple-400 tracking-wider">
                    {parseInt(decoded.machine_code_hex, 16).toLocaleString()}
                  </div>
                </motion.div>
              </div>

              {/* Info Banner */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-3 px-4 py-3 bg-blue-900/20 border border-blue-500/30 rounded-lg"
              >
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-200">
                  <span className="font-semibold">How it works:</span> MIPS instructions are encoded as 32-bit words.
                  The format ({decoded.format}-type) determines how bits are organized into fields.
                  <span className="block mt-1 text-blue-300/70">
                    {decoded.description}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!decoded && !error && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Binary className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <div className="text-gray-400">Enter a MIPS instruction to see its binary encoding</div>
            <div className="text-sm text-gray-500 mt-2">
              Supports R-type, I-type, and J-type instructions
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700">
        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4">
          <span className="font-semibold text-gray-400">Field Legend:</span>
          {Object.entries(FIELD_COLORS).slice(0, 6).map(([name, colors]) => (
            <div key={name} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${colors.bg} ${colors.border} border`}></div>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
