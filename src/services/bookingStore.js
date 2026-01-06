/**
 * In-memory booking store for Phase 1 with file persistence
 * In Phase 2, this will be replaced with Google Sheets/Database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOOKINGS_FILE = path.join(__dirname, '../../data/bookings.json');

// Ensure data directory exists
const dataDir = path.dirname(BOOKINGS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load bookings from file on startup
const bookings = new Map();
function loadBookings() {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
      const bookingsArray = JSON.parse(data);
      bookingsArray.forEach(booking => {
        // Convert date strings back to Date objects
        if (booking.createdAt) booking.createdAt = new Date(booking.createdAt);
        if (booking.updatedAt) booking.updatedAt = new Date(booking.updatedAt);
        if (booking.cancelledAt) booking.cancelledAt = new Date(booking.cancelledAt);
        bookings.set(booking.code, booking);
      });
      console.log(`Loaded ${bookings.size} bookings from file`);
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
  }
}

// Save bookings to file
function saveBookings() {
  try {
    const bookingsArray = Array.from(bookings.values());
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookingsArray, null, 2), 'utf8');
    console.log(`Saved ${bookingsArray.length} bookings to file`);
  } catch (error) {
    console.error('Error saving bookings:', error);
  }
}

// Load bookings on module initialization
loadBookings();

/**
 * Creates a new booking
 */
export function createBooking(bookingCode, bookingData) {
  console.log(`[BookingStore] Creating booking: ${bookingCode}`);
  const booking = {
    code: bookingCode,
    ...bookingData,
    createdAt: new Date(),
    status: 'confirmed'
  };
  bookings.set(bookingCode, booking);
  console.log(`[BookingStore] Booking stored in memory. Total bookings: ${bookings.size}`);
  saveBookings(); // Persist to file
  return booking;
}

/**
 * Gets a booking by code
 */
export function getBooking(bookingCode) {
  return bookings.get(bookingCode);
}

/**
 * Updates a booking
 */
export function updateBooking(bookingCode, updates) {
  const booking = bookings.get(bookingCode);
  if (!booking) {
    return null;
  }
  Object.assign(booking, updates, { updatedAt: new Date() });
  saveBookings(); // Persist to file
  return booking;
}

/**
 * Cancels a booking
 */
export function cancelBooking(bookingCode) {
  const booking = bookings.get(bookingCode);
  if (!booking) {
    return null;
  }
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  saveBookings(); // Persist to file
  return booking;
}

/**
 * Gets all bookings (for debugging)
 */
export function getAllBookings() {
  return Array.from(bookings.values());
}

/**
 * Finds booking by partial code or other criteria
 */
export function findBooking(searchTerm) {
  const upperSearch = searchTerm.toUpperCase();
  for (const booking of bookings.values()) {
    if (booking.code.toUpperCase().includes(upperSearch)) {
      return booking;
    }
  }
  return null;
}

/**
 * Checks if a slot (date + time) is already booked
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format (e.g., "10:00", "14:00")
 * @param {string} excludeBookingCode - Optional booking code to exclude from check (for rescheduling)
 * @returns {boolean} True if slot is already booked
 */
export function isSlotBooked(date, time, excludeBookingCode = null) {
  // Normalize date format (ensure YYYY-MM-DD)
  const normalizeDate = (d) => {
    if (!d) return null;
    // If date is already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return d;
    }
    // Try to parse and format
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return d; // Return original if invalid
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return d; // Return original if parsing fails
    }
  };
  
  // Normalize time format (ensure HH:MM)
  const normalizeTime = (t) => {
    if (!t) return null;
    // If already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(t)) {
      return t;
    }
    // Try to parse time formats like "2:00 PM" or "14:00"
    const timeStr = t.toString().trim().toUpperCase();
    if (timeStr.includes('PM') || timeStr.includes('AM')) {
      // Parse "2:00 PM" format
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[3];
        if (minutes === 'PM' && hours !== 12) hours += 12;
        if (minutes === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${match[2]}`;
      }
    }
    return t; // Return original if can't parse
  };
  
  const normalizedDate = normalizeDate(date);
  const normalizedTime = normalizeTime(time);
  
  console.log(`[isSlotBooked] Checking: date="${date}" (normalized: "${normalizedDate}"), time="${time}" (normalized: "${normalizedTime}")`);
  
  for (const booking of bookings.values()) {
    // Skip cancelled bookings and the booking being excluded (for reschedule)
    if (booking.status === 'cancelled' || 
        (excludeBookingCode && booking.code === excludeBookingCode)) {
      continue;
    }
    
    if (!booking.selectedSlot) {
      continue;
    }
    
    // Normalize the booking's date and time for comparison
    const bookingDate = normalizeDate(booking.selectedSlot.date);
    const bookingTime = normalizeTime(booking.selectedSlot.time);
    
    console.log(`[isSlotBooked] Comparing with booking ${booking.code}: date="${booking.selectedSlot.date}" (normalized: "${bookingDate}"), time="${booking.selectedSlot.time}" (normalized: "${bookingTime}")`);
    
    // Check if the booking's slot matches the requested date and time
    if (bookingDate === normalizedDate && bookingTime === normalizedTime) {
      console.log(`[isSlotBooked] MATCH FOUND! Booking ${booking.code} has slot ${bookingDate} ${bookingTime}`);
      return true;
    }
  }
  
  console.log(`[isSlotBooked] No match found - slot is available`);
  return false;
}

/**
 * Gets all booked slots (for filtering available slots)
 * @param {string} excludeBookingCode - Optional booking code to exclude
 * @returns {Array} Array of {date, time} objects for booked slots
 */
export function getBookedSlots(excludeBookingCode = null) {
  const bookedSlots = [];
  for (const booking of bookings.values()) {
    if (booking.status === 'cancelled' || 
        (excludeBookingCode && booking.code === excludeBookingCode)) {
      continue;
    }
    
    if (booking.selectedSlot && booking.selectedSlot.date && booking.selectedSlot.time) {
      bookedSlots.push({
        date: booking.selectedSlot.date,
        time: booking.selectedSlot.time
      });
    }
  }
  return bookedSlots;
}

/**
 * Checks if all slots for a specific date are booked
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} excludeBookingCode - Optional booking code to exclude
 * @returns {boolean} True if all time slots (10:00, 14:00, 16:00) for that date are booked
 */
export function isDateFullyBooked(date, excludeBookingCode = null) {
  const bookedSlots = getBookedSlots(excludeBookingCode);
  const bookedTimesForDate = bookedSlots
    .filter(bs => bs.date === date)
    .map(bs => bs.time);
  
  // Check if all 3 time slots (10:00, 14:00, 16:00) are booked
  const allTimeSlots = ['10:00', '14:00', '16:00'];
  return allTimeSlots.every(time => bookedTimesForDate.includes(time));
}

