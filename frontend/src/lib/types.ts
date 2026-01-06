/**
 * TypeScript interfaces for CAVL V1
 * Mirrors backend Pydantic models for type-safe API communication
 */

// ============================================================================
// Heap Types
// ============================================================================

/**
 * Metadata for heap blocks (allocator information)
 */
export interface HeapMeta {
  allocated: boolean;
  blockSize: number;
}

/**
 * A single heap block with allocation status
 */
export interface HeapBlock {
  address: number;
  size: number;
  allocated: boolean;
}

/**
 * A free block in the free list
 */
export interface FreeBlock {
  address: number;
  size: number;
}

/**
 * Complete heap state including blocks, free list, and fragmentation
 */
export interface HeapState {
  blocks: HeapBlock[];
  freeList: FreeBlock[];
  fragmentation: number;
}

// ============================================================================
// Memory Types
// ============================================================================

/**
 * A single memory block with address, size, and optional value/metadata
 */
export interface MemoryBlock {
  address: number;
  size: number;
  value?: number;
  meta?: HeapMeta;
  label?: string;
}

/**
 * A memory segment (Text, Data, Heap, or Stack)
 */
export interface MemorySegment {
  startAddress: number;
  endAddress: number;
  blocks: MemoryBlock[];
}

/**
 * Complete memory state with all four segments
 */
export interface MemoryState {
  text: MemorySegment;
  data: MemorySegment;
  heap: MemorySegment;
  stack: MemorySegment;
}

// ============================================================================
// Register Types
// ============================================================================

/**
 * All 32 MIPS general-purpose register names
 */
export const MIPS_REGISTERS = [
  "$zero", "$at", "$v0", "$v1",
  "$a0", "$a1", "$a2", "$a3",
  "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
  "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
  "$t8", "$t9", "$k0", "$k1",
  "$gp", "$sp", "$fp", "$ra"
] as const;

export type MipsRegister = typeof MIPS_REGISTERS[number];

/**
 * State of all 32 MIPS general-purpose registers
 */
export interface RegisterState {
  values: Record<string, number>;
}

// ============================================================================
// MIPS Analysis Types (produced by mips/core/instruction_analyzer.asm)
// ============================================================================

/**
 * Instruction analysis results from MIPS analyzer.
 * CRITICAL: This data is computed IN MIPS, not JavaScript.
 */
export interface InstructionAnalysis {
  r_type_count: number;      // R-type arithmetic
  i_type_count: number;      // I-type immediate
  load_count: number;        // Memory loads
  store_count: number;       // Memory stores
  branch_count: number;      // Branch instructions
  jump_count: number;        // Jump instructions
  syscall_count: number;     // Syscall instructions
  other_count: number;       // Unclassified
  total_analyzed: number;    // Total instructions
  register_usage: Record<string, number>;  // Per-register usage
  analysis_valid: boolean;   // Whether MIPS analysis succeeded
}

// ============================================================================
// Execution State Types
// ============================================================================

/**
 * Complete execution state at a point in time
 */
export interface ExecutionState {
  pc: number;
  currentInstruction: string;
  registers: RegisterState;
  changedRegisters: string[];
  memory: MemoryState;
  heap: HeapState;
  isComplete: boolean;
  programOutput?: string;
  program_output?: string;  // Snake case from backend
  instructionAnalysis?: InstructionAnalysis;
  instruction_analysis?: InstructionAnalysis;  // Snake case from backend
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request to execute MIPS code
 */
export interface ExecuteRequest {
  code: string;
  mode: "full" | "step";
}

/**
 * Request to allocate heap memory
 */
export interface AllocateRequest {
  size: number;
}

/**
 * Request to free heap memory
 */
export interface FreeRequest {
  address: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from execution endpoints
 */
export interface ExecuteResponse {
  success: boolean;
  state?: ExecutionState;
  error?: string;
}

/**
 * Response from step endpoint
 */
export interface StepResponse {
  success: boolean;
  state?: ExecutionState;
  error?: string;
}

/**
 * Response from allocate endpoint
 */
export interface AllocateResponse {
  success: boolean;
  address?: number;
  heap?: HeapState;
  error?: string;
}

/**
 * Response from free endpoint
 */
export interface FreeResponse {
  success: boolean;
  heap?: HeapState;
  error?: string;
}

/**
 * Response from get state endpoint
 */
export interface StateResponse {
  success: boolean;
  state?: ExecutionState;
  error?: string;
}

/**
 * Response from reset endpoint
 */
export interface ResetResponse {
  success: boolean;
  state?: ExecutionState;
  error?: string;
}