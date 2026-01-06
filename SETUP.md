# Setup Guide - Phase 1

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   Create a `.env` file in the root directory:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   PORT=3000
   ```
   
   Get your Groq API key from: https://console.groq.com/

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open the chat UI:**
   Navigate to `http://localhost:3000` in your browser

## Testing the Conversation Flow

### Test 1: Book New Slot
1. Type: "I want to book an advisor call"
2. Select a topic (e.g., "Account Changes/Nominee" or "1")
3. Provide time preference (e.g., "Monday morning" or "tomorrow afternoon")
4. Select a slot (Option 1 or Option 2)
5. Confirm with "yes"

Expected: Booking code generated, mock function calls shown

### Test 2: Check Availability
1. Type: "What times are available?"

Expected: List of available time windows

### Test 3: Reschedule
1. Type: "I want to reschedule my booking"

Expected: Prompt for booking code

### Test 4: Cancel
1. Type: "I want to cancel my booking"

Expected: Prompt for booking code

### Test 5: Guardrails
1. Type: "My phone number is 9876543210"
   Expected: PII warning message

2. Type: "What should I invest in?"
   Expected: Investment advice refusal message

## Debug Panel

The chat UI includes a debug panel at the bottom showing:
- Session ID
- Current state
- Intent
- Topic
- Function calls triggered
- Debug information

## API Endpoints

- `POST /api/chat` - Send a message and get AI response
- `GET /api/session/:sessionId` - Get session state (for debugging)
- `POST /api/session` - Create a new session
- `GET /health` - Health check

## Troubleshooting

**Error: "GROQ_API_KEY is not set"**
- Make sure you've created a `.env` file with your Groq API key

**Error: "Cannot find module"**
- Run `npm install` to install dependencies

**Chat not responding**
- Check browser console for errors
- Verify server is running on the correct port
- Check that GROQ_API_KEY is valid

