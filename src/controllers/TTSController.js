/**
 * TTS Controller
 * Handles HTTP requests for text-to-speech
 */

import { ttsService } from '../services/external/TTSService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../errors/AppError.js';

/**
 * Convert text to speech
 */
export const textToSpeech = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new ValidationError('Text is required and must be a non-empty string');
  }

  const audioBuffer = await ttsService.convertToSpeech(text);

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Empty audio response from TTS service');
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', audioBuffer.length);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(audioBuffer);
});

/**
 * Test TTS API key
 */
export const testTTS = asyncHandler(async (req, res) => {
  const result = await ttsService.testConnection();
  res.json(result);
});

