import { APIClient, OPENAI_PROVIDER, DEEPSEEK_PROVIDER, GEMINI_PROVIDER, createAPIClient, detectProvider } from '../utils/apiClient';

// Mock fetch
const mockFetch = jest.fn();
Object.defineProperty(window, 'fetch', { value: mockFetch, writable: true });

// Mock AbortController
Object.defineProperty(window, 'AbortController', {
  value: jest.fn(() => ({
    signal: {},
    abort: jest.fn()
  })),
  writable: true
});

// Mock setTimeout and clearTimeout
Object.defineProperty(window, 'setTimeout', {
  value: jest.fn((fn: Function, delay: number) => {
    if (typeof fn === 'function') {
      fn();
    }
    return 1;
  }),
  writable: true
});
Object.defineProperty(window, 'clearTimeout', { value: jest.fn(), writable: true });

// Mock TextEncoder and TextDecoder for Node.js environment
Object.defineProperty(window, 'TextEncoder', {
  value: class TextEncoder {
    encode(input: string): Uint8Array {
      const bytes = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) {
        bytes[i] = input.charCodeAt(i);
      }
      return bytes;
    }
  },
  writable: true
});

Object.defineProperty(window, 'TextDecoder', {
  value: class TextDecoder {
    decode(input: Uint8Array): string {
      return String.fromCharCode(...Array.from(input));
    }
  },
  writable: true
});

describe('APIClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Provider Detection', () => {
    it('should detect DeepSeek provider', () => {
      const provider = detectProvider('https://api.deepseek.com/v1');
      expect(provider.name).toBe('DeepSeek');
    });

    it('should detect Gemini provider from googleapis URL', () => {
      const provider = detectProvider('https://generativelanguage.googleapis.com/v1beta');
      expect(provider.name).toBe('Gemini');
    });

    it('should detect Gemini provider from gemini keyword', () => {
      const provider = detectProvider('https://api.gemini.example.com/v1');
      expect(provider.name).toBe('Gemini');
    });

    it('should default to OpenAI provider', () => {
      const provider = detectProvider('https://api.openai.com/v1');
      expect(provider.name).toBe('OpenAI');
    });

    it('should default to OpenAI for unknown URLs', () => {
      const provider = detectProvider('https://custom-api.example.com');
      expect(provider.name).toBe('OpenAI');
    });
  });

  describe('Request Handling', () => {
    it('should make successful non-streaming request', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { total_tokens: 100 }
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const client = new APIClient({
        apiKey: 'test-key',
        provider: OPENAI_PROVIDER
      });

      const response = await client.sendRequest({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(response.content).toBe('Test response');
      expect(response.usage?.total_tokens).toBe(100);
    });

    it('should handle streaming request', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: [DONE]\n'
      ];

      const encoder = new (window as any).TextEncoder();
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[0]) })
          .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[1]) })
          .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[2]) })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: jest.fn()
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader
        }
      };
      mockFetch.mockResolvedValue(mockResponse);

      const client = new APIClient({
        apiKey: 'test-key',
        provider: OPENAI_PROVIDER
      });

      let accumulatedContent = '';
      const response = await client.sendStreamingRequest(
        {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        (chunk) => {
          accumulatedContent += chunk;
        }
      );

      expect(accumulatedContent).toBe('Hello world');
      expect(response.content).toBe('Hello world');
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Success after retry' } }]
          })
        });

      const client = new APIClient({
        apiKey: 'test-key',
        provider: OPENAI_PROVIDER,
        maxRetries: 3,
        retryDelay: 0
      });

      const response = await client.sendRequest({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(response.content).toBe('Success after retry');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({
          error: { message: 'Invalid API key' }
        })
      });

      const client = new APIClient({
        apiKey: 'invalid-key',
        provider: OPENAI_PROVIDER,
        maxRetries: 3
      });

      await expect(client.sendRequest({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow('API request failed: 401 Unauthorized');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: jest.fn().mockResolvedValue({
            error: { message: 'Rate limit exceeded' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Success after rate limit' } }]
          })
        });

      const client = new APIClient({
        apiKey: 'test-key',
        provider: OPENAI_PROVIDER,
        maxRetries: 3,
        retryDelay: 0
      });

      const response = await client.sendRequest({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(response.content).toBe('Success after rate limit');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Provider Formatting', () => {
    it('should format OpenAI request correctly', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        max_tokens: 100,
        temperature: 0.7
      };

      const formatted = OPENAI_PROVIDER.formatRequest(request);
      expect(formatted).toEqual({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        max_tokens: 100,
        temperature: 0.7,
        top_p: undefined
      });
    });

    it('should format DeepSeek request correctly', () => {
      const request = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        max_tokens: 100,
        temperature: 0.7
      };

      const formatted = DEEPSEEK_PROVIDER.formatRequest(request);
      expect(formatted).toEqual({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        max_tokens: 100,
        temperature: 0.7
      });
    });

    it('should format Gemini request correctly', () => {
      const request = {
        model: 'gemini-1.5-pro',
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant' },
          { role: 'user' as const, content: 'Hello' }
        ],
        max_tokens: 100,
        temperature: 0.7
      };

      const formatted = GEMINI_PROVIDER.formatRequest(request);
      expect(formatted).toEqual({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'System instruction: You are a helpful assistant' }]
          },
          {
            role: 'user',
            parts: [{ text: 'Hello' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7
        }
      });
    });

    it('should format Gemini request with image correctly', () => {
      const request = {
        model: 'gemini-1.5-pro',
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: 'What is in this image?' },
              { type: 'image_url' as const, image_url: { url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD' } }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      };

      const formatted = GEMINI_PROVIDER.formatRequest(request);
      expect(formatted.contents[0].parts).toHaveLength(2);
      expect(formatted.contents[0].parts[0]).toEqual({ text: 'What is in this image?' });
      expect(formatted.contents[0].parts[1]).toEqual({
        inlineData: {
          mimeType: 'image/jpeg',
          data: '/9j/4AAQSkZJRgABAQAAAQABAAD'
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should create appropriate error types', async () => {
      // Test timeout error
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const client = new APIClient({
        apiKey: 'test-key',
        provider: OPENAI_PROVIDER,
        maxRetries: 0
      });

      try {
        await client.sendRequest({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      } catch (error: any) {
        expect(error.type).toBe('timeout');
        expect(error.message).toBe('Request timeout');
      }
    });

    it('should handle API errors with status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({
          error: { message: 'Server error' }
        })
      });

      const client = new APIClient({
        apiKey: 'test-key',
        provider: OPENAI_PROVIDER,
        maxRetries: 0
      });

      try {
        await client.sendRequest({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      } catch (error: any) {
        expect(error.type).toBe('api');
        expect(error.status).toBe(500);
      }
    });
  });

  describe('Factory Function', () => {
    it('should create client with correct provider', () => {
      const client = createAPIClient('test-key', 'https://api.deepseek.com/v1');
      expect(client).toBeInstanceOf(APIClient);
    });

    it('should handle custom base URLs', () => {
      const client = createAPIClient('test-key', 'https://custom-api.example.com/v1/chat/completions');
      expect(client).toBeInstanceOf(APIClient);
    });
  });
}); 