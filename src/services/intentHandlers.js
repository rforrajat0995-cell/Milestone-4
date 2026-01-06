/**
 * Intent handlers for the 4 main intents
 */

import { getMockAvailableSlots, getAvailabilityWindows } from './mockAvailability.js';
import { generateBookingCode } from '../utils/bookingCode.js';
import { STATES } from './dialogStateMachine.js';
import { getBooking, createBooking, updateBooking, cancelBooking, findBooking } from './bookingStore.js';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './googleCalendar.js';
import { appendBookingToSheet, updateBookingInSheet, markBookingCancelledInSheet } from './googleSheets.js';
import { createBookingEmailDraft, createRescheduleEmailDraft, createCancellationEmailDraft } from './emailService.js';
import { extractBookingCodeFromVoice } from '../utils/voiceBookingCode.js';

/**
 * Handles book new slot intent
 */
export async function handleBookIntent(session, userMessage) {
  const responses = [];
  
  // Only handle book intent if intent is actually "book"
  // This prevents interference with other intents
  if (session.intent !== 'book' && session.intent !== null) {
    return responses;
  }
  
  // Check current state and respond accordingly
  if (session.state === STATES.GREETING || session.state === STATES.DISCLAIMER) {
    // Move to topic selection
    responses.push({
      type: 'disclaimer',
      message: "Great! To help you better, I need to know what topic you'd like to discuss. Please choose one:\n1. KYC/Onboarding\n2. SIP/Mandates\n3. Statements/Tax Docs\n4. Withdrawals & Timelines\n5. Account Changes/Nominee"
    });
  } else if (session.state === STATES.TOPIC_SELECTION) {
    const topic = extractTopic(userMessage);
    if (topic) {
      responses.push({
        type: 'topic_selected',
        message: `Great! You've selected: ${topic}. Now, when would you prefer to have the call? Please mention the day (e.g., Monday, tomorrow) and time preference (morning, afternoon, evening).`,
        data: { topic }
      });
    } else {
      responses.push({
        type: 'topic_clarification',
        message: "I didn't catch that. Please choose from:\n1. KYC/Onboarding\n2. SIP/Mandates\n3. Statements/Tax Docs\n4. Withdrawals & Timelines\n5. Account Changes/Nominee"
      });
    }
  } else if (session.state === STATES.TIME_PREFERENCE) {
    const preferences = extractTimePreferences(userMessage);
    if (preferences.day || preferences.time) {
      responses.push({
        type: 'preferences_collected',
        message: `Got it. Let me check available slots for ${preferences.day || 'your preferred day'} ${preferences.time ? 'around ' + preferences.time : ''}.`,
        data: { preferences }
      });
    } else {
      responses.push({
        type: 'preferences_clarification',
        message: "When would you prefer to have the call? Please mention the day (e.g., Monday, tomorrow) and time preference (morning, afternoon, evening)."
      });
    }
  } else if (session.state === STATES.SLOT_OFFER) {
    const slots = getMockAvailableSlots(session.preferences);
    if (slots.length > 0) {
      const slotOptions = slots.map((slot, idx) => 
        `Option ${idx + 1}: ${slot.formatted}`
      ).join('\n');
      
      responses.push({
        type: 'slots_offered',
        message: `I have these available slots:\n${slotOptions}\n\nWhich one would you prefer? (Please say Option 1 or Option 2)`,
        data: { slots }
      });
    } else {
      responses.push({
        type: 'no_slots',
        message: "I don't have any slots matching your preferences right now. I'll add you to the waitlist and send you an email when slots become available. Is that okay?",
        data: { waitlist: true }
      });
    }
  } else if (session.state === STATES.CONFIRMATION) {
    if (isConfirmation(userMessage)) {
      // Check if the selected slot is still available before confirming
      if (session.selectedSlot) {
        const { isSlotBooked, isDateFullyBooked } = await import('./bookingStore.js');
        const slotIsBooked = isSlotBooked(session.selectedSlot.date, session.selectedSlot.time);
        
        if (slotIsBooked) {
          // Slot was booked in the meantime - show next available slots
          const { getMockAvailableSlots } = await import('./mockAvailability.js');
          const allSlots = getMockAvailableSlots(session.preferences || {});
          
          // Filter out the booked slot
          const nextAvailableSlots = allSlots
            .filter(s => !(s.date === session.selectedSlot.date && s.time === session.selectedSlot.time))
            .slice(0, 2);
          
          if (nextAvailableSlots.length > 0) {
            const slotOptions = nextAvailableSlots.map((slot, idx) => 
              `Option ${idx + 1}: ${slot.formatted}`
            ).join('\n');
            
            const slotPrompt = nextAvailableSlots.length === 2 
              ? "Which one would you prefer? (Please say Option 1 or Option 2)"
              : "Would you like to proceed with this slot? (Please say 'yes' to confirm)";
            
            // Format date for display
            const [year, month, day] = session.selectedSlot.date.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const formattedDate = dateObj.toLocaleDateString('en-IN', { 
              timeZone: 'Asia/Kolkata',
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            const timeFormatted = session.selectedSlot.time === '10:00' ? '10:00 AM' : 
                                 session.selectedSlot.time === '14:00' ? '2:00 PM' : '4:00 PM';
            
            responses.push({
              type: 'slot_conflict',
              message: `Sorry, the slot for ${formattedDate} at ${timeFormatted} was just booked by someone else. Here are the next available slots:\n${slotOptions}\n\n${slotPrompt}`,
              data: { slots: nextAvailableSlots }
            });
            return responses;
          } else {
            responses.push({
              type: 'slot_conflict',
              message: `Sorry, the slot for ${session.selectedSlot.formatted} was just booked by someone else, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`
            });
            return responses;
          }
        }
      }
      
      // CRITICAL: Check if slot is still available BEFORE generating booking code
      if (session.selectedSlot) {
        const { isSlotBooked } = await import('./bookingStore.js');
        const slotIsBooked = isSlotBooked(session.selectedSlot.date, session.selectedSlot.time);
        console.log(`[Slot Conflict Check - Intent Handler] Before creating booking: slot ${session.selectedSlot.date} ${session.selectedSlot.time} is booked: ${slotIsBooked}`);
        
        if (slotIsBooked) {
          console.log(`[Slot Conflict Check - Intent Handler] Slot conflict detected! Slot ${session.selectedSlot.formatted} is already booked.`);
          // Slot was booked in the meantime - show next available slots
          const { getMockAvailableSlots } = await import('./mockAvailability.js');
          const allSlots = getMockAvailableSlots(session.preferences || {});
          
          // Filter out the booked slot
          const nextAvailableSlots = allSlots
            .filter(s => !(s.date === session.selectedSlot.date && s.time === session.selectedSlot.time))
            .slice(0, 2);
          
          if (nextAvailableSlots.length > 0) {
            const slotOptions = nextAvailableSlots.map((slot, idx) => 
              `Option ${idx + 1}: ${slot.formatted}`
            ).join('\n');
            
            const slotPrompt = nextAvailableSlots.length === 2
              ? "Which one would you prefer? (Please say Option 1 or Option 2)"
              : "Would you like to proceed with this slot? (Please say 'yes' to confirm)";
            
            responses.push({
              type: 'slot_conflict',
              message: `Sorry, that slot (${session.selectedSlot.formatted}) was just booked by someone else. Here are some other available slots:\n${slotOptions}\n\n${slotPrompt}`,
              data: { slots: nextAvailableSlots }
            });
            return responses;
          } else {
            responses.push({
              type: 'slot_conflict',
              message: `Sorry, that slot (${session.selectedSlot.formatted}) was just booked by someone else, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`
            });
            return responses;
          }
        }
      }
      
      const bookingCode = generateBookingCode();
      
      // Create and store the booking (MCP calls will be handled in conversationEngine)
      const bookingData = {
        topic: session.topic,
        selectedSlot: session.selectedSlot,
        preferences: session.preferences
      };
      // Note: MCP integrations (calendar, sheet, email) are handled in conversationEngine.js
      // This handler just prepares the booking data
      
      responses.push({
        type: 'booking_confirmed',
        message: `Perfect! Your booking is confirmed.\n\nBooking Code: ${bookingCode}\nTopic: ${session.topic}\nSlot: ${session.selectedSlot?.formatted} IST\n\n[MCP integrations will be created...]\n\nPlease use this secure link to complete your contact details: https://booking.example.com/${bookingCode}\n\nIs there anything else I can help you with? You can book another appointment, reschedule, or cancel a booking.`,
        data: { bookingCode, bookingData }
      });
    } else {
      responses.push({
        type: 'confirmation_clarification',
        message: "Would you like to confirm this booking? Please say 'yes' to confirm or 'no' to choose a different slot."
      });
    }
  }
  
  return responses;
}

/**
 * Handles reschedule intent
 */
export async function handleRescheduleIntent(session, userMessage) {
  const responses = [];
  
  // If we're in initial states, ask for booking code
  if (session.state === STATES.GREETING || session.state === STATES.DISCLAIMER) {
    responses.push({
      type: 'reschedule_request',
      message: "I can help you reschedule your booking. Please provide your booking code (format: NL-XXXX)."
    });
    return responses;
  }
  
  // Check if we're waiting for booking code
  if (!session.bookingCodeToReschedule) {
    // Extract booking code from message (use voice-aware extraction)
    let bookingCode = extractBookingCodeFromVoice(userMessage);
    
    // Fallback to regex if voice extraction fails
    if (!bookingCode) {
      const codeMatch = userMessage.match(/\b([A-Z]{2}-[A-Z0-9]{4})\b/);
      bookingCode = codeMatch ? codeMatch[1] : null;
    }
    
    if (bookingCode) {
      const booking = getBooking(bookingCode);
      if (booking && booking.status === 'confirmed') {
        // Store the booking code in session for rescheduling
        responses.push({
          type: 'reschedule_booking_found',
          message: `Found your booking:\n\nBooking Code: ${bookingCode}\nTopic: ${booking.topic}\nCurrent Slot: ${booking.selectedSlot?.formatted || 'N/A'} IST\n\nWhen would you like to reschedule to? Please mention the day and time preference.`,
          data: { bookingCode, booking }
        });
      } else {
        responses.push({
          type: 'reschedule_not_found',
          message: `I couldn't find a confirmed booking with code ${bookingCode}. Please check the code and try again, or say "book" to create a new booking.`
        });
      }
    } else {
      responses.push({
        type: 'reschedule_request',
        message: "I can help you reschedule your booking. Please provide your booking code (format: NL-XXXX)."
      });
    }
  } else if (session.state === STATES.RESCHEDULE || session.bookingCodeToReschedule) {
    // We have the booking code, check if we're selecting a new slot
    if (session.offeredSlots && (userMessage.includes('option 1') || userMessage.includes('option 2') || userMessage.match(/\b[12]\b/))) {
      const slotIndex = userMessage.includes('option 1') || userMessage.match(/\b1\b/) ? 0 : 1;
      const selectedSlot = session.offeredSlots[slotIndex];
      if (selectedSlot) {
        // Check if the selected slot is already booked (exclude current booking being rescheduled)
        const { isSlotBooked, isDateFullyBooked } = await import('./bookingStore.js');
        const excludeBookingCode = session.bookingCodeToReschedule || null;
        const slotIsBooked = isSlotBooked(selectedSlot.date, selectedSlot.time, excludeBookingCode);
        
        if (slotIsBooked) {
          // Slot is already booked - show next available slots
          const { getMockAvailableSlots } = await import('./mockAvailability.js');
          const allSlots = getMockAvailableSlots(session.preferences || {}, excludeBookingCode);
          
          // Filter out the booked slot and get next available
          const nextAvailableSlots = allSlots
            .filter(s => !(s.date === selectedSlot.date && s.time === selectedSlot.time))
            .slice(0, 2);
          
          if (nextAvailableSlots.length > 0) {
            const slotOptions = nextAvailableSlots.map((slot, idx) => 
              `Option ${idx + 1}: ${slot.formatted}`
            ).join('\n');
            
            const slotPrompt = nextAvailableSlots.length === 2 
              ? "Which one would you prefer? (Please say Option 1 or Option 2)"
              : "Would you like to proceed with this slot? (Please say 'yes' to confirm)";
            
            // Format date for display
            const [year, month, day] = selectedSlot.date.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const formattedDate = dateObj.toLocaleDateString('en-IN', { 
              timeZone: 'Asia/Kolkata',
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            const timeFormatted = selectedSlot.time === '10:00' ? '10:00 AM' : 
                                 selectedSlot.time === '14:00' ? '2:00 PM' : '4:00 PM';
            
            responses.push({
              type: 'reschedule_slot_conflict',
              message: `Sorry, the slot for ${formattedDate} at ${timeFormatted} is already booked. Here are the next available slots:\n${slotOptions}\n\n${slotPrompt}`,
              data: { slots: nextAvailableSlots }
            });
            return responses;
          } else {
            responses.push({
              type: 'reschedule_slot_conflict',
              message: `Sorry, the slot for ${selectedSlot.formatted} is already booked, and I don't have any other available slots right now. Would you like to try a different day or time? Please let me know your preference.`
            });
            return responses;
          }
        }
        
        // Slot is available - proceed with reschedule
        const booking = getBooking(session.bookingCodeToReschedule);
        if (booking) {
          // Note: MCP integrations (calendar update, sheet update, email) will be handled in conversationEngine.js
          responses.push({
            type: 'reschedule_confirmed',
            message: `Your booking has been rescheduled successfully!\n\nBooking Code: ${session.bookingCodeToReschedule}\nTopic: ${booking.topic}\nNew Slot: ${selectedSlot.formatted} IST\nPrevious Slot: ${booking.selectedSlot?.formatted || 'N/A'} IST\n\n[MCP integrations will be updated...]`,
            data: {
              bookingCode: session.bookingCodeToReschedule,
              booking,
              newSlot: selectedSlot,
              previousSlot: booking.selectedSlot
            }
          });
        }
      }
    } else if (!session.offeredSlots) {
      // Collect new time preference
      const preferences = extractTimePreferences(userMessage);
      if (preferences.day || preferences.time) {
        // Exclude the current booking's slot when rescheduling
        const excludeBookingCode = session.bookingCodeToReschedule || null;
        const slots = getMockAvailableSlots(preferences, excludeBookingCode);
        
        // Additional safety check: explicitly filter out the current booking's slot
        // in case it somehow got through
        let filteredSlots = slots;
        if (excludeBookingCode) {
          const currentBooking = getBooking(excludeBookingCode);
          if (currentBooking && currentBooking.selectedSlot) {
            filteredSlots = slots.filter(s => 
              !(s.date === currentBooking.selectedSlot.date && 
                s.time === currentBooking.selectedSlot.time)
            );
          }
        }
        
        if (filteredSlots.length > 0) {
          // Ensure we show up to 2 slots
          const slotsToShow = filteredSlots.slice(0, 2);
          const slotOptions = slotsToShow.map((slot, idx) => 
            `Option ${idx + 1}: ${slot.formatted}`
          ).join('\n');
          
          responses.push({
            type: 'reschedule_slots_offered',
            message: `Here are available slots for rescheduling:\n${slotOptions}\n\nWhich one would you prefer?`,
            data: { slots: slotsToShow }
          });
        } else {
          responses.push({
            type: 'reschedule_no_slots',
            message: "I don't have any slots matching your preferences. Would you like to try a different time?"
          });
        }
      } else {
        responses.push({
          type: 'reschedule_preferences_clarification',
          message: "When would you like to reschedule to? Please mention the day (e.g., Monday, tomorrow) and time preference (morning, afternoon, evening)."
        });
      }
    }
  }
  
  return responses;
}

/**
 * Handles cancel intent
 */
export function handleCancelIntent(session, userMessage) {
  const responses = [];
  
  // Check if user is confirming a pending cancellation
  if (session.cancellationPending && (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('confirm'))) {
    // Use the booking code from session
    const bookingCode = session.bookingCodeToCancel;
    if (bookingCode) {
      const booking = getBooking(bookingCode);
      if (booking && booking.status === 'confirmed') {
        // Note: MCP integrations (calendar delete, sheet update, email) will be handled in conversationEngine.js
        responses.push({
          type: 'cancellation_confirmed',
          message: `Your booking has been cancelled successfully.\n\nBooking Code: ${bookingCode}\nTopic: ${booking.topic}\nOriginal Slot: ${booking.selectedSlot?.formatted || 'N/A'} IST\n\n[MCP integrations will be updated...]`,
          data: {
            bookingCode,
            booking
          }
        });
        return responses;
      }
    }
  }
  
  // Extract booking code from message (use voice-aware extraction)
  let bookingCode = extractBookingCodeFromVoice(userMessage);
  
  // Fallback to regex if voice extraction fails
  if (!bookingCode) {
    const codeMatch = userMessage.match(/\b([A-Z]{2}-[A-Z0-9]{4})\b/);
    bookingCode = codeMatch ? codeMatch[1] : null;
  }
  
  if (bookingCode) {
    const booking = getBooking(bookingCode);
    if (booking && booking.status === 'confirmed') {
      responses.push({
        type: 'cancellation_confirmation',
        message: `I found your booking:\n\nBooking Code: ${bookingCode}\nTopic: ${booking.topic}\nSlot: ${booking.selectedSlot?.formatted || 'N/A'} IST\n\nAre you sure you want to cancel this booking? Please say 'yes' to confirm.`,
        data: { bookingCode, booking }
      });
    } else {
      responses.push({
        type: 'cancellation_not_found',
        message: `I couldn't find a confirmed booking with code ${bookingCode}. Please check the code and try again.`
      });
    }
    } else {
      // Check if we're waiting for confirmation
      if (session.cancellationPending && (userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase().includes('confirm'))) {
        const bookingCode = session.bookingCodeToCancel;
        if (bookingCode) {
          const booking = getBooking(bookingCode);
          if (booking) {
            // Note: MCP integrations (calendar delete, sheet update, email) will be handled in conversationEngine.js
            responses.push({
              type: 'cancellation_confirmed',
              message: `Your booking has been cancelled successfully.\n\nBooking Code: ${bookingCode}\nTopic: ${booking.topic}\nOriginal Slot: ${booking.selectedSlot?.formatted || 'N/A'} IST\n\n[MCP integrations will be updated...]`,
              data: {
                bookingCode,
                booking
              }
            });
            return responses;
          }
        }
      } else {
      responses.push({
        type: 'cancellation_request',
        message: "I can help you cancel your booking. Please provide your booking code (format: NL-XXXX)."
      });
    }
  }
  
  return responses;
}

/**
 * Handles availability check intent
 */
export function handleAvailabilityIntent(session, userMessage) {
  const responses = [];
  const windows = getAvailabilityWindows();
  
  const availabilityText = Object.entries(windows)
    .map(([date, times]) => {
      // Parse date string (YYYY-MM-DD) and format in IST
      const [year, month, day] = date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const formattedDate = dateObj.toLocaleDateString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      return `${formattedDate}: ${times.join(', ')} IST`;
    })
    .join('\n');
  
  responses.push({
    type: 'availability_shown',
    message: `Here are the available time windows:\n\n${availabilityText}\n\nWould you like to book one of these slots?`
  });
  
  return responses;
}

/**
 * Extracts topic from user message
 */
function extractTopic(message) {
  const topicMap = {
    'kyc': 'KYC/Onboarding',
    'onboarding': 'KYC/Onboarding',
    'sip': 'SIP/Mandates',
    'mandate': 'SIP/Mandates',
    'statement': 'Statements/Tax Docs',
    'tax': 'Statements/Tax Docs',
    'withdrawal': 'Withdrawals & Timelines',
    'timeline': 'Withdrawals & Timelines',
    'account change': 'Account Changes/Nominee',
    'nominee': 'Account Changes/Nominee',
    'change nominee': 'Account Changes/Nominee'
  };
  
  const lowerMessage = message.toLowerCase();
  
  for (const [keyword, topic] of Object.entries(topicMap)) {
    if (lowerMessage.includes(keyword)) {
      return topic;
    }
  }
  
  // Check for numbered selection
  const numberMatch = message.match(/\b([1-5])\b/);
  if (numberMatch) {
    const topics = [
      'KYC/Onboarding',
      'SIP/Mandates',
      'Statements/Tax Docs',
      'Withdrawals & Timelines',
      'Account Changes/Nominee'
    ];
    return topics[parseInt(numberMatch[1]) - 1];
  }
  
  return null;
}

/**
 * Extracts time preferences from user message
 */
export function extractTimePreferences(message) {
  const preferences = { day: null, time: null };
  const lowerMessage = message.toLowerCase();
  
  // Day extraction
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (lowerMessage.includes(day)) {
      preferences.day = day;
      break;
    }
  }
  
  if (lowerMessage.includes('tomorrow')) {
    preferences.day = 'tomorrow';
  }
  if (lowerMessage.includes('today')) {
    preferences.day = 'today';
  }
  
  // Extract specific times first (before generic terms)
  const timeMatch = message.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const isPM = timeMatch[3] && timeMatch[3].toLowerCase() === 'pm';
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    // Convert to 24-hour format
    let hour24 = hour;
    if (isPM && hour !== 12) {
      hour24 = hour + 12;
    } else if (!isPM && hour === 12) {
      hour24 = 0;
    }
    
    // Map to closest available slot time (10:00, 14:00, 16:00)
    // Calculate which slot is closest
    const availableSlots = [10, 14, 16]; // Available slot hours
    let closestSlot = availableSlots[0];
    let minDiff = Math.abs(hour24 - closestSlot);
    
    for (const slotHour of availableSlots) {
      const diff = Math.abs(hour24 - slotHour);
      if (diff < minDiff) {
        minDiff = diff;
        closestSlot = slotHour;
      }
    }
    
    // Map to the appropriate time preference
    if (closestSlot === 10) {
      preferences.time = 'morning';
    } else if (closestSlot === 14) {
      preferences.time = 'afternoon';
    } else {
      preferences.time = 'evening';
    }
    
    // Also store the specific hour for more precise matching
    preferences.specificHour = hour24;
  } else {
    // Time extraction for generic terms
    if (lowerMessage.includes('morning')) {
      preferences.time = 'morning';
    } else if (lowerMessage.includes('afternoon')) {
      preferences.time = 'afternoon';
    } else if (lowerMessage.includes('evening')) {
      preferences.time = 'evening';
    }
  }
  
  return preferences;
}

/**
 * Checks if message is a confirmation
 */
function isConfirmation(message) {
  const lowerMessage = message.toLowerCase();
  return lowerMessage.includes('yes') || 
         lowerMessage.includes('confirm') || 
         lowerMessage.includes('ok') ||
         lowerMessage.includes('okay') ||
         lowerMessage.includes('option 1') ||
         lowerMessage.includes('option 2') ||
         lowerMessage.match(/\b1\b/) ||
         lowerMessage.match(/\b2\b/);
}

