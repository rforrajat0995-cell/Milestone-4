/**
 * Express Server
 * Main application entry point
 */

import dotenv from 'dotenv';
dotenv.config(); // Must be called before any other imports

import express from 'express';
import cors from 'cors';
import { serverConfig, corsConfig, validateConfig } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { paths } from './config/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.static(paths.publicDir || path.join(__dirname, '../public')));

// Routes
app.use(routes);

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(serverConfig.port, () => {
  console.log(`🚀 Advisor Booking Agent server running on http://localhost:${serverConfig.port}`);
  console.log(`📝 Chat UI available at http://localhost:${serverConfig.port}`);
  console.log(`🎤 Voice UI available at http://localhost:${serverConfig.port}/voice.html`);
  console.log(`🎤 Complete Voice UI available at http://localhost:${serverConfig.port}/voice-complete.html`);
  console.log(`🔑 Environment: ${serverConfig.nodeEnv}`);
  console.log(`🔊 TTS: ${serverConfig.isDevelopment ? 'Development mode' : 'Production mode'}`);
});
