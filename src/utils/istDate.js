/**
 * IST (Indian Standard Time) date utilities
 * IST is UTC+5:30 (Asia/Kolkata)
 * 
 * For Phase 1, we use a simplified approach where all dates are calculated
 * as if the server is in IST timezone. In production, use a proper timezone library.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds

/**
 * Gets current date/time in IST
 * @returns {Date} Date object representing current IST time
 */
export function getISTDate() {
  const now = new Date();
  // If system is already in IST, just return now
  // Otherwise, convert to IST
  // Check if system timezone is IST (offset -330 minutes = UTC+5:30)
  if (now.getTimezoneOffset() === -330) {
    // System is already in IST, return as-is
    return now;
  }
  // System is not in IST, convert to IST
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + IST_OFFSET_MS);
}

/**
 * Gets today's date in IST (midnight IST)
 * @returns {Date} Date object set to today midnight IST
 */
export function getISTToday() {
  // Get current system time
  const now = new Date();
  
  // If system is already in IST (offset -330), use system date directly
  if (now.getTimezoneOffset() === -330) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  
  // System is not in IST, convert to IST first
  const istNow = getISTDate();
  const year = istNow.getFullYear();
  const month = istNow.getMonth();
  const day = istNow.getDate();
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Formats a date to YYYY-MM-DD string in IST
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format (IST date)
 */
export function formatISTDate(date) {
  // If system is already in IST, use local date components directly
  if (date.getTimezoneOffset() === -330) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // System is not in IST, convert to IST for getting date components
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + IST_OFFSET_MS);
  
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates a date in IST from a date string (YYYY-MM-DD) and time (HH:MM)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {Date} Date object representing the IST datetime
 */
export function createISTDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create UTC date representing IST time
  // IST is UTC+5:30, so create UTC time and subtract offset
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  return new Date(utcDate.getTime() - IST_OFFSET_MS);
}

/**
 * Gets day of week in IST (0 = Sunday, 1 = Monday, etc.)
 * @param {Date} date - Date object
 * @returns {number} Day of week (0-6)
 */
export function getISTDayOfWeek(date) {
  // If system is already in IST, use local day of week directly
  if (date.getTimezoneOffset() === -330) {
    return date.getDay();
  }
  
  // System is not in IST, convert to IST and get day of week
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + IST_OFFSET_MS);
  return istTime.getUTCDay();
}

