/**
 * Guardrails for conversation safety
 */

// Patterns to detect PII
const PII_PATTERNS = [
  /\b\d{10}\b/g, // 10-digit phone numbers
  /\b\d{12}\b/g, // 12-digit account numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card patterns
];

// Investment advice keywords
const INVESTMENT_ADVICE_KEYWORDS = [
  'should i invest',
  'what should i buy',
  'recommend',
  'best investment',
  'which stock',
  'which mutual fund',
  'guaranteed returns',
  'investment advice',
  'financial advice',
];

/**
 * Detects if user message contains PII
 */
export function detectPII(message) {
  const lowerMessage = message.toLowerCase();
  
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detects if user is asking for investment advice
 */
export function detectInvestmentAdvice(message) {
  const lowerMessage = message.toLowerCase();
  
  return INVESTMENT_ADVICE_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword)
  );
}

/**
 * Gets appropriate response for investment advice requests
 */
export function getInvestmentAdviceResponse() {
  return {
    message: "I can't provide investment advice. This service is for informational purposes only. For investment guidance, please consult with a certified financial advisor. Would you like to continue with booking an advisor consultation?",
    shouldContinue: true
  };
}

/**
 * Gets appropriate response for PII detection
 */
export function getPIIResponse() {
  return {
    message: "For your security, please don't share personal information like phone numbers, email addresses, or account numbers during this call. We'll collect your contact details securely after the call. How can I help you today?",
    shouldContinue: true
  };
}

