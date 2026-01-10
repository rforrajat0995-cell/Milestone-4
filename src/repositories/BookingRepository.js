/**
 * Booking Repository
 * Data access layer for booking management
 */

import fs from 'fs';
import { Booking } from '../models/Booking.js';
import { paths } from '../config/index.js';

class BookingRepository {
  constructor() {
    this.bookings = new Map();
    this.ensureDataDirectory();
    this.loadBookings();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(paths.dataDir)) {
      fs.mkdirSync(paths.dataDir, { recursive: true });
    }
  }

  loadBookings() {
    try {
      if (fs.existsSync(paths.bookingsFile)) {
        const data = fs.readFileSync(paths.bookingsFile, 'utf8');
        const bookingsArray = JSON.parse(data);
        bookingsArray.forEach((bookingData) => {
          const booking = new Booking(bookingData);
          this.bookings.set(booking.bookingCode, booking);
        });
        console.log(`[BookingRepository] Loaded ${this.bookings.size} bookings`);
      }
    } catch (error) {
      console.error('[BookingRepository] Error loading bookings:', error);
    }
  }

  saveBookings() {
    try {
      const bookingsArray = Array.from(this.bookings.values()).map((b) =>
        b.toJSON()
      );
      fs.writeFileSync(
        paths.bookingsFile,
        JSON.stringify(bookingsArray, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('[BookingRepository] Error saving bookings:', error);
    }
  }

  create(bookingCode, bookingData) {
    const booking = new Booking({
      bookingCode,
      ...bookingData,
      status: 'confirmed',
    });
    this.bookings.set(bookingCode, booking);
    this.saveBookings();
    return booking;
  }

  getById(bookingCode) {
    return this.bookings.get(bookingCode) || null;
  }

  update(bookingCode, updates) {
    const booking = this.getById(bookingCode);
    if (!booking) {
      return null;
    }
    booking.update(updates);
    this.saveBookings();
    return booking;
  }

  cancel(bookingCode) {
    const booking = this.getById(bookingCode);
    if (!booking) {
      return null;
    }
    booking.cancel();
    this.saveBookings();
    return booking;
  }

  findAll() {
    return Array.from(this.bookings.values());
  }

  findByCodePattern(pattern) {
    const regex = new RegExp(pattern, 'i');
    return Array.from(this.bookings.values()).filter((booking) =>
      regex.test(booking.bookingCode)
    );
  }

  isSlotBooked(date, time, excludeBookingCode = null) {
    const normalizedDate = this.normalizeDate(date);
    const normalizedTime = this.normalizeTime(time);

    return Array.from(this.bookings.values()).some((booking) => {
      if (booking.status !== 'confirmed') return false;
      if (excludeBookingCode && booking.bookingCode === excludeBookingCode)
        return false;

      const bookingDate = this.normalizeDate(booking.date);
      const bookingTime = this.normalizeTime(booking.time);

      return bookingDate === normalizedDate && bookingTime === normalizedTime;
    });
  }

  getBookedSlots(excludeBookingCode = null) {
    return Array.from(this.bookings.values())
      .filter((booking) => {
        if (booking.status !== 'confirmed') return false;
        if (excludeBookingCode && booking.bookingCode === excludeBookingCode)
          return false;
        return true;
      })
      .map((booking) => ({
        date: booking.date,
        time: booking.time,
        bookingCode: booking.bookingCode,
      }));
  }

  isDateFullyBooked(date, excludeBookingCode = null) {
    const normalizedDate = this.normalizeDate(date);
    const bookedSlots = this.getBookedSlots(excludeBookingCode);
    const slotsForDate = bookedSlots.filter(
      (slot) => this.normalizeDate(slot.date) === normalizedDate
    );

    // Assuming 3 slots per day (10:00, 14:00, 16:00)
    const totalSlotsPerDay = 3;
    return slotsForDate.length >= totalSlotsPerDay;
  }

  normalizeDate(date) {
    if (!date) return null;
    if (typeof date === 'string') {
      // Handle various date formats
      const d = new Date(date);
      if (isNaN(d.getTime())) return date;
      return d.toISOString().split('T')[0];
    }
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return date;
  }

  normalizeTime(time) {
    if (!time) return null;
    if (typeof time === 'string') {
      // Convert "2:00 PM" to "14:00" or keep "14:00"
      const timeStr = time.trim().toUpperCase();
      if (timeStr.includes('PM') || timeStr.includes('AM')) {
        const [hour, minute] = timeStr
          .replace(/[AP]M/i, '')
          .split(':')
          .map(Number);
        const isPM = timeStr.includes('PM');
        const hour24 = isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;
        return `${hour24.toString().padStart(2, '0')}:${(minute || 0).toString().padStart(2, '0')}`;
      }
      // Already in 24-hour format
      return timeStr;
    }
    return time;
  }
}

// Singleton instance
export const bookingRepository = new BookingRepository();

// Export functions for backward compatibility
export function createBooking(bookingCode, bookingData) {
  return bookingRepository.create(bookingCode, bookingData);
}

export function getBooking(bookingCode) {
  return bookingRepository.getById(bookingCode);
}

export function updateBooking(bookingCode, updates) {
  return bookingRepository.update(bookingCode, updates);
}

export function cancelBooking(bookingCode) {
  return bookingRepository.cancel(bookingCode);
}

export function getAllBookings() {
  return bookingRepository.findAll();
}

export function findBooking(searchTerm) {
  return bookingRepository.findByCodePattern(searchTerm);
}

export function isSlotBooked(date, time, excludeBookingCode = null) {
  return bookingRepository.isSlotBooked(date, time, excludeBookingCode);
}

export function getBookedSlots(excludeBookingCode = null) {
  return bookingRepository.getBookedSlots(excludeBookingCode);
}

export function isDateFullyBooked(date, excludeBookingCode = null) {
  return bookingRepository.isDateFullyBooked(date, excludeBookingCode);
}

