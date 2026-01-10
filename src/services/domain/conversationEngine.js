/**
 * Conversation Engine
 * Main orchestrator for conversation flow
 * This is the core business logic for processing user messages
 */

import { detectIntent, generateResponse, detectSlotSelectionIntent } from '../ai/groqService.js';
import { detectPII, detectInvestmentAdvice, getPIIResponse, getInvestmentAdviceResponse } from '../../utils/guardrails.js';
import { getSession, createSession, updateSession } from '../../repositories/SessionRepository.js';
import { getNextState, STATES } from './dialogStateMachine.js';
import { getMockAvailableSlots } from './mockAvailability.js';
import { generateBookingCode } from '../../utils/bookingCode.js';
import { createBooking, updateBooking, cancelBooking } from '../../repositories/BookingRepository.js';
import {
  handleBookIntent,
  handleRescheduleIntent,
  handleCancelIntent,
  handleAvailabilityIntent,
  extractTimePreferences
} from './intentHandlers.js';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../external/googleCalendar.js';
import { appendBookingToSheet, updateBookingInSheet, markBookingCancelledInSheet } from '../external/googleSheets.js';
import { createBookingEmailDraft, createRescheduleEmailDraft, createCancellationEmailDraft } from '../external/emailService.js';

// Re-export processMessage from the original file for now
// TODO: Refactor conversationEngine.js to use new structure
export { processMessage } from '../../services/conversationEngine.js';

// Create a wrapper for the service pattern
export const conversationEngine = {
  async processMessage(sessionId, userMessage) {
    const { processMessage: originalProcessMessage } = await import('../../services/conversationEngine.js');
    return await originalProcessMessage(sessionId, userMessage);
  }
};
