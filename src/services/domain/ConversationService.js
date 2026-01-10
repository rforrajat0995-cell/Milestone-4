/**
 * Conversation Service
 * Business logic for conversation management
 * Refactored from conversationEngine.js
 */

import { processMessage as processMessageEngine } from '../../services/conversationEngine.js';

class ConversationService {
  /**
   * Process user message and return response
   */
  async processMessage(sessionId, userMessage) {
    return await processMessageEngine(sessionId, userMessage);
  }
}

export const conversationService = new ConversationService();

