/// <reference types="chrome"/>

import { simpleTokenEstimation } from './simpleTokenCounter';

/**
 * Simple token estimation without tiktoken dependency
 * Uses various heuristics to estimate token count
 */

const modelLimits: Record<string, number> = {
  'gpt-4': 8000,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 4000,
  'deepseek-chat': 32000,
  'deepseek-reasoner': 32000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
  'gemini-2.0-flash': 1000000,
  'gemini-2.5-pro': 1000000,
  'gemini-2.5-flash': 1000000
};

export function countTokens(text: string, model: string = 'gpt-4'): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Use simple estimation for all models
  return simpleTokenEstimation(text, model);
}

/**
 * Get estimated tokens for a conversation with context
 */
export function getTokenEstimate(
  content: string, 
  model: string = 'gpt-4',
  includeSystemPrompt: boolean = true
): { 
  contentTokens: number; 
  systemTokens: number; 
  totalTokens: number; 
  maxTokens: number;
  isWithinLimit: boolean;
} {
  const contentTokens = countTokens(content, model);
  
  // Estimate system prompt tokens (typical AI assistant prompt)
  const systemTokens = includeSystemPrompt ? simpleTokenEstimation(
    "You are a helpful AI assistant that analyzes web page content and answers questions about it.",
    model
  ) : 0;
  
  const totalTokens = contentTokens + systemTokens;

  // Default to a conservative limit if model not found
  const maxTokens = modelLimits[model] || modelLimits['gpt-4'] || 8000;
  const isWithinLimit = totalTokens <= maxTokens * 0.8; // Use 80% of limit for safety
  
  return {
    contentTokens,
    systemTokens,
    totalTokens,
    maxTokens,
    isWithinLimit
  };
}

/**
 * Count tokens with message overhead for chat completions
 */
export function countConversationTokens(
  messages: Array<{ role: string; content: string }>, 
  model = 'gpt-4'
): number {
  let totalTokens = 0;
  
  // Message overhead varies by model
  const tokensPerMessage = model.includes('gpt-3.5') ? 4 : 3;
  const tokensPerName = 1;
  
    for (const message of messages) {
    totalTokens += countTokens(message.content, model);
    totalTokens += tokensPerMessage;
      if (message.role) {
      totalTokens += tokensPerName;
    }
  }
  
  totalTokens += 3; // every reply is primed with assistant
  
  return totalTokens;
}

/**
 * Get a human-readable token estimate with status
 */
export function getTokenStatus(tokenCount: number, model = 'gpt-4'): { text: string; status: 'low' | 'moderate' | 'high' | 'very-high' } {
  
  const limit = modelLimits[model] || modelLimits['gpt-4'];
  const percentage = (tokenCount / limit) * 100;
  
  let status: 'low' | 'moderate' | 'high' | 'very-high';
  let text: string;
  
  if (percentage < 20) {
    status = 'low';
    text = `${tokenCount} tokens (${percentage.toFixed(1)}% of limit)`;
  } else if (percentage < 50) {
    status = 'moderate';
    text = `${tokenCount} tokens (${percentage.toFixed(1)}% of limit)`;
  } else if (percentage < 80) {
    status = 'high';
    text = `${tokenCount} tokens (${percentage.toFixed(1)}% of limit)`;
  } else {
    status = 'very-high';
    text = `${tokenCount} tokens (${percentage.toFixed(1)}% of limit)`;
  }
  
  // Add estimation indicator
  text += ' (estimated)';
  
  return { text, status };
} 