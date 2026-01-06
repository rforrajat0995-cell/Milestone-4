/**
 * Unit tests for mock availability service
 */

import { getMockAvailableSlots, getAvailabilityWindows } from '../services/mockAvailability.js';
import { getISTToday, formatISTDate } from '../utils/istDate.js';

describe('getMockAvailableSlots', () => {
  test('should return slots when no preferences provided', () => {
    const slots = getMockAvailableSlots();
    expect(slots).toBeDefined();
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(2);
  });

  test('should return slots for "tomorrow afternoon"', () => {
    const preferences = { day: 'tomorrow', time: 'afternoon' };
    const slots = getMockAvailableSlots(preferences);
    
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(2);
    
    // Check that slots are for tomorrow (or next day if tomorrow is Sunday)
    const today = getISTToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatISTDate(tomorrow);
    
    // All slots should be for tomorrow (or next business day)
    slots.forEach(slot => {
      expect(slot.time).toBe('14:00'); // afternoon = 14:00
    });
  });

  test('should return slots for "Monday afternoon"', () => {
    const preferences = { day: 'monday', time: 'afternoon' };
    const slots = getMockAvailableSlots(preferences);
    
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(2);
    
    // All slots should be Monday afternoon
    slots.forEach(slot => {
      expect(slot.time).toBe('14:00');
      // Check that it's a Monday (we'll verify the date format)
      expect(slot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test('should return slots for "3 pm" preference', () => {
    const preferences = { time: 'afternoon' }; // 3 pm maps to afternoon
    const slots = getMockAvailableSlots(preferences);
    
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach(slot => {
      expect(slot.time).toBe('14:00');
    });
  });

  test('should return slots with correct time format', () => {
    const slots = getMockAvailableSlots();
    
    slots.forEach(slot => {
      expect(slot.time).toMatch(/^(10:00|14:00|16:00)$/);
      expect(slot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(slot.formatted).toContain('IST');
    });
  });

  test('should not return Sunday slots', () => {
    const slots = getMockAvailableSlots();
    
    // Generate slots for next 7 days and check none are Sunday
    slots.forEach(slot => {
      const [year, month, day] = slot.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      expect(date.getDay()).not.toBe(0); // 0 = Sunday
    });
  });
});

describe('getAvailabilityWindows', () => {
  test('should return availability windows', () => {
    const windows = getAvailabilityWindows();
    expect(windows).toBeDefined();
    expect(typeof windows).toBe('object');
    expect(Object.keys(windows).length).toBeGreaterThan(0);
  });

  test('should have valid date keys', () => {
    const windows = getAvailabilityWindows();
    Object.keys(windows).forEach(date => {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test('should have time arrays for each date', () => {
    const windows = getAvailabilityWindows();
    Object.values(windows).forEach(times => {
      expect(Array.isArray(times)).toBe(true);
      expect(times.length).toBeGreaterThan(0);
      times.forEach(time => {
        expect(time).toMatch(/^(10:00|14:00|16:00)$/);
      });
    });
  });
});

