"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  FastForward,
  Rewind,
  Cpu,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Code,
  Hash,
  ArrowRight,
} from "lucide-react";

// ============== Types ==============

interface RegisterValue {
  name: string;
  value: number;
  value_hex: string;
  value_unsigned: number;
}

interface ExecutionStep {
  step_number: number;
  pc: number;
  pc_hex: string;
  instruction: string;
  instruction_hex: string;
  registers: RegisterValue[];
  changed_registers: string[];
  description: string;
  is_complete: boolean;
}

interface StepExecutionResponse {
  success: boolean;
  current_step: ExecutionStep | null;
  total_steps: number;
  current_step_number: number;
  is_complete: boolean;
  error: string | null;
}

interface AllStepsResponse {
  success: boolean;
  steps: ExecutionStep[];
  total_steps: number;
  error: string | null;
}

interface StepExecutionProps {
  code: string;
  onClose?: () => void;
}

// ============== Register Groups ==============

const REGISTER_GROUPS = {
  "Return Values": ["$v0", "$v1"],
  Arguments: ["$a0", "$a1", "$a2", "$a3"],
  Temporaries: ["$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7", "$t8", "$t9"],
  Saved: ["$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7"],
  Special: ["$zero", "$at", "$gp", "$sp", "$fp", "$ra", "$k0", "$k1"],
};

// ============== Animated Register Cell ==============

function RegisterCell({
  register,
  isChanged,
  showHex,
}: {
  register: RegisterValue;
  isChanged: boolean;
  showHex: boolean;
}) {
  return (
    <motion.div
      initial={isChanged ? { scale: 1.1, backgroundColor: "rgba(34, 197, 94, 0.3)" } : {}}
      animate={{
        scale: 1,
        backgroundColor: isChanged ? "rgba(34, 197, 94, 0.15)" : "transparent",
      }}
      transition={{ duration: 0.5 }}
      className={`
        px-2 py-1 rounded font-mono text-xs
        ${isChanged ? "border border-green-500/50 shadow-lg shadow-green-500/20" : "border border-gray-700"}
        ${isChanged ? "text-green-400" : "text-gray-300"}
      `}
    >
      <div className="flex justify-between items-center gap-2">
        <span className={`${isChanged ? "text-green-300 font-bold" : "text-gray-500"}`}>
          {register.name}
        </span>
        <span className={isChanged ? "text-green-400 font-semibold" : ""}>
          {showHex ? register.value_hex : register.value.toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
}

// ============== Timeline Scrubber ==============

function Timeline({
  steps,
  currentStep,
  onGotoStep,
}: {
  steps: ExecutionStep[];
  currentStep: number;
  onGotoStep: (step: number) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400">Step {currentStep}</span>
        <div className="flex-1 relative h-2">
          <div className="absolute inset-0 bg-gray-700 rounded-full" />
          <motion.div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: steps.length > 1 ? `${(currentStep / (steps.length - 1)) * 100}%` : "0%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          {/* Step markers */}
          <div className="absolute inset-0 flex justify-between items-center px-1">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => onGotoStep(idx)}
                className={`
                  w-3 h-3 rounded-full transition-all z-10
                  ${idx === currentStep
                    ? "bg-cyan-400 scale-125 shadow-lg shadow-cyan-400/50"
                    : idx < currentStep
                      ? "bg-blue-500"
                      : "bg-gray-600 hover:bg-gray-500"
                  }
                `}
                title={`Step ${idx}: ${step.instruction}`}
              />
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400">Step {steps.length - 1}</span>
      </div>
    </div>
  );
}

// ============== Instruction Display ==============

function InstructionDisplay({
  step,
  isAnimating,
}: {
  step: ExecutionStep | null;
  isAnimating: boolean;
}) {
  if (!step) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center">
        <Code className="w-12 h-12 text-gray-600 mx-auto mb-2" />
        <div className="text-gray-400">No step data</div>
      </div>
    );
  }

  return (
    <motion.div
      key={step.step_number}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
    >
      {/* PC and Step Number */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-cyan-900/50 rounded text-cyan-400 text-xs font-mono">
            Step {step.step_number}
          </span>
          <span className="px-2 py-1 bg-purple-900/50 rounded text-purple-400 text-xs font-mono">
            PC: {step.pc_hex}
          </span>
        </div>
        {step.is_complete && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 px-2 py-1 bg-green-900/50 rounded text-green-400 text-xs"
          >
            <CheckCircle className="w-3 h-3" />
            Complete
          </motion.div>
        )}
      </div>

      {/* Instruction */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">Instruction</div>
        <motion.div
          key={step.instruction}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-lg text-white bg-gray-900 rounded-lg px-4 py-2 border border-gray-700"
        >
          {step.instruction}
        </motion.div>
        <div className="text-xs text-gray-500 mt-1 font-mono">
          {step.instruction_hex}
        </div>
      </div>

      {/* Description */}
      <div className="flex items-start gap-2 text-sm">
        <ArrowRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
        <span className="text-gray-300">{step.description}</span>
      </div>

      {/* Changed Registers */}
      {step.changed_registers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 pt-3 border-t border-gray-700"
        >
          <div className="text-xs text-gray-500 mb-2">Changed Registers</div>
          <div className="flex flex-wrap gap-2">
            {step.changed_registers.map((reg) => {
              const regData = step.registers.find((r) => r.name === reg);
              return (
                <motion.span
                  key={reg}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="px-2 py-1 bg-green-900/30 border border-green-500/50 rounded text-green-400 text-xs font-mono"
                >
                  {reg} = {regData?.value ?? 0}
                </motion.span>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============== Register Panel ==============

function RegisterPanel({
  registers,
  changedRegisters,
  showHex,
  onToggleHex,
}: {
  registers: RegisterValue[];
  changedRegisters: string[];
  showHex: boolean;
  onToggleHex: () => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Return Values": true,
    Arguments: true,
    Temporaries: true,
    Saved: false,
    Special: false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const getRegister = (name: string) => registers.find((r) => r.name === name);

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Registers</span>
        </div>
        <button
          onClick={onToggleHex}
          className={`px-2 py-1 text-xs rounded ${
            showHex ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-300"
          }`}
        >
          {showHex ? "HEX" : "DEC"}
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {Object.entries(REGISTER_GROUPS).map(([groupName, groupRegs]) => (
          <div key={groupName} className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleGroup(groupName)}
              className="w-full px-3 py-2 bg-gray-800 flex items-center justify-between hover:bg-gray-700 transition-colors"
            >
              <span className="text-xs font-medium text-gray-300">{groupName}</span>
              <div className="flex items-center gap-2">
                {groupRegs.some((r) => changedRegisters.includes(r)) && (
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                )}
                {expandedGroups[groupName] ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {expandedGroups[groupName] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-2 grid grid-cols-2 gap-1"
                >
                  {groupRegs.map((regName) => {
                    const reg = getRegister(regName);
                    if (!reg) return null;
                    return (
                      <RegisterCell
                        key={regName}
                        register={reg}
                        isChanged={changedRegisters.includes(regName)}
                        showHex={showHex}
                      />
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== Main Component ==============

export default function StepExecution({ code, onClose }: StepExecutionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ExecutionStep | null>(null);
  const [allSteps, setAllSteps] = useState<ExecutionStep[]>([]);
  const [currentStepNumber, setCurrentStepNumber] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showHex, setShowHex] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);

  // Load program
  const loadProgram = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/step/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, max_steps: 200 }),
      });

      const data: StepExecutionResponse = await response.json();

      if (data.success && data.current_step) {
        setCurrentStep(data.current_step);
        setCurrentStepNumber(data.current_step_number);
        setTotalSteps(data.total_steps);
        setIsComplete(data.is_complete);
        setIsLoaded(true);

        // Fetch all steps for timeline
        const allResponse = await fetch("http://localhost:8000/api/step/all");
        const allData: AllStepsResponse = await allResponse.json();
        if (allData.success) {
          setAllSteps(allData.steps);
        }
      } else {
        setError(data.error || "Failed to load program");
      }
    } catch (err) {
      setError("Connection error: Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  // Step forward
  const stepForward = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/step/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data: StepExecutionResponse = await response.json();
      if (data.success && data.current_step) {
        setCurrentStep(data.current_step);
        setCurrentStepNumber(data.current_step_number);
        setIsComplete(data.is_complete);
      }
    } catch (err) {
      setError("Failed to step forward");
    }
  }, []);

  // Step backward
  const stepBackward = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/step/backward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data: StepExecutionResponse = await response.json();
      if (data.success && data.current_step) {
        setCurrentStep(data.current_step);
        setCurrentStepNumber(data.current_step_number);
        setIsComplete(data.is_complete);
      }
    } catch (err) {
      setError("Failed to step backward");
    }
  }, []);

  // Reset
  const reset = useCallback(async () => {
    setIsPlaying(false);
    try {
      const response = await fetch("http://localhost:8000/api/step/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data: StepExecutionResponse = await response.json();
      if (data.success && data.current_step) {
        setCurrentStep(data.current_step);
        setCurrentStepNumber(data.current_step_number);
        setIsComplete(data.is_complete);
      }
    } catch (err) {
      setError("Failed to reset");
    }
  }, []);

  // Goto step
  const gotoStep = useCallback(async (stepNum: number) => {
    try {
      const response = await fetch("http://localhost:8000/api/step/goto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_number: stepNum }),
      });

      const data: StepExecutionResponse = await response.json();
      if (data.success && data.current_step) {
        setCurrentStep(data.current_step);
        setCurrentStepNumber(data.current_step_number);
        setIsComplete(data.is_complete);
      }
    } catch (err) {
      setError("Failed to go to step");
    }
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying || isComplete) return;

    const timer = setInterval(() => {
      stepForward();
    }, playSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, isComplete, playSpeed, stepForward]);

  // Stop playing when complete
  useEffect(() => {
    if (isComplete) {
      setIsPlaying(false);
    }
  }, [isComplete]);

  // Load on mount
  useEffect(() => {
    if (code) {
      loadProgram();
    }
  }, [code, loadProgram]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900/50 to-cyan-900/50 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={isPlaying ? { rotate: 360 } : {}}
              transition={isPlaying ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
            >
              <Cpu className="w-8 h-8 text-green-400" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Step-by-Step Execution</h2>
              <p className="text-sm text-gray-400">
                Execute MIPS code one instruction at a time
              </p>
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

      <div className="p-6 space-y-4">
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading program...</span>
          </div>
        )}

        {/* Main Content */}
        {isLoaded && !isLoading && (
          <>
            {/* Timeline */}
            {allSteps.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-3">Execution Timeline</div>
                <Timeline
                  steps={allSteps}
                  currentStep={currentStepNumber}
                  onGotoStep={gotoStep}
                />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 py-2">
              <button
                onClick={reset}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                title="Reset to start"
              >
                <Rewind className="w-5 h-5" />
              </button>

              <button
                onClick={stepBackward}
                disabled={currentStepNumber === 0}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous step"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={isComplete}
                className={`p-3 rounded-lg ${
                  isPlaying
                    ? "bg-orange-600 hover:bg-orange-500"
                    : "bg-green-600 hover:bg-green-500"
                } text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>

              <button
                onClick={stepForward}
                disabled={isComplete}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next step"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <button
                onClick={() => gotoStep(totalSteps - 1)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                title="Go to end"
              >
                <FastForward className="w-5 h-5" />
              </button>

              {/* Speed Control */}
              <select
                value={playSpeed}
                onChange={(e) => setPlaySpeed(Number(e.target.value))}
                className="ml-4 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              >
                <option value={2000}>0.5x</option>
                <option value={1000}>1x</option>
                <option value={500}>2x</option>
                <option value={250}>4x</option>
              </select>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Current Instruction */}
              <InstructionDisplay step={currentStep} isAnimating={isPlaying} />

              {/* Right: Registers */}
              <RegisterPanel
                registers={currentStep?.registers || []}
                changedRegisters={currentStep?.changed_registers || []}
                showHex={showHex}
                onToggleHex={() => setShowHex(!showHex)}
              />
            </div>

            {/* Step Counter */}
            <div className="text-center text-sm text-gray-500">
              Step {currentStepNumber} of {totalSteps - 1}
              {isComplete && (
                <span className="ml-2 text-green-400">• Execution Complete</span>
              )}
            </div>
          </>
        )}

        {/* Not loaded state */}
        {!isLoaded && !isLoading && !error && (
          <div className="text-center py-12">
            <Cpu className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <div className="text-gray-400">Loading program for step execution...</div>
          </div>
        )}
      </div>
    </div>
  );
}
