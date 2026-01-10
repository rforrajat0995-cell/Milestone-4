/**
 * Application Configuration
 * Centralized configuration management
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Server Configuration
 */
export const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * CORS Configuration
 */
export const corsConfig = {
  origin: [
    'http://localhost:8501',
    'https://*.streamlit.app',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
};

/**
 * API Keys Configuration
 */
export const apiKeys = {
  groq: process.env.GROQ_API_KEY,
  elevenLabs: process.env.ELEVEN_LABS_API_KEY,
  elevenLabsVoiceId: process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  elevenLabsModel: process.env.ELEVEN_LABS_MODEL || 'eleven_turbo_v2',
};

/**
 * Google APIs Configuration
 */
export const googleConfig = {
  calendarId: process.env.GOOGLE_CALENDAR_ID,
  sheetId: process.env.GOOGLE_SHEET_ID,
  serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
};

/**
 * Email Configuration
 */
export const emailConfig = {
  user: process.env.GMAIL_USER,
  appPassword: process.env.GMAIL_APP_PASSWORD,
};

/**
 * File Paths Configuration
 */
export const paths = {
  dataDir: path.join(__dirname, '../../data'),
  bookingsFile: path.join(__dirname, '../../data/bookings.json'),
  publicDir: path.join(__dirname, '../../public'),
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const required = {
    groq: apiKeys.groq,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

