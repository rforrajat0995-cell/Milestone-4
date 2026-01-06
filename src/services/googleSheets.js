/**
 * Google Sheets integration service
 * Logs booking details, reschedules, and cancellations to a Google Sheet
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Sheets client
let sheetsClient = null;

/**
 * Gets authenticated Google Sheets client
 */
function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Ensures the sheet has headers if it's empty
 */
async function ensureHeaders() {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not set in .env');
    }

    // Check if sheet is empty (read first row)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A1:Z1'
    });

    const values = response.data.values;
    
    // If sheet is empty or doesn't have headers, add them
    if (!values || values.length === 0 || !values[0] || values[0][0] !== 'Booking Code') {
      const headers = [
        'Booking Code',
        'Topic',
        'Date',
        'Time',
        'Status',
        'Created At',
        'Updated At',
        'Cancelled At',
        'Previous Slot',
        'Calendar Event ID'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'A1:J1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      console.log('[Google Sheets] Added headers to sheet');
    }
  } catch (error) {
    // If error is "range not found", the sheet might be empty - that's okay, we'll add headers
    if (error.message.includes('Unable to parse range')) {
      // Sheet is empty, add headers
      const sheets = getSheetsClient();
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      
      const headers = [
        'Booking Code',
        'Topic',
        'Date',
        'Time',
        'Status',
        'Created At',
        'Updated At',
        'Cancelled At',
        'Previous Slot',
        'Calendar Event ID'
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'A1:J1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });
    } else {
      console.error('[Google Sheets] Error ensuring headers:', error.message);
    }
  }
}

/**
 * Appends a booking entry to the Google Sheet
 * @param {Object} bookingData - { bookingCode, topic, selectedSlot, createdAt, calendarEventId }
 * @returns {Promise<void>}
 */
export async function appendBookingToSheet(bookingData) {
  try {
    await ensureHeaders();
    
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not set in .env');
    }

    const { bookingCode, topic, selectedSlot, createdAt, calendarEventId } = bookingData;
    
    const row = [
      bookingCode,
      topic,
      selectedSlot.date,
      selectedSlot.time,
      'confirmed',
      createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      '', // Updated At (empty for new bookings)
      '', // Cancelled At (empty for confirmed bookings)
      '', // Previous Slot (empty for new bookings)
      calendarEventId || '' // Calendar Event ID
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: 'A:J',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    console.log(`[Google Sheets] Appended booking ${bookingCode} to sheet`);
  } catch (error) {
    console.error('[Google Sheets] Error appending booking:', error.message);
    throw error;
  }
}

/**
 * Updates a booking entry in the Google Sheet (for reschedule)
 * @param {string} bookingCode - Booking code to update
 * @param {Object} updateData - { selectedSlot, previousSlot, calendarEventId }
 * @returns {Promise<void>}
 */
export async function updateBookingInSheet(bookingCode, updateData) {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not set in .env');
    }

    // Find the row with this booking code
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A:J'
    });

    const values = response.data.values || [];
    let rowIndex = -1;

    // Find the row (skip header row, so start from index 1)
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === bookingCode) {
        rowIndex = i + 1; // Google Sheets is 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      console.warn(`[Google Sheets] Booking ${bookingCode} not found in sheet, appending instead`);
      // If not found, append as new entry
      await appendBookingToSheet({
        bookingCode,
        topic: updateData.topic || '',
        selectedSlot: updateData.selectedSlot,
        createdAt: new Date(),
        calendarEventId: updateData.calendarEventId
      });
      return;
    }

    // Update the row
    const { selectedSlot, previousSlot, calendarEventId } = updateData;
    const updateRange = `A${rowIndex}:J${rowIndex}`;
    
    // Get current row to preserve other values
    const currentRow = values[rowIndex - 1];
    const updatedRow = [
      currentRow[0], // Booking Code (unchanged)
      currentRow[1], // Topic (unchanged)
      selectedSlot.date, // Date (updated)
      selectedSlot.time, // Time (updated)
      currentRow[4] || 'confirmed', // Status (unchanged)
      currentRow[5], // Created At (unchanged)
      new Date().toISOString(), // Updated At (updated)
      currentRow[7] || '', // Cancelled At (unchanged)
      previousSlot ? `${previousSlot.date} ${previousSlot.time}` : '', // Previous Slot (updated)
      calendarEventId || currentRow[9] || '' // Calendar Event ID (updated)
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [updatedRow]
      }
    });

    console.log(`[Google Sheets] Updated booking ${bookingCode} in sheet`);
  } catch (error) {
    console.error('[Google Sheets] Error updating booking:', error.message);
    throw error;
  }
}

/**
 * Marks a booking as cancelled in the Google Sheet
 * @param {string} bookingCode - Booking code to cancel
 * @returns {Promise<void>}
 */
export async function markBookingCancelledInSheet(bookingCode) {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not set in .env');
    }

    // Find the row with this booking code
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A:J'
    });

    const values = response.data.values || [];
    let rowIndex = -1;

    // Find the row (skip header row)
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === bookingCode) {
        rowIndex = i + 1; // Google Sheets is 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      console.warn(`[Google Sheets] Booking ${bookingCode} not found in sheet`);
      return;
    }

    // Update status and cancelled date
    const currentRow = values[rowIndex - 1];
    const updateRange = `E${rowIndex}:G${rowIndex}`;
    
    const updatedValues = [
      'cancelled', // Status
      currentRow[5] || new Date().toISOString(), // Created At (unchanged)
      new Date().toISOString() // Cancelled At (updated)
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [updatedValues]
      }
    });

    console.log(`[Google Sheets] Marked booking ${bookingCode} as cancelled in sheet`);
  } catch (error) {
    console.error('[Google Sheets] Error marking booking as cancelled:', error.message);
    throw error;
  }
}

