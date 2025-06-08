/// <reference types="chrome"/>

// Dynamic import for tiktoken to handle loading failures gracefully
let tiktokenModule: any = null;
let tiktokenLoadAttempted = false;
let tiktokenLoadFailed = false;

async function loadTiktoken() {
  if (tiktokenLoadAttempted) {
    return tiktokenModule;
  }
  
  tiktokenLoadAttempted = true;
  
  try {
    tiktokenModule = await import('tiktoken');
    console.log('✅ Tiktoken loaded successfully');
    return tiktokenModule;
  } catch (error) {
    console.warn('❌ Failed to load tiktoken, using fallback estimation:', error);
    tiktokenLoadFailed = true;
    return null;
  }
}

/**
 * Fallback token estimation that doesn't require tiktoken
 */
function fallbackTokenEstimation(text: string, model: string): number {
  // More sophisticated fallback estimation based on model type
  let baseRatio = 4; // Default: 4 characters per token
  
  // Adjust ratio based on model (some models have different tokenization)
  if (model.includes('gpt-3.5')) {
    baseRatio = 3.8;
  } else if (model.includes('gpt-4')) {
    baseRatio = 4.2;
  } else if (model.includes('deepseek')) {
    baseRatio = 3.5; // DeepSeek tends to be more efficient
  } else if (model.includes('gemini')) {
    baseRatio = 4.5; // Gemini tends to use more tokens
  }
  
  // Account for special characters, punctuation, and spacing
  let adjustedLength = text.length;
  
  // Penalize text with lots of special characters or code
  const specialCharCount = (text.match(/[^\w\s]/g) || []).length;
  const codeIndicators = (text.match(/[{}()[\];=<>]/g) || []).length;
  
  if (specialCharCount > text.length * 0.1 || codeIndicators > 10) {
    adjustedLength *= 1.2; // Code/special chars tend to use more tokens
  }
  
  return Math.ceil(adjustedLength / baseRatio);
}

export interface TokenEstimate {
  tokens: number;
  messages: number;
  imageTokens: number;
  totalTokens: number;
  warning?: string;
}

export interface MessageContent {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

/**
 * Get the encoding for a specific model
 */
async function getModelEncoding(model: string) {
  try {
    const tiktoken = await loadTiktoken();
    if (!tiktoken) {
      return null;
    }
    
    // Map some common model variations to their tiktoken equivalents
    const modelMaps: Record<string, string> = {
      'gpt-4o': 'gpt-4',
      'gpt-4o-mini': 'gpt-4',
      'gpt-4-turbo': 'gpt-4',
      'gpt-4-turbo-preview': 'gpt-4',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k': 'gpt-3.5-turbo',
      'deepseek-chat': 'gpt-4', // Use GPT-4 encoding as fallback
      'deepseek-coder': 'gpt-4',
      'gemini-pro': 'gpt-4', // Use GPT-4 encoding as fallback
      'gemini-1.5-pro': 'gpt-4',
      'gemini-1.5-flash': 'gpt-4'
    };
    
    const mappedModel = modelMaps[model] || model;
    
    try {
      return tiktoken.encoding_for_model(mappedModel as any);
    } catch {
      // Fallback to cl100k_base encoding (used by GPT-4 and newer models)
      return tiktoken.get_encoding('cl100k_base');
    }
  } catch (error) {
    console.warn('Failed to get tiktoken encoding, using fallback estimation:', error);
    return null;
  }
}

/**
 * Count tokens in a text string using tiktoken
 */
export async function countTextTokens(text: string, model = 'gpt-4o-mini'): Promise<number> {
  // If tiktoken failed to load, use fallback immediately
  if (tiktokenLoadFailed) {
    return fallbackTokenEstimation(text, model);
  }
  
  try {
    const encoding = await getModelEncoding(model);
    if (!encoding) {
      return fallbackTokenEstimation(text, model);
    }
    
    const tokens = encoding.encode(text);
    encoding.free(); // Important: free the encoding to prevent memory leaks
    return tokens.length;
  } catch (error) {
    console.warn('Token counting error, using fallback estimation:', error);
    return fallbackTokenEstimation(text, model);
  }
}

/**
 * Estimate tokens for image content based on resolution
 * Based on OpenAI's vision model pricing
 */
function estimateImageTokens(imageUrl: string): number {
  // Base tokens for image processing
  let baseTokens = 85;
  
  // Try to estimate based on data URL size (rough approximation)
  if (imageUrl.startsWith('data:image/')) {
    const sizeEstimate = imageUrl.length * 0.75; // Account for base64 encoding
    
    // Rough categorization based on file size
    if (sizeEstimate > 500000) { // > 500KB, likely high resolution
      baseTokens += 750; // High detail tokens
    } else if (sizeEstimate > 50000) { // > 50KB, likely medium resolution
      baseTokens += 250; // Medium detail tokens
    } else {
      baseTokens += 85; // Low detail tokens
    }
  } else {
    // External image URL, assume medium resolution
    baseTokens += 250;
  }
  
  return baseTokens;
}

/**
 * Count tokens for message content (text and images)
 */
async function countMessageTokens(content: MessageContent['content'], model: string): Promise<{ textTokens: number; imageTokens: number }> {
  let textTokens = 0;
  let imageTokens = 0;
  
  if (typeof content === 'string') {
    textTokens = await countTextTokens(content, model);
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        textTokens += await countTextTokens(item.text, model);
      } else if (item.type === 'image_url' && item.image_url?.url) {
        imageTokens += estimateImageTokens(item.image_url.url);
      }
    }
  }
  
  return { textTokens, imageTokens };
}

/**
 * Estimate total tokens for a conversation
 */
export async function estimateConversationTokens(messages: MessageContent[], model = 'gpt-4o-mini'): Promise<TokenEstimate> {
  let totalTextTokens = 0;
  let totalImageTokens = 0;
  let warning: string | undefined;
  
  // Tokens per message overhead (varies by model)
  const tokensPerMessage = model.includes('gpt-3.5') ? 4 : 3;
  const tokensPerName = 1;
  
  try {
    for (const message of messages) {
      const { textTokens, imageTokens } = await countMessageTokens(message.content, model);
      totalTextTokens += textTokens;
      totalImageTokens += imageTokens;
      
      // Add message formatting overhead
      totalTextTokens += tokensPerMessage;
      if (message.role) {
        totalTextTokens += tokensPerName;
      }
    }
  } catch (error) {
    console.warn('Error counting message tokens, using fallback estimation:', error);
    // Fallback estimation
    for (const message of messages) {
      let chars = 0;
      if (typeof message.content === 'string') {
        chars += message.content.length;
      } else if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'text' && item.text) {
            chars += item.text.length;
          } else if (item.type === 'image_url') {
            totalImageTokens += 250; // Rough image estimate
          }
        }
      }
      totalTextTokens += Math.ceil(chars / 4);
      totalTextTokens += tokensPerMessage;
      if (message.role) {
        totalTextTokens += tokensPerName;
      }
    }
  }
  
  // Add overhead for the response priming
  totalTextTokens += 3;
  
  const totalTokens = totalTextTokens + totalImageTokens;
  
  // Add warnings for high token counts
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
    warning
  };
}

/**
 * Estimate tokens for a simple text + context combination
 */
export async function estimateSimpleTokens(question: string, context: string, model = 'gpt-4o-mini'): Promise<TokenEstimate> {
  let messages: MessageContent[] = [];
  
  if (context.startsWith('data:image/')) {
    // Image context
    messages = [
      {
        role: 'system',
        content: 'You are analyzing the provided image. Be specific and detailed in your observations.'
      },
      {
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
      }
    ];
  } else {
    // Text context
    const systemContent = context ? 
      `You are analyzing the following content:\n\n${context}` : 
      'You are analyzing the current webpage.';
    
    messages = [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: question
      }
    ];
  }
  
  return await estimateConversationTokens(messages, model);
}

/**
 * Format token count for display
 */
export function formatTokenCount(estimate: TokenEstimate): string {
  const parts = [];
  
  if (estimate.imageTokens > 0) {
    parts.push(`${estimate.tokens.toLocaleString()} text`);
    parts.push(`${estimate.imageTokens.toLocaleString()} image`);
    parts.push(`${estimate.totalTokens.toLocaleString()} total tokens`);
  } else {
    parts.push(`${estimate.totalTokens.toLocaleString()} tokens`);
  }
  
  return parts.join(' + ');
}

/**
 * Get token count with color coding based on usage level
 */
export function getTokenCountWithStatus(estimate: TokenEstimate): { text: string; status: 'low' | 'moderate' | 'high' | 'very-high' } {
  let text = formatTokenCount(estimate);
  
  // Add fallback indicator if tiktoken failed to load
  if (tiktokenLoadFailed) {
    text += ' (estimated)';
  }
  
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