/**
 * Unit tests for guardrails
 */

import { 
  detectPII, 
  detectInvestmentAdvice, 
  getPIIResponse, 
  getInvestmentAdviceResponse 
} from '../utils/guardrails.js';

describe('PII Detection', () => {
  test('should detect phone number', () => {
    expect(detectPII('My phone is 9876543210')).toBe(true);
  });

  test('should detect email address', () => {
    expect(detectPII('Contact me at test@example.com')).toBe(true);
  });

  test('should not detect false positives', () => {
    expect(detectPII('I want to book a call')).toBe(false);
    expect(detectPII('Monday afternoon')).toBe(false);
  });

  test('should return PII response', () => {
    const response = getPIIResponse();
    expect(response.message).toBeDefined();
    expect(response.shouldContinue).toBe(true);
  });
});

describe('Investment Advice Detection', () => {
  test('should detect investment advice requests', () => {
    expect(detectInvestmentAdvice('What should I invest in?')).toBe(true);
    expect(detectInvestmentAdvice('Which stock should I buy?')).toBe(true);
    expect(detectInvestmentAdvice('Recommend me a mutual fund')).toBe(true);
  });

  test('should not detect false positives', () => {
    expect(detectInvestmentAdvice('I want to book a call')).toBe(false);
    expect(detectInvestmentAdvice('What times are available?')).toBe(false);
  });

  test('should return investment advice response', () => {
    const response = getInvestmentAdviceResponse();
    expect(response.message).toBeDefined();
    expect(response.shouldContinue).toBe(true);
  });
});

