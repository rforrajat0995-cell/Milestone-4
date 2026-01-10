/**
 * Session Controller
 * Handles HTTP requests for session management
 */

import { sessionRepository } from '../repositories/SessionRepository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError } from '../errors/AppError.js';

/**
 * Create new session
 */
export const createSession = asyncHandler(async (req, res) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session = sessionRepository.create(sessionId);
  res.json({ sessionId, session: session.toJSON() });
});

/**
 * Get session by ID
 */
export const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = sessionRepository.getById(sessionId);

  if (!session) {
    throw new NotFoundError('Session');
  }

  res.json(session.toJSON());
});

