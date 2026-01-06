/**
 * Express server for the advisor booking agent
 */

import dotenv from 'dotenv';
dotenv.config(); // Must be called before any other imports that use process.env

import express from 'express';
import cors from 'cors';
import { processMessage } from './services/conversationEngine.js';
import { createSession, getSession } from './services/sessionManager.js';
import { textToSpeech } from './services/elevenLabsService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow Streamlit and localhost
app.use(cors({
  origin: [
    'http://localhost:8501',
    'https://*.streamlit.app',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Chat endpoint - processes user messages
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Generate session ID if not provided
    const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process the message
    const result = await processMessage(currentSessionId, message);

    res.json({
      message: result.message,
      sessionId: currentSessionId,
      session: result.session,
      functionCalls: result.functionCalls,
      debug: result.debug
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Get session state endpoint (for debugging)
 */
app.get('/api/session/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

/**
 * Create new session endpoint
 */
app.post('/api/session', (req, res) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session = createSession(sessionId);
  res.json({ sessionId, session });
});

/**
 * Test endpoint to verify Eleven Labs API key (tests TTS directly)
 */
app.get('/api/tts/test', async (req, res) => {
  try {
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    
    if (!apiKey) {
      return res.json({ 
        configured: false,
        error: 'ELEVEN_LABS_API_KEY is not set in .env'
      });
    }
    
    // Test API key by making a TTS request (this is what we actually need)
    const axios = (await import('axios')).default;
    const voiceId = process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const modelId = process.env.ELEVEN_LABS_MODEL || 'eleven_turbo_v2'; // Use free tier model
    const trimmedKey = apiKey.trim();
    
    try {
      console.log('[TTS Test] Testing API key with TTS endpoint...');
      const testResponse = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: 'Test',
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': trimmedKey
          },
          responseType: 'arraybuffer',
          timeout: 10000
        }
      );
      
      return res.json({
        configured: true,
        valid: true,
        audioSize: testResponse.data.byteLength,
        message: 'API key is valid and TTS is working! ✅'
      });
    } catch (testError) {
      if (testError.response) {
        const status = testError.response.status;
        let errorDetail = 'Unknown error';
        
        if (testError.response.data) {
          try {
            if (Buffer.isBuffer(testError.response.data)) {
              const errorText = Buffer.from(testError.response.data).toString('utf-8');
              try {
                const errorJson = JSON.parse(errorText);
                errorDetail = errorJson.detail?.message || errorJson.message || errorText;
              } catch (e) {
                errorDetail = errorText;
              }
            } else if (typeof testError.response.data === 'object') {
              errorDetail = testError.response.data.detail?.message || testError.response.data.message || JSON.stringify(testError.response.data);
            }
          } catch (e) {
            errorDetail = 'Could not parse error';
          }
        }
        
        return res.json({
          configured: true,
          valid: false,
          status: status,
          error: errorDetail,
          message: status === 401 
            ? 'API key is invalid or lacks TTS permissions. Make sure "Text to Speech" permission is enabled on your API key.'
            : `API error (${status}): ${errorDetail}`
        });
      }
      throw testError;
    }
  } catch (error) {
    return res.json({
      configured: false,
      valid: false,
      error: error.message
    });
  }
});

/**
 * Text-to-Speech endpoint using Eleven Labs
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`[TTS] Request received: ${text.length} characters`);
    console.log(`[TTS] Text preview: ${text.substring(0, 100)}...`);
    
    // Check if API key is configured
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      console.error('[TTS] ELEVEN_LABS_API_KEY is not set in .env');
      return res.status(500).json({ 
        error: 'TTS not configured',
        message: 'ELEVEN_LABS_API_KEY is missing. Please add it to your .env file.'
      });
    }
    
    console.log(`[TTS] API key length: ${apiKey.trim().length} characters`);
    console.log(`[TTS] API key preview: ${apiKey.trim().substring(0, 10)}...`);
    
    const audioBuffer = await textToSpeech(text);
    
    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('[TTS] Received empty audio buffer');
      return res.status(500).json({ 
        error: 'Empty audio response',
        message: 'Eleven Labs returned empty audio'
      });
    }
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(audioBuffer);
    
    console.log(`[TTS] Audio sent successfully: ${audioBuffer.length} bytes`);
  } catch (error) {
    console.error('[TTS] Error generating speech:', error.message);
    console.error('[TTS] Error stack:', error.stack);
    
    // Log more details for debugging
    if (error.response) {
      console.error('[TTS] Response status:', error.response.status);
      console.error('[TTS] Response data:', error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate speech',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Advisor Booking Agent server running on http://localhost:${PORT}`);
  console.log(`📝 Chat UI available at http://localhost:${PORT}`);
  console.log(`🎤 Voice UI available at http://localhost:${PORT}/voice.html`);
  console.log(`🔑 Make sure GROQ_API_KEY is set in .env file`);
  console.log(`🔊 Make sure ELEVEN_LABS_API_KEY is set in .env file for TTS`);
});

