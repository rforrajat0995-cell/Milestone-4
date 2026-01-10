/**
 * Session Repository
 * Data access layer for session management
 */

import { Session } from '../models/Session.js';

class SessionRepository {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new session
   */
  create(sessionId) {
    const session = new Session({ sessionId });
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getById(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get or create session
   */
  getOrCreate(sessionId) {
    let session = this.getById(sessionId);
    if (!session) {
      session = this.create(sessionId);
    }
    return session;
  }

  /**
   * Update session
   */
  update(sessionId, updates) {
    const session = this.getById(sessionId);
    if (!session) {
      return null;
    }
    session.update(updates);
    return session;
  }

  /**
   * Delete session
   */
  delete(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions (for debugging)
   */
  getAll() {
    return Array.from(this.sessions.values());
  }
}

// Singleton instance
export const sessionRepository = new SessionRepository();

// Export functions for backward compatibility
export function createSession(sessionId) {
  return sessionRepository.create(sessionId);
}

export function getSession(sessionId) {
  return sessionRepository.getById(sessionId);
}

export function updateSession(sessionId, updates) {
  return sessionRepository.update(sessionId, updates);
}

export function deleteSession(sessionId) {
  return sessionRepository.delete(sessionId);
}

export function getAllSessions() {
  return sessionRepository.getAll();
}

