/**
 * Manual test script to quickly test key functionality
 * Run with: node src/__tests__/manualTest.js
 */

import { extractTimePreferences } from '../services/intentHandlers.js';
import { getMockAvailableSlots } from '../services/mockAvailability.js';
import { generateBookingCode } from '../utils/bookingCode.js';
import { createSession, updateSession, getSession } from '../services/sessionManager.js';
import { detectPII, detectInvestmentAdvice } from '../utils/guardrails.js';

console.log('🧪 Running Manual Tests...\n');

// Test 1: Time Preference Extraction
console.log('1. Testing Time Preference Extraction:');
const testCases = [
  'Monday afternoon',
  'Tomorrow 3 pm',
  'Tuesday morning',
  'Friday evening',
  'tomorrow afternoon',
  '2 pm',
  '10 am',
  '4 pm'
];

testCases.forEach(testCase => {
  const result = extractTimePreferences(testCase);
  console.log(`   "${testCase}" → day: ${result.day}, time: ${result.time}`);
});
console.log('');

// Test 2: Slot Generation
console.log('2. Testing Slot Generation:');
const preferences1 = { day: 'tomorrow', time: 'afternoon' };
const slots1 = getMockAvailableSlots(preferences1);
console.log(`   Tomorrow afternoon: ${slots1.length} slot(s)`);
slots1.forEach(slot => {
  console.log(`     - ${slot.formatted}`);
});

const preferences2 = { day: 'monday', time: 'afternoon' };
const slots2 = getMockAvailableSlots(preferences2);
console.log(`   Monday afternoon: ${slots2.length} slot(s)`);
slots2.forEach(slot => {
  console.log(`     - ${slot.formatted}`);
});

const preferences3 = { time: 'afternoon' }; // 3 pm maps to afternoon
const slots3 = getMockAvailableSlots(preferences3);
console.log(`   Afternoon only: ${slots3.length} slot(s)`);
slots3.forEach(slot => {
  console.log(`     - ${slot.formatted}`);
});
console.log('');

// Test 3: Booking Code Generation
console.log('3. Testing Booking Code Generation:');
const codes = [];
for (let i = 0; i < 5; i++) {
  codes.push(generateBookingCode());
}
console.log(`   Generated codes: ${codes.join(', ')}`);
codes.forEach(code => {
  const isValid = /^NL-[A-Z0-9]{4}$/.test(code);
  console.log(`   ${code}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
});
console.log('');

// Test 4: Session Management
console.log('4. Testing Session Management:');
const sessionId = 'test_session_123';
createSession(sessionId);
let session = getSession(sessionId);
console.log(`   Created session: ${session.id}, state: ${session.state}`);

updateSession(sessionId, { intent: 'book', topic: 'KYC/Onboarding' });
session = getSession(sessionId);
console.log(`   Updated session: intent=${session.intent}, topic=${session.topic}`);
console.log('');

// Test 5: Guardrails
console.log('5. Testing Guardrails:');
const piiTests = [
  'My phone is 9876543210',
  'Contact me at test@example.com',
  'I want to book a call'
];
piiTests.forEach(test => {
  const hasPII = detectPII(test);
  console.log(`   "${test}": ${hasPII ? '⚠️ PII detected' : '✓ No PII'}`);
});

const adviceTests = [
  'What should I invest in?',
  'I want to book a call'
];
adviceTests.forEach(test => {
  const hasAdvice = detectInvestmentAdvice(test);
  console.log(`   "${test}": ${hasAdvice ? '⚠️ Investment advice detected' : '✓ No advice request'}`);
});
console.log('');

// Test 6: Edge Cases
console.log('6. Testing Edge Cases:');
const edgeCases = [
  { input: 'Monday', expected: { day: 'monday', time: null } },
  { input: 'afternoon', expected: { day: null, time: 'afternoon' } },
  { input: 'tomorrow 3pm', expected: { day: 'tomorrow', time: 'afternoon' } },
  { input: 'hello world', expected: { day: null, time: null } }
];

edgeCases.forEach(({ input, expected }) => {
  const result = extractTimePreferences(input);
  const dayMatch = result.day === expected.day;
  const timeMatch = result.time === expected.time;
  const status = dayMatch && timeMatch ? '✓' : '✗';
  console.log(`   ${status} "${input}" → day: ${result.day} (expected: ${expected.day}), time: ${result.time} (expected: ${expected.time})`);
});

console.log('\n✅ Manual tests completed!');
console.log('\nTo run full Jest tests, install dependencies and run: npm test');

