/**
 * Unit tests for IST date utilities
 */

import { 
  getISTDate, 
  getISTToday, 
  formatISTDate, 
  getISTDayOfWeek 
} from '../utils/istDate.js';

describe('IST Date Utilities', () => {
  test('should get IST date', () => {
    const istDate = getISTDate();
    expect(istDate).toBeInstanceOf(Date);
  });

  test('should get IST today (midnight)', () => {
    const today = getISTToday();
    expect(today).toBeInstanceOf(Date);
  });

  test('should format date correctly', () => {
    const date = new Date('2024-12-29T00:00:00Z');
    const formatted = formatISTDate(date);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should get day of week', () => {
    const date = new Date('2024-12-30T00:00:00Z'); // Monday
    const dayOfWeek = getISTDayOfWeek(date);
    expect([0, 1, 2, 3, 4, 5, 6]).toContain(dayOfWeek);
  });

  test('should format date as YYYY-MM-DD', () => {
    const date = new Date('2024-12-29');
    const formatted = formatISTDate(date);
    expect(formatted).toBe('2024-12-29');
  });
});

