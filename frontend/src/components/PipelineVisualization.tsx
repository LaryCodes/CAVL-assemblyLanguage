"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Zap,
  Activity,
  Clock,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============== Types ==============

interface PipelineStage {
  name: string;
  instruction: number;
  instruction_hex: string;
  pc: number;
  pc_hex: string;
  valid: boolean;
  src_reg1: number;
  src_reg2: number;
  dest_reg: number;
  src_reg1_name: string | null;
  src_reg2_name: string | null;
  dest_reg_name: string | null;
}

interface HazardInfo {
  detected: boolean;
  hazard_type: number;
  hazard_type_name: string;
  stall_required: boolean;
  forward_from: number;
  forward_from_name: string | null;
  forward_to: number;
  forward_to_name: string | null;
  forward_reg: number;
  forward_reg_name: string | null;
}

interface PipelineMetrics {
  total_cycles: number;
  total_instructions: number;
  stall_cycles: number;
  forward_count: number;
  branch_stalls: number;
  load_use_stalls: number;
  raw_hazards: number;
  cpi: number;
  efficiency: number;
  speedup: number;
}

interface CycleRecord {
  cycle: number;
  stages: Record<string, number>;
  stages_hex: Record<string, string>;
  hazard_type: number;
  hazard_type_name: string;
  stall: boolean;
  forward: boolean;
}

interface PipelineSimulationResult {
  success: boolean;
  stages: PipelineStage[];
  hazard: HazardInfo | null;
  metrics: PipelineMetrics | null;
  cycle_history: CycleRecord[];
  simulation_complete: boolean;
  error: string | null;
}

interface PipelineVisualizationProps {
  simulationResult: PipelineSimulationResult | null;
  isLoading?: boolean;
  onSimulate?: () => void;
}

// ============== Stage Colors ==============

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  IF: { bg: "bg-blue-900/50", border: "border-blue-500", text: "text-blue-400" },
  ID: { bg: "bg-purple-900/50", border: "border-purple-500", text: "text-purple-400" },
  EX: { bg: "bg-orange-900/50", border: "border-orange-500", text: "text-orange-400" },
  MEM: { bg: "bg-green-900/50", border: "border-green-500", text: "text-green-400" },
  WB: { bg: "bg-cyan-900/50", border: "border-cyan-500", text: "text-cyan-400" },
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  IF: "Instruction Fetch",
  ID: "Instruction Decode",
  EX: "Execute",
  MEM: "Memory Access",
  WB: "Write Back",
};

const HAZARD_COLORS: Record<string, string> = {
  none: "bg-green-500",
  RAW: "bg-yellow-500",
  "load-use": "bg-red-500",
  control: "bg-purple-500",
};

// ============== Helper Functions ==============

function decodeInstructionName(instrWord: number): string {
  if (instrWord === 0) return "NOP";

  const opcode = (instrWord >>> 26) & 0x3f;
  const funct = instrWord & 0x3f;

  // R-type
  if (opcode === 0) {
    const functNames: Record<number, string> = {
      0: "sll", 2: "srl", 3: "sra", 8: "jr", 9: "jalr",
      12: "syscall", 32: "add", 33: "addu", 34: "sub", 35: "subu",
      36: "and", 37: "or", 38: "xor", 39: "nor", 42: "slt", 43: "sltu",
      24: "mult", 25: "multu", 26: "div", 27: "divu",
      16: "mfhi", 18: "mflo",
    };
    return functNames[funct] || "R-type";
  }

  // J-type and I-type
  const opcodeNames: Record<number, string> = {
    2: "j", 3: "jal",
    4: "beq", 5: "bne", 6: "blez", 7: "bgtz",
    8: "addi", 9: "addiu", 10: "slti", 11: "sltiu",
    12: "andi", 13: "ori", 14: "xori", 15: "lui",
    32: "lb", 33: "lh", 35: "lw", 36: "lbu", 37: "lhu",
    40: "sb", 41: "sh", 43: "sw",
  };

  return opcodeNames[opcode] || `op${opcode}`;
}

// ============== Sub-Components ==============

function StageBox({
  stage,
  isAnimating = false,
  showDetails = false,
}: {
  stage: PipelineStage;
  isAnimating?: boolean;
  showDetails?: boolean;
}) {
  const colors = STAGE_COLORS[stage.name] || STAGE_COLORS.IF;
  const instrName = decodeInstructionName(stage.instruction);

  return (
    <motion.div
      className={`${colors.bg} ${colors.border} border-2 rounded-xl p-4 min-w-[140px] relative overflow-hidden`}
      animate={isAnimating ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Stage Name */}
      <div className={`text-sm font-bold ${colors.text} mb-2`}>
        {stage.name}
      </div>

      {/* Instruction */}
      <div className="mb-2">
        {stage.valid ? (
          <>
            <div className="text-white font-mono font-bold text-lg">
              {instrName}
            </div>
            <div className="text-gray-400 text-xs font-mono">
              {stage.instruction_hex}
            </div>
          </>
        ) : (
          <div className="text-gray-500 italic">bubble</div>
        )}
      </div>

      {/* Register Info */}
      {showDetails && stage.valid && (
        <div className="text-xs text-gray-400 space-y-1 border-t border-gray-700 pt-2 mt-2">
          {stage.src_reg1_name && (
            <div>src1: <span className="text-green-400">{stage.src_reg1_name}</span></div>
          )}
          {stage.src_reg2_name && (
            <div>src2: <span className="text-green-400">{stage.src_reg2_name}</span></div>
          )}
          {stage.dest_reg_name && (
            <div>dest: <span className="text-cyan-400">{stage.dest_reg_name}</span></div>
          )}
        </div>
      )}

      {/* Valid indicator */}
      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
        stage.valid ? "bg-green-500" : "bg-gray-600"
      }`} />
    </motion.div>
  );
}

function HazardIndicator({ hazard }: { hazard: HazardInfo }) {
  if (!hazard.detected) return null;

  const bgColor = HAZARD_COLORS[hazard.hazard_type_name] || "bg-gray-500";

  return (
    <motion.div
      className={`${bgColor} rounded-lg p-3 flex items-center gap-3`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <AlertTriangle className="w-5 h-5 text-white" />
      <div className="text-white">
        <div className="font-bold">{hazard.hazard_type_name.toUpperCase()} Hazard</div>
        <div className="text-sm opacity-90">
          {hazard.stall_required ? "Pipeline stalled" : "Forwarding applied"}
          {hazard.forward_reg_name && (
            <span> • Register: {hazard.forward_reg_name}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ForwardingArrow({
  from,
  to,
  reg,
}: {
  from: string | null;
  to: string | null;
  reg: string | null;
}) {
  if (!from || !to) return null;

  return (
    <motion.div
      className="absolute flex items-center gap-1 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ top: -20, left: "50%", transform: "translateX(-50%)" }}
    >
      <Zap className="w-3 h-3" />
      {from} → {to}
      {reg && <span className="ml-1">({reg})</span>}
    </motion.div>
  );
}

function MetricsPanel({ metrics }: { metrics: PipelineMetrics }) {
  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-600/50 p-5">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-cyan-400" />
        Pipeline Metrics
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* CPI */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">CPI</div>
          <div className="text-2xl font-bold text-cyan-400">{metrics.cpi.toFixed(2)}</div>
          <div className="text-xs text-gray-500">cycles/instruction</div>
        </div>

        {/* Efficiency */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Efficiency</div>
          <div className="text-2xl font-bold text-green-400">{metrics.efficiency.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">vs ideal</div>
        </div>

        {/* Total Cycles */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Cycles</div>
          <div className="text-2xl font-bold text-white">{metrics.total_cycles}</div>
          <div className="text-xs text-gray-500">{metrics.total_instructions} instructions</div>
        </div>

        {/* Speedup */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Speedup</div>
          <div className="text-2xl font-bold text-purple-400">{metrics.speedup.toFixed(2)}x</div>
          <div className="text-xs text-gray-500">vs non-pipelined</div>
        </div>
      </div>

      {/* Stall breakdown */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="text-sm text-gray-400 mb-2">Stall Analysis</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2">
            <span className="text-xs text-gray-400">Total Stalls</span>
            <span className="font-mono text-yellow-400">{metrics.stall_cycles}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2">
            <span className="text-xs text-gray-400">Load-Use</span>
            <span className="font-mono text-red-400">{metrics.load_use_stalls}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2">
            <span className="text-xs text-gray-400">Forwards</span>
            <span className="font-mono text-green-400">{metrics.forward_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CycleTimeline({
  history,
  currentCycle,
  onCycleSelect,
}: {
  history: CycleRecord[];
  currentCycle: number;
  onCycleSelect: (cycle: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayHistory = expanded ? history : history.slice(0, 10);

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-600/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          Cycle Timeline
        </h3>
        {history.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "Show Less" : `Show All (${history.length})`}
          </button>
        )}
      </div>

      {/* Timeline header */}
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-400 font-mono">
        <div className="w-12">Cycle</div>
        <div className="flex-1 grid grid-cols-5 gap-1 text-center">
          <div>IF</div>
          <div>ID</div>
          <div>EX</div>
          <div>MEM</div>
          <div>WB</div>
        </div>
        <div className="w-20 text-center">Status</div>
      </div>

      {/* Timeline rows */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {displayHistory.map((record) => (
          <motion.div
            key={record.cycle}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
              record.cycle === currentCycle
                ? "bg-cyan-900/50 border border-cyan-500/50"
                : "bg-slate-900/30 hover:bg-slate-900/50"
            }`}
            onClick={() => onCycleSelect(record.cycle)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: record.cycle * 0.02 }}
          >
            <div className="w-12 font-mono text-sm text-cyan-400">
              {record.cycle}
            </div>

            <div className="flex-1 grid grid-cols-5 gap-1">
              {["IF", "ID", "EX", "MEM", "WB"].map((stage) => {
                const instr = record.stages[stage];
                const instrName = decodeInstructionName(instr);
                const colors = STAGE_COLORS[stage];

                return (
                  <div
                    key={stage}
                    className={`${colors.bg} rounded px-2 py-1 text-center text-xs font-mono truncate`}
                    title={record.stages_hex[stage]}
                  >
                    {instr !== 0 ? instrName : "-"}
                  </div>
                );
              })}
            </div>

            <div className="w-20 flex items-center justify-center gap-1">
              {record.stall && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded">
                  STALL
                </span>
              )}
              {record.forward && (
                <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded">
                  FWD
                </span>
              )}
              {!record.stall && !record.forward && (
                <span className="text-gray-500 text-xs">-</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============== Main Component ==============

export default function PipelineVisualization({
  simulationResult,
  isLoading = false,
}: PipelineVisualizationProps) {
  const [currentCycle, setCurrentCycle] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms per cycle
  const [showDetails, setShowDetails] = useState(false);

  const history = simulationResult?.cycle_history || [];
  const maxCycle = history.length > 0 ? history[history.length - 1].cycle : 0;

  // Get current cycle record
  const currentRecord = history.find(r => r.cycle === currentCycle) || null;

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying || history.length === 0) return;

    const timer = setInterval(() => {
      setCurrentCycle(prev => {
        if (prev >= maxCycle) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, maxCycle, playSpeed, history.length]);

  // Playback controls
  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentCycle(1);
  }, []);
  const handleStepForward = useCallback(() => {
    setCurrentCycle(prev => Math.min(prev + 1, maxCycle));
  }, [maxCycle]);
  const handleStepBack = useCallback(() => {
    setCurrentCycle(prev => Math.max(prev - 1, 1));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Cpu className="w-12 h-12 text-cyan-400 animate-pulse mx-auto mb-4" />
          <div className="text-cyan-300">Simulating pipeline...</div>
        </div>
      </div>
    );
  }

  if (!simulationResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Cpu className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <div className="text-gray-400">No pipeline simulation data</div>
          <div className="text-sm text-gray-500 mt-2">
            Execute MIPS code to see pipeline visualization
          </div>
        </div>
      </div>
    );
  }

  if (!simulationResult.success) {
    return (
      <div className="bg-red-900/30 border border-red-500 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div>
            <div className="text-red-300 font-bold">Pipeline Simulation Failed</div>
            <div className="text-red-200 text-sm mt-1">{simulationResult.error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Cpu className="w-6 h-6 text-cyan-400" />
          MIPS 5-Stage Pipeline
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`px-3 py-1 rounded text-sm ${
              showDetails ? "bg-cyan-600 text-white" : "bg-slate-700 text-gray-300"
            }`}
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>
      </div>

      {/* Playback Controls */}
      {history.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleStepBack}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              title="Step Back"
              disabled={currentCycle <= 1}
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className={`p-2 rounded-lg ${
                isPlaying ? "bg-orange-600 hover:bg-orange-500" : "bg-green-600 hover:bg-green-500"
              } text-white`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleStepForward}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              title="Step Forward"
              disabled={currentCycle >= maxCycle}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-cyan-400">
              Cycle {currentCycle}
            </div>
            <div className="text-xs text-gray-400">of {maxCycle}</div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Speed:</span>
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              className="bg-slate-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value={2000}>0.5x</option>
              <option value={1000}>1x</option>
              <option value={500}>2x</option>
              <option value={250}>4x</option>
            </select>
          </div>
        </div>
      )}

      {/* Pipeline Stages Visualization */}
      <div className="bg-slate-900/50 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 relative">
          {/* Connection lines */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-700 -z-10" />

          {/* Stages */}
          {simulationResult.stages.map((stage, index) => {
            // If we have a current record, use its data
            const displayStage = currentRecord
              ? {
                  ...stage,
                  instruction: currentRecord.stages[stage.name],
                  instruction_hex: currentRecord.stages_hex[stage.name],
                  valid: currentRecord.stages[stage.name] !== 0,
                }
              : stage;

            return (
              <React.Fragment key={stage.name}>
                <StageBox
                  stage={displayStage as PipelineStage}
                  isAnimating={isPlaying}
                  showDetails={showDetails}
                />
                {index < simulationResult.stages.length - 1 && (
                  <ArrowRight className="w-6 h-6 text-slate-600 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Hazard Display */}
        {currentRecord && (currentRecord.stall || currentRecord.forward) && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <AnimatePresence>
              {currentRecord.stall && (
                <motion.div
                  className="bg-red-900/50 border border-red-500 rounded-lg p-3 flex items-center gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div className="text-red-300">
                    <span className="font-bold">Pipeline Stalled</span>
                    <span className="text-sm ml-2">
                      ({currentRecord.hazard_type_name} hazard)
                    </span>
                  </div>
                </motion.div>
              )}
              {currentRecord.forward && !currentRecord.stall && (
                <motion.div
                  className="bg-green-900/50 border border-green-500 rounded-lg p-3 flex items-center gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Zap className="w-5 h-5 text-green-400" />
                  <div className="text-green-300">
                    <span className="font-bold">Data Forwarding</span>
                    <span className="text-sm ml-2">
                      Hazard resolved without stall
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Metrics */}
      {simulationResult.metrics && (
        <MetricsPanel metrics={simulationResult.metrics} />
      )}

      {/* Cycle Timeline */}
      {history.length > 0 && (
        <CycleTimeline
          history={history}
          currentCycle={currentCycle}
          onCycleSelect={setCurrentCycle}
        />
      )}

      {/* Legend */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Pipeline Stages</h4>
        <div className="flex flex-wrap gap-4">
          {Object.entries(STAGE_COLORS).map(([name, colors]) => (
            <div key={name} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${colors.bg} ${colors.border} border`} />
              <span className="text-sm text-gray-300">
                {name} - {STAGE_DESCRIPTIONS[name]}
              </span>
            </div>
          ))}
        </div>

        <h4 className="text-sm font-semibold text-gray-400 mb-3 mt-4">Hazard Types</h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span className="text-sm text-gray-300">RAW - Read After Write</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-sm text-gray-300">Load-Use - Requires Stall</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500" />
            <span className="text-sm text-gray-300">Control - Branch/Jump</span>
          </div>
        </div>
      </div>

      {/* MIPS Implementation Notice */}
      <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-3 text-center">
        <p className="text-xs text-gray-500">
          🔒 Pipeline simulation computed by{" "}
          <code className="text-cyan-400">mips/core/pipeline_simulator.asm</code>
        </p>
      </div>
    </div>
  );
}
