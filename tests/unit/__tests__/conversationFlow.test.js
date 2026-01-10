/**
 * Integration tests for conversation flow
 */

import { processMessage } from '../services/conversationEngine.js';
import { createSession } from '../services/sessionManager.js';

describe('Conversation Flow - Booking', () => {
  let sessionId;

  beforeEach(() => {
    sessionId = `test_flow_${Date.now()}`;
  });

  test('should handle initial greeting and move to topic selection', async () => {
    const result = await processMessage(sessionId, 'I want to book an advisor call');
    
    expect(result.message).toBeDefined();
    expect(result.session.state).toBe('topic_selection');
    expect(result.session.intent).toBe('book');
  });

  test('should handle topic selection', async () => {
    createSession(sessionId);
    const session = await processMessage(sessionId, 'I want to book an advisor call');
    
    // Now select topic
    const result = await processMessage(sessionId, 'KYC');
    
    expect(result.message).toContain('KYC/Onboarding');
    expect(result.session.topic).toBe('KYC/Onboarding');
  });

  test('should handle time preference collection', async () => {
    createSession(sessionId);
    await processMessage(sessionId, 'I want to book an advisor call');
    await processMessage(sessionId, 'KYC');
    
    const result = await processMessage(sessionId, 'Monday afternoon');
    
    expect(result.session.preferences).toBeDefined();
    expect(result.session.preferences.day).toBe('monday');
    expect(result.session.preferences.time).toBe('afternoon');
  });

  test('should offer slots after preferences collected', async () => {
    createSession(sessionId);
    await processMessage(sessionId, 'I want to book an advisor call');
    await processMessage(sessionId, 'KYC');
    
    const result = await processMessage(sessionId, 'Monday afternoon');
    
    // Should either show slots or ask for different preferences
    expect(result.message).toBeDefined();
    expect(['slot_offer', 'time_preference']).toContain(result.session.state);
  });

  test('should handle "tomorrow 3 pm" correctly', async () => {
    createSession(sessionId);
    await processMessage(sessionId, 'I want to book an advisor call');
    await processMessage(sessionId, 'KYC');
    
    const result = await processMessage(sessionId, 'Tomorrow 3 pm');
    
    expect(result.session.preferences).toBeDefined();
    expect(result.session.preferences.day).toBe('tomorrow');
    expect(result.session.preferences.time).toBe('afternoon'); // 3 pm maps to afternoon
  });
});

describe('Conversation Flow - Intent Detection', () => {
  let sessionId;

  beforeEach(() => {
    sessionId = `test_intent_${Date.now()}`;
  });

  test('should detect reschedule intent', async () => {
    const result = await processMessage(sessionId, 'I want to reschedule my booking');
    
    expect(result.session.intent).toBe('reschedule');
  });

  test('should detect cancel intent', async () => {
    const result = await processMessage(sessionId, 'I want to cancel my booking');
    
    expect(result.session.intent).toBe('cancel');
  });

  test('should detect availability intent', async () => {
    const result = await processMessage(sessionId, 'What times are available?');
    
    expect(result.session.intent).toBe('availability');
  });
});

