import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toHex, fromHex } from '../RegisterDisplay';

/**
 * Feature: cavl-v1, Property 8: Hex/Decimal Conversion Round-Trip
 * Validates: Requirements 5.4
 * 
 * For any register value, converting to hexadecimal and back to decimal
 * SHALL produce the original value.
 */
describe('Property 8: Hex/Decimal Conversion Round-Trip', () => {
  it('should round-trip any 32-bit signed integer through hex conversion', () => {
    fc.assert(
      fc.property(
        // Generate 32-bit signed integers (-2^31 to 2^31-1)
        fc.integer({ min: -2147483648, max: 2147483647 }),
        (value: number) => {
          const hex = toHex(value);
          const result = fromHex(hex);
          return result === value;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should round-trip any 32-bit unsigned integer through hex conversion', () => {
    fc.assert(
      fc.property(
        // Generate 32-bit unsigned integers (0 to 2^32-1)
        fc.integer({ min: 0, max: 4294967295 }),
        (value: number) => {
          const hex = toHex(value);
          const result = fromHex(hex);
          // For unsigned values > MAX_INT32, result will be negative (signed interpretation)
          const expected = value > 2147483647 ? value - 4294967296 : value;
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce valid 8-digit hex strings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2147483648, max: 2147483647 }),
        (value: number) => {
          const hex = toHex(value);
          // Should match format: 0xXXXXXXXX (10 chars total)
          return /^0x[0-9A-F]{8}$/.test(hex);
        }
      ),
      { numRuns: 100 }
    );
  });
});
