# Advisor Booking Agent

A comprehensive voice-enabled AI agent for booking, rescheduling, and canceling advisor consultation slots. Built with Groq AI, Eleven Labs TTS, and Google APIs integration.

## 🎯 Features

### Phase 1: Core Conversation Engine ✅
- ✅ Groq AI integration with intelligent intent detection
- ✅ 4 intent handlers (book, reschedule, cancel, availability)
- ✅ Topic taxonomy and slot filling
- ✅ Dialog state machine for conversation flow
- ✅ Booking code generation (e.g., NL-A742)
- ✅ Guardrails (PII detection, investment advice refusal)
- ✅ IST timezone handling
- ✅ Slot conflict detection
- ✅ File-based booking persistence

### Phase 2: MCP Integration ✅
- ✅ Google Calendar integration (create, update, delete events)
- ✅ Google Sheets integration (log bookings, updates, cancellations)
- ✅ Gmail integration (email draft creation via Nodemailer)
- ✅ Real-time availability checking
- ✅ Service account authentication

### Phase 3: Voice Integration ✅
- ✅ Speech-to-Text (STT) using Web Speech API
- ✅ Text-to-Speech (TTS) using Eleven Labs API
- ✅ Browser TTS fallback (Web Speech API)
- ✅ Voice-only interface (`voice-complete.html`)
- ✅ Text-based interface (`index.html`)
- ✅ Fuzzy booking code matching for voice input

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google Cloud account (for Calendar, Sheets, Gmail)
- Eleven Labs account (for TTS)
- Groq API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd Milestone-4
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   # Required
   GROQ_API_KEY=your_groq_api_key
   PORT=3000
   
   # Eleven Labs TTS (optional - falls back to browser TTS)
   ELEVEN_LABS_API_KEY=your_eleven_labs_api_key
   ELEVEN_LABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ELEVEN_LABS_MODEL=eleven_turbo_v2
   
   # Google APIs (for MCP integration)
   GOOGLE_CALENDAR_ID=your_calendar_id
   GOOGLE_SHEET_ID=your_sheet_id
   GMAIL_USER=your_email@gmail.com
   GMAIL_APP_PASSWORD=your_app_password
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/service-account-key.json
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

5. **Access the interfaces:**
   - Text Chat: `http://localhost:3000`
   - Voice Interface (STT only): `http://localhost:3000/voice.html`
   - Complete Voice (STT + TTS): `http://localhost:3000/voice-complete.html`

## 📁 Project Structure

```
Milestone-4/
├── src/
│   ├── server.js                    # Express server & API endpoints
│   ├── services/
│   │   ├── conversationEngine.js    # Main conversation orchestrator
│   │   ├── groqService.js           # Groq AI integration
│   │   ├── intentHandlers.js        # Intent-specific handlers
│   │   ├── dialogStateMachine.js    # State management
│   │   ├── sessionManager.js        # Session state storage
│   │   ├── bookingStore.js          # Booking persistence
│   │   ├── mockAvailability.js      # Slot generation
│   │   ├── googleCalendar.js        # Google Calendar API
│   │   ├── googleSheets.js          # Google Sheets API
│   │   ├── emailService.js          # Gmail integration
│   │   ├── elevenLabsService.js     # Eleven Labs TTS
│   │   └── webSpeechTTS.js          # Browser TTS fallback
│   ├── utils/
│   │   ├── bookingCode.js           # Booking code generator
│   │   ├── guardrails.js            # PII and advice detection
│   │   ├── istDate.js               # IST timezone utilities
│   │   └── voiceBookingCode.js     # Voice code matching
│   └── __tests__/                   # Unit tests
├── public/
│   ├── index.html                   # Text-based chat UI
│   ├── voice.html                   # Voice interface (STT only)
│   └── voice-complete.html          # Complete voice interface (STT + TTS)
├── data/
│   └── bookings.json                # Booking storage (gitignored)
├── package.json
├── README.md
├── SETUP.md                         # Detailed setup instructions
├── MCP_SETUP.md                     # MCP integration guide
└── .gitignore
```

## 🎤 Usage Examples

### Book a New Slot
```
User: "I want to book an advisor call"
Agent: "What topic would you like to discuss?"
User: "KYC"
Agent: "When would you prefer? (e.g., Monday, tomorrow, morning)"
User: "Tomorrow 2 pm"
Agent: [Shows available slots]
User: "Option 1"
Agent: [Confirms booking, creates calendar event, logs to sheet, drafts email]
```

### Reschedule
```
User: "I want to reschedule my booking"
Agent: "What's your booking code?"
User: "NL-A742"
Agent: [Shows current booking, asks for new preferences]
```

### Cancel
```
User: "I want to cancel my booking"
Agent: "What's your booking code?"
User: "NL-A742"
Agent: [Confirms cancellation, removes calendar event, updates sheet]
```

## 🔧 Configuration

### Google APIs Setup
See `MCP_SETUP.md` for detailed instructions on:
- Creating service account
- Enabling APIs
- Setting up Calendar, Sheets, and Gmail

### Eleven Labs Setup
1. Sign up at https://elevenlabs.io
2. Get API key from Settings → API Keys
3. Enable "Text to Speech" permission
4. Add key to `.env` file

### Timezone
All date/time operations use IST (Indian Standard Time, Asia/Kolkata).

## 🧪 Testing

Run unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📝 API Endpoints

- `POST /api/chat` - Process user messages
- `POST /api/session` - Create new session
- `GET /api/session/:sessionId` - Get session state
- `POST /api/tts` - Text-to-Speech conversion
- `GET /api/tts/test` - Test TTS API key
- `GET /health` - Health check

## 🛡️ Guardrails

- **PII Detection**: Detects and refuses to process personal information
- **Investment Advice**: Explicitly refuses to provide investment advice
- **Slot Conflicts**: Prevents double-booking
- **Sunday Handling**: Automatically redirects Sunday requests to Monday

## 🔐 Security Notes

- Never commit `.env` file
- Service account keys should be kept secure
- Gmail app passwords are sensitive
- API keys should be rotated regularly

## 📚 Documentation

- `SETUP.md` - Initial setup guide
- `MCP_SETUP.md` - Google APIs integration guide
- `PHASE2_MCP_INTEGRATION.md` - Phase 2 implementation details

## 🤝 Contributing

This is a milestone project. For questions or issues, please refer to the project documentation.

## 📄 License

ISC

## 🙏 Acknowledgments

- Groq AI for fast inference
- Eleven Labs for high-quality TTS
- Google APIs for calendar and email integration
