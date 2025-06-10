import { handleQuestion } from '../components/chat/messageHandler';
import { modelManager } from '../utils/modelManager';

// Mock the chatHistory functions
jest.mock('../components/chat/chatHistory', () => ({
  addMessage: jest.fn().mockResolvedValue(undefined),
  updateLastMessage: jest.fn().mockResolvedValue(undefined),
}));

// Mock the modelManager
jest.mock('../utils/modelManager', () => ({
  modelManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getCurrentConfig: jest.fn(),
  }
}));

// Mock the API client
jest.mock('../utils/apiClient', () => ({
  createAPIClient: jest.fn().mockReturnValue({
    sendStreamingRequest: jest.fn().mockResolvedValue({
      usage: { total_tokens: 100 }
    })
  })
}));

// Mock the rate limiter
jest.mock('../utils/rateLimiter', () => ({
  createRateLimiter: jest.fn().mockReturnValue({
    canMakeRequest: jest.fn().mockResolvedValue({ allowed: true }),
    recordRequest: jest.fn().mockResolvedValue(undefined)
  }),
  RateLimiter: jest.fn().mockImplementation(() => ({
    canMakeRequest: jest.fn().mockResolvedValue({ allowed: true }),
    recordRequest: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock the image utilities
jest.mock('../utils/imageUtils', () => ({
  resizeImage: jest.fn().mockResolvedValue('data:image/png;base64,resized')
}));

// Mock the prompt shortcuts
jest.mock('../components/chat/promptShortcuts', () => ({
  handleShortcut: jest.fn().mockResolvedValue(null)
}));

// Mock Chrome API
const mockChromeStorage = {
  sync: {
    get: jest.fn().mockImplementation((keys, callback) => {
      if (callback) {
        callback({ customPrompts: {} });
      }
      return Promise.resolve({ customPrompts: {} });
    }),
    set: jest.fn(),
  },
  local: {
    get: jest.fn().mockImplementation((keys, callback) => {
      if (callback) {
        callback({ tokenUsage: { totalTokens: 0, requestCount: 0 } });
      }
      return Promise.resolve({ tokenUsage: { totalTokens: 0, requestCount: 0 } });
    }),
    set: jest.fn().mockImplementation((data, callback) => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
  },
  onChanged: {
    addListener: jest.fn(),
  }
};

Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: mockChromeStorage,
    runtime: {
      lastError: null,
    }
  },
  writable: true
});

describe('Message Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error when no API config is available', async () => {
    (modelManager.getCurrentConfig as jest.Mock).mockReturnValue(null);

    await expect(async () => {
      await handleQuestion('test question', 'test context');
    }).rejects.toThrow('Please configure an API provider in the extension settings.');
  });

  it('should throw error when API key is not set', async () => {
    (modelManager.getCurrentConfig as jest.Mock).mockReturnValue({
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4'
    });

    await expect(async () => {
      await handleQuestion('test question', 'test context');
    }).rejects.toThrow('Please configure an API provider in the extension settings.');
  });

  it('should proceed with valid API key', async () => {
    (modelManager.getCurrentConfig as jest.Mock).mockReturnValue({
      apiKey: 'valid-api-key',
      apiUrl: 'https://api.openai.com/v1',
      model: 'gpt-4'
    });

    // This should not throw an error
    await expect(handleQuestion('test question', 'test context')).resolves.not.toThrow();
  });

  it('should handle API configuration correctly', async () => {
    const mockConfig = {
      apiKey: 'valid-api-key',
      apiUrl: 'https://custom-openai-url.com',
      model: 'gpt-4'
    };
    
    (modelManager.getCurrentConfig as jest.Mock).mockReturnValue(mockConfig);

    await handleQuestion('test question', 'test context');
    
    // Verify that modelManager was initialized
    expect(modelManager.initialize).toHaveBeenCalled();
    expect(modelManager.getCurrentConfig).toHaveBeenCalled();
  });
}); 