/**
 * Unit tests for time preference extraction
 */

import { extractTimePreferences } from '../services/intentHandlers.js';

describe('extractTimePreferences', () => {
  test('should extract day and time from "Monday afternoon"', () => {
    const result = extractTimePreferences('Monday afternoon');
    expect(result.day).toBe('monday');
    expect(result.time).toBe('afternoon');
  });

  test('should extract "tomorrow" and "3 pm"', () => {
    const result = extractTimePreferences('Tomorrow 3 pm');
    expect(result.day).toBe('tomorrow');
    expect(result.time).toBe('afternoon'); // 3 pm maps to afternoon (14:00)
  });

  test('should extract "tomorrow" and "3pm" (no space)', () => {
    const result = extractTimePreferences('Tomorrow 3pm');
    expect(result.day).toBe('tomorrow');
    expect(result.time).toBe('afternoon');
  });

  test('should extract "Tuesday" and "morning"', () => {
    const result = extractTimePreferences('Tuesday morning');
    expect(result.day).toBe('tuesday');
    expect(result.time).toBe('morning');
  });

  test('should extract "2 pm" and map to afternoon', () => {
    const result = extractTimePreferences('2 pm');
    expect(result.time).toBe('afternoon');
  });

  test('should extract "10 am" and map to morning', () => {
    const result = extractTimePreferences('10 am');
    expect(result.time).toBe('morning');
  });

  test('should extract "4 pm" and map to evening', () => {
    const result = extractTimePreferences('4 pm');
    expect(result.time).toBe('evening');
  });

  test('should handle "Monday" without time', () => {
    const result = extractTimePreferences('Monday');
    expect(result.day).toBe('monday');
    expect(result.time).toBeNull();
  });

  test('should handle "afternoon" without day', () => {
    const result = extractTimePreferences('afternoon');
    expect(result.day).toBeNull();
    expect(result.time).toBe('afternoon');
  });

  test('should return null for both if no preferences found', () => {
    const result = extractTimePreferences('hello world');
    expect(result.day).toBeNull();
    expect(result.time).toBeNull();
  });
});

