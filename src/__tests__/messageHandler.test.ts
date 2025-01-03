import { getSettings } from '../settings';
import { handleQuestion } from '../components/chat/messageHandler';

jest.mock('../settings');

// Create a minimal Response implementation
class MockResponse implements Response {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  private responseData: any;

  constructor(ok: boolean, data: any, status: number = 200, statusText: string = '') {
    this.ok = ok;
    this.responseData = data;
    this.status = status;
    this.statusText = statusText;
  }

  json(): Promise<any> {
    return Promise.resolve(this.responseData);
  }

  // Implement required Response interface properties
  readonly headers: Headers = new Headers();
  readonly redirected: boolean = false;
  readonly type: ResponseType = 'basic';
  readonly url: string = '';
  readonly body: ReadableStream<Uint8Array> | null = null;
  readonly bodyUsed: boolean = false;

  arrayBuffer(): Promise<ArrayBuffer> {
    throw new Error('Method not implemented.');
  }
  blob(): Promise<Blob> {
    throw new Error('Method not implemented.');
  }
  formData(): Promise<FormData> {
    throw new Error('Method not implemented.');
  }
  text(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  clone(): Response {
    return new MockResponse(this.ok, this.responseData, this.status, this.statusText);
  }
  bytes(): Promise<Uint8Array> {
    throw new Error('Method not implemented.');
  }
}

// Mock fetch function
const mockFetch = jest.fn();

// Set up global fetch mock
Object.defineProperty(window, 'fetch', {
  value: mockFetch,
  writable: true
});

describe('Message Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('should throw error when API key is not set', async () => {
    (getSettings as jest.Mock).mockResolvedValue({
      apiUrl: 'https://api.openai.com/v1',
      showIcon: true,
      shortcuts: {}
    });

    await expect(async () => {
      await handleQuestion('test question', 'test context');
    }).rejects.toThrow('Please set your OpenAI API key in the extension settings');
  });

  it('should throw error when API key is empty', async () => {
    (getSettings as jest.Mock).mockResolvedValue({
      apiKey: '',
      apiUrl: 'https://api.openai.com/v1',
      showIcon: true,
      shortcuts: {}
    });

    await expect(async () => {
      await handleQuestion('test question', 'test context');
    }).rejects.toThrow('Please set your OpenAI API key in the extension settings');
  });

  it('should proceed with valid API key', async () => {
    (getSettings as jest.Mock).mockResolvedValue({
      apiKey: 'valid-api-key',
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      showIcon: true,
      shortcuts: {}
    });

    // Mock fetch response
    mockFetch.mockResolvedValue(
      new MockResponse(true, { choices: [{ message: { content: 'test response' } }] })
    );

    const response = await handleQuestion('test question', 'test context');
    expect(response).toBe('test response');
  });

  it('should use custom API URL when provided', async () => {
    const customUrl = 'https://custom-openai-url.com';
    (getSettings as jest.Mock).mockResolvedValue({
      apiKey: 'valid-api-key',
      apiUrl: customUrl,
      model: 'gpt-4',
      showIcon: true,
      shortcuts: {}
    });

    mockFetch.mockResolvedValue(
      new MockResponse(true, { choices: [{ message: { content: 'test response' } }] })
    );

    await handleQuestion('test question', 'test context');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(customUrl),
      expect.any(Object)
    );
  });

  it('should handle API errors gracefully', async () => {
    (getSettings as jest.Mock).mockResolvedValue({
      apiKey: 'valid-api-key',
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      showIcon: true,
      shortcuts: {}
    });

    mockFetch.mockResolvedValue(
      new MockResponse(false, {}, 401, 'Unauthorized')
    );

    await expect(async () => {
      await handleQuestion('test question', 'test context');
    }).rejects.toThrow('API request failed: 401 Unauthorized');
  });
}); 