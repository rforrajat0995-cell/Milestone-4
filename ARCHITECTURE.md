# Architecture Documentation

## Project Structure

This project follows industry-standard architecture patterns for maintainability and scalability.

```
src/
├── config/              # Configuration management
│   └── index.js        # Centralized config (env vars, paths, etc.)
├── controllers/        # Request handlers (thin layer)
│   ├── ChatController.js
│   ├── SessionController.js
│   └── TTSController.js
├── services/           # Business logic layer
│   ├── ai/            # AI-related services
│   │   └── groqService.js
│   ├── external/      # External API integrations
│   │   ├── elevenLabsService.js
│   │   ├── googleCalendar.js
│   │   ├── googleSheets.js
│   │   ├── emailService.js
│   │   ├── webSpeechTTS.js
│   │   └── TTSService.js (wrapper)
│   └── domain/        # Domain-specific business logic
│       ├── conversationEngine.js
│       ├── dialogStateMachine.js
│       ├── intentHandlers.js
│       └── mockAvailability.js
├── models/             # Data models
│   ├── Session.js
│   └── Booking.js
├── repositories/       # Data access layer
│   ├── SessionRepository.js
│   └── BookingRepository.js
├── routes/             # Route definitions
│   └── index.js
├── middleware/        # Express middleware
│   ├── errorHandler.js
│   └── validation.js
├── utils/              # Utility functions
│   ├── bookingCode.js
│   ├── guardrails.js
│   ├── istDate.js
│   └── voiceBookingCode.js
└── errors/            # Custom error classes
    └── AppError.js
```

## Architecture Principles

### 1. Separation of Concerns
- **Controllers**: Handle HTTP requests/responses only
- **Services**: Contain business logic
- **Repositories**: Handle data access
- **Models**: Define data structures

### 2. Dependency Injection
- Services receive dependencies through constructor or function parameters
- Makes testing easier and code more modular

### 3. Error Handling
- Custom error classes for different error types
- Centralized error handling middleware
- Consistent error response format

### 4. Configuration Management
- All configuration in `src/config/index.js`
- Environment variables validated on startup
- Type-safe configuration access

### 5. Service Organization
- **AI Services**: Groq AI integration
- **External Services**: Third-party APIs (Eleven Labs, Google, etc.)
- **Domain Services**: Core business logic (conversation, intents, availability)

## Data Flow

```
HTTP Request
    ↓
Routes (routes/index.js)
    ↓
Controller (controllers/*.js)
    ↓
Service (services/**/*.js)
    ↓
Repository (repositories/*.js)
    ↓
Model (models/*.js)
    ↓
Response
```

## Key Components

### Controllers
- **ChatController**: Handles `/api/chat` requests
- **SessionController**: Manages session creation/retrieval
- **TTSController**: Text-to-speech conversion

### Services

#### AI Services
- **groqService**: Intent detection, response generation

#### External Services
- **elevenLabsService**: Eleven Labs TTS API
- **googleCalendar**: Google Calendar API
- **googleSheets**: Google Sheets API
- **emailService**: Gmail integration

#### Domain Services
- **conversationEngine**: Main conversation orchestrator
- **intentHandlers**: Handle specific intents (book, reschedule, cancel, availability)
- **dialogStateMachine**: State management
- **mockAvailability**: Slot generation and filtering

### Repositories
- **SessionRepository**: In-memory session storage
- **BookingRepository**: File-based booking storage with conflict detection

### Models
- **Session**: Session state model
- **Booking**: Booking data model

## Error Handling

All errors flow through:
1. Service throws `AppError` or subclass
2. Controller catches and passes to middleware
3. `errorHandler` middleware formats response

## Testing

Tests are organized in `tests/` directory:
- `tests/unit/`: Unit tests for individual components
- `tests/integration/`: Integration tests

## Future Improvements

1. **Database Integration**: Replace file-based storage with database
2. **Caching Layer**: Add Redis for session management
3. **API Versioning**: Add versioning to routes (`/api/v1/...`)
4. **Logging**: Structured logging with Winston/Pino
5. **Monitoring**: Add health checks and metrics
6. **Documentation**: API documentation with Swagger/OpenAPI

