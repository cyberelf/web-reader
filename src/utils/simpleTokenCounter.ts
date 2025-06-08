/// <reference types="chrome"/>

export interface SimpleTokenEstimate {
  tokens: number;
  messages: number;
  imageTokens: number;
  totalTokens: number;
  warning?: string;
  isEstimated: boolean;
}

/**
 * Simple token estimation without WebAssembly dependencies
 * This is used as a fallback when tiktoken fails to load
 */
export function simpleTokenEstimation(text: string, model: string): number {
  if (!text) return 0;
  
  // Model-specific token ratios based on empirical testing
  let baseRatio = 4; // Default: 4 characters per token
  
  switch (true) {
    case model.includes('gpt-3.5'):
      baseRatio = 3.8;
      break;
    case model.includes('gpt-4'):
      baseRatio = 4.2;
      break;
    case model.includes('deepseek'):
      baseRatio = 3.5;
      break;
    case model.includes('gemini'):
      baseRatio = 4.5;
      break;
    case model.includes('claude'):
      baseRatio = 4.1;
      break;
  }
  
  // Account for text characteristics
  let adjustedLength = text.length;
  
  // Count different types of content
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).length;
  const specialChars = (text.match(/[^\w\s]/g) || []).length;
  const codeIndicators = (text.match(/[{}()[\];=<>]/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  
  // Adjust for content type
  if (codeIndicators > words * 0.1) {
    // Looks like code - code typically uses more tokens
    adjustedLength *= 1.3;
  } else if (specialChars > text.length * 0.15) {
    // Lots of special characters - might be structured data
    adjustedLength *= 1.2;
  } else if (words / sentences > 15) {
    // Very long sentences - might be more efficient
    adjustedLength *= 0.95;
  }
  
  // Account for common patterns that affect tokenization
  if (text.includes('http')) {
    // URLs tend to be tokenized differently
    adjustedLength += (text.match(/https?:\/\/[^\s]+/g) || []).length * 10;
  }
  
  if (numbers > 0) {
    // Numbers can be tokenized in various ways
    adjustedLength += numbers * 2;
  }
  
  return Math.max(1, Math.ceil(adjustedLength / baseRatio));
}

/**
 * Estimate tokens for image content
 */
export function simpleImageTokenEstimation(imageUrl: string): number {
  if (!imageUrl.startsWith('data:image/')) {
    return 250; // Default for external images
  }
  
  // Estimate based on data URL size
  const sizeEstimate = imageUrl.length * 0.75; // Account for base64 encoding
  
  if (sizeEstimate > 500000) {
    return 835; // High resolution: 85 + 750
  } else if (sizeEstimate > 100000) {
    return 335; // Medium resolution: 85 + 250
  } else {
    return 170; // Low resolution: 85 + 85
  }
}

/**
 * Simple conversation token estimation
 */
export function simpleConversationTokens(messages: any[], model = 'gpt-4o-mini'): SimpleTokenEstimate {
  let totalTextTokens = 0;
  let totalImageTokens = 0;
  let warning: string | undefined;
  
  // Message overhead varies by model
  const tokensPerMessage = model.includes('gpt-3.5') ? 4 : 3;
  const tokensPerName = 1;
  
  for (const message of messages) {
    if (typeof message.content === 'string') {
      totalTextTokens += simpleTokenEstimation(message.content, model);
    } else if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (item.type === 'text' && item.text) {
          totalTextTokens += simpleTokenEstimation(item.text, model);
        } else if (item.type === 'image_url' && item.image_url?.url) {
          totalImageTokens += simpleImageTokenEstimation(item.image_url.url);
        }
      }
    }
    
    // Add message formatting overhead
    totalTextTokens += tokensPerMessage;
    if (message.role) {
      totalTextTokens += tokensPerName;
    }
  }
  
  // Add response priming overhead
  totalTextTokens += 3;
  
  const totalTokens = totalTextTokens + totalImageTokens;
  
  // Generate warnings
  if (totalTokens > 100000) {
    warning = 'Very high token count - may be expensive';
  } else if (totalTokens > 50000) {
    warning = 'High token count - check content length';
  } else if (totalTokens > 20000) {
    warning = 'Moderate token count';
  }
  
  return {
    tokens: totalTextTokens,
    messages: messages.length,
    imageTokens: totalImageTokens,
    totalTokens,
    warning,
    isEstimated: true
  };
}

/**
 * Simple token estimation for question + context
 */
export function simpleTokenEstimate(question: string, context: string, model = 'gpt-4o-mini'): SimpleTokenEstimate {
  const messages: any[] = [];
  
  if (context.startsWith('data:image/')) {
    // Image context
    messages.push({
      role: 'system',
      content: 'You are analyzing the provided image. Be specific and detailed in your observations.'
    });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: context }
        },
        {
          type: 'text',
          text: question
        }
      ]
    });
  } else {
    // Text context
    const systemContent = context ? 
      `You are analyzing the following content:\n\n${context}` : 
      'You are analyzing the current webpage.';
    
    messages.push({
      role: 'system',
      content: systemContent
    });
    messages.push({
      role: 'user',
      content: question
    });
  }
  
  return simpleConversationTokens(messages, model);
}

/**
 * Format token count for display
 */
export function formatSimpleTokenCount(estimate: SimpleTokenEstimate): string {
  const parts = [];
  
  if (estimate.imageTokens > 0) {
    parts.push(`${estimate.tokens.toLocaleString()} text`);
    parts.push(`${estimate.imageTokens.toLocaleString()} image`);
    parts.push(`${estimate.totalTokens.toLocaleString()} total tokens`);
  } else {
    parts.push(`${estimate.totalTokens.toLocaleString()} tokens`);
  }
  
  if (estimate.isEstimated) {
    return parts.join(' + ') + ' (est)';
  }
  
  return parts.join(' + ');
}

/**
 * Get token count with status
 */
export function getSimpleTokenStatus(estimate: SimpleTokenEstimate): { text: string; status: 'low' | 'moderate' | 'high' | 'very-high' } {
  const text = formatSimpleTokenCount(estimate);
  
  let status: 'low' | 'moderate' | 'high' | 'very-high';
  if (estimate.totalTokens > 100000) {
    status = 'very-high';
  } else if (estimate.totalTokens > 50000) {
    status = 'high';
  } else if (estimate.totalTokens > 20000) {
    status = 'moderate';
  } else {
    status = 'low';
  }
  
  return { text, status };
}