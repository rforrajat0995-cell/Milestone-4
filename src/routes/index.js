/**
 * Route Definitions
 * Centralized route configuration
 */

import express from 'express';
import { processMessage } from '../controllers/ChatController.js';
import { createSession, getSession } from '../controllers/SessionController.js';
import { textToSpeech, testTTS } from '../controllers/TTSController.js';

const router = express.Router();

/**
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'advisor-booking-agent',
  });
});

/**
 * Chat routes
 */
router.post('/api/chat', processMessage);

/**
 * Session routes
 */
router.post('/api/session', createSession);
router.get('/api/session/:sessionId', getSession);

/**
 * TTS routes
 */
router.post('/api/tts', textToSpeech);
router.get('/api/tts/test', testTTS);

export default router;

