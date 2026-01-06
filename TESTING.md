# Testing Guide

## Running Tests

```bash
# Install dependencies (if not already done)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- extractTimePreferences.test.js
```

## Test Coverage

The test suite covers:

1. **Time Preference Extraction** (`extractTimePreferences.test.js`)
   - Day extraction (Monday, tomorrow, etc.)
   - Time extraction (morning, afternoon, evening, specific times like "3 pm")
   - Edge cases

2. **Mock Availability Service** (`mockAvailability.test.js`)
   - Slot generation
   - Filtering by preferences
   - Date/time handling
   - Sunday exclusion

3. **Booking Code Generation** (`bookingCode.test.js`)
   - Format validation (NL-XXXX)
   - Uniqueness
   - Character exclusion

4. **Session Management** (`sessionManager.test.js`)
   - Session creation
   - Session retrieval
   - Session updates
   - Session deletion

5. **Conversation Flow** (`conversationFlow.test.js`)
   - End-to-end booking flow
   - Intent detection
   - State transitions

6. **IST Date Utilities** (`istDate.test.js`)
   - Date formatting
   - Day of week calculation
   - IST timezone handling

7. **Guardrails** (`guardrails.test.js`)
   - PII detection
   - Investment advice detection

## Common Issues to Test For

### Slot Selection Issues
- "Monday afternoon" not finding slots
- "Tomorrow 3 pm" showing wrong slots
- Only 1 slot shown when 2 should be available

### Time Parsing Issues
- "3 pm" not being recognized
- "Tomorrow" calculation wrong
- Timezone issues

### State Management Issues
- Wrong state transitions
- Session data not persisting
- Intent detection failing

## Debugging Failed Tests

1. Check the test output for specific error messages
2. Look at the `debug` object in conversation responses
3. Check console logs for intent detection results
4. Verify IST date calculations are correct

## Adding New Tests

When adding new functionality:

1. Create a test file in `src/__tests__/`
2. Follow the naming convention: `*.test.js`
3. Test both happy path and edge cases
4. Mock external dependencies (like Groq API) if needed

