/**
 * Unit tests for booking code generation
 */

import { generateBookingCode } from '../utils/bookingCode.js';

describe('generateBookingCode', () => {
  test('should generate a booking code', () => {
    const code = generateBookingCode();
    expect(code).toBeDefined();
    expect(typeof code).toBe('string');
  });

  test('should have format NL-XXXX', () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^NL-[A-Z0-9]{4}$/);
  });

  test('should start with NL-', () => {
    const code = generateBookingCode();
    expect(code.startsWith('NL-')).toBe(true);
  });

  test('should generate unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateBookingCode());
    }
    // Should have high uniqueness (at least 95% unique)
    expect(codes.size).toBeGreaterThan(95);
  });

  test('should not contain confusing characters (0, O, I, 1)', () => {
    const code = generateBookingCode();
    const suffix = code.substring(3); // After "NL-"
    expect(suffix).not.toMatch(/[0O1I]/);
  });
});

