/**
 * Web Speech API Text-to-Speech Service (Browser-based, completely free)
 * This uses the browser's built-in TTS, no API key needed
 */

/**
 * Converts text to speech using browser's Web Speech API
 * This is a client-side only solution
 * @param {string} text - Text to convert to speech
 * @returns {Promise<void>} Resolves when speech starts
 */
export function speakText(text) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Web Speech API is not supported in this browser'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice settings
    utterance.rate = 1.0; // Speech rate (0.1 to 10)
    utterance.pitch = 1.0; // Pitch (0 to 2)
    utterance.volume = 1.0; // Volume (0 to 1)
    utterance.lang = 'en-US';

    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = voices.filter(v => 
      v.name.includes('Samantha') || 
      v.name.includes('Alex') || 
      v.name.includes('Google') ||
      v.lang.startsWith('en')
    );
    
    if (preferredVoices.length > 0) {
      utterance.voice = preferredVoices[0];
    }

    utterance.onstart = () => {
      console.log('[Web Speech TTS] Speech started');
      resolve();
    };

    utterance.onend = () => {
      console.log('[Web Speech TTS] Speech ended');
    };

    utterance.onerror = (error) => {
      console.error('[Web Speech TTS] Error:', error);
      reject(new Error(`Speech synthesis error: ${error.error}`));
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Check if Web Speech API is available
 * @returns {boolean}
 */
export function isAvailable() {
  return 'speechSynthesis' in window;
}

