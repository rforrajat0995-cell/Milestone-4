/**
 * Dialog State Machine for conversation flow management
 */

const STATES = {
  GREETING: 'greeting',
  DISCLAIMER: 'disclaimer',
  TOPIC_SELECTION: 'topic_selection',
  TIME_PREFERENCE: 'time_preference',
  SLOT_OFFER: 'slot_offer',
  CONFIRMATION: 'confirmation',
  BOOKING_COMPLETE: 'booking_complete',
  RESCHEDULE: 'reschedule',
  CANCELLATION: 'cancellation',
  AVAILABILITY_CHECK: 'availability_check',
  COMPLETED: 'completed'
};

/**
 * Gets the next state based on current state and action
 */
export function getNextState(currentState, action, context = {}) {
  switch (currentState) {
    case STATES.GREETING:
      return STATES.DISCLAIMER;
    
    case STATES.DISCLAIMER:
      if (action === 'acknowledge') {
        return STATES.TOPIC_SELECTION;
      }
      return currentState;
    
    case STATES.TOPIC_SELECTION:
      if (action === 'topic_selected' && context.topic) {
        return STATES.TIME_PREFERENCE;
      }
      return currentState;
    
    case STATES.TIME_PREFERENCE:
      if (action === 'preferences_collected') {
        return STATES.SLOT_OFFER;
      }
      return currentState;
    
    case STATES.SLOT_OFFER:
      if (action === 'slot_selected') {
        return STATES.CONFIRMATION;
      }
      if (action === 'no_slots_available') {
        return STATES.COMPLETED; // Waitlist flow
      }
      return currentState;
    
    case STATES.CONFIRMATION:
      if (action === 'confirmed') {
        return STATES.BOOKING_COMPLETE;
      }
      if (action === 'rejected') {
        return STATES.SLOT_OFFER;
      }
      return currentState;
    
    case STATES.BOOKING_COMPLETE:
      return STATES.COMPLETED;
    
    case STATES.RESCHEDULE:
      if (action === 'reschedule_complete') {
        return STATES.COMPLETED;
      }
      return currentState;
    
    case STATES.CANCELLATION:
      if (action === 'cancellation_complete') {
        return STATES.COMPLETED;
      }
      return currentState;
    
    case STATES.AVAILABILITY_CHECK:
      if (action === 'availability_shown') {
        return STATES.COMPLETED;
      }
      return currentState;
    
    default:
      return currentState;
  }
}

/**
 * Checks if state transition is valid
 */
export function isValidTransition(fromState, toState) {
  const validTransitions = {
    [STATES.GREETING]: [STATES.DISCLAIMER],
    [STATES.DISCLAIMER]: [STATES.TOPIC_SELECTION],
    [STATES.TOPIC_SELECTION]: [STATES.TIME_PREFERENCE],
    [STATES.TIME_PREFERENCE]: [STATES.SLOT_OFFER],
    [STATES.SLOT_OFFER]: [STATES.CONFIRMATION, STATES.COMPLETED],
    [STATES.CONFIRMATION]: [STATES.BOOKING_COMPLETE, STATES.SLOT_OFFER],
    [STATES.BOOKING_COMPLETE]: [STATES.COMPLETED],
    [STATES.RESCHEDULE]: [STATES.COMPLETED],
    [STATES.CANCELLATION]: [STATES.COMPLETED],
    [STATES.AVAILABILITY_CHECK]: [STATES.COMPLETED]
  };
  
  return validTransitions[fromState]?.includes(toState) || false;
}

export { STATES };

