# Code Refactoring Guide

## What Was Changed

The codebase has been restructured to follow industry-standard architecture patterns:

### New Structure

```
src/
├── config/              # ✅ Configuration management
├── controllers/         # ✅ Request handlers (thin layer)
├── services/           
│   ├── ai/             # ✅ AI services (Groq)
│   ├── external/       # ✅ External APIs (Google, Eleven Labs)
│   └── domain/         # ✅ Business logic
├── models/             # ✅ Data models
├── repositories/       # ✅ Data access layer
├── routes/             # ✅ Route definitions
├── middleware/         # ✅ Express middleware
├── utils/              # ✅ Utility functions
└── errors/             # ✅ Custom error classes

tests/
├── unit/               # ✅ Unit tests
└── integration/        # ✅ Integration tests
```

### Key Improvements

1. **Separation of Concerns**
   - Controllers only handle HTTP
   - Services contain business logic
   - Repositories handle data access

2. **Configuration Management**
   - Centralized in `src/config/index.js`
   - Validated on startup

3. **Error Handling**
   - Custom error classes
   - Centralized error middleware

4. **Service Organization**
   - AI services separated
   - External APIs grouped
   - Domain logic isolated

## Migration Status

### ✅ Completed
- Created new folder structure
- Created config management
- Created error handling
- Created models (Session, Booking)
- Created repositories (SessionRepository, BookingRepository)
- Created controllers
- Created routes
- Created middleware
- Updated some imports

### ⚠️ In Progress
- Updating all imports in moved files
- conversationEngine.js still has old imports (partially updated)
- Some services need import updates

### 📝 TODO
- Update all remaining imports
- Test that everything works
- Remove old files after migration
- Update documentation

## Import Path Changes

### Old → New

```
./groqService.js → ./ai/groqService.js
./sessionManager.js → ../repositories/SessionRepository.js
./bookingStore.js → ../repositories/BookingRepository.js
./dialogStateMachine.js → ./domain/dialogStateMachine.js
./mockAvailability.js → ./domain/mockAvailability.js
./intentHandlers.js → ./domain/intentHandlers.js
./googleCalendar.js → ./external/googleCalendar.js
./googleSheets.js → ./external/googleSheets.js
./emailService.js → ./external/emailService.js
./elevenLabsService.js → ./external/elevenLabsService.js
```

## Testing the Refactoring

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Test endpoints:**
   - `GET /health` - Should work
   - `POST /api/chat` - Should process messages
   - `POST /api/session` - Should create sessions
   - `POST /api/tts` - Should convert text to speech

3. **Check for errors:**
   - Look for import errors in console
   - Test all functionality

## Rollback Plan

If issues occur:
1. Old files are still in `src/services/`
2. Can revert imports to old paths
3. Git history has previous working version

## Next Steps

1. Complete import updates
2. Test all functionality
3. Remove duplicate/old files
4. Update all documentation

