/**
 * Main conversation engine that orchestrates the entire flow
 */

import { detectIntent, generateResponse, detectSlotSelectionIntent } from './groqService.js';
import { detectPII, detectInvestmentAdvice, getPIIResponse, getInvestmentAdviceResponse } from '../utils/guardrails.js';
import { getSession, createSession, updateSession } from './sessionManager.js';
import { getNextState, STATES } from './dialogStateMachine.js';
import { getMockAvailableSlots } from './mockAvailability.js';
import { generateBookingCode } from '../utils/bookingCode.js';
import { createBooking, updateBooking, cancelBooking } from './bookingStore.js';
import {
  handleBookIntent,
  handleRescheduleIntent,
  handleCancelIntent,
  handleAvailabilityIntent,
  extractTimePreferences
} from './intentHandlers.js';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './googleCalendar.js';
import { appendBookingToSheet, updateBookingInSheet, markBookingCancelledInSheet } from './googleSheets.js';
import { createBookingEmailDraft, createRescheduleEmailDraft, createCancellationEmailDraft } from './emailService.js';

/**
 * Processes a user message and returns AI response
 */
export async function processMessage(sessionId, userMessage) {
  // Get or create session
  let session = getSession(sessionId);
  if (!session) {
    session = createSession(sessionId);
  }

  // Check guardrails first
  if (detectPII(userMessage)) {
    const piiResponse = getPIIResponse();
    return {
      message: piiResponse.message,
      session: updateSession(sessionId, {}),
      functionCalls: [],
      debug: { guardrail: 'PII detected' }
    };
  }

  if (detectInvestmentAdvice(userMessage)) {
    const adviceResponse = getInvestmentAdviceResponse();
    return {
      message: adviceResponse.message,
      session: updateSession(sessionId, {}),
      functionCalls: [],
      debug: { guardrail: 'Investment advice detected' }
    };
  }

  // Handle new conversation request after completion
  // Check if we're in a completed state and user wants to start fresh
  if (session && (session.state === STATES.COMPLETED || session.state === STATES.BOOKING_COMPLETE)) {
    const lowerMessage = userMessage.toLowerCase();
    // Check if user wants to start a new booking/cancel/reschedule
    const wantsNewAction = (
      lowerMessage.includes('book') || 
      lowerMessage.includes('reschedule') || 
      lowerMessage.includes('cancel') || 
      lowerMessage.includes('available') ||
      (lowerMessage.includes('new') && (lowerMessage.includes('appointment') || lowerMessage.includes('booking'))) ||
      (lowerMessage.includes('another') && (lowerMessage.includes('appointment') || lowerMessage.includes('booking'))) ||
      lowerMessage.includes('help')
    );
    
    if (wantsNewAction) {
      // Reset session to start fresh
      session = updateSession(sessionId, {
        state: STATES.GREETING,
        intent: null,
        topic: null,
        preferences: null,
        offeredSlots: null,
        selectedSlot: null,
        bookingCode: null,
        bookingCodeToReschedule: null,
        bookingCodeToCancel: null,
        cancellationPending: false
      });
    }
  }

  // Detect intent (only if not already in a flow or if in initial states)
  // Always detect intent if we don't have one, or if we're in initial states
  if (!session.intent || session.state === STATES.GREETING || session.state === STATES.DISCLAIMER) {
    // Don't re-detect if we're already in a specific flow (unless it's a new request)
    if (session.state === STATES.GREETING || session.state === STATES.DISCLAIMER || !session.intent) {
      const intentResult = await detectIntent(userMessage);
      console.log(`[Intent Detection] Message: "${userMessage}" -> Intent: ${intentResult.intent} (confidence: ${intentResult.confidence})`);
      session = updateSession(sessionId, { intent: intentResult.intent });
    }
  }
  
  console.log(`[Routing] Intent: ${session.intent}, State: ${session.state}`);

  // Route to appropriate intent handler
  let responses = [];
  let functionCalls = [];

  switch (session.intent) {
    case 'book':
      responses = await handleBookIntent(session, userMessage);
      break;
    case 'reschedule':
      responses = await handleRescheduleIntent(session, userMessage);
      break;
    case 'cancel':
      responses = handleCancelIntent(session, userMessage);
      break;
    case 'availability':
      responses = handleAvailabilityIntent(session, userMessage);
      break;
    default:
      // Use Groq for general conversation
      const aiResponse = await generateResponse(session, userMessage);
      responses = [{ type: 'general', message: aiResponse }];
  }

  // Process responses and update session state
  const primaryResponse = responses[0];
  let newState = session.state;
  let sessionUpdates = {};

  if (primaryResponse) {
    // Update state based on response type
    switch (primaryResponse.type) {
      case 'greeting':
        newState = getNextState(session.state, 'acknowledge');
        break;
      case 'disclaimer':
        newState = STATES.TOPIC_SELECTION;
        break;
      case 'topic_selected':
        if (primaryResponse.data?.topic) {
          sessionUpdates.topic = primaryResponse.data.topic;
          newState = STATES.TIME_PREFERENCE;
        }
        break;
      case 'topic_confirmed':
        // Legacy support - treat as topic_selected
        if (primaryResponse.data?.topic) {
          sessionUpdates.topic = primaryResponse.data.topic;
          newState = STATES.TIME_PREFERENCE;
        }
        break;
      case 'preferences_collected':
        if (primaryResponse.data?.preferences) {
          sessionUpdates.preferences = primaryResponse.data.preferences;
          const preferences = primaryResponse.data.preferences;
          
          // Check if this is a reschedule flow - if so, exclude the current booking
          const excludeBookingCode = session.bookingCodeToReschedule || null;
          
          // Check if we need to verify day-specific or day+time-specific availability
          const { isDateFullyBooked, isSlotBooked } = await import('./bookingStore.js');
          const { formatISTDate, getISTDayOfWeek, getISTToday } = await import('../utils/istDate.js');
          
          let targetDate = null;
          let isFullyBooked = false;
          let specificSlotBooked = false;
          
          // Determine target date from preferences
          if (preferences.day) {
            const dayLower = preferences.day.toLowerCase();
            const today = getISTToday();
            
            if (dayLower === 'today') {
              targetDate = formatISTDate(today);
            } else if (dayLower === 'tomorrow') {
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              targetDate = formatISTDate(tomorrow);
            } else {
              // Find the next occurrence of the day name
              const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              const targetDayIndex = dayNames.findIndex(d => dayLower.includes(d));
              if (targetDayIndex !== -1) {
                let checkDate = new Date(today);
                let daysToAdd = (targetDayIndex - getISTDayOfWeek(checkDate) + 7) % 7;
                if (daysToAdd === 0) daysToAdd = 7; // If today is that day, get next week
                checkDate.setDate(today.getDate() + daysToAdd);
                targetDate = formatISTDate(checkDate);
              }
            }
          }
          
          // Check if specific time slot is requested and booked
          if (targetDate && preferences.specificHour !== undefined) {
            const timeMap = { 10: '10:00', 14: '14:00', 16: '16:00' };
            const requestedTime = timeMap[preferences.specificHour] || '10:00';
            specificSlotBooked = isSlotBooked(targetDate, requestedTime, excludeBookingCode);
          }
          
          // Check if the entire day is fully booked
          if (targetDate) {
            isFullyBooked = isDateFullyBooked(targetDate, excludeBookingCode);
          }
          
          // Get available slots (exclude current booking if rescheduling)
          const slots = getMockAvailableSlots(preferences, excludeBookingCode);
          const isSundayRequest = slots._isSundayRequest || false;
          const cleanSlots = Array.isArray(slots) ? slots : [];
          
          // Format date for display
          let formattedDate = '';
          if (targetDate) {
            const [year, month, day] = targetDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            formattedDate = dateObj.toLocaleDateString('en-IN', { 
              timeZone: 'Asia/Kolkata',
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          }
          
          if (cleanSlots.length > 0) {
            // Check if the returned slots are for the requested day
            const slotsForRequestedDay = targetDate ? cleanSlots.filter(s => s.date === targetDate) : [];
            
            // If user requested a specific day but no slots for that day are available
            if (targetDate && slotsForRequestedDay.length === 0) {
              // Get next available slots from other days (exclude current booking if rescheduling)
              const allSlots = getMockAvailableSlots({}, excludeBookingCode);
              let nextAvailableSlots = allSlots
                .filter(s => s.date !== targetDate);
              
              // Take up to 2 slots, but ensure we have at least 2 if available
              if (nextAvailableSlots.length >= 2) {
                nextAvailableSlots = nextAvailableSlots.slice(0, 2);
              } else if (nextAvailableSlots.length === 1) {
                // Only 1 slot available, but we still show it
                nextAvailableSlots = nextAvailableSlots.slice(0, 1);
              }
              
              if (nextAvailableSlots.length > 0) {
                const slotOptions = nextAvailableSlots.map((slot, idx) => 
                  `Option ${idx + 1}: ${slot.formatted}`
                ).join('\n');
                
                sessionUpdates.offeredSlots = nextAvailableSlots;
                newState = STATES.SLOT_OFFER;
                
                // Adjust message based on number of slots
                const slotPrompt = nextAvailableSlots.length === 2 
                  ? "Which one would you prefer? (Please say Option 1 or Option 2)"
                  : "Would you like to proceed with this slot? (Please say 'yes' to confirm)";
                
                if (isFullyBooked) {
                  primaryResponse.message = `Sorry, all slots for ${formattedDate} are already booked. Here are the next available slots:\n${slotOptions}\n\n${slotPrompt}`;
                } else if (specificSlotBooked) {
                  const timeMap = { 10: '10:00', 14: '14:00', 16: '16:00' };
                  const requestedTime = timeMap[preferences.specificHour] || '10:00';
                  const timeFormatted = requestedTime === '10:00' ? '10:00 AM' : requestedTime === '14:00' ? '2:00 PM' : '4:00 PM';
                  primaryResponse.message = `Sorry, the slot for ${formattedDate} at ${timeFormatted} is already booked. Here are the next available slots:\n${slotOptions}\n\n${slotPrompt}`;
                } else {
                  primaryResponse.message = `Sorry, I don't have any available slots for ${formattedDate}. Here are the next available slots:\n${slotOptions}\n\n${slotPrompt}`;
                }
              } else {
                // No slots available at all
                newState = STATES.TIME_PREFERENCE;
                primaryResponse.message = `Sorry, all slots for ${formattedDate} are already booked, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`;
              }
            } else {
              // Normal flow - show available slots
              sessionUpdates.offeredSlots = cleanSlots;
              newState = STATES.SLOT_OFFER;
              const slotOptions = cleanSlots.map((slot, idx) => 
                `Option ${idx + 1}: ${slot.formatted}`
              ).join('\n');
              
              let sundayMessage = '';
              if (isSundayRequest) {
                sundayMessage = "Note: We don't have slots available on Sundays. I'm showing you the next available slots instead.\n\n";
              }
              
              if (cleanSlots.length === 1) {
                primaryResponse.message = `${sundayMessage}I have this available slot:\n${slotOptions}\n\nWould you like to proceed with this slot? (Please say 'yes' to confirm or ask for different options)`;
              } else {
                primaryResponse.message = `${sundayMessage}I have these available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`;
              }
            }
          } else {
            // No slots found at all
            newState = STATES.TIME_PREFERENCE;
            
            if (targetDate && isFullyBooked) {
              // Get next available slots (exclude current booking if rescheduling)
              const allSlots = getMockAvailableSlots({}, excludeBookingCode);
              if (allSlots.length > 0) {
                let nextAvailableSlots = allSlots
                  .filter(s => s.date !== targetDate);
                
                // Ensure we get at least 2 slots if available
                if (nextAvailableSlots.length >= 2) {
                  nextAvailableSlots = nextAvailableSlots.slice(0, 2);
                } else if (nextAvailableSlots.length === 1) {
                  nextAvailableSlots = nextAvailableSlots.slice(0, 1);
                }
                
                if (nextAvailableSlots.length > 0) {
                  const slotOptions = nextAvailableSlots.map((slot, idx) => 
                    `Option ${idx + 1}: ${slot.formatted}`
                  ).join('\n');
                  
                  sessionUpdates.offeredSlots = nextAvailableSlots;
                  newState = STATES.SLOT_OFFER;
                  
                  // Adjust message based on number of slots
                  const slotPrompt = nextAvailableSlots.length === 2 
                    ? "Which one would you prefer? (Please say Option 1 or Option 2)"
                    : "Would you like to proceed with this slot? (Please say 'yes' to confirm)";
                  
                  primaryResponse.message = `Sorry, all slots for ${formattedDate} are already booked. Here are the next available slots:\n${slotOptions}\n\n${slotPrompt}`;
                } else {
                  primaryResponse.message = `Sorry, all slots for ${formattedDate} are already booked, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`;
                }
              } else {
                primaryResponse.message = `Sorry, all slots for ${formattedDate} are already booked, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`;
              }
            } else {
              let noSlotsMessage = `I don't have any slots available for ${preferences.day || 'that day'} ${preferences.time ? 'at ' + preferences.time : ''}.`;
              
              if (isSundayRequest || preferences.day?.toLowerCase().includes('sunday')) {
                noSlotsMessage = "We don't have slots available on Sundays. " + noSlotsMessage.replace(/for .*? at/, 'for that day at');
              }
              
              primaryResponse.message = `${noSlotsMessage} Would you like to try a different day or time? Please let me know your preference.`;
            }
          }
        } else {
          newState = getNextState(session.state, 'preferences_collected');
        }
        break;
      case 'slots_offered':
        if (primaryResponse.data?.slots) {
          sessionUpdates.offeredSlots = primaryResponse.data.slots;
          newState = STATES.SLOT_OFFER;
        }
        break;
      case 'booking_confirmed':
        if (primaryResponse.data?.bookingCode) {
          sessionUpdates.bookingCode = primaryResponse.data.bookingCode;
          sessionUpdates.selectedSlot = session.offeredSlots?.[0]; // Simplified
          newState = getNextState(session.state, 'confirmed');
          functionCalls.push('create_calendar_hold');
          functionCalls.push('append_to_sheet');
          functionCalls.push('create_email_draft');
        }
        break;
      case 'no_slots':
        newState = getNextState(session.state, 'no_slots_available');
        functionCalls.push('create_waitlist_hold');
        functionCalls.push('create_email_draft');
        break;
      case 'reschedule_request':
        newState = STATES.RESCHEDULE;
        break;
      case 'reschedule_booking_found':
        if (primaryResponse.data?.bookingCode) {
          sessionUpdates.bookingCodeToReschedule = primaryResponse.data.bookingCode;
          newState = STATES.RESCHEDULE;
        }
        break;
      case 'reschedule_slots_offered':
        if (primaryResponse.data?.slots) {
          sessionUpdates.offeredSlots = primaryResponse.data.slots;
          newState = STATES.SLOT_OFFER;
        }
        break;
      case 'reschedule_confirmed':
        newState = STATES.COMPLETED;
        functionCalls.push('update_calendar_hold');
        functionCalls.push('log_reschedule');
        functionCalls.push('create_reschedule_email_draft');
        // Add prompt for next action
        if (primaryResponse.message) {
          primaryResponse.message += '\n\nIs there anything else I can help you with? You can book another appointment, cancel a booking, or check available slots.';
        }
        break;
      case 'slot_conflict':
        if (primaryResponse.data?.slots) {
          sessionUpdates.offeredSlots = primaryResponse.data.slots;
          newState = STATES.SLOT_OFFER;
        } else {
          newState = STATES.TIME_PREFERENCE;
        }
        break;
      case 'reschedule_slot_conflict':
        if (primaryResponse.data?.slots) {
          sessionUpdates.offeredSlots = primaryResponse.data.slots;
          newState = STATES.SLOT_OFFER;
        } else {
          newState = STATES.TIME_PREFERENCE;
        }
        break;
      case 'cancellation_request':
        newState = STATES.CANCELLATION;
        break;
      case 'cancellation_confirmation':
        if (primaryResponse.data?.bookingCode) {
          sessionUpdates.cancellationPending = true;
          sessionUpdates.bookingCodeToCancel = primaryResponse.data.bookingCode;
          newState = STATES.CANCELLATION;
        }
        break;
      case 'cancellation_confirmed':
        newState = STATES.COMPLETED;
        // MCP integrations will be handled after switch statement
        break;
      case 'availability_shown':
        newState = STATES.COMPLETED;
        break;
    }
  }

  // Update session with new state and data
  sessionUpdates.state = newState;
  const updatedSession = updateSession(sessionId, sessionUpdates);
  
  // If we just transitioned to SLOT_OFFER from preferences, don't process slot selection yet
  // The user needs to see the slots first before selecting
  const justTransitionedToSlotOffer = (session.state === STATES.TIME_PREFERENCE && newState === STATES.SLOT_OFFER);

  // Handle booking confirmation MCP integrations
  if (primaryResponse?.type === 'booking_confirmed') {
    console.log('[DEBUG] Processing booking_confirmed response');
    const { bookingCode, bookingData } = primaryResponse.data || {};
    console.log('[DEBUG] bookingCode:', bookingCode, 'bookingData:', bookingData);
    const finalSession = getSession(sessionId);
    const functionCalls = [];
    
    if (bookingCode && bookingData) {
      console.log('[DEBUG] Calling MCP services for booking:', bookingCode);
      console.log('[DEBUG] bookingData.selectedSlot:', JSON.stringify(bookingData.selectedSlot, null, 2));
      
      // Validate selectedSlot structure
      if (!bookingData.selectedSlot || !bookingData.selectedSlot.date || !bookingData.selectedSlot.time) {
        console.error('[ERROR] Invalid selectedSlot structure:', bookingData.selectedSlot);
        return {
          message: primaryResponse.message.replace('[MCP integrations will be created...]', '⚠ Error: Invalid slot data. Please try booking again.'),
          session: updateSession(sessionId, { 
            bookingCode,
            state: STATES.BOOKING_COMPLETE 
          }),
          functionCalls: ['error_invalid_slot'],
          debug: { state: STATES.BOOKING_COMPLETE, bookingCode, error: 'invalid_slot_structure' }
        };
      }
      
      // CRITICAL: Check if slot is still available before creating booking
      const { isSlotBooked, isDateFullyBooked } = await import('./bookingStore.js');
      const slotIsBooked = isSlotBooked(bookingData.selectedSlot.date, bookingData.selectedSlot.time);
      console.log(`[Slot Conflict Check] Before creating booking ${bookingCode}: slot ${bookingData.selectedSlot.date} ${bookingData.selectedSlot.time} is booked: ${slotIsBooked}`);
      
      if (slotIsBooked) {
        console.log(`[Slot Conflict Check] Slot conflict detected! Slot ${bookingData.selectedSlot.date} ${bookingData.selectedSlot.time} is already booked.`);
        // Slot was booked in the meantime - show next available slots
        const { getMockAvailableSlots } = await import('./mockAvailability.js');
        const allSlots = getMockAvailableSlots(finalSession.preferences || {});
        
        // Filter out the booked slot
        const nextAvailableSlots = allSlots
          .filter(s => !(s.date === bookingData.selectedSlot.date && s.time === bookingData.selectedSlot.time))
          .slice(0, 2);
        
        if (nextAvailableSlots.length > 0) {
          const slotOptions = nextAvailableSlots.map((slot, idx) => 
            `Option ${idx + 1}: ${slot.formatted}`
          ).join('\n');
          
          updateSession(sessionId, { 
            offeredSlots: nextAvailableSlots,
            selectedSlot: null,
            state: STATES.SLOT_OFFER 
          });
          
          return {
            message: `Sorry, that slot (${bookingData.selectedSlot.formatted}) was just booked by someone else. Here are some other available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
            session: getSession(sessionId),
            functionCalls: [],
            debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_on_booking_creation' }
          };
        } else {
          return {
            message: `Sorry, that slot (${bookingData.selectedSlot.formatted}) was just booked by someone else, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`,
            session: updateSession(sessionId, { 
              state: STATES.TIME_PREFERENCE,
              selectedSlot: null
            }),
            functionCalls: [],
            debug: { state: STATES.TIME_PREFERENCE, action: 'slot_conflict_no_alternatives' }
          };
        }
      }
      
      let calendarEventId = null;
      
      try {
        // Create calendar event
        console.log('[DEBUG] Creating calendar event...');
        const calendarEvent = await createCalendarEvent({
          bookingCode,
          topic: bookingData.topic,
          selectedSlot: bookingData.selectedSlot
        });
        calendarEventId = calendarEvent.id;
        functionCalls.push('create_calendar_hold');
        console.log(`[MCP] Calendar event created: ${calendarEventId}`);
      } catch (error) {
        console.error('[MCP] Error creating calendar event:', error.message);
        functionCalls.push('create_calendar_hold_failed');
      }
      
      try {
        // Append to Google Sheet
        await appendBookingToSheet({
          bookingCode,
          topic: bookingData.topic,
          selectedSlot: bookingData.selectedSlot,
          createdAt: new Date(),
          calendarEventId
        });
        functionCalls.push('append_to_sheet');
        console.log(`[MCP] Booking logged to sheet: ${bookingCode}`);
      } catch (error) {
        console.error('[MCP] Error logging to sheet:', error.message);
        functionCalls.push('append_to_sheet_failed');
      }
      
      try {
        // Create email draft
        const secureLink = `https://booking.example.com/${bookingCode}`;
        await createBookingEmailDraft({
          bookingCode,
          topic: bookingData.topic,
          selectedSlot: bookingData.selectedSlot,
          secureLink
        });
        functionCalls.push('create_email_draft');
        console.log(`[MCP] Email draft created: ${bookingCode}`);
      } catch (error) {
        console.error('[MCP] Error creating email draft:', error.message);
        functionCalls.push('create_email_draft_failed');
      }
      
      // Store booking with calendar event ID
      createBooking(bookingCode, {
        ...bookingData,
        calendarEventId
      });
      
      // Build status message
      const statusMessages = [];
      if (functionCalls.includes('create_calendar_hold')) {
        statusMessages.push('✓ Calendar hold created');
      } else if (functionCalls.includes('create_calendar_hold_failed')) {
        statusMessages.push('⚠ Calendar hold creation failed');
      }
      if (functionCalls.includes('append_to_sheet')) {
        statusMessages.push('✓ Entry logged to sheet');
      } else if (functionCalls.includes('append_to_sheet_failed')) {
        statusMessages.push('⚠ Sheet logging failed');
      }
      if (functionCalls.includes('create_email_draft')) {
        statusMessages.push('✓ Email draft created');
      } else if (functionCalls.includes('create_email_draft_failed')) {
        statusMessages.push('⚠ Email draft creation failed');
      }
      
      let message = primaryResponse.message;
      if (statusMessages.length > 0) {
        message = message.replace('[MCP integrations will be created...]', statusMessages.join('\n'));
      }
      
      return {
        message,
        session: updateSession(sessionId, { 
          bookingCode,
          state: STATES.BOOKING_COMPLETE 
        }),
        functionCalls,
        debug: { state: STATES.BOOKING_COMPLETE, bookingCode, calendarEventId }
      };
    }
  }
  
  // Handle slot selection (check updated session state)
  // But first check if the intent handler already processed it (for reschedule)
  if (primaryResponse?.type === 'reschedule_confirmed') {
    // Handle MCP integrations for reschedule
    const { bookingCode, booking, newSlot, previousSlot } = primaryResponse.data || {};
    const finalSession = getSession(sessionId);
    const functionCalls = [];
    
    if (booking && booking.calendarEventId && newSlot) {
      try {
        // Update calendar event
        await updateCalendarEvent(booking.calendarEventId, {
          bookingCode,
          topic: booking.topic,
          selectedSlot: newSlot
        });
        functionCalls.push('update_calendar_hold');
        console.log(`[MCP] Calendar event updated: ${booking.calendarEventId}`);
      } catch (error) {
        console.error('[MCP] Error updating calendar event:', error.message);
        functionCalls.push('update_calendar_hold_failed');
      }
      
      try {
        // Update Google Sheet
        await updateBookingInSheet(bookingCode, {
          selectedSlot: newSlot,
          previousSlot: previousSlot,
          calendarEventId: booking.calendarEventId,
          topic: booking.topic
        });
        functionCalls.push('log_reschedule');
        console.log(`[MCP] Reschedule logged to sheet: ${bookingCode}`);
      } catch (error) {
        console.error('[MCP] Error logging reschedule to sheet:', error.message);
        functionCalls.push('log_reschedule_failed');
      }
      
      try {
        // Create reschedule email draft
        await createRescheduleEmailDraft({
          bookingCode,
          topic: booking.topic,
          newSlot: newSlot,
          previousSlot: previousSlot
        });
        functionCalls.push('create_reschedule_email_draft');
        console.log(`[MCP] Reschedule email draft created: ${bookingCode}`);
      } catch (error) {
        console.error('[MCP] Error creating reschedule email draft:', error.message);
        functionCalls.push('create_reschedule_email_draft_failed');
      }
      
      // Update booking in store
      updateBooking(bookingCode, {
        selectedSlot: newSlot,
        previousSlot: previousSlot
      });
    }
    
    // Build status message
    const statusMessages = [];
    if (functionCalls.includes('update_calendar_hold')) {
      statusMessages.push('✓ Calendar hold updated');
    } else if (functionCalls.includes('update_calendar_hold_failed')) {
      statusMessages.push('⚠ Calendar update failed');
    }
    if (functionCalls.includes('log_reschedule')) {
      statusMessages.push('✓ Reschedule logged');
    } else if (functionCalls.includes('log_reschedule_failed')) {
      statusMessages.push('⚠ Sheet logging failed');
    }
    if (functionCalls.includes('create_reschedule_email_draft')) {
      statusMessages.push('✓ Reschedule email draft created');
    } else if (functionCalls.includes('create_reschedule_email_draft_failed')) {
      statusMessages.push('⚠ Email draft creation failed');
    }
    
    let message = primaryResponse.message;
    if (statusMessages.length > 0) {
      message = message.replace('[MCP integrations will be updated...]', statusMessages.join('\n'));
    }
    message += '\n\nIs there anything else I can help you with? You can book another appointment, cancel a booking, or check available slots.';
    
    return {
      message,
      session: updateSession(sessionId, { state: STATES.COMPLETED }),
      functionCalls,
      debug: { state: STATES.COMPLETED, bookingCode }
    };
  }
  
  // Handle cancellation MCP integrations
  if (primaryResponse?.type === 'cancellation_confirmed') {
    console.log('[DEBUG] Processing cancellation_confirmed response');
    const { bookingCode, booking } = primaryResponse.data || {};
    console.log('[DEBUG] bookingCode:', bookingCode, 'booking:', booking);
    const functionCalls = [];
    
    if (!booking) {
      console.error('[ERROR] Booking not found for cancellation:', bookingCode);
      return {
        message: primaryResponse.message.replace('[MCP integrations will be updated...]', '⚠ Error: Booking not found.'),
        session: updateSession(sessionId, { state: STATES.COMPLETED }),
        functionCalls: ['error_booking_not_found'],
        debug: { state: STATES.COMPLETED, bookingCode, error: 'booking_not_found' }
      };
    }
    
    // Proceed with cancellation even if calendarEventId is missing (for old bookings)
    if (booking.calendarEventId) {
      console.log('[DEBUG] Found calendarEventId:', booking.calendarEventId);
      try {
        // Delete calendar event
        await deleteCalendarEvent(booking.calendarEventId);
        functionCalls.push('remove_calendar_hold');
        console.log(`[MCP] Calendar event deleted: ${booking.calendarEventId}`);
      } catch (error) {
        console.error('[MCP] Error deleting calendar event:', error.message);
        functionCalls.push('remove_calendar_hold_failed');
      }
    } else {
      console.warn('[WARN] No calendarEventId found for booking:', bookingCode, '- skipping calendar deletion');
    }
    
    // Always try to update sheet and send email, even if calendarEventId is missing
    try {
      // Mark as cancelled in Google Sheet
      console.log('[DEBUG] Marking booking as cancelled in sheet...');
      await markBookingCancelledInSheet(bookingCode);
      functionCalls.push('log_cancellation');
      console.log(`[MCP] Cancellation logged to sheet: ${bookingCode}`);
    } catch (error) {
      console.error('[MCP] Error logging cancellation to sheet:', error.message);
      functionCalls.push('log_cancellation_failed');
    }
    
    try {
      // Create cancellation email draft
      console.log('[DEBUG] Creating cancellation email draft...');
      await createCancellationEmailDraft({
        bookingCode,
        topic: booking.topic,
        originalSlot: booking.selectedSlot
      });
      functionCalls.push('create_cancellation_email_draft');
      console.log(`[MCP] Cancellation email draft created: ${bookingCode}`);
    } catch (error) {
      console.error('[MCP] Error creating cancellation email draft:', error.message);
      functionCalls.push('create_cancellation_email_draft_failed');
    }
    
    // Cancel booking in store (do this last, after MCP calls)
    console.log('[DEBUG] Cancelling booking in store...');
    cancelBooking(bookingCode);
    
    // Build status message
    const statusMessages = [];
    if (functionCalls.includes('remove_calendar_hold')) {
      statusMessages.push('✓ Calendar hold removed');
    } else if (functionCalls.includes('remove_calendar_hold_failed')) {
      statusMessages.push('⚠ Calendar deletion failed');
    }
    if (functionCalls.includes('log_cancellation')) {
      statusMessages.push('✓ Cancellation logged');
    } else if (functionCalls.includes('log_cancellation_failed')) {
      statusMessages.push('⚠ Sheet logging failed');
    }
    if (functionCalls.includes('create_cancellation_email_draft')) {
      statusMessages.push('✓ Cancellation email draft created');
    } else if (functionCalls.includes('create_cancellation_email_draft_failed')) {
      statusMessages.push('⚠ Email draft creation failed');
    }
    
    let message = primaryResponse.message;
    if (statusMessages.length > 0) {
      message = message.replace('[MCP integrations will be updated...]', statusMessages.join('\n'));
    }
    message += '\n\nIs there anything else I can help you with? You can book a new appointment, reschedule, or check available slots.';
    
    return {
      message,
      session: updateSession(sessionId, { state: STATES.COMPLETED }),
      functionCalls,
      debug: { state: STATES.COMPLETED, bookingCode }
    };
  }
  
  const finalSession = getSession(sessionId);
  
  // IMPORTANT: Only process slot selection if we're actually in SLOT_OFFER state
  // AND we have offered slots already. If user is providing preferences, let the intent handler process it.
  // Also check if the message contains time preferences - if so, don't treat it as slot selection
  // And don't process if we just transitioned to SLOT_OFFER (user needs to see options first)
  const timePreferencePattern = /\b(\d{1,2})\s*(am|pm)\b|\b(morning|afternoon|evening)\b/i;
  const isTimePreference = timePreferencePattern.test(userMessage);
  
  if (finalSession && finalSession.state === STATES.SLOT_OFFER && 
      finalSession.offeredSlots && finalSession.offeredSlots.length > 0 &&
      !finalSession.bookingCodeToReschedule && !isTimePreference && !justTransitionedToSlotOffer) {
    
    // Use Groq to understand user's intent
    const slotIntent = await detectSlotSelectionIntent(userMessage);
    
    // Check if user wants different slots
    if (slotIntent.wantsDifferentSlots) {
      // Generate more slots or ask for different preferences
      const allSlots = getMockAvailableSlots(finalSession.preferences);
      // Filter out already shown slots
      const newSlots = allSlots.filter(s => 
        !finalSession.offeredSlots?.some(os => 
          os.date === s.date && os.time === s.time
        )
      );
      
      if (newSlots.length > 0) {
        // Show new slots (up to 2)
        const additionalSlots = newSlots.slice(0, 2);
        const updatedSlots = [...(finalSession.offeredSlots || []), ...additionalSlots];
        const slotOptions = additionalSlots.map((slot, idx) => 
          `Option ${finalSession.offeredSlots.length + idx + 1}: ${slot.formatted}`
        ).join('\n');
        
        updateSession(sessionId, { offeredSlots: updatedSlots });
        
        return {
          message: `I understand you'd like to see different options. Here are some additional slots:\n${slotOptions}\n\nWhich one would you prefer?`,
          session: getSession(sessionId),
          functionCalls: [],
          debug: { state: STATES.SLOT_OFFER, action: 'showing_different_slots' }
        };
      } else {
        // No more slots available, ask for different preferences
        return {
          message: "I don't have any other slots matching your current preferences. Would you like to try a different day or time? Please let me know your new preference.",
          session: updateSession(sessionId, { state: STATES.TIME_PREFERENCE }),
          functionCalls: [],
          debug: { state: STATES.TIME_PREFERENCE }
        };
      }
    }
    
    // Check if user is selecting a slot
    if (slotIntent.selectedSlot) {
      const slotIndex = slotIntent.selectedSlot - 1; // Convert to 0-based index
      const selectedSlot = finalSession.offeredSlots?.[slotIndex];
      if (selectedSlot) {
        // Check if this slot is already booked (exclude reschedule booking if applicable)
        const { isSlotBooked, isDateFullyBooked } = await import('./bookingStore.js');
        const excludeBookingCode = finalSession.bookingCodeToReschedule || null;
        if (isSlotBooked(selectedSlot.date, selectedSlot.time, excludeBookingCode)) {
          // Check if all slots for that day are booked
          if (isDateFullyBooked(selectedSlot.date, excludeBookingCode)) {
            // All slots for that day are booked - show next available slots from other days
            const { getMockAvailableSlots } = await import('./mockAvailability.js');
            const allAvailableSlots = getMockAvailableSlots({}, excludeBookingCode);
            
            // Filter out slots from the fully booked date
            const nextAvailableSlots = allAvailableSlots
              .filter(s => s.date !== selectedSlot.date)
              .slice(0, 2);
            
            if (nextAvailableSlots.length > 0) {
              const slotOptions = nextAvailableSlots.map((slot, idx) => 
                `Option ${idx + 1}: ${slot.formatted}`
              ).join('\n');
              
              // Format the date for display
              const [year, month, day] = selectedSlot.date.split('-').map(Number);
              const dateObj = new Date(year, month - 1, day);
              const formattedDate = dateObj.toLocaleDateString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
              
              updateSession(sessionId, { 
                offeredSlots: nextAvailableSlots,
                preferences: {} // Clear preferences to allow any slot
              });
              
              return {
                message: `Sorry, all slots for ${formattedDate} are already booked. Here are the next available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
                session: getSession(sessionId),
                functionCalls: [],
                debug: { state: STATES.SLOT_OFFER, action: 'date_fully_booked' }
              };
            } else {
              // No other slots available at all
              return {
                message: `Sorry, all slots for ${selectedSlot.date} are already booked, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your new preference.`,
                session: updateSession(sessionId, { state: STATES.TIME_PREFERENCE }),
                functionCalls: [],
                debug: { state: STATES.TIME_PREFERENCE, action: 'date_fully_booked_no_alternatives' }
              };
            }
          } else {
            // Only this specific slot is booked - show other slots from the same day
            const { getMockAvailableSlots } = await import('./mockAvailability.js');
            const allSlots = getMockAvailableSlots(finalSession.preferences, excludeBookingCode);
            
            // Get slots from the same date
            const sameDaySlots = allSlots.filter(s => s.date === selectedSlot.date);
            
            if (sameDaySlots.length > 0) {
              // Show other available slots from the same day
              const slotOptions = sameDaySlots.map((slot, idx) => 
                `Option ${idx + 1}: ${slot.formatted}`
              ).join('\n');
              
              updateSession(sessionId, { offeredSlots: sameDaySlots });
              
              return {
                message: `Sorry, that slot (${selectedSlot.formatted}) is already booked. Here are other available slots for the same day:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
                session: getSession(sessionId),
                functionCalls: [],
                debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_same_day' }
              };
            } else {
              // No other slots available for that day - show next available from other days
              const nextAvailableSlots = allSlots
                .filter(s => s.date !== selectedSlot.date)
                .slice(0, 2);
              
              if (nextAvailableSlots.length > 0) {
                const slotOptions = nextAvailableSlots.map((slot, idx) => 
                  `Option ${idx + 1}: ${slot.formatted}`
                ).join('\n');
                
                updateSession(sessionId, { offeredSlots: nextAvailableSlots });
                
                return {
                  message: `Sorry, that slot (${selectedSlot.formatted}) is already booked, and there are no other slots available for that day. Here are the next available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
                  session: getSession(sessionId),
                  functionCalls: [],
                  debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_next_day' }
                };
              } else {
                // No other slots available at all
                return {
                  message: `Sorry, that slot (${selectedSlot.formatted}) is already booked, and I don't have any other available slots matching your preferences right now. Would you like to try a different day or time? Please let me know your new preference.`,
                  session: updateSession(sessionId, { state: STATES.TIME_PREFERENCE }),
                  functionCalls: [],
                  debug: { state: STATES.TIME_PREFERENCE, action: 'slot_conflict_no_alternatives' }
                };
              }
            }
          }
        }
        
        // Slot is available - proceed with confirmation
        const confirmedSession = updateSession(sessionId, { selectedSlot, state: STATES.CONFIRMATION });
        return {
          message: `You selected: ${selectedSlot.formatted}. Please confirm to proceed with this booking.`,
          session: confirmedSession,
          functionCalls: [],
          debug: { state: STATES.CONFIRMATION }
        };
      }
    }
    
    // Fallback: check for explicit slot selection patterns
    // Be careful not to match time preferences like "2 pm" or "1 pm"
    const timePattern = /\b(\d{1,2})\s*(am|pm)\b/i;
    const hasTimePreference = timePattern.test(userMessage);
    
    if (!hasTimePreference && (userMessage.includes('option 1') || userMessage.includes('option 2') || userMessage.match(/\b[12]\b/))) {
      const slotIndex = userMessage.includes('option 1') || userMessage.match(/\b1\b/) ? 0 : 1;
      const selectedSlot = finalSession.offeredSlots?.[slotIndex];
      if (selectedSlot) {
        // Check if this slot is already booked (exclude reschedule booking if applicable)
        const { isSlotBooked, isDateFullyBooked } = await import('./bookingStore.js');
        const excludeBookingCode = finalSession.bookingCodeToReschedule || null;
        console.log(`[Slot Conflict Check - Fallback] Checking slot: ${selectedSlot.date} ${selectedSlot.time}, excludeBookingCode: ${excludeBookingCode}`);
        const slotIsBooked = isSlotBooked(selectedSlot.date, selectedSlot.time, excludeBookingCode);
        console.log(`[Slot Conflict Check - Fallback] Slot is booked: ${slotIsBooked}`);
        if (slotIsBooked) {
          // Check if all slots for that day are booked
          const dateFullyBooked = isDateFullyBooked(selectedSlot.date, excludeBookingCode);
          console.log(`[Slot Conflict Check - Fallback] Date fully booked: ${dateFullyBooked} for date: ${selectedSlot.date}`);
          if (dateFullyBooked) {
            // All slots for that day are booked - show next available slots from other days
            const { getMockAvailableSlots } = await import('./mockAvailability.js');
            const allAvailableSlots = getMockAvailableSlots({}, excludeBookingCode);
            
            // Filter out slots from the fully booked date
            const nextAvailableSlots = allAvailableSlots
              .filter(s => s.date !== selectedSlot.date)
              .slice(0, 2);
            
            if (nextAvailableSlots.length > 0) {
              const slotOptions = nextAvailableSlots.map((slot, idx) => 
                `Option ${idx + 1}: ${slot.formatted}`
              ).join('\n');
              
              // Format the date for display
              const [year, month, day] = selectedSlot.date.split('-').map(Number);
              const dateObj = new Date(year, month - 1, day);
              const formattedDate = dateObj.toLocaleDateString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
              
              updateSession(sessionId, { 
                offeredSlots: nextAvailableSlots,
                preferences: {} // Clear preferences to allow any slot
              });
              
              return {
                message: `Sorry, all slots for ${formattedDate} are already booked. Here are the next available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
                session: getSession(sessionId),
                functionCalls: [],
                debug: { state: STATES.SLOT_OFFER, action: 'date_fully_booked' }
              };
            } else {
              // No other slots available at all
              return {
                message: `Sorry, all slots for ${selectedSlot.date} are already booked, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your new preference.`,
                session: updateSession(sessionId, { state: STATES.TIME_PREFERENCE }),
                functionCalls: [],
                debug: { state: STATES.TIME_PREFERENCE, action: 'date_fully_booked_no_alternatives' }
              };
            }
          } else {
            // Only this specific slot is booked - show other slots from the same day
            const { getMockAvailableSlots } = await import('./mockAvailability.js');
            const allSlots = getMockAvailableSlots(finalSession.preferences, excludeBookingCode);
            
            // Get slots from the same date
            const sameDaySlots = allSlots.filter(s => s.date === selectedSlot.date);
            
            if (sameDaySlots.length > 0) {
              // Show other available slots from the same day
              const slotOptions = sameDaySlots.map((slot, idx) => 
                `Option ${idx + 1}: ${slot.formatted}`
              ).join('\n');
              
              updateSession(sessionId, { offeredSlots: sameDaySlots });
              
              return {
                message: `Sorry, that slot (${selectedSlot.formatted}) is already booked. Here are other available slots for the same day:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
                session: getSession(sessionId),
                functionCalls: [],
                debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_same_day' }
              };
            } else {
              // No other slots available for that day - show next available from other days
              const nextAvailableSlots = allSlots
                .filter(s => s.date !== selectedSlot.date)
                .slice(0, 2);
              
              if (nextAvailableSlots.length > 0) {
                const slotOptions = nextAvailableSlots.map((slot, idx) => 
                  `Option ${idx + 1}: ${slot.formatted}`
                ).join('\n');
                
                updateSession(sessionId, { offeredSlots: nextAvailableSlots });
                
                return {
                  message: `Sorry, that slot (${selectedSlot.formatted}) is already booked, and there are no other slots available for that day. Here are the next available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
                  session: getSession(sessionId),
                  functionCalls: [],
                  debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_next_day' }
                };
              } else {
                // No other slots available at all
                return {
                  message: `Sorry, that slot (${selectedSlot.formatted}) is already booked, and I don't have any other available slots matching your preferences right now. Would you like to try a different day or time? Please let me know your new preference.`,
                  session: updateSession(sessionId, { state: STATES.TIME_PREFERENCE }),
                  functionCalls: [],
                  debug: { state: STATES.TIME_PREFERENCE, action: 'slot_conflict_no_alternatives' }
                };
              }
            }
          }
        }
        
        // Slot is available - proceed with confirmation
        const confirmedSession = updateSession(sessionId, { selectedSlot, state: STATES.CONFIRMATION });
        return {
          message: `You selected: ${selectedSlot.formatted}. Please confirm to proceed with this booking.`,
          session: confirmedSession,
          functionCalls: [],
          debug: { state: STATES.CONFIRMATION }
        };
      }
    }
  }

  // Handle booking confirmation
  if (finalSession && finalSession.state === STATES.CONFIRMATION && 
      (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('confirm'))) {
    // Double-check that the slot is still available (in case it was booked between selection and confirmation)
    const { isSlotBooked: checkSlotBooked } = await import('./bookingStore.js');
    if (finalSession.selectedSlot && checkSlotBooked(finalSession.selectedSlot.date, finalSession.selectedSlot.time)) {
      // Slot was booked in the meantime - offer new slots
      const { getMockAvailableSlots } = await import('./mockAvailability.js');
      const newSlots = getMockAvailableSlots(finalSession.preferences);
      
      if (newSlots.length > 0) {
        const updatedSlots = newSlots.slice(0, 2);
        const slotOptions = updatedSlots.map((slot, idx) => 
          `Option ${idx + 1}: ${slot.formatted}`
        ).join('\n');
        
        updateSession(sessionId, { 
          offeredSlots: updatedSlots,
          selectedSlot: null,
          state: STATES.SLOT_OFFER 
        });
        
        return {
          message: `Sorry, that slot (${finalSession.selectedSlot.formatted}) was just booked by someone else. Here are some other available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
          session: getSession(sessionId),
          functionCalls: [],
          debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_on_confirm' }
        };
      } else {
        return {
          message: `Sorry, that slot (${finalSession.selectedSlot.formatted}) was just booked by someone else, and I don't have any other available slots matching your preferences right now. Would you like to try a different day or time? Please let me know your new preference.`,
          session: updateSession(sessionId, { 
            selectedSlot: null,
            state: STATES.TIME_PREFERENCE 
          }),
          functionCalls: [],
          debug: { state: STATES.TIME_PREFERENCE, action: 'slot_conflict_on_confirm_no_alternatives' }
        };
      }
    }
    
    const bookingCode = generateBookingCode();
    
    // Store the booking
    const bookingData = {
      topic: finalSession.topic,
      selectedSlot: finalSession.selectedSlot,
      preferences: finalSession.preferences
    };
    
    // CRITICAL: Check if slot is still available before creating booking
    const { isSlotBooked: checkSlotBookedFallback } = await import('./bookingStore.js');
    const slotIsBooked = checkSlotBookedFallback(finalSession.selectedSlot.date, finalSession.selectedSlot.time);
    console.log(`[Slot Conflict Check - Fallback] Before creating booking ${bookingCode}: slot ${finalSession.selectedSlot.date} ${finalSession.selectedSlot.time} is booked: ${slotIsBooked}`);
    
    if (slotIsBooked) {
      console.log(`[Slot Conflict Check - Fallback] Slot conflict detected! Showing alternatives.`);
      // Slot was booked in the meantime - offer new slots
      const { getMockAvailableSlots } = await import('./mockAvailability.js');
      const newSlots = getMockAvailableSlots(finalSession.preferences);
      
      if (newSlots.length > 0) {
        const updatedSlots = newSlots.slice(0, 2);
        const slotOptions = updatedSlots.map((slot, idx) => 
          `Option ${idx + 1}: ${slot.formatted}`
        ).join('\n');
        
        updateSession(sessionId, { 
          offeredSlots: updatedSlots,
          selectedSlot: null,
          state: STATES.SLOT_OFFER 
        });
        
        return {
          message: `Sorry, that slot (${finalSession.selectedSlot.formatted}) was just booked by someone else. Here are some other available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
          session: getSession(sessionId),
          functionCalls: [],
          debug: { state: STATES.SLOT_OFFER, action: 'slot_conflict_on_confirm_fallback' }
        };
      } else {
        return {
          message: `Sorry, that slot (${finalSession.selectedSlot.formatted}) was just booked by someone else, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`,
          session: updateSession(sessionId, { 
            state: STATES.TIME_PREFERENCE,
            selectedSlot: null
          }),
          functionCalls: [],
          debug: { state: STATES.TIME_PREFERENCE, action: 'slot_conflict_no_alternatives_fallback' }
        };
      }
    }
    
    // Create MCP integrations (calendar, sheet, email)
    let calendarEventId = null;
    const functionCalls = [];
    
    try {
      // Create calendar event
      const calendarEvent = await createCalendarEvent({
        bookingCode,
        topic: finalSession.topic,
        selectedSlot: finalSession.selectedSlot
      });
      calendarEventId = calendarEvent.id;
      functionCalls.push('create_calendar_hold');
      console.log(`[MCP] Calendar event created: ${calendarEventId}`);
    } catch (error) {
      console.error('[MCP] Error creating calendar event:', error.message);
      functionCalls.push('create_calendar_hold_failed');
    }
    
    try {
      // Append to Google Sheet
      await appendBookingToSheet({
        bookingCode,
        topic: finalSession.topic,
        selectedSlot: finalSession.selectedSlot,
        createdAt: new Date(),
        calendarEventId
      });
      functionCalls.push('append_to_sheet');
      console.log(`[MCP] Booking logged to sheet: ${bookingCode}`);
    } catch (error) {
      console.error('[MCP] Error logging to sheet:', error.message);
      functionCalls.push('append_to_sheet_failed');
    }
    
    try {
      // Create email draft
      const secureLink = `https://booking.example.com/${bookingCode}`;
      await createBookingEmailDraft({
        bookingCode,
        topic: finalSession.topic,
        selectedSlot: finalSession.selectedSlot,
        secureLink
      });
      functionCalls.push('create_email_draft');
      console.log(`[MCP] Email draft created: ${bookingCode}`);
    } catch (error) {
      console.error('[MCP] Error creating email draft:', error.message);
      functionCalls.push('create_email_draft_failed');
    }
    
    // Store booking with calendar event ID
    const booking = createBooking(bookingCode, {
      ...bookingData,
      calendarEventId
    });
    
    const bookingCompleteSession = updateSession(sessionId, { 
      bookingCode,
      state: STATES.BOOKING_COMPLETE 
    });
    
    const slotInfo = finalSession.selectedSlot?.formatted || 'Selected slot';
    
    // Build status message
    const statusMessages = [];
    if (functionCalls.includes('create_calendar_hold')) {
      statusMessages.push('✓ Calendar hold created');
    } else if (functionCalls.includes('create_calendar_hold_failed')) {
      statusMessages.push('⚠ Calendar hold creation failed');
    }
    if (functionCalls.includes('append_to_sheet')) {
      statusMessages.push('✓ Entry logged to sheet');
    } else if (functionCalls.includes('append_to_sheet_failed')) {
      statusMessages.push('⚠ Sheet logging failed');
    }
    if (functionCalls.includes('create_email_draft')) {
      statusMessages.push('✓ Email draft created');
    } else if (functionCalls.includes('create_email_draft_failed')) {
      statusMessages.push('⚠ Email draft creation failed');
    }
    
    return {
      message: `Perfect! Your booking is confirmed.\n\nBooking Code: ${bookingCode}\nTopic: ${finalSession.topic}\nSlot: ${slotInfo} IST\n\n${statusMessages.join('\n')}\n\nPlease use this secure link to complete your contact details: https://booking.example.com/${bookingCode}\n\nIs there anything else I can help you with? You can book another appointment, reschedule, or cancel a booking.`,
      session: bookingCompleteSession,
      functionCalls,
      debug: { state: STATES.BOOKING_COMPLETE, bookingCode, calendarEventId }
    };
  }
  
  // Handle new conversation request after completion
  // Check if we're in a completed state and user wants to start fresh
  if (session && (session.state === STATES.COMPLETED || session.state === STATES.BOOKING_COMPLETE)) {
    const lowerMessage = userMessage.toLowerCase();
    // Check if user wants to start a new booking/cancel/reschedule
    const wantsNewAction = (
      lowerMessage.includes('book') || 
      lowerMessage.includes('reschedule') || 
      lowerMessage.includes('cancel') || 
      lowerMessage.includes('available') ||
      (lowerMessage.includes('new') && (lowerMessage.includes('appointment') || lowerMessage.includes('booking'))) ||
      (lowerMessage.includes('another') && (lowerMessage.includes('appointment') || lowerMessage.includes('booking'))) ||
      lowerMessage.includes('help')
    );
    
    if (wantsNewAction) {
      // Reset session to start fresh
      session = updateSession(sessionId, {
        state: STATES.GREETING,
        intent: null,
        topic: null,
        preferences: null,
        offeredSlots: null,
        selectedSlot: null,
        bookingCode: null,
        bookingCodeToReschedule: null,
        bookingCodeToCancel: null,
        cancellationPending: false
      });
      
      // Re-detect intent for the new message
      const intentResult = await detectIntent(userMessage);
      session = updateSession(sessionId, { intent: intentResult.intent });
    }
  }

  // Return the response
  return {
    message: primaryResponse?.message || "I'm here to help. How can I assist you?",
    session: updatedSession || finalSession || getSession(sessionId),
    functionCalls,
    debug: {
      intent: (updatedSession || finalSession || session)?.intent,
      state: newState,
      previousState: session.state
    }
  };
}

