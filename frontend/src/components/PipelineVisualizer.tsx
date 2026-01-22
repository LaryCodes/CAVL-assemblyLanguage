"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Zap, AlertTriangle, ArrowRight, TrendingUp, Activity } from "lucide-react";

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

interface PipelineResponse {
  success: boolean;
  stages: PipelineStage[];
  hazard: HazardInfo | null;
  metrics: PipelineMetrics | null;
  simulation_complete: boolean;
  error: string | null;
}

export default function PipelineVisualizer() {
  const [code, setCode] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [enableForwarding, setEnableForwarding] = useState(true);

  const handleSimulate = async () => {
    if (!code.trim()) return;

    setIsSimulating(true);
    try {
      const response = await fetch("http://localhost:8000/api/pipeline/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enable_forwarding: enableForwarding }),
      });

      const data: PipelineResponse = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        stages: [],
        hazard: null,
        metrics: null,
        simulation_complete: false,
        error: "Connection error: Is the backend running?",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const loadExample = () => {
    setCode(`.text
.globl main

main:
    li $t0, 5
    li $t1, 10
    add $t2, $t0, $t1
    lw $t3, 0($sp)
    add $t4, $t3, $t2
    sw $t4, 4($sp)
    
    li $v0, 10
    syscall`);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Cpu className="w-8 h-8 text-purple-400" />
          <h2 className="text-2xl font-bold text-white">Pipeline Simulator</h2>
        </div>
        <p className="text-sm text-gray-400">
          Visualize the 5-stage MIPS pipeline with hazard detection and forwarding
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">MIPS Code</label>
          <div className="flex gap-2">
            <button
              onClick={loadExample}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Load Example
            </button>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={enableForwarding}
                onChange={(e) => setEnableForwarding(e.target.checked)}
                className="rounded"
              />
              Enable Forwarding
            </label>
          </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter MIPS assembly code..."
          className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={handleSimulate}
          disabled={isSimulating || !code.trim()}
          className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {isSimulating ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
              Simulating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Simulate Pipeline
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Error */}
              {!result.success && (
                <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {result.error}
                </div>
              )}

              {/* Success */}
              {result.success && (
                <>
                  {/* Pipeline Stages */}
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      Pipeline Stages
                    </h3>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {result.stages.map((stage, idx) => (
                        <div key={stage.name} className="flex items-center gap-2">
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`
                              flex-shrink-0 w-32 p-3 rounded-lg border-2 transition-all
                              ${stage.valid
                                ? "bg-purple-900/40 border-purple-500/50"
                                : "bg-gray-900/40 border-gray-600/30"
                              }
                            `}
                          >
                            <div className="text-xs font-bold text-purple-300 mb-1">
                              {stage.name}
                            </div>
                            {stage.valid ? (
                              <>
                                <div className="text-xs font-mono text-gray-300 truncate">
                                  {stage.instruction_hex}
                                </div>
                                {stage.dest_reg_name && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    → {stage.dest_reg_name}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-gray-500">NOP</div>
                            )}
                          </motion.div>
                          {idx < result.stages.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hazard Info */}
                  {result.hazard && result.hazard.detected && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <h3 className="text-lg font-semibold text-yellow-300">
                          Hazard Detected: {result.hazard.hazard_type_name.toUpperCase()}
                        </h3>
                      </div>
                      <div className="text-sm text-yellow-200 space-y-1">
                        {result.hazard.stall_required && (
                          <div>⚠️ Pipeline stall required</div>
                        )}
                        {result.hazard.forward_from_name && result.hazard.forward_to_name && (
                          <div>
                            🔄 Forwarding: {result.hazard.forward_from_name} → {result.hazard.forward_to_name}
                            {result.hazard.forward_reg_name && ` (${result.hazard.forward_reg_name})`}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Metrics */}
                  {result.metrics && (
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        Performance Metrics
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <MetricCard
                          label="CPI"
                          value={result.metrics.cpi.toFixed(2)}
                          color="text-cyan-400"
                        />
                        <MetricCard
                          label="Efficiency"
                          value={`${result.metrics.efficiency.toFixed(1)}%`}
                          color="text-green-400"
                        />
                        <MetricCard
                          label="Speedup"
                          value={`${result.metrics.speedup.toFixed(2)}x`}
                          color="text-purple-400"
                        />
                        <MetricCard
                          label="Instructions"
                          value={result.metrics.total_instructions.toString()}
                          color="text-blue-400"
                        />
                        <MetricCard
                          label="Total Cycles"
                          value={result.metrics.total_cycles.toString()}
                          color="text-gray-300"
                        />
                        <MetricCard
                          label="Stalls"
                          value={result.metrics.stall_cycles.toString()}
                          color="text-red-400"
                        />
                        <MetricCard
                          label="Forwards"
                          value={result.metrics.forward_count.toString()}
                          color="text-yellow-400"
                        />
                        <MetricCard
                          label="RAW Hazards"
                          value={result.metrics.raw_hazards.toString()}
                          color="text-orange-400"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {!result && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Cpu className="w-16 h-16 mb-4 opacity-50" />
              <p>Enter MIPS code and click "Simulate Pipeline" to see results</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-gray-900/50 rounded-lg p-3 border border-gray-700"
    >
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </motion.div>
  );
}
