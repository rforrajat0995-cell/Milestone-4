/**
 * Mock availability service for Phase 1
 * Generates fake available slots based on time preferences
 * All dates and times are in IST (Indian Standard Time, Asia/Kolkata)
 */

import { 
  getISTToday, 
  getISTDate,
  formatISTDate, 
  createISTDateTime, 
  getISTDayOfWeek 
} from '../../utils/istDate.js';
import { getBookedSlots } from '../../repositories/BookingRepository.js';

const TOPICS = [
  'KYC/Onboarding',
  'SIP/Mandates',
  'Statements/Tax Docs',
  'Withdrawals & Timelines',
  'Account Changes/Nominee'
];

/**
 * Generates mock available slots based on preferences
 * @param {Object} preferences - { day: string, time: string }
 * @param {string} excludeBookingCode - Optional booking code to exclude from conflict check (for rescheduling)
 * @returns {Array} Array of available slots
 */
export function getMockAvailableSlots(preferences = {}, excludeBookingCode = null) {
  const slots = [];
  const today = getISTToday(); // Get today in IST
  const now = getISTDate(); // Get current IST time
  
  // Get all booked slots to filter them out
  const bookedSlots = getBookedSlots(excludeBookingCode);
  const bookedSlotsSet = new Set(bookedSlots.map(bs => `${bs.date}-${bs.time}`));
  
  // Generate slots for today and next 7 days
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const slotDate = new Date(today);
    slotDate.setDate(today.getDate() + dayOffset);
    
    // Skip Sundays (day 0) in IST
    if (getISTDayOfWeek(slotDate) === 0) continue;
    
    // Generate 3 time slots per day: 10:00, 14:00, 16:00 IST
    const timeSlots = ['10:00', '14:00', '16:00'];
    const dateStr = formatISTDate(slotDate);
    
    for (const time of timeSlots) {
      const slotDateTime = createISTDateTime(dateStr, time);
      
      // Skip past slots - if the slot time has already passed, don't include it
      if (slotDateTime <= now) {
        continue;
      }
      
      // Skip slots that are already booked
      const slotKey = `${dateStr}-${time}`;
      if (bookedSlotsSet.has(slotKey)) {
        continue;
      }
      
      slots.push({
        date: dateStr, // YYYY-MM-DD in IST
        time: time,
        datetime: slotDateTime.toISOString(),
        formatted: formatSlotDateTime(slotDateTime, time)
      });
    }
  }
  
  // Filter based on preferences if provided
  if (preferences.day || preferences.time) {
    let { filtered, isSundayRequest, targetDate } = filterSlotsByPreferences(slots, preferences);
    
    // If we have filtered slots, return up to 2
    // If we have less than 2, try to add more slots from the original list
    let result;
    
    // CRITICAL: If this is a Sunday request, we MUST return Monday slots, not Saturday
    // Check if filtered slots are actually for the target date (Monday)
    if (isSundayRequest && targetDate) {
      const correctDateSlots = filtered.filter(s => s.date === targetDate);
      if (correctDateSlots.length === 0) {
        // Filtered slots are wrong (probably Saturday) or missing - clear and we'll get Monday slots in the else branch
        filtered = [];
      } else {
        // Use only the correct date slots (Monday)
        filtered = correctDateSlots;
      }
    }
    
    if (filtered.length >= 2) {
      // Sort slots to prioritize the one matching the specific time preference
      if (preferences.specificHour !== undefined) {
        const hour24 = preferences.specificHour;
        filtered.sort((a, b) => {
          const timeA = parseInt(a.time.split(':')[0]);
          const timeB = parseInt(b.time.split(':')[0]);
          const diffA = Math.abs(timeA - hour24);
          const diffB = Math.abs(timeB - hour24);
          return diffA - diffB; // Sort by closest to requested time
        });
      }
      result = filtered.slice(0, 2);
    } else if (filtered.length === 1) {
      // If only 1 slot matches preferences, add 1 more from available slots
      // But if this is a Sunday request, prioritize Monday slots
      let remaining;
      if (isSundayRequest && targetDate) {
        // For Sunday requests, prioritize Monday slots
        remaining = slots.filter(s => 
          s.date === targetDate && 
          !filtered.some(f => f.date === s.date && f.time === s.time)
        );
        // If no more Monday slots, then get any other available slot
        if (remaining.length === 0) {
          remaining = slots.filter(s => 
            !filtered.some(f => f.date === s.date && f.time === s.time)
          );
        }
      } else {
        remaining = slots.filter(s => 
          !filtered.some(f => f.date === s.date && f.time === s.time)
        );
      }
      result = [...filtered, ...remaining.slice(0, 1)].slice(0, 2);
    } else {
      // No matches - if this was a Sunday request, ensure we return Monday slots
      if (isSundayRequest && targetDate) {
        // Find Monday slots from the original slots list
        let mondaySlots = slots.filter(s => s.date === targetDate);
        
        // If no Monday slots found in original array, generate them
        if (mondaySlots.length === 0) {
          const today = getISTToday();
          const mondayDate = new Date(today);
          // Calculate Monday (next Monday after Sunday)
          const currentDay = getISTDayOfWeek(today);
          let daysToMonday = 1 - currentDay; // Monday is day 1
          if (daysToMonday <= 0) {
            daysToMonday += 7;
          }
          mondayDate.setDate(today.getDate() + daysToMonday);
          const mondayDateStr = formatISTDate(mondayDate);
          
          // Generate Monday slots
          const timeSlots = ['10:00', '14:00', '16:00'];
          const now = getISTDate();
          for (const time of timeSlots) {
            const slotDateTime = createISTDateTime(mondayDateStr, time);
            if (slotDateTime > now) {
              mondaySlots.push({
                date: mondayDateStr,
                time: time,
                datetime: slotDateTime.toISOString(),
                formatted: formatSlotDateTime(slotDateTime, time)
              });
            }
          }
        }
        
        // If time preferences were provided, try to match them
        if (preferences.time && mondaySlots.length > 0) {
          const timeLower = preferences.time.toLowerCase();
          const timeKeywords = {
            'morning': ['10:00'],
            'afternoon': ['14:00'],
            'evening': ['16:00'],
            '10': ['10:00'],
            '14': ['14:00'],
            '2': ['14:00'],
            '16': ['16:00'],
            '4': ['16:00'],
            '3 pm': ['14:00'],
            '3pm': ['14:00'],
            '15': ['14:00'],
            '15:00': ['14:00']
          };
          
          for (const [keyword, times] of Object.entries(timeKeywords)) {
            if (timeLower === keyword || timeLower.includes(keyword)) {
              mondaySlots = mondaySlots.filter(slot => times.includes(slot.time));
              break;
            }
          }
        }
        
        if (mondaySlots.length > 0) {
          result = mondaySlots.slice(0, 2);
        } else {
          // If still no matching Monday slots, return all Monday slots we generated
          const allMondaySlots = slots.filter(s => s.date === targetDate);
          if (allMondaySlots.length === 0 && mondaySlots.length === 0) {
            // Last resort: generate basic Monday slots
            const today = getISTToday();
            const mondayDate = new Date(today);
            const currentDay = getISTDayOfWeek(today);
            let daysToMonday = 1 - currentDay;
            if (daysToMonday <= 0) daysToMonday += 7;
            mondayDate.setDate(today.getDate() + daysToMonday);
            const mondayDateStr = formatISTDate(mondayDate);
            const slot1DateTime = createISTDateTime(mondayDateStr, '10:00');
            const slot2DateTime = createISTDateTime(mondayDateStr, '14:00');
            result = [
              { date: mondayDateStr, time: '10:00', datetime: slot1DateTime.toISOString(), formatted: formatSlotDateTime(slot1DateTime, '10:00') },
              { date: mondayDateStr, time: '14:00', datetime: slot2DateTime.toISOString(), formatted: formatSlotDateTime(slot2DateTime, '14:00') }
            ];
          } else {
            result = allMondaySlots.length > 0 ? allMondaySlots.slice(0, 2) : mondaySlots.slice(0, 2);
          }
        }
      } else {
        // No matches, return first 2 from original
        result = slots.slice(0, 2);
      }
    }
    
    // CRITICAL FINAL CHECK: Verify result matches expectations for "tomorrow" requests
    // Only run this check if the initial detection might have missed Sunday
    // This is a safety net - only check if isSundayRequest is false but we suspect it should be true
    if (preferences.day && preferences.day.toLowerCase().includes('tomorrow') && !isSundayRequest) {
      const today = getISTToday();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowDayOfWeek = getISTDayOfWeek(tomorrow);
      
      // If tomorrow is ACTUALLY Sunday (and we missed it), we MUST return Monday slots
      if (tomorrowDayOfWeek === 0) {
        // Calculate Monday date
        const mondayDate = new Date(tomorrow);
        mondayDate.setDate(tomorrow.getDate() + 1);
        const mondayDateStr = formatISTDate(mondayDate);
        
        // Force Sunday request flag and target date
        isSundayRequest = true;
        targetDate = mondayDateStr;
        
        // Check if result already has Monday slots
        const hasMondaySlots = result.some(s => s.date === mondayDateStr);
        
        if (!hasMondaySlots) {
          // Result doesn't have Monday slots - get/generate them
          let mondaySlots = slots.filter(s => s.date === mondayDateStr);
          if (mondaySlots.length === 0) {
            // Generate Monday slots
            const timeSlots = ['10:00', '14:00', '16:00'];
            const now = getISTDate();
            for (const time of timeSlots) {
              const slotDateTime = createISTDateTime(mondayDateStr, time);
              if (slotDateTime > now) {
                mondaySlots.push({
                  date: mondayDateStr,
                  time: time,
                  datetime: slotDateTime.toISOString(),
                  formatted: formatSlotDateTime(slotDateTime, time)
                });
              }
            }
          }
          // Replace result with Monday slots
          result = mondaySlots.slice(0, 2);
        } else {
          // Result has Monday slots, but filter to ensure we only have Monday slots
          result = result.filter(s => s.date === mondayDateStr).slice(0, 2);
        }
      }
    }
    
    // CRITICAL FINAL CHECK: If this is a Sunday request, verify result is Monday slots
    if (isSundayRequest && targetDate) {
      // Check if result contains any non-Monday slots
      const nonMondaySlots = result.filter(s => s.date !== targetDate);
      if (nonMondaySlots.length > 0) {
        // Replace with Monday slots
        let mondaySlots = slots.filter(s => s.date === targetDate);
        if (mondaySlots.length === 0) {
          // Generate Monday slots
          const today = getISTToday();
          const mondayDate = new Date(today);
          const currentDay = getISTDayOfWeek(today);
          let daysToMonday = 1 - currentDay;
          if (daysToMonday <= 0) daysToMonday += 7;
          mondayDate.setDate(today.getDate() + daysToMonday);
          const mondayDateStr = formatISTDate(mondayDate);
          const timeSlots = ['10:00', '14:00', '16:00'];
          const now = getISTDate();
          for (const time of timeSlots) {
            const slotDateTime = createISTDateTime(mondayDateStr, time);
            if (slotDateTime > now) {
              mondaySlots.push({
                date: mondayDateStr,
                time: time,
                datetime: slotDateTime.toISOString(),
                formatted: formatSlotDateTime(slotDateTime, time)
              });
            }
          }
        }
        result = mondaySlots.slice(0, 2);
      }
    }
    
    // Attach Sunday request flag to result
    if (isSundayRequest) {
      result._isSundayRequest = true;
    }
    return result;
  }
  
  // Return first 2 available slots
  return slots.slice(0, 2);
}

/**
 * Filters slots based on user preferences
 */
function filterSlotsByPreferences(slots, preferences) {
  let filtered = [...slots];
  let isSundayRequest = false;
  let targetDate = null;
  
  if (preferences.day) {
    const dayLower = preferences.day.toLowerCase();
    const today = getISTToday(); // Get today in IST
    
    // Handle "tomorrow" first (most common)
    if (dayLower.includes('tomorrow')) {
      // Calculate tomorrow in IST - use same method as slot generation
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      // Check if tomorrow is Sunday in IST
      const tomorrowDayOfWeek = getISTDayOfWeek(tomorrow);
      
      if (tomorrowDayOfWeek === 0) {
        // If tomorrow is Sunday, move to Monday
        isSundayRequest = true;
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Double-check we're now on Monday
        const mondayDayOfWeek = getISTDayOfWeek(tomorrow);
        if (mondayDayOfWeek !== 1) {
          // If not Monday, calculate next Monday explicitly
          const currentDay = getISTDayOfWeek(today);
          let daysToMonday = 1 - currentDay; // Monday is day 1
          if (daysToMonday <= 0) {
            daysToMonday += 7;
          }
          tomorrow.setDate(today.getDate() + daysToMonday);
        }
      }
      targetDate = formatISTDate(tomorrow);
      filtered = filtered.filter(slot => slot.date === targetDate);
    } else if (dayLower.includes('today')) {
      // Check if today is Sunday
      const todayDayOfWeek = getISTDayOfWeek(today);
      if (todayDayOfWeek === 0) {
        // Today is Sunday, move to Monday
        isSundayRequest = true;
        const mondayDate = new Date(today);
        const currentDay = getISTDayOfWeek(today);
        let daysToMonday = 1 - currentDay; // Monday is day 1
        if (daysToMonday <= 0) {
          daysToMonday += 7;
        }
        mondayDate.setDate(today.getDate() + daysToMonday);
        targetDate = formatISTDate(mondayDate);
      } else {
        // Today is not Sunday, use today's date
        targetDate = formatISTDate(today);
      }
      filtered = filtered.filter(slot => slot.date === targetDate);
    } else if (dayLower.includes('sunday')) {
      // User explicitly requested Sunday
      isSundayRequest = true;
      // Find next Monday instead
      const today = getISTToday();
      const currentDay = getISTDayOfWeek(today);
      let daysToAdd = 1 - currentDay; // Monday is day 1
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysToAdd);
      const targetDateStr = formatISTDate(targetDate);
      filtered = filtered.filter(slot => slot.date === targetDateStr);
    } else {
      // Handle day names (Monday, Tuesday, etc.)
      const dayKeywords = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6
      };
      
      for (const [keyword, dayOfWeek] of Object.entries(dayKeywords)) {
        if (dayLower.includes(keyword)) {
          // Find the next occurrence of this day in IST
          const targetDate = new Date(today);
          const currentDay = getISTDayOfWeek(today);
          let daysToAdd = dayOfWeek - currentDay;
          
          // If the day has passed this week, get next week's occurrence
          if (daysToAdd <= 0) {
            daysToAdd += 7;
          }
          
          targetDate.setDate(today.getDate() + daysToAdd);
          const targetDateStr = formatISTDate(targetDate);
          filtered = filtered.filter(slot => slot.date === targetDateStr);
          break;
        }
      }
    }
  }
  
  // Filter by time preferences
  if (preferences.time) {
    const timeLower = preferences.time.toLowerCase();
    
    // If we have a specific hour, use it to find the closest slot
    let targetTimes = [];
    if (preferences.specificHour !== undefined) {
      const hour24 = preferences.specificHour;
      const availableSlots = [10, 14, 16];
      let closestSlot = availableSlots[0];
      let minDiff = Math.abs(hour24 - closestSlot);
      
      for (const slotHour of availableSlots) {
        const diff = Math.abs(hour24 - slotHour);
        if (diff < minDiff) {
          minDiff = diff;
          closestSlot = slotHour;
        }
      }
      
      // Map to time string
      targetTimes = [String(closestSlot).padStart(2, '0') + ':00'];
    } else {
      // Use keyword mapping for generic terms
      const timeKeywords = {
        'morning': ['10:00'],
        'afternoon': ['14:00'],
        'evening': ['16:00'],
        '10': ['10:00'],
        '14': ['14:00'],
        '2': ['14:00'],
        '16': ['16:00'],
        '4': ['16:00'],
        '3 pm': ['14:00'], // 3 pm maps to afternoon (14:00)
        '3pm': ['14:00'],
        '15': ['14:00'], // 15:00 (3 pm) maps to closest which is 14:00
        '15:00': ['14:00']
      };
      
      // Check for exact matches first
      if (timeKeywords[timeLower]) {
        targetTimes = timeKeywords[timeLower];
      } else {
        // Try partial matching
        for (const [keyword, times] of Object.entries(timeKeywords)) {
          if (timeLower.includes(keyword)) {
            targetTimes = times;
            break;
          }
        }
      }
    }
    
    // Filter slots by target times
    if (targetTimes.length > 0) {
      filtered = filtered.filter(slot => targetTimes.includes(slot.time));
    }
  }
  
  // Return both filtered slots and Sunday request flag
  return {
    filtered: filtered.length > 0 ? filtered : slots,
    isSundayRequest,
    targetDate
  };
}

/**
 * Formats slot for display
 */
function formatSlotDateTime(date, time) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  
  return `${dayName}, ${month} ${day} at ${time} IST`;
}

/**
 * Checks if a specific slot is available
 */
export function isSlotAvailable(date, time) {
  const slots = getMockAvailableSlots();
  return slots.some(slot => slot.date === date && slot.time === time);
}

/**
 * Gets all available time windows
 */
export function getAvailabilityWindows() {
  const slots = getMockAvailableSlots();
  const windows = {};
  
  slots.forEach(slot => {
    if (!windows[slot.date]) {
      windows[slot.date] = [];
    }
    windows[slot.date].push(slot.time);
  });
  
  return windows;
}

