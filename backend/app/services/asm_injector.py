"""
ASM Injector Service.
Injects user inputs into MIPS assembly templates.

IMPORTANT: This service ONLY performs text substitution.
It does NOT make any algorithmic decisions.
All logic (first-fit, splitting, free list management) is in MIPS.

Per the MIPS-centric architecture:
- FastAPI accepts user input (size, address)
- This service injects those values into .data section
- MARS executes the MIPS program
- Output parser reads results from registers/memory
"""

import re
from pathlib import Path
from typing import Optional


class AsmInjector:
    """
    Injects input values into MIPS assembly templates.
    
    This is a pure text-substitution service. It replaces placeholder
    values in the .data section with actual user inputs.
    
    Template format expected:
        operation_type:     .word 0
        requested_size:     .word 0
        free_address:       .word 0
    """
    
    def __init__(self, mips_dir: Optional[Path] = None):
        """
        Initialize ASM injector.
        
        Args:
            mips_dir: Directory containing MIPS templates.
                      Defaults to mips/core relative to project root.
        """
        if mips_dir:
            self.mips_dir = Path(mips_dir)
        else:
            # Default: mips/core relative to backend directory
            self.mips_dir = Path(__file__).parent.parent.parent.parent / "mips" / "core"
    
    def load_template(self, template_name: str = "heap_operations.asm") -> str:
        """
        Load a MIPS template file.
        
        Args:
            template_name: Name of the template file
            
        Returns:
            Template content as string
            
        Raises:
            FileNotFoundError: If template doesn't exist
        """
        template_path = self.mips_dir / template_name
        if not template_path.exists():
            raise FileNotFoundError(f"MIPS template not found: {template_path}")
        return template_path.read_text(encoding='utf-8')
    
    def inject_value(self, asm_code: str, label: str, value: int) -> str:
        """
        Replace a .word value for a specific label in the .data section.
        
        Example:
            Input:  "requested_size:     .word 0"
            Output: "requested_size:     .word 32"
        
        Args:
            asm_code: MIPS assembly code
            label: Label name (without colon)
            value: Integer value to inject
            
        Returns:
            Modified assembly code
        """
        # Pattern matches: label: .word <number>
        # Preserves whitespace and any trailing comments
        pattern = rf'^(\s*{label}:\s*\.word\s+)-?\d+(.*)$'
        replacement = rf'\g<1>{value}\g<2>'
        return re.sub(pattern, replacement, asm_code, flags=re.MULTILINE)
    
    def inject_heap_allocate(self, size: int) -> str:
        """
        Create MIPS code for a heap allocation operation.
        
        Injects:
            operation_type = 0 (allocate)
            requested_size = size
        
        Args:
            size: Number of bytes to allocate
            
        Returns:
            Complete MIPS assembly code ready for MARS execution
        """
        template = self.load_template("heap_operations.asm")
        
        # Inject operation type (0 = allocate)
        template = self.inject_value(template, "operation_type", 0)
        
        # Inject requested size
        template = self.inject_value(template, "requested_size", size)
        
        return template
    
    def inject_heap_free(self, address: int) -> str:
        """
        Create MIPS code for a heap free operation.
        
        Injects:
            operation_type = 1 (free)
            free_address = address
        
        Args:
            address: User data address to free (NOT the block header)
            
        Returns:
            Complete MIPS assembly code ready for MARS execution
        """
        template = self.load_template("heap_operations.asm")
        
        # Inject operation type (1 = free)
        template = self.inject_value(template, "operation_type", 1)
        
        # Inject address to free
        template = self.inject_value(template, "free_address", address)
        
        return template
    
    def inject_heap_init(self) -> str:
        """
        Create MIPS code to initialize the heap only.
        
        Injects:
            operation_type = 2 (init_only)
        
        Returns:
            Complete MIPS assembly code ready for MARS execution
        """
        template = self.load_template("heap_operations.asm")
        
        # Inject operation type (2 = init only)
        template = self.inject_value(template, "operation_type", 2)
        
        return template
    
    def inject_heap_operation(
        self,
        operation: str,
        size: Optional[int] = None,
        address: Optional[int] = None,
    ) -> str:
        """
        Generic method to inject parameters for any heap operation.
        
        Args:
            operation: One of "allocate", "free", "init"
            size: Size to allocate (required for "allocate")
            address: Address to free (required for "free")
            
        Returns:
            Complete MIPS assembly code ready for MARS execution
            
        Raises:
            ValueError: If required parameters are missing
        """
        if operation == "allocate":
            if size is None:
                raise ValueError("Size is required for allocate operation")
            return self.inject_heap_allocate(size)
        
        elif operation == "free":
            if address is None:
                raise ValueError("Address is required for free operation")
            return self.inject_heap_free(address)
        
        elif operation == "init":
            return self.inject_heap_init()
        
        else:
            raise ValueError(f"Unknown operation: {operation}")


# Singleton instance
_asm_injector: Optional[AsmInjector] = None


def get_asm_injector() -> AsmInjector:
    """Get singleton AsmInjector instance."""
    global _asm_injector
    if _asm_injector is None:
        _asm_injector = AsmInjector()
    return _asm_injector
