/**
 * TTS Service
 * Unified interface for text-to-speech services
 */

import { textToSpeech as elevenLabsTTS } from './elevenLabsService.js';
import { apiKeys } from '../../config/index.js';
import { ExternalServiceError } from '../../errors/AppError.js';

class TTSService {
  /**
   * Convert text to speech
   */
  async convertToSpeech(text) {
    if (!apiKeys.elevenLabs) {
      throw new ExternalServiceError(
        'Eleven Labs',
        'ELEVEN_LABS_API_KEY is not set in .env'
      );
    }

    try {
      return await elevenLabsTTS(text);
    } catch (error) {
      throw new ExternalServiceError('Eleven Labs', error.message);
    }
  }

  /**
   * Test TTS connection
   */
  async testConnection() {
    if (!apiKeys.elevenLabs) {
      return {
        configured: false,
        valid: false,
        error: 'ELEVEN_LABS_API_KEY is not set in .env',
      };
    }

    try {
      const axios = (await import('axios')).default;
      const voiceId = apiKeys.elevenLabsVoiceId;
      const modelId = apiKeys.elevenLabsModel;
      const trimmedKey = apiKeys.elevenLabs.trim();

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: 'Test',
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': trimmedKey,
          },
          responseType: 'arraybuffer',
          timeout: 10000,
        }
      );

      return {
        configured: true,
        valid: true,
        audioSize: response.data.byteLength,
        message: 'API key is valid and TTS is working! ✅',
      };
    } catch (error) {
      const status = error.response?.status;
      let errorDetail = 'Unknown error';

      if (error.response?.data) {
        try {
          if (Buffer.isBuffer(error.response.data)) {
            const errorText = Buffer.from(error.response.data).toString('utf-8');
            try {
              const errorJson = JSON.parse(errorText);
              errorDetail =
                errorJson.detail?.message || errorJson.message || errorText;
            } catch (e) {
              errorDetail = errorText;
            }
          } else if (typeof error.response.data === 'object') {
            errorDetail =
              error.response.data.detail?.message ||
              error.response.data.message ||
              JSON.stringify(error.response.data);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      return {
        configured: true,
        valid: false,
        status: status,
        error: errorDetail,
        message:
          status === 401
            ? 'API key is invalid or lacks TTS permissions. Make sure "Text to Speech" permission is enabled on your API key.'
            : `API error (${status}): ${errorDetail}`,
      };
    }
  }
}

export const ttsService = new TTSService();

