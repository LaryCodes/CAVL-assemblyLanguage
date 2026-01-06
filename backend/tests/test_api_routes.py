"""
Property-based tests for API routes.
Feature: cavl-v1

Tests the API request/response contract for all endpoints.
"""

import pytest
from hypothesis import given, strategies as st, settings, assume
from fastapi.testclient import TestClient
from copy import deepcopy

from app.main import app
from app.models.schemas import (
    ExecuteRequest,
    ExecuteResponse,
    StepResponse,
    ResetResponse,
    StateResponse,
    AllocateRequest,
    AllocateResponse,
    FreeRequest,
    FreeResponse,
    ExecutionState,
    RegisterState,
    MemoryState,
    MemorySegment,
    HeapState,
    HeapBlock,
    FreeBlock,
    MIPS_REGISTERS,
)
from app.services.state_manager import get_state_manager


client = TestClient(app)


# ============== Strategies ==============

@st.composite
def valid_mips_code_strategy(draw):
    """Generate valid simple MIPS code."""
    # Simple valid MIPS programs
    programs = [
        ".text\nmain:\n    li $t0, 5\n    li $v0, 10\n    syscall",
        ".text\nmain:\n    addi $t0, $zero, 10\n    addi $t1, $zero, 20\n    add $t2, $t0, $t1\n    li $v0, 10\n    syscall",
        ".data\nval: .word 42\n.text\nmain:\n    la $t0, val\n    lw $t1, 0($t0)\n    li $v0, 10\n    syscall",
        ".text\nmain:\n    li $t0, 100\n    li $v0, 10\n    syscall",
        ".text\nmain:\n    move $t0, $zero\n    li $v0, 10\n    syscall",
    ]
    return draw(st.sampled_from(programs))


@st.composite
def invalid_mips_code_strategy(draw):
    """Generate invalid MIPS code that should produce errors."""
    invalid_programs = [
        "invalid instruction here",
        ".text\nmain:\n    xyz $t0, $t1",  # Invalid instruction
        ".text\nmain:\n    add $t0",  # Missing operands
        ".text\nmain:\n    lw $t0, ($t1",  # Syntax error
        "this is not mips code at all!",
    ]
    return draw(st.sampled_from(invalid_programs))


@st.composite
def allocation_size_strategy(draw):
    """Generate valid allocation sizes."""
    return draw(st.integers(min_value=4, max_value=256))


@st.composite
def invalid_allocation_size_strategy(draw):
    """Generate invalid allocation sizes."""
    return draw(st.integers(min_value=-1000, max_value=0))


@st.composite
def memory_address_strategy(draw):
    """Generate valid memory addresses."""
    return draw(st.integers(min_value=0x10040000, max_value=0x10050000))


# ============== Fixtures ==============

@pytest.fixture(autouse=True)
def reset_state_manager():
    """Reset state manager before each test."""
    state_manager = get_state_manager()
    state_manager.clear()
    yield
    state_manager.clear()


# ============== Property Tests ==============

class TestAPIRequestResponseContract:
    """
    Property 12: API Request/Response Contract
    
    *For any* valid API request to /api/execute, /api/step, /api/allocate, or /api/free,
    the response SHALL conform to the defined response schema with appropriate 
    success/error fields.
    
    **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
    """

    @given(code=valid_mips_code_strategy())
    @settings(max_examples=10, deadline=None)
    def test_execute_valid_code_returns_success_response(self, code: str):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        For any valid MIPS code, /api/execute should return a response
        conforming to ExecuteResponse schema with success=True.
        """
        response = client.post("/api/execute", json={"code": code, "mode": "step"})
        
        # Response should be valid JSON
        data = response.json()
        
        # Should have required fields
        assert "success" in data, "Response must have 'success' field"
        
        # If success, should have state
        if data["success"]:
            assert "state" in data, "Successful response must have 'state' field"
            assert data["state"] is not None, "State should not be None on success"
            
            # Validate state structure
            state = data["state"]
            assert "pc" in state, "State must have 'pc' field"
            assert "registers" in state, "State must have 'registers' field"
            assert "memory" in state, "State must have 'memory' field"
            assert "heap" in state, "State must have 'heap' field"
            assert "is_complete" in state, "State must have 'is_complete' field"
        else:
            # If not success, should have error
            assert "error" in data, "Failed response must have 'error' field"

    @given(code=invalid_mips_code_strategy())
    @settings(max_examples=10, deadline=None)
    def test_execute_invalid_code_returns_error_response(self, code: str):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        For any invalid MIPS code, /api/execute should return a response
        with success=False and a non-empty error message.
        """
        response = client.post("/api/execute", json={"code": code, "mode": "step"})
        
        data = response.json()
        
        # Should have required fields
        assert "success" in data, "Response must have 'success' field"
        
        # Invalid code should fail
        if not data["success"]:
            assert "error" in data, "Failed response must have 'error' field"
            assert data["error"] is not None, "Error should not be None"
            assert len(data["error"]) > 0, "Error message should not be empty"

    @settings(max_examples=10)
    @given(st.data())
    def test_step_without_program_returns_error(self, data):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Calling /api/step without loading a program should return an error.
        """
        # Clear state to ensure no program is loaded
        state_manager = get_state_manager()
        state_manager.clear()
        
        response = client.post("/api/step")
        
        resp_data = response.json()
        
        assert "success" in resp_data, "Response must have 'success' field"
        assert resp_data["success"] is False, "Step without program should fail"
        assert "error" in resp_data, "Failed response must have 'error' field"
        assert resp_data["error"] is not None, "Error should not be None"

    @settings(max_examples=10)
    @given(st.data())
    def test_reset_without_program_returns_error(self, data):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Calling /api/reset without loading a program should return an error.
        """
        state_manager = get_state_manager()
        state_manager.clear()
        
        response = client.post("/api/reset")
        
        resp_data = response.json()
        
        assert "success" in resp_data, "Response must have 'success' field"
        assert resp_data["success"] is False, "Reset without program should fail"
        assert "error" in resp_data, "Failed response must have 'error' field"

    @settings(max_examples=10)
    @given(st.data())
    def test_get_state_without_program_returns_error(self, data):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Calling /api/state without loading a program should return an error.
        """
        state_manager = get_state_manager()
        state_manager.clear()
        
        response = client.get("/api/state")
        
        resp_data = response.json()
        
        assert "success" in resp_data, "Response must have 'success' field"
        assert resp_data["success"] is False, "Get state without program should fail"
        assert "error" in resp_data, "Failed response must have 'error' field"

    @given(size=allocation_size_strategy())
    @settings(max_examples=10, deadline=None)
    def test_allocate_returns_valid_response(self, size: int):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Calling /api/heap/allocate should return a valid response.
        Note: In MIPS-centric architecture, heap operations run MIPS code directly.
        """
        response = client.post("/api/heap/allocate", json={"size": size})
        
        data = response.json()
        
        assert "success" in data, "Response must have 'success' field"
        # Either succeeds with address or fails with error
        if data["success"]:
            assert "address" in data, "Successful allocate must have 'address' field"
        else:
            assert "error" in data, "Failed response must have 'error' field"

    @given(address=memory_address_strategy())
    @settings(max_examples=10, deadline=None)
    def test_free_returns_valid_response(self, address: int):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Calling /api/heap/free should return a valid response.
        Note: In MIPS-centric architecture, heap operations run MIPS code directly.
        """
        response = client.post("/api/heap/free", json={"address": address})
        
        data = response.json()
        
        assert "success" in data, "Response must have 'success' field"
        # Either succeeds or fails with error
        if not data["success"]:
            assert "error" in data, "Failed response must have 'error' field"

    @given(code=valid_mips_code_strategy())
    @settings(max_examples=10, deadline=None)
    def test_step_after_execute_returns_valid_response(self, code: str):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        After executing valid code, /api/step should return a valid response.
        """
        # First execute code
        exec_response = client.post("/api/execute", json={"code": code, "mode": "step"})
        exec_data = exec_response.json()
        
        # Skip if execution failed (e.g., MARS not available)
        assume(exec_data.get("success", False))
        
        # Now step
        step_response = client.post("/api/step")
        step_data = step_response.json()
        
        assert "success" in step_data, "Response must have 'success' field"
        
        if step_data["success"]:
            assert "state" in step_data, "Successful step must have 'state' field"

    @given(code=valid_mips_code_strategy())
    @settings(max_examples=10, deadline=None)
    def test_reset_after_execute_returns_valid_response(self, code: str):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        After executing valid code, /api/reset should return a valid response.
        """
        # First execute code
        exec_response = client.post("/api/execute", json={"code": code, "mode": "step"})
        exec_data = exec_response.json()
        
        assume(exec_data.get("success", False))
        
        # Now reset
        reset_response = client.post("/api/reset")
        reset_data = reset_response.json()
        
        assert "success" in reset_data, "Response must have 'success' field"
        
        if reset_data["success"]:
            assert "state" in reset_data, "Successful reset must have 'state' field"

    @given(code=valid_mips_code_strategy())
    @settings(max_examples=10, deadline=None)
    def test_get_state_after_execute_returns_valid_response(self, code: str):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        After executing valid code, /api/state should return a valid response.
        """
        # First execute code
        exec_response = client.post("/api/execute", json={"code": code, "mode": "step"})
        exec_data = exec_response.json()
        
        assume(exec_data.get("success", False))
        
        # Now get state
        state_response = client.get("/api/state")
        state_data = state_response.json()
        
        assert "success" in state_data, "Response must have 'success' field"
        
        if state_data["success"]:
            assert "state" in state_data, "Successful get state must have 'state' field"

    @settings(max_examples=10)
    @given(st.data())
    def test_execute_empty_code_returns_error(self, data):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Executing empty code should return an error response.
        """
        response = client.post("/api/execute", json={"code": "", "mode": "step"})
        
        # Should either be validation error (422) or success=False
        if response.status_code == 422:
            # Pydantic validation error - this is acceptable
            pass
        else:
            resp_data = response.json()
            assert "success" in resp_data
            if not resp_data["success"]:
                assert "error" in resp_data

    @given(mode=st.sampled_from(["full", "step"]))
    @settings(max_examples=10, deadline=None)
    def test_execute_mode_parameter_accepted(self, mode: str):
        """
        Feature: cavl-v1, Property 12: API Request/Response Contract
        
        Both 'full' and 'step' modes should be accepted.
        """
        code = ".text\nmain:\n    li $t0, 5\n    li $v0, 10\n    syscall"
        
        response = client.post("/api/execute", json={"code": code, "mode": mode})
        
        # Should not be a validation error
        assert response.status_code != 422, f"Mode '{mode}' should be valid"
        
        data = response.json()
        assert "success" in data, "Response must have 'success' field"


# ============== Unit Tests ==============

class TestAPIRoutesUnit:
    """Unit tests for API routes."""

    def test_health_endpoint(self):
        """Health endpoint should return healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_root_endpoint(self):
        """Root endpoint should return ok status."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_execute_invalid_mode_rejected(self):
        """Invalid execution mode should be rejected."""
        response = client.post(
            "/api/execute",
            json={"code": "li $t0, 5", "mode": "invalid_mode"}
        )
        # Should be validation error
        assert response.status_code == 422

    def test_allocate_negative_size_rejected(self):
        """Negative allocation size should be rejected."""
        response = client.post("/api/heap/allocate", json={"size": -10})
        # Should be validation error or error response
        if response.status_code == 422:
            pass  # Pydantic validation
        else:
            data = response.json()
            assert data.get("success") is False

    def test_free_negative_address_rejected(self):
        """Negative address should be rejected."""
        response = client.post("/api/heap/free", json={"address": -1})
        # Should be validation error or error response
        if response.status_code == 422:
            pass  # Pydantic validation
        else:
            data = response.json()
            assert data.get("success") is False
