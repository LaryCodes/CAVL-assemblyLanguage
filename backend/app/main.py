"""
CAVL Backend - FastAPI Application Entry Point

Computer Architecture Visual Lab backend server that orchestrates
MARS simulator execution and provides visualization data.

CRITICAL: This system REQUIRES MIPS core files to function.
If mips/core/instruction_analyzer.asm is missing, the server will REFUSE to start.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import decoder, execution, heap, pipeline, step
from app.services.mips_analyzer import MipsCoreMissingError, verify_mips_core


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.

    CRITICAL: Verifies MIPS core files exist at startup.
    If missing, the application will FAIL TO START.
    """
    # ========== STARTUP ==========
    print("=" * 60)
    print("CAVL Backend Starting...")
    print("=" * 60)

    # CRITICAL: Verify MIPS core files exist
    # This ensures the system CANNOT run without MIPS
    try:
        verify_mips_core()
        print("✓ MIPS Core Verified: instruction_analyzer.asm found")
        print("✓ System is MIPS-DEPENDENT (as required)")
    except MipsCoreMissingError as e:
        print("=" * 60)
        print("FATAL ERROR: MIPS CORE FILES MISSING")
        print("=" * 60)
        print(str(e))
        print("")
        print("CAVL is a MIPS-DEPENDENT system.")
        print("It CANNOT function without the core MIPS assembly files.")
        print("=" * 60)
        raise SystemExit(1)

    print("=" * 60)
    print("CAVL Backend Ready")
    print("=" * 60)

    yield  # Application runs here

    # ========== SHUTDOWN ==========
    print("CAVL Backend Shutting Down...")


app = FastAPI(
    title="CAVL Backend",
    description="Computer Architecture Visual Lab - MIPS-DEPENDENT Visualization System",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
# execution.router handles /api/execute, /api/step, /api/reset, /api/state
app.include_router(execution.router)

# heap.router handles /api/heap/allocate, /api/heap/free, /api/heap/init, /api/heap/state
# NOTE: All heap allocation logic is in MIPS (mips/core/heap_operations.asm)
# Python only orchestrates MARS execution and parses output
app.include_router(heap.router)

# pipeline.router handles /api/pipeline/simulate, /api/pipeline/info
# NOTE: All pipeline simulation logic is in MIPS (mips/core/pipeline_simulator.asm)
# Python only orchestrates MARS execution and parses output
app.include_router(pipeline.router)

# decoder.router handles /api/decode/instruction, /api/decode/program, /api/decode/info
# NOTE: This is a supplementary educational feature showing binary encoding
# Decodes MIPS assembly to show machine code representation
app.include_router(decoder.router)

# step.router handles /api/step/load, /api/step/forward, /api/step/backward, etc.
# NOTE: Provides true step-by-step execution with register state at each instruction
# Allows forward/backward navigation through execution history
app.include_router(step.router)


@app.get("/")
async def root() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "CAVL Backend is running",
        "mips_dependent": True,
    }


@app.get("/health")
async def health_check() -> dict[str, Any]:
    """Detailed health check."""
    # Re-verify MIPS core on health check
    try:
        verify_mips_core()
        mips_status = "verified"
    except MipsCoreMissingError:
        mips_status = "MISSING - SYSTEM BROKEN"

    return {
        "status": "healthy",
        "service": "cavl-backend",
        "version": "1.0.0",
        "mips_core": mips_status,
        "mips_dependent": True,
    }
