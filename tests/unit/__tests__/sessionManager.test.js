/**
 * Unit tests for session management
 */

import { 
  createSession, 
  getSession, 
  updateSession, 
  deleteSession 
} from '../services/sessionManager.js';

describe('Session Manager', () => {
  let sessionId;

  beforeEach(() => {
    sessionId = `test_session_${Date.now()}`;
  });

  afterEach(() => {
    deleteSession(sessionId);
  });

  test('should create a new session', () => {
    const session = createSession(sessionId);
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
    expect(session.state).toBe('greeting');
    expect(session.intent).toBeNull();
  });

  test('should retrieve a session', () => {
    createSession(sessionId);
    const session = getSession(sessionId);
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
  });

  test('should return null for non-existent session', () => {
    const session = getSession('non_existent_session');
    expect(session).toBeUndefined();
  });

  test('should update session', () => {
    createSession(sessionId);
    const updates = { intent: 'book', topic: 'KYC/Onboarding' };
    const updated = updateSession(sessionId, updates);
    
    expect(updated.intent).toBe('book');
    expect(updated.topic).toBe('KYC/Onboarding');
  });

  test('should update session state', () => {
    createSession(sessionId);
    updateSession(sessionId, { state: 'topic_selection' });
    const session = getSession(sessionId);
    expect(session.state).toBe('topic_selection');
  });

  test('should delete a session', () => {
    createSession(sessionId);
    const deleted = deleteSession(sessionId);
    expect(deleted).toBe(true);
    
    const session = getSession(sessionId);
    expect(session).toBeUndefined();
  });
});

