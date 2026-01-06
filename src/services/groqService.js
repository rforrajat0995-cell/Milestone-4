/**
 * Groq AI integration with function calling for intent recognition
 */

import Groq from 'groq-sdk';

// Lazy initialization - only create client when needed
let groq = null;

function getGroqClient() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set. Please check your .env file.');
    }
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groq;
}

/**
 * Function definitions for Groq function calling
 */
const FUNCTIONS = [
  {
    name: 'identify_intent',
    description: 'Identifies the user intent from their message',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['book', 'reschedule', 'cancel', 'availability', 'general'],
          description: 'The identified intent'
        },
        confidence: {
          type: 'number',
          description: 'Confidence score between 0 and 1'
        }
      },
      required: ['intent', 'confidence']
    }
  }
];

/**
 * Detects intent from user message using Groq
 */
export async function detectIntent(userMessage) {
  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for an advisor booking system. 
          Classify user messages into one of these intents:
          - book: User wants to book a new advisor consultation slot
          - reschedule: User wants to reschedule an existing booking
          - cancel: User wants to cancel an existing booking
          - availability: User wants to check available time slots
          - general: General questions or unclear intent
          
          Be accurate and return the most appropriate intent.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      model: 'llama-3.1-70b-versatile',
      tools: [
        {
          type: 'function',
          function: FUNCTIONS[0]
        }
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'identify_intent' }
      },
      temperature: 0.3
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function.name === 'identify_intent') {
      const args = JSON.parse(toolCall.function.arguments);
      return {
        intent: args.intent,
        confidence: args.confidence
      };
    }

    // Fallback if no tool call
    return {
      intent: 'general',
      confidence: 0.5
    };
  } catch (error) {
    console.error('Error detecting intent:', error);
    // Fallback to simple keyword matching
    return fallbackIntentDetection(userMessage);
  }
}

/**
 * Fallback intent detection using keyword matching
 */
function fallbackIntentDetection(message) {
  const lowerMessage = message.toLowerCase();
  
  // Check for reschedule first (before book, since "reschedule" might contain "book")
  if (lowerMessage.includes('reschedule') || lowerMessage.includes('change time') || lowerMessage.includes('move') || lowerMessage.includes('change my booking')) {
    return { intent: 'reschedule', confidence: 0.9 };
  }
  // Check for cancel
  if (lowerMessage.includes('cancel') || lowerMessage.includes('delete booking') || lowerMessage.includes('remove booking')) {
    return { intent: 'cancel', confidence: 0.9 };
  }
  // Check for availability
  if (lowerMessage.includes('available') || lowerMessage.includes('when can') || lowerMessage.includes('time slot') || lowerMessage.includes('what times')) {
    return { intent: 'availability', confidence: 0.9 };
  }
  // Check for book (but only if not reschedule/cancel)
  if (lowerMessage.includes('book') || lowerMessage.includes('schedule') || lowerMessage.includes('appointment') || lowerMessage.includes('new booking')) {
    return { intent: 'book', confidence: 0.8 };
  }
  
  return { intent: 'general', confidence: 0.5 };
}

/**
 * Generates a conversational response using Groq
 */
/**
 * Detects user intent during slot selection
 * Determines if user is selecting a slot, wants different slots, or asking a question
 */
export async function detectSlotSelectionIntent(userMessage) {
  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are analyzing a user message during slot selection in a booking system. 
          Determine the user's intent:
          1. "select" - User is selecting a slot (option 1, option 2, or confirming a slot)
          2. "different" - User wants different slots (another, different, more options, not this one, don't like)
          3. "question" - User is asking a question or needs clarification
          
          Respond with a JSON object: {"action": "select" | "different" | "question", "selectedSlot": 1 | 2 | null}
          If action is "select", include which slot (1 or 2) in selectedSlot field.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const response = JSON.parse(responseText);
    
    return {
      wantsDifferentSlots: response.action === 'different',
      selectedSlot: response.selectedSlot || null,
      action: response.action || 'unknown'
    };
  } catch (error) {
    console.error('Error detecting slot selection intent:', error);
    // Fallback to pattern matching
    const lower = userMessage.toLowerCase();
    const wantsDifferent = lower.includes('another') || 
                          lower.includes('different') || 
                          lower.includes('more options') ||
                          lower.includes('not this') ||
                          lower.includes('other slot') ||
                          lower.includes('different time') ||
                          (lower.includes('no') && !lower.includes('yes') && !lower.includes('option'));
    
    // Check for slot selection
    // Be careful not to match time preferences like "2 pm" or "1 pm"
    const timePattern = /\b(\d{1,2})\s*(am|pm)\b/i;
    const hasTimePreference = timePattern.test(userMessage);
    
    let selectedSlot = null;
    if (!hasTimePreference) {
      if (userMessage.includes('option 1') || userMessage.match(/\b1\b/)) {
        selectedSlot = 1;
      } else if (userMessage.includes('option 2') || userMessage.match(/\b2\b/)) {
        selectedSlot = 2;
      }
    }
    
    return {
      wantsDifferentSlots: wantsDifferent && !selectedSlot,
      selectedSlot: selectedSlot,
      action: wantsDifferent ? 'different' : (selectedSlot ? 'select' : 'question')
    };
  }
}

export async function generateResponse(context, userMessage) {
  try {
    const client = getGroqClient();
    const systemPrompt = `You are a helpful assistant for booking advisor consultations. 
    You are friendly, professional, and concise.
    Always mention IST timezone when discussing times.
    Never provide investment advice - redirect to advisor consultation.
    Never ask for PII like phone numbers or account numbers.
    
    Current conversation state: ${context.state}
    Current topic: ${context.topic || 'Not selected'}
    Current intent: ${context.intent || 'Not identified'}
    
    Respond naturally and helpfully.`;

    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...(context.messageHistory || []),
        {
          role: 'user',
          content: userMessage
        }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 300
    });

    return completion.choices[0]?.message?.content || "I'm sorry, I didn't understand that. Could you please rephrase?";
  } catch (error) {
    console.error('Error generating response:', error);
    return "I'm having trouble processing that. Could you please try again?";
  }
}

