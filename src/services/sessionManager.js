/**
 * In-memory session state management
 */

const sessions = new Map();

/**
 * Creates a new session
 */
export function createSession(sessionId) {
  const session = {
    id: sessionId,
    state: 'greeting',
    intent: null,
    topic: null,
    preferences: {
      day: null,
      time: null
    },
    selectedSlot: null,
    bookingCode: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  sessions.set(sessionId, session);
  return session;
}

/**
 * Gets a session by ID
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Updates session state
 */
export function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  Object.assign(session, updates, { updatedAt: new Date() });
  return session;
}

/**
 * Deletes a session
 */
export function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

/**
 * Gets all sessions (for debugging)
 */
export function getAllSessions() {
  return Array.from(sessions.values());
}

