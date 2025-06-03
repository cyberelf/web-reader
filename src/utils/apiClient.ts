/// <reference types="chrome"/>

export interface APIProvider {
  name: string;
  baseUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  formatRequest: (request: LLMRequest) => any;
  parseResponse: (response: any) => LLMResponse;
  parseStreamChunk: (chunk: string) => string | null;
  supportsStreaming: boolean;
}

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'system' | 'assistant';
    content: string | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
      };
    }>;
  }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  model?: string;
  finish_reason?: string;
}

export interface APIError extends Error {
  status?: number;
  code?: string;
  type?: 'network' | 'api' | 'rate_limit' | 'timeout' | 'unknown';
}

export interface APIClientConfig {
  apiKey: string;
  provider: APIProvider;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  requestQueue?: boolean;
}

// OpenAI Provider
export const OPENAI_PROVIDER: APIProvider = {
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  headers: (apiKey: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }),
  formatRequest: (request: LLMRequest) => ({
    model: request.model,
    messages: request.messages,
    stream: request.stream || false,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    top_p: request.top_p
  }),
  parseResponse: (response: any): LLMResponse => ({
    content: response.choices?.[0]?.message?.content || '',
    usage: response.usage,
    model: response.model,
    finish_reason: response.choices?.[0]?.finish_reason
  }),
  parseStreamChunk: (chunk: string): string | null => {
    if (chunk.startsWith('data: ') && chunk !== 'data: [DONE]') {
      try {
        const data = JSON.parse(chunk.slice(6));
        return data.choices?.[0]?.delta?.content || null;
      } catch {
        return null;
      }
    }
    return null;
  },
  supportsStreaming: true
};

// DeepSeek Provider
export const DEEPSEEK_PROVIDER: APIProvider = {
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  headers: (apiKey: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }),
  formatRequest: (request: LLMRequest) => ({
    model: request.model,
    messages: request.messages,
    stream: request.stream || false,
    max_tokens: request.max_tokens,
    temperature: request.temperature
  }),
  parseResponse: (response: any): LLMResponse => ({
    content: response.choices?.[0]?.message?.content || '',
    usage: response.usage,
    model: response.model,
    finish_reason: response.choices?.[0]?.finish_reason
  }),
  parseStreamChunk: (chunk: string): string | null => {
    if (chunk.startsWith('data: ') && chunk !== 'data: [DONE]') {
      try {
        const data = JSON.parse(chunk.slice(6));
        return data.choices?.[0]?.delta?.content || null;
      } catch {
        return null;
      }
    }
    return null;
  },
  supportsStreaming: true
};

// Gemini Provider
export const GEMINI_PROVIDER: APIProvider = {
  name: 'Gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  headers: (apiKey: string) => ({
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  }),
  formatRequest: (request: LLMRequest) => {
    // Convert OpenAI format to Gemini format
    const contents = request.messages.map(msg => {
      if (msg.role === 'system') {
        // Gemini doesn't have system role, convert to user message with instruction
        return {
          role: 'user',
          parts: [{ text: `System instruction: ${msg.content}` }]
        };
      } else if (msg.role === 'assistant') {
        return {
          role: 'model',
          parts: Array.isArray(msg.content) 
            ? msg.content.map(part => {
                if (part.type === 'text') {
                  return { text: part.text };
                } else if (part.type === 'image_url') {
                  // Gemini expects inline data for images
                  const base64Data = part.image_url?.url.split(',')[1];
                  return {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Data
                    }
                  };
                }
                return { text: '' };
              })
            : [{ text: msg.content as string }]
        };
      } else {
        // user role
        return {
          role: 'user',
          parts: Array.isArray(msg.content) 
            ? msg.content.map(part => {
                if (part.type === 'text') {
                  return { text: part.text };
                } else if (part.type === 'image_url') {
                  // Extract base64 data from data URL
                  const base64Data = part.image_url?.url.split(',')[1];
                  return {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Data
                    }
                  };
                }
                return { text: '' };
              })
            : [{ text: msg.content as string }]
        };
      }
    });

    const geminiRequest: any = {
      contents,
      generationConfig: {
        maxOutputTokens: request.max_tokens || 4000,
        temperature: request.temperature || 0.7
      }
    };

    // Add streaming configuration if needed
    if (request.stream) {
      geminiRequest.generationConfig.candidateCount = 1;
    }

    return geminiRequest;
  },
  parseResponse: (response: any): LLMResponse => {
    const candidate = response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    // Gemini doesn't provide detailed usage stats in the same format
    const usage = response.usageMetadata ? {
      total_tokens: response.usageMetadata.totalTokenCount || 0,
      prompt_tokens: response.usageMetadata.promptTokenCount || 0,
      completion_tokens: response.usageMetadata.candidatesTokenCount || 0
    } : undefined;

    return {
      content,
      usage,
      model: response.modelVersion,
      finish_reason: candidate?.finishReason?.toLowerCase()
    };
  },
  parseStreamChunk: (chunk: string): string | null => {
    if (chunk.startsWith('data: ') && chunk !== 'data: [DONE]') {
      try {
        const data = JSON.parse(chunk.slice(6));
        const candidate = data.candidates?.[0];
        return candidate?.content?.parts?.[0]?.text || null;
      } catch {
        return null;
      }
    }
    return null;
  },
  supportsStreaming: true
};

class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private maxConcurrent = 3;
  private currentRequests = 0;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.currentRequests >= this.maxConcurrent) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.currentRequests < this.maxConcurrent) {
      const request = this.queue.shift();
      if (request) {
        this.currentRequests++;
        request().finally(() => {
          this.currentRequests--;
          this.process();
        });
      }
    }

    this.processing = false;
  }
}

export class APIClient {
  private config: APIClientConfig;
  private requestQueue?: RequestQueue;

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      requestQueue: true,
      ...config
    };

    if (this.config.requestQueue) {
      this.requestQueue = new RequestQueue();
    }
  }

  async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const executeRequest = () => this.executeRequest(request);
    
    if (this.requestQueue) {
      return this.requestQueue.add(executeRequest);
    }
    
    return executeRequest();
  }

  async sendStreamingRequest(
    request: LLMRequest,
    onChunk: (content: string) => void
  ): Promise<LLMResponse> {
    const executeRequest = () => this.executeStreamingRequest(request, onChunk);
    
    if (this.requestQueue) {
      return this.requestQueue.add(executeRequest);
    }
    
    return executeRequest();
  }

  private async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    let lastError: APIError | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const response = await this.makeRequest(request);
        return this.config.provider.parseResponse(response);
      } catch (error) {
        lastError = this.createAPIError(error);
        
        if (attempt === this.config.maxRetries || !this.shouldRetry(lastError)) {
          break;
        }

        await this.delay(this.config.retryDelay! * Math.pow(2, attempt));
      }
    }

    throw lastError;
  }

  private async executeStreamingRequest(
    request: LLMRequest,
    onChunk: (content: string) => void
  ): Promise<LLMResponse> {
    if (!this.config.provider.supportsStreaming) {
      throw new Error(`Provider ${this.config.provider.name} does not support streaming`);
    }

    const streamRequest = { ...request, stream: true };
    let lastError: APIError | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await this.makeStreamingRequest(streamRequest, onChunk);
      } catch (error) {
        lastError = this.createAPIError(error);
        
        if (attempt === this.config.maxRetries || !this.shouldRetry(lastError)) {
          break;
        }

        await this.delay(this.config.retryDelay! * Math.pow(2, attempt));
      }
    }

    throw lastError;
  }

  private async makeRequest(request: LLMRequest): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const formattedRequest = this.config.provider.formatRequest(request);
      
      // Determine the correct endpoint based on provider
      let endpoint = `${this.config.provider.baseUrl}/chat/completions`;
      if (this.config.provider.name === 'Gemini') {
        endpoint = `${this.config.provider.baseUrl}/models/${request.model}:generateContent`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.config.provider.headers(this.config.apiKey),
        body: JSON.stringify(formattedRequest),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async makeStreamingRequest(
    request: LLMRequest,
    onChunk: (content: string) => void
  ): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const formattedRequest = this.config.provider.formatRequest(request);
      
      // Determine the correct endpoint based on provider
      let endpoint = `${this.config.provider.baseUrl}/chat/completions`;
      if (this.config.provider.name === 'Gemini') {
        endpoint = `${this.config.provider.baseUrl}/models/${request.model}:streamGenerateContent?alt=sse`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.config.provider.headers(this.config.apiKey),
        body: JSON.stringify(formattedRequest),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let usage: any = null;
      let model: string | undefined;
      let finishReason: string | undefined;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            const content = this.config.provider.parseStreamChunk(line);
            if (content) {
              accumulatedContent += content;
              onChunk(content);
            }

            // Try to extract metadata from the chunk
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Handle different response formats
                if (this.config.provider.name === 'Gemini') {
                  if (data.usageMetadata) usage = {
                    total_tokens: data.usageMetadata.totalTokenCount || 0,
                    prompt_tokens: data.usageMetadata.promptTokenCount || 0,
                    completion_tokens: data.usageMetadata.candidatesTokenCount || 0
                  };
                  if (data.modelVersion) model = data.modelVersion;
                  if (data.candidates?.[0]?.finishReason) {
                    finishReason = data.candidates[0].finishReason.toLowerCase();
                  }
                } else {
                  // OpenAI/DeepSeek format
                  if (data.usage) usage = data.usage;
                  if (data.model) model = data.model;
                  if (data.choices?.[0]?.finish_reason) {
                    finishReason = data.choices[0].finish_reason;
                  }
                }
              } catch {
                // Ignore parsing errors for metadata
              }
            }
          }
        }

        return {
          content: accumulatedContent,
          usage,
          model,
          finish_reason: finishReason
        };
      } finally {
        reader.releaseLock();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private createAPIError(error: any): APIError {
    const apiError = new Error(error.message || 'Unknown API error') as APIError;
    
    if (error.name === 'AbortError') {
      apiError.type = 'timeout';
      apiError.message = 'Request timeout';
    } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      apiError.type = 'network';
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      apiError.type = 'rate_limit';
    } else if (error.message?.includes('API request failed')) {
      apiError.type = 'api';
      const statusMatch = error.message.match(/(\d{3})/);
      if (statusMatch) {
        apiError.status = parseInt(statusMatch[1]);
      }
    } else {
      apiError.type = 'unknown';
    }

    return apiError;
  }

  private shouldRetry(error: APIError): boolean {
    // Don't retry on authentication errors or client errors (4xx except 429)
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }

    // Retry on network errors, timeouts, rate limits, and server errors
    return ['network', 'timeout', 'rate_limit'].includes(error.type || 'unknown') || 
           (error.status !== undefined && error.status >= 500);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(newConfig: Partial<APIClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Provider detection utility
export function detectProvider(apiUrl: string): APIProvider {
  if (apiUrl.includes('deepseek')) {
    return DEEPSEEK_PROVIDER;
  } else if (apiUrl.includes('generativelanguage.googleapis.com') || apiUrl.includes('gemini')) {
    return GEMINI_PROVIDER;
  }
  // Default to OpenAI for compatibility
  return OPENAI_PROVIDER;
}

// Factory function for creating API client
export function createAPIClient(apiKey: string, apiUrl: string, customConfig?: Partial<APIClientConfig>): APIClient {
  const provider = detectProvider(apiUrl);
  
  // Update provider base URL if custom URL is provided
  const customProvider = {
    ...provider,
    baseUrl: apiUrl.replace(/\/chat\/completions$/, '').replace(/\/$/, '')
  };

  return new APIClient({
    apiKey,
    provider: customProvider,
    ...customConfig
  });
} 