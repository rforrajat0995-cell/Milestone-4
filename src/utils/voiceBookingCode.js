/**
 * Utility functions for extracting booking codes from voice input
 * Handles speech recognition variations and normalizes spoken codes
 */

import { findBooking, getAllBookings } from '../services/bookingStore.js';

/**
 * Normalizes spoken text to extract booking code
 * Handles variations like "N L dash S U Y R" -> "NL-SUYR"
 */
function normalizeSpokenCode(text) {
  // Convert to uppercase
  let normalized = text.toUpperCase().trim();
  
  // Remove common speech artifacts
  normalized = normalized
    .replace(/\b(AND|THE|A|AN)\b/g, '') // Remove common words
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Handle "dash", "minus", "hyphen" -> "-"
  normalized = normalized
    .replace(/\b(DASH|MINUS|HYPHEN|TO)\b/g, '-')
    .replace(/\s*-\s*/g, '-'); // Normalize dash spacing
  
  // Handle letter pronunciation variations
  // "EN EL" -> "NL", "N L" -> "NL"
  normalized = normalized.replace(/\b(EN|N)\s+(EL|L)\b/g, 'NL');
  normalized = normalized.replace(/\b([A-Z])\s+([A-Z])\b/g, '$1$2'); // Remove spaces between letters
  
  // Remove all spaces
  normalized = normalized.replace(/\s+/g, '');
  
  return normalized;
}

/**
 * Extracts booking code from text using regex
 * Returns the first match in format XX-XXXX
 */
function extractCodeWithRegex(text) {
  // Try exact match first
  const exactMatch = text.match(/\b([A-Z]{2}-[A-Z0-9]{4})\b/);
  if (exactMatch) {
    return exactMatch[1];
  }
  
  // Try normalized version
  const normalized = normalizeSpokenCode(text);
  const normalizedMatch = normalized.match(/([A-Z]{2}-[A-Z0-9]{4})/);
  if (normalizedMatch) {
    return normalizedMatch[1];
  }
  
  // Try pattern without dash
  const noDashMatch = text.match(/\b([A-Z]{2})\s*[-]?\s*([A-Z0-9]{4})\b/);
  if (noDashMatch) {
    return `${noDashMatch[1]}-${noDashMatch[2]}`;
  }
  
  return null;
}

/**
 * Finds booking code using fuzzy matching
 * Tries to match partial codes or similar patterns
 */
function findCodeFuzzy(text) {
  const normalized = normalizeSpokenCode(text);
  
  // Extract potential code parts
  const parts = normalized.match(/([A-Z]{2})[-]?([A-Z0-9]{1,4})/);
  if (parts) {
    const prefix = parts[1];
    const suffix = parts[2].padEnd(4, '0').substring(0, 4); // Pad to 4 chars
    
    // Try to find booking with similar code
    try {
      const allBookings = getAllBookings();
      for (const booking of allBookings) {
        const code = booking.code.toUpperCase();
        if (code.startsWith(prefix) && code.substring(3).startsWith(suffix.substring(0, 2))) {
          return code;
        }
      }
    } catch (error) {
      console.error('[Voice Booking Code] Error getting all bookings:', error);
    }
  }
  
  return null;
}

/**
 * Main function to extract booking code from voice input
 * Tries multiple strategies to find the code
 */
export function extractBookingCodeFromVoice(text) {
  if (!text) return null;
  
  console.log('[Voice Booking Code] Extracting from:', text);
  
  // Strategy 1: Direct regex match
  let code = extractCodeWithRegex(text);
  if (code) {
    console.log('[Voice Booking Code] Found via regex:', code);
    return code;
  }
  
  // Strategy 2: Normalize and try again
  const normalized = normalizeSpokenCode(text);
  code = extractCodeWithRegex(normalized);
  if (code) {
    console.log('[Voice Booking Code] Found via normalization:', code);
    return code;
  }
  
  // Strategy 3: Fuzzy matching with existing bookings
  code = findCodeFuzzy(text);
  if (code) {
    console.log('[Voice Booking Code] Found via fuzzy match:', code);
    return code;
  }
  
  // Strategy 4: Use findBooking for partial matches
  const partialMatch = findBooking(text);
  if (partialMatch) {
    console.log('[Voice Booking Code] Found via partial match:', partialMatch.code);
    return partialMatch.code;
  }
  
  console.log('[Voice Booking Code] No code found');
  return null;
}

/**
 * Validates if a string looks like a booking code
 */
export function isValidBookingCodeFormat(code) {
  if (!code) return false;
  return /^[A-Z]{2}-[A-Z0-9]{4}$/.test(code.toUpperCase());
}

