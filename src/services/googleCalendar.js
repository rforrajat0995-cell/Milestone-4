/**
 * Google Calendar integration service
 * Creates, updates, and deletes calendar events for bookings
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createISTDateTime } from '../utils/istDate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Calendar client
let calendarClient = null;

/**
 * Gets authenticated Google Calendar client
 */
function getCalendarClient() {
  if (calendarClient) {
    return calendarClient;
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH is not set in .env');
  }

  // Resolve path (handle both relative and absolute paths)
  const fullPath = path.isAbsolute(keyPath) 
    ? keyPath 
    : path.join(process.cwd(), keyPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Service account key file not found: ${fullPath}`);
  }

  const key = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  // Authenticate using service account
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

/**
 * Creates a calendar event for a booking
 * @param {Object} bookingData - { bookingCode, topic, selectedSlot }
 * @returns {Promise<Object>} Created event
 */
export async function createCalendarEvent(bookingData) {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    
    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set in .env');
    }

    const { bookingCode, topic, selectedSlot } = bookingData;
    
    // Parse the slot date and time
    const slotDateTime = createISTDateTime(selectedSlot.date, selectedSlot.time);
    const endDateTime = new Date(slotDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 30); // 30-minute slot

    // Format for Google Calendar API (RFC3339)
    const startTime = slotDateTime.toISOString();
    const endTime = endDateTime.toISOString();

    const event = {
      summary: `Advisor Q&A — ${topic} — ${bookingCode}`,
      description: `Booking Code: ${bookingCode}\nTopic: ${topic}\n\nThis is a tentative hold. Please use the secure link to complete your contact details.`,
      start: {
        dateTime: startTime,
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endTime,
        timeZone: 'Asia/Kolkata'
      },
      transparency: 'opaque',
      visibility: 'private',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 } // 30 minutes before
        ]
      }
    };

    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event
    });

    console.log(`[Google Calendar] Created event: ${response.data.id} for booking ${bookingCode}`);
    return response.data;
  } catch (error) {
    console.error('[Google Calendar] Error creating event:', error.message);
    throw error;
  }
}

/**
 * Updates a calendar event for a rescheduled booking
 * @param {string} eventId - Google Calendar event ID
 * @param {Object} bookingData - { bookingCode, topic, selectedSlot }
 * @returns {Promise<Object>} Updated event
 */
export async function updateCalendarEvent(eventId, bookingData) {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    
    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set in .env');
    }

    const { bookingCode, topic, selectedSlot } = bookingData;
    
    // Parse the new slot date and time
    const slotDateTime = createISTDateTime(selectedSlot.date, selectedSlot.time);
    const endDateTime = new Date(slotDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 30); // 30-minute slot

    // Format for Google Calendar API (RFC3339)
    const startTime = slotDateTime.toISOString();
    const endTime = endDateTime.toISOString();

    // First, get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId
    });

    const event = {
      ...existingEvent.data,
      summary: `Advisor Q&A — ${topic} — ${bookingCode}`,
      description: `Booking Code: ${bookingCode}\nTopic: ${topic}\n\nThis is a tentative hold. Please use the secure link to complete your contact details.`,
      start: {
        dateTime: startTime,
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endTime,
        timeZone: 'Asia/Kolkata'
      }
    };

    const response = await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      requestBody: event
    });

    console.log(`[Google Calendar] Updated event: ${eventId} for booking ${bookingCode}`);
    return response.data;
  } catch (error) {
    console.error('[Google Calendar] Error updating event:', error.message);
    throw error;
  }
}

/**
 * Deletes a calendar event for a cancelled booking
 * @param {string} eventId - Google Calendar event ID
 * @returns {Promise<void>}
 */
export async function deleteCalendarEvent(eventId) {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    
    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set in .env');
    }

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId
    });

    console.log(`[Google Calendar] Deleted event: ${eventId}`);
  } catch (error) {
    console.error('[Google Calendar] Error deleting event:', error.message);
    throw error;
  }
}

/**
 * Gets available time slots from Google Calendar
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of busy time slots
 */
export async function getBusySlots(startDate, endDate) {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    
    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set in .env');
    }

    // Use FreeBusy API to get busy slots
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        items: [{ id: calendarId }]
      }
    });

    const busyPeriods = response.data.calendars[calendarId]?.busy || [];
    console.log(`[Google Calendar] Found ${busyPeriods.length} busy periods`);
    return busyPeriods;
  } catch (error) {
    console.error('[Google Calendar] Error getting busy slots:', error.message);
    throw error;
  }
}

