"""
Property-based tests for MARS executor.
Feature: cavl-v1
"""

import pytest
from hypothesis import given, strategies as st, settings, assume

from app.services.mars_executor import MarsExecutor, MarsResult


# ============== Strategies ==============

@st.composite
def invalid_mips_code_strategy(draw):
    """Generate syntactically invalid MIPS code that MARS will reject as errors."""
    invalid_patterns = [
        # Invalid register names - these definitely cause errors
        "add $x0, $t1, $t2",
        "li $invalid, 5",
        "add $t0, $notreal, $t2",
        "move $badregister, $t0",
        # Invalid instruction names
        "notaninstr $t0, 5",
        "xyz $a0, $a1, $a2",
        # Incomplete hex literal
        "li $t0, 0x",
        # Invalid immediate values
        "li $t0, abc",
        # Invalid label reference
        ".text\nj undefined_label",
    ]
    return draw(st.sampled_from(invalid_patterns))


@st.composite
def valid_mips_code_strategy(draw):
    """Generate valid simple MIPS programs."""
    templates = [
        ".text\n.globl main\nmain:\n    li $t0, {val}\n    li $v0, 10\n    syscall",
        ".text\n.globl main\nmain:\n    li $t0, {val}\n    li $t1, {val2}\n    add $t2, $t0, $t1\n    li $v0, 10\n    syscall",
        ".data\nmsg: .asciiz \"test\"\n.text\n.globl main\nmain:\n    li $t0, {val}\n    li $v0, 10\n    syscall",
    ]
    template = draw(st.sampled_from(templates))
    val = draw(st.integers(min_value=0, max_value=1000))
    val2 = draw(st.integers(min_value=0, max_value=1000))
    return template.format(val=val, val2=val2)


# ============== Property Tests ==============

class TestInvalidMipsErrorHandling:
    """
    Property 10: Invalid MIPS Code Error Handling
    
    *For any* syntactically invalid MIPS code, the Backend SHALL return a response 
    with `success: false` and a non-empty error message.
    
    **Validates: Requirements 2.4**
    """

    @given(invalid_code=invalid_mips_code_strategy())
    @settings(max_examples=15, deadline=None)
    def test_invalid_mips_returns_error(self, invalid_code):
        """
        Feature: cavl-v1, Property 10: Invalid MIPS Code Error Handling
        
        For any invalid MIPS code, execution should return success=False with error message.
        """
        executor = MarsExecutor()
        result = executor.execute(invalid_code)
        
        # Invalid code should not succeed
        assert result.success is False, f"Invalid code should fail: {invalid_code}"
        # Should have an error message
        assert result.error is not None and len(result.error) > 0, \
            f"Should have error message for: {invalid_code}"


    @given(valid_code=valid_mips_code_strategy())
    @settings(max_examples=10, deadline=None)
    def test_valid_mips_succeeds(self, valid_code):
        """
        Feature: cavl-v1, Property 10: Invalid MIPS Code Error Handling (inverse)
        
        For any valid MIPS code, execution should succeed.
        """
        executor = MarsExecutor()
        # Use longer timeout (5s) to account for JVM startup time variability
        result = executor.execute(valid_code, timeout=5.0)
        
        assert result.success is True, f"Valid code should succeed: {valid_code}\nError: {result.error}"


class TestMarsExecutorUnit:
    """Unit tests for MarsExecutor."""

    def test_execute_simple_program(self):
        """Execute a simple MIPS program."""
        code = """
.text
.globl main
main:
    li $t0, 42
    li $v0, 10
    syscall
"""
        executor = MarsExecutor()
        result = executor.execute(code)
        
        assert result.success is True
        assert "$t0" in result.stdout
        assert "42" in result.stdout

    def test_execute_with_syntax_error(self):
        """Execute code with syntax error."""
        code = "invalid_instruction $t0, $t1"
        
        executor = MarsExecutor()
        result = executor.execute(code)
        
        assert result.success is False
        assert result.error is not None

    def test_timeout_handling(self):
        """Test timeout for infinite loop."""
        code = """
.text
.globl main
main:
    j main
"""
        executor = MarsExecutor()
        result = executor.execute(code, timeout=0.5)
        
        assert result.success is False
        assert result.timeout is True
        assert "timeout" in result.error.lower()

    def test_execute_with_trace(self):
        """Execute with full register trace."""
        code = """
.text
.globl main
main:
    li $t0, 100
    li $t1, 200
    add $t2, $t0, $t1
    li $v0, 10
    syscall
"""
        executor = MarsExecutor()
        result = executor.execute_with_trace(code)
        
        assert result.success is True
        # Should have register values in output
        assert "$t0" in result.stdout or "t0" in result.stdout
        assert "100" in result.stdout
        assert "200" in result.stdout
        assert "300" in result.stdout  # t2 = t0 + t1

    def test_memory_dump(self):
        """Test memory dump functionality."""
        code = """
.data
value: .word 12345
.text
.globl main
main:
    li $v0, 10
    syscall
"""
        executor = MarsExecutor()
        result = executor.dump_memory(code, segment=".data")
        
        assert result.success is True
        # Memory dump should contain hex values
        assert "0x" in result.stdout.lower() or result.stdout.strip() != ""
