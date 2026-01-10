/**
 * Chat Controller
 * Handles HTTP requests for chat functionality
 */

import { processMessage as processMessageService } from '../services/conversationEngine.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../errors/AppError.js';

/**
 * Process chat message
 */
export const processMessage = asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new ValidationError('Message is required and must be a non-empty string');
  }

  const currentSessionId =
    sessionId ||
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const result = await processMessageService(
    currentSessionId,
    message
  );

  res.json({
    message: result.message,
    sessionId: currentSessionId,
    session: result.session?.toJSON() || result.session,
    functionCalls: result.functionCalls || [],
    debug: result.debug,
  });
});

