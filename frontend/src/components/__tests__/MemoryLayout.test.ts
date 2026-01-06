import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateSegmentOrdering } from '../MemoryLayout';
import { MemoryState, MemorySegment } from '@/lib/types';

/**
 * Feature: cavl-v1, Property 11: Memory Segment Ordering
 * Validates: Requirements 1.1, 1.2
 * 
 * For any execution state, heap addresses SHALL be greater than data segment
 * addresses, and stack addresses SHALL be greater than heap addresses
 * (following MIPS memory layout convention).
 */

// Generator for a valid memory segment with guaranteed start < end
const memorySegmentArb = (start: number, end: number): fc.Arbitrary<MemorySegment> =>
  fc.record({
    startAddress: fc.constant(start),
    endAddress: fc.constant(end),
    blocks: fc.constant([]), // Empty blocks for ordering test
  });

// Generator for valid MIPS memory state following address conventions
// Uses non-overlapping address ranges that follow MIPS convention
const validMipsMemoryStateArb: fc.Arbitrary<MemoryState> = fc.tuple(
  // Generate sizes for each segment
  fc.integer({ min: 4, max: 0x1000 }),  // text size
  fc.integer({ min: 4, max: 0x1000 }),  // data size
  fc.integer({ min: 4, max: 0x10000 }), // heap size
  fc.integer({ min: 4, max: 0x10000 }), // stack size
).map(([textSize, dataSize, heapSize, stackSize]) => {
  // MIPS memory layout (addresses increase upward):
  // Text:  0x00400000 - 0x00400000 + textSize
  // Data:  0x10000000 - 0x10000000 + dataSize
  // Heap:  0x10010000 - 0x10010000 + heapSize (grows up)
  // Stack: 0x7FFFFFFC - stackSize - 0x7FFFFFFC (grows down, but we store as range)
  
  const textStart = 0x00400000;
  const textEnd = textStart + textSize;
  
  const dataStart = 0x10000000;
  const dataEnd = dataStart + dataSize;
  
  const heapStart = 0x10010000;
  const heapEnd = heapStart + heapSize;
  
  // Stack is at high memory, well above heap
  const stackEnd = 0x7FFFFFFC;
  const stackStart = stackEnd - stackSize;
  
  return {
    text: { startAddress: textStart, endAddress: textEnd, blocks: [] },
    data: { startAddress: dataStart, endAddress: dataEnd, blocks: [] },
    heap: { startAddress: heapStart, endAddress: heapEnd, blocks: [] },
    stack: { startAddress: stackStart, endAddress: stackEnd, blocks: [] },
  };
});

describe('Property 11: Memory Segment Ordering', () => {
  it('should validate that heap addresses are greater than data addresses', () => {
    fc.assert(
      fc.property(validMipsMemoryStateArb, (memory: MemoryState) => {
        // Heap start should be >= data end (heap is above data)
        return memory.heap.startAddress >= memory.data.endAddress;
      }),
      { numRuns: 100 }
    );
  });

  it('should validate that stack addresses are greater than heap addresses', () => {
    fc.assert(
      fc.property(validMipsMemoryStateArb, (memory: MemoryState) => {
        // Stack start should be >= heap end (stack is above heap)
        return memory.stack.startAddress >= memory.heap.endAddress;
      }),
      { numRuns: 100 }
    );
  });

  it('should pass validation for properly ordered memory segments', () => {
    fc.assert(
      fc.property(validMipsMemoryStateArb, (memory: MemoryState) => {
        return validateSegmentOrdering(memory) === true;
      }),
      { numRuns: 100 }
    );
  });

  it('should follow MIPS memory layout convention: text < data < heap < stack', () => {
    fc.assert(
      fc.property(validMipsMemoryStateArb, (memory: MemoryState) => {
        // Full ordering check
        const textBeforeData = memory.text.endAddress <= memory.data.startAddress;
        const dataBeforeHeap = memory.data.endAddress <= memory.heap.startAddress;
        const heapBeforeStack = memory.heap.endAddress <= memory.stack.startAddress;
        
        return textBeforeData && dataBeforeHeap && heapBeforeStack;
      }),
      { numRuns: 100 }
    );
  });
});
