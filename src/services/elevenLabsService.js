/**
 * Eleven Labs Text-to-Speech Service
 * Converts text to speech using Eleven Labs API
 */

import axios from 'axios';

// Read environment variables dynamically (not at module load time)
function getApiKey() {
  return process.env.ELEVEN_LABS_API_KEY;
}

function getVoiceId() {
  return process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice: Rachel
}

/**
 * Converts text to speech using Eleven Labs
 * @param {string} text - Text to convert to speech
 * @returns {Promise<Buffer>} Audio buffer (MP3)
 */
export async function textToSpeech(text) {
  const ELEVEN_LABS_API_KEY = getApiKey();
  const ELEVEN_LABS_VOICE_ID = getVoiceId();
  
  if (!ELEVEN_LABS_API_KEY) {
    console.error('[Eleven Labs] ELEVEN_LABS_API_KEY is not set');
    console.error('[Eleven Labs] Available env vars:', Object.keys(process.env).filter(k => k.includes('ELEVEN')));
    throw new Error('ELEVEN_LABS_API_KEY is not set in .env file. Please add it to your .env file.');
  }
  
  // Trim whitespace from API key (common mistake)
  const apiKey = ELEVEN_LABS_API_KEY.trim();
  
  if (apiKey.length < 10) {
    console.error('[Eleven Labs] API key seems too short:', apiKey.length, 'characters');
    throw new Error('ELEVEN_LABS_API_KEY appears to be invalid (too short). Please check your .env file.');
  }
  
  console.log('[Eleven Labs] Using API key (first 10 chars):', apiKey.substring(0, 10) + '...');

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS');
  }

  try {
    console.log(`[Eleven Labs] Converting text to speech (${text.length} characters)...`);
    
    // Use a model available on free tier (eleven_turbo_v2 or eleven_flash_v2)
    const modelId = process.env.ELEVEN_LABS_MODEL || 'eleven_turbo_v2';
    
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}`,
      {
        text: text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      }
    );

    const audioBuffer = Buffer.from(response.data);
    console.log(`[Eleven Labs] Generated audio: ${audioBuffer.length} bytes`);
    return audioBuffer;
  } catch (error) {
    console.error('[Eleven Labs] Error converting text to speech:', error.message);
    
    if (error.response) {
      const status = error.response.status;
      console.error('[Eleven Labs] Response status:', status);
      
      // Try to parse error response
      let errorMessage = 'Unknown error from Eleven Labs API';
      if (error.response.data) {
        try {
          if (Buffer.isBuffer(error.response.data)) {
            const errorText = Buffer.from(error.response.data).toString('utf-8');
            console.error('[Eleven Labs] Error response text:', errorText);
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.detail?.message || errorJson.message || errorText;
            } catch (e) {
              errorMessage = errorText;
            }
          } else if (typeof error.response.data === 'object') {
            errorMessage = error.response.data.detail?.message || error.response.data.message || JSON.stringify(error.response.data);
          } else {
            errorMessage = error.response.data.toString();
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Provide user-friendly error messages
      if (status === 401) {
        throw new Error('Invalid API key. Please check your ELEVEN_LABS_API_KEY in the .env file. The key may be incorrect, expired, or not have the required permissions.');
      } else if (status === 400) {
        throw new Error(`Bad request: ${errorMessage}`);
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      } else if (status === 500) {
        throw new Error('Eleven Labs API server error. Please try again later.');
      } else {
        throw new Error(`Eleven Labs API error (${status}): ${errorMessage}`);
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - Eleven Labs API took too long to respond');
    }
    
    if (error.message.includes('ELEVEN_LABS_API_KEY')) {
      throw error; // Re-throw API key errors as-is
    }
    
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

/**
 * Validates Eleven Labs configuration
 * @returns {boolean} True if configured correctly
 */
export function isConfigured() {
  return !!getApiKey();
}

