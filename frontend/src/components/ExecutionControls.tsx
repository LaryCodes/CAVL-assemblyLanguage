"use client";

interface ExecutionControlsProps {
  onStep: () => void;
  onRun: () => void;
  onReset: () => void;
  onLoad: () => void;
  isRunning?: boolean;
  isComplete?: boolean;
  isLoading?: boolean;
}

interface ControlButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "success" | "warning";
  children: React.ReactNode;
  title?: string;
}

function ControlButton({ onClick, disabled, variant, children, title }: ControlButtonProps) {
  const baseClasses = "px-4 py-2 rounded font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white disabled:hover:bg-blue-600",
    secondary: "bg-gray-600 hover:bg-gray-500 text-white disabled:hover:bg-gray-600",
    success: "bg-green-600 hover:bg-green-500 text-white disabled:hover:bg-green-600",
    warning: "bg-yellow-600 hover:bg-yellow-500 text-white disabled:hover:bg-yellow-600",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]}`}
      title={title}
    >
      {children}
    </button>
  );
}

// SVG Icons
const StepIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const RunIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ResetIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const LoadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default function ExecutionControls({
  onStep,
  onRun,
  onReset,
  onLoad,
  isRunning = false,
  isComplete = false,
  isLoading = false,
}: ExecutionControlsProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3 flex-wrap">
      <ControlButton
        onClick={onStep}
        disabled={isRunning || isComplete || isLoading}
        variant="primary"
        title="Execute one instruction (Step)"
      >
        <StepIcon />
        Step
      </ControlButton>

      <ControlButton
        onClick={onRun}
        disabled={isRunning || isComplete || isLoading}
        variant="success"
        title="Run until completion"
      >
        {isRunning ? <SpinnerIcon /> : <RunIcon />}
        {isRunning ? "Running..." : "Run"}
      </ControlButton>

      <ControlButton
        onClick={onReset}
        disabled={isRunning || isLoading}
        variant="warning"
        title="Reset to initial state"
      >
        <ResetIcon />
        Reset
      </ControlButton>

      <div className="h-6 w-px bg-gray-600 mx-1" />

      <ControlButton
        onClick={onLoad}
        disabled={isRunning || isLoading}
        variant="secondary"
        title="Load code for execution"
      >
        {isLoading ? <SpinnerIcon /> : <LoadIcon />}
        {isLoading ? "Loading..." : "Load"}
      </ControlButton>

      {/* Status indicator */}
      {isComplete && (
        <div className="ml-auto flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-green-400">Execution Complete</span>
        </div>
      )}
      
      {isRunning && !isLoading && (
        <div className="ml-auto flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-yellow-400">Executing...</span>
        </div>
      )}
      
      {isLoading && (
        <div className="ml-auto flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-blue-400">Loading program...</span>
        </div>
      )}
    </div>
  );
}
