/**
 * API Client for CAVL V1
 * Handles communication with the FastAPI backend for MIPS execution and heap management.
 * 
 * Requirements: 6.3, 7.5
 */

import type {
  ExecuteRequest,
  ExecuteResponse,
  StepResponse,
  ResetResponse,
  StateResponse,
  AllocateRequest,
  AllocateResponse,
  FreeRequest,
  FreeResponse,
} from "./types";

// API base URL - defaults to localhost:8000 for development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    // Parse response body
    const data = await response.json();

    // Handle HTTP errors
    if (!response.ok) {
      throw new ApiError(
        data.detail || data.error || `HTTP error ${response.status}`,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError("Network error: Unable to connect to server");
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      throw new ApiError("Invalid response from server");
    }

    // Re-throw unknown errors
    throw error;
  }
}

// ============================================================================
// Execution API
// ============================================================================

/**
 * Execute MIPS code.
 * Sends code to the backend for execution using MARS simulator.
 * 
 * @param code - MIPS assembly code to execute
 * @param mode - Execution mode: "full" for complete execution, "step" for step-by-step
 * @returns ExecuteResponse with success status and execution state
 */
export async function execute(
  code: string,
  mode: "full" | "step" = "step"
): Promise<ExecuteResponse> {
  const request: ExecuteRequest = { code, mode };
  
  return fetchApi<ExecuteResponse>("/api/execute", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Execute a single instruction step.
 * Advances execution by one instruction and returns the new state.
 * Requires a program to be loaded via execute() first.
 * 
 * @returns StepResponse with success status and new execution state
 */
export async function step(): Promise<StepResponse> {
  return fetchApi<StepResponse>("/api/step", {
    method: "POST",
  });
}

/**
 * Reset execution to initial state.
 * Restores the program state (PC, registers, memory) to the initial state after loading.
 * 
 * @returns ResetResponse with success status and initial execution state
 */
export async function reset(): Promise<ResetResponse> {
  return fetchApi<ResetResponse>("/api/reset", {
    method: "POST",
  });
}

/**
 * Get current execution state.
 * Returns the current state including registers, memory, and heap.
 * 
 * @returns StateResponse with success status and current execution state
 */
export async function getState(): Promise<StateResponse> {
  return fetchApi<StateResponse>("/api/state", {
    method: "GET",
  });
}

// ============================================================================
// Heap API
// ============================================================================

/**
 * Allocate heap memory using First-Fit strategy.
 * Simulates a heap allocation for visualization purposes.
 * 
 * @param size - Number of bytes to allocate
 * @returns AllocateResponse with allocated address and updated heap state
 */
export async function allocate(size: number): Promise<AllocateResponse> {
  const request: AllocateRequest = { size };
  
  return fetchApi<AllocateResponse>("/api/allocate", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Free heap memory at the specified address.
 * Simulates freeing a heap block for visualization purposes.
 * 
 * @param address - Memory address to free
 * @returns FreeResponse with updated heap state
 */
export async function free(address: number): Promise<FreeResponse> {
  const request: FreeRequest = { address };
  
  return fetchApi<FreeResponse>("/api/free", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================================
// Convenience exports
// ============================================================================

/**
 * API client object with all methods
 */
export const api = {
  execute,
  step,
  reset,
  getState,
  allocate,
  free,
};

export default api;
