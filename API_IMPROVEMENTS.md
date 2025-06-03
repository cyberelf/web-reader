# LLM API Improvements

This document outlines the significant improvements made to the LLM API calling logic in the web-reader extension.

## Overview

The original implementation had several issues that have been addressed with a complete rewrite of the API handling system.

## Problems with Original Implementation

### 1. **Inefficient Double API Calls**
- Made two separate requests: one non-streaming for token usage, then streaming for response
- Doubled the API costs and increased latency
- Wasted rate limit quota

### 2. **Poor Error Handling**
- Limited error categorization
- No user-friendly error messages
- No distinction between retryable and non-retryable errors

### 3. **No Retry Logic**
- Failed requests were not automatically retried
- Network issues caused immediate failures
- No exponential backoff for rate limits

### 4. **No Request Timeout**
- Requests could hang indefinitely
- No way to cancel long-running requests

### 5. **Hardcoded OpenAI Format**
- Tightly coupled to OpenAI's API structure
- Difficult to add support for other providers
- No abstraction for different API formats

### 6. **No Rate Limiting**
- No protection against hitting API rate limits
- Could overwhelm the API with rapid requests
- No usage tracking or warnings

## New Implementation Features

### 1. **Unified API Client (`src/utils/apiClient.ts`)**

#### Provider Abstraction
```typescript
interface APIProvider {
  name: string;
  baseUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  formatRequest: (request: LLMRequest) => any;
  parseResponse: (response: any) => LLMResponse;
  parseStreamChunk: (chunk: string) => string | null;
  supportsStreaming: boolean;
}
```

#### Supported Providers
- **OpenAI**: Full support with streaming
- **DeepSeek**: Full support with streaming
- **Gemini**: Full support with streaming (Google's Gemini models)
- **Extensible**: Easy to add new providers

#### Advanced Error Handling
```typescript
interface APIError extends Error {
  status?: number;
  code?: string;
  type?: 'network' | 'api' | 'rate_limit' | 'timeout' | 'unknown';
}
```

#### Intelligent Retry Logic
- Exponential backoff with jitter
- Different retry strategies based on error type
- No retry for authentication errors (4xx except 429)
- Automatic retry for network, timeout, and server errors

#### Request Queue Management
- Prevents overwhelming the API
- Configurable concurrency limits
- Automatic queuing of requests

### 2. **Rate Limiting System (`src/utils/rateLimiter.ts`)**

#### Features
- **Multi-level Rate Limiting**: Requests per minute/hour/day, tokens per minute/day
- **Provider-specific Limits**: Predefined configurations for different providers
- **Usage Tracking**: Persistent storage of request history
- **Proactive Prevention**: Checks limits before making requests
- **User Feedback**: Clear messages about wait times

#### Predefined Configurations
```typescript
const RATE_LIMIT_CONFIGS = {
  OPENAI_FREE: { requestsPerMinute: 3, tokensPerDay: 200000 },
  OPENAI_PAID: { requestsPerMinute: 60, tokensPerDay: 2000000 },
  DEEPSEEK: { requestsPerMinute: 30, tokensPerDay: 1000000 },
  GEMINI_FREE: { requestsPerMinute: 15, tokensPerDay: 50000 },
  GEMINI_PAID: { requestsPerMinute: 360, tokensPerDay: 4000000 },
  CONSERVATIVE: { requestsPerMinute: 2, tokensPerDay: 100000 }
};
```

### 3. **Enhanced Message Handler (`src/components/chat/messageHandler.ts`)**

#### Single Request Streaming
- Eliminates the double API call issue
- Gets token usage from streaming response metadata
- Reduces API costs by 50%

#### Smart Token Estimation
- Estimates token usage before making requests
- Helps with rate limiting decisions
- Accounts for image processing overhead

#### User-Friendly Error Messages
```typescript
function createUserFriendlyErrorMessage(error: APIError): string {
  switch (error.type) {
    case 'network': return 'Network error: Please check your internet connection...';
    case 'rate_limit': return 'Rate limit exceeded: Please wait a moment...';
    case 'timeout': return 'Request timeout: The request took too long...';
    // ... more cases
  }
}
```

#### Rate Limit Integration
- Checks rate limits before making requests
- Provides clear feedback about wait times
- Automatically selects appropriate rate limiter based on provider

## Usage Examples

### Basic API Client Usage
```typescript
import { createAPIClient } from '../utils/apiClient';

const client = createAPIClient('your-api-key', 'https://api.openai.com/v1');

// Non-streaming request
const response = await client.sendRequest({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Streaming request
const response = await client.sendStreamingRequest(
  { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello!' }] },
  (chunk) => console.log(chunk)
);
```

### Gemini Provider Usage
```typescript
import { createAPIClient } from '../utils/apiClient';

// Using Google's Gemini API
const client = createAPIClient('your-google-api-key', 'https://generativelanguage.googleapis.com/v1beta');

// Text generation with Gemini
const response = await client.sendStreamingRequest(
  { 
    model: 'gemini-1.5-pro', 
    messages: [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Explain quantum computing' }
    ]
  },
  (chunk) => console.log(chunk)
);

// Vision capabilities with Gemini
const response = await client.sendRequest({
  model: 'gemini-1.5-pro',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What do you see in this image?' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }
    ]
  }]
});
```

### Rate Limiter Usage
```typescript
import { createRateLimiter } from '../utils/rateLimiter';

const limiter = createRateLimiter('OPENAI_FREE');

const check = await limiter.canMakeRequest(1000); // estimated tokens
if (check.allowed) {
  // Make request
  await limiter.recordRequest(actualTokens);
} else {
  console.log(`Rate limited: ${check.reason}`);
}
```

## Performance Improvements

### 1. **Reduced API Calls**
- **Before**: 2 API calls per request (non-streaming + streaming)
- **After**: 1 API call per request (streaming only)
- **Improvement**: 50% reduction in API costs and latency

### 2. **Better Error Recovery**
- **Before**: Immediate failure on any error
- **After**: Intelligent retry with exponential backoff
- **Improvement**: Higher success rate, better user experience

### 3. **Proactive Rate Limiting**
- **Before**: No rate limit protection
- **After**: Prevents hitting rate limits, provides user feedback
- **Improvement**: Avoids API blocks, better resource management

### 4. **Request Queuing**
- **Before**: Concurrent requests could overwhelm API
- **After**: Intelligent queuing with concurrency limits
- **Improvement**: More stable API usage, better performance

## Configuration Options

### API Client Configuration
```typescript
interface APIClientConfig {
  apiKey: string;
  provider: APIProvider;
  timeout?: number;        // Default: 30000ms
  maxRetries?: number;     // Default: 3
  retryDelay?: number;     // Default: 1000ms
  requestQueue?: boolean;  // Default: true
}
```

### Rate Limiter Configuration
```typescript
interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}
```

## Testing

Comprehensive test suite covers:
- Provider detection and formatting
- Request/response handling
- Error scenarios and retry logic
- Rate limiting functionality
- Streaming response processing

Run tests with:
```bash
npm test
```

## Migration Guide

The new implementation is backward compatible. The main `handleQuestion` function maintains the same interface, so no changes are required in existing code.

### Optional Optimizations
1. **Update Settings**: Add rate limiter configuration options
2. **Provider Selection**: Allow users to choose rate limit profiles
3. **Usage Dashboard**: Display rate limit status and usage statistics

## Future Enhancements

### 1. **Additional Providers**
- Anthropic Claude
- Google Gemini
- Local LLM support (Ollama, etc.)

### 2. **Advanced Features**
- Request caching
- Response compression
- Batch request processing
- Cost tracking and budgets

### 3. **Monitoring**
- Request analytics
- Performance metrics
- Error rate tracking

## Conclusion

The new LLM API implementation provides:
- **50% cost reduction** through single-request streaming
- **Better reliability** with intelligent retry logic
- **Rate limit protection** with proactive checking
- **Multi-provider support** with easy extensibility
- **Enhanced user experience** with clear error messages

This foundation makes the extension more robust, cost-effective, and ready for future enhancements. 