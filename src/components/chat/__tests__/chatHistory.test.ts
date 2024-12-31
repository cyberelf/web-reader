/// <reference types="jest" />

// Mock chrome API before imports
const mockChrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListeners: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
  },
};

(globalThis as any).chrome = mockChrome;

import { addMessage, clearChatHistory, loadChatHistory } from '../chatHistory';
import { renderMarkdown } from '../../../utils/markdown';

jest.mock('../../../utils/markdown', () => ({
  renderMarkdown: jest.fn(),
}));

describe('Chat History', () => {
  let mockStorage: { [key: string]: any } = {};
  let answerDiv: HTMLDivElement;
  let clearButton: HTMLButtonElement;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset storage mock
    mockStorage = {};
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: string | string[] | object, callback) => {
      let result: { [key: string]: any } = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = mockStorage[key];
        });
      } else if (typeof keys === 'string') {
        result[keys] = mockStorage[keys];
      } else {
        result = { ...mockStorage };
      }
      callback?.(result);
      return Promise.resolve(result);
    });
    (chrome.storage.local.set as jest.Mock).mockImplementation((data, callback) => {
      Object.assign(mockStorage, data);
      callback?.();
      return Promise.resolve();
    });

    // Setup DOM elements
    answerDiv = document.createElement('div');
    answerDiv.id = 'answer';
    document.body.appendChild(answerDiv);

    clearButton = document.createElement('button');
    clearButton.className = 'clear-chat';
    answerDiv.appendChild(clearButton);

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/',
      },
      writable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('loadChatHistory', () => {
    it('should load chat history from storage', async () => {
      // Setup mock storage with a chat history
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({
          chatHistories: {
            'https://example.com/': {
              messages: [{
                role: 'user',
                content: 'Test message',
                timestamp: '14:56:07',
              }],
              url: 'https://example.com/',
            },
          },
        }, resolve);
      });

      await loadChatHistory();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for DOM updates

      const messages = answerDiv.querySelectorAll('.ai-chat-message');
      expect(messages.length).toBe(1);

      const message = messages[0];
      expect(message).toBeTruthy();
      expect(message.classList.contains('ai-user-message')).toBe(true);
      expect(message.querySelector('.ai-message-content')?.textContent).toBe('Test message');
      expect(message.querySelector('.ai-message-time')?.textContent).toBe('14:56:07');
    });

    it('should handle empty history', async () => {
      await loadChatHistory();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for DOM updates
      expect(answerDiv.querySelectorAll('.ai-chat-message').length).toBe(0);
    });
  });

  describe('addMessage', () => {
    it('should add a new message to history', async () => {
      await addMessage('user', 'Test message');
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for DOM updates

      const messages = answerDiv.querySelectorAll('.ai-chat-message');
      expect(messages.length).toBe(1);

      const message = messages[0];
      expect(message).toBeTruthy();
      expect(message.classList.contains('ai-user-message')).toBe(true);
      expect(message.querySelector('.ai-message-content')?.textContent).toBe('Test message');
    });

    it('should render markdown content', async () => {
      const markdownText = '**Bold text**';
      (renderMarkdown as jest.Mock).mockReturnValue('<strong>Bold text</strong>');

      await addMessage('assistant', markdownText);
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for DOM updates

      expect(renderMarkdown).toHaveBeenCalledWith(markdownText);
      const message = answerDiv.querySelector('.ai-chat-message.ai-assistant-message');
      expect(message).toBeTruthy();
      expect(message?.querySelector('.ai-message-content')?.innerHTML).toBe('<strong>Bold text</strong>');
    });
  });

  describe('clearChatHistory', () => {
    it('should clear chat history for current URL', async () => {
      // Add a message first
      await addMessage('user', 'Test message');
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for DOM updates
      expect(answerDiv.querySelectorAll('.ai-chat-message').length).toBe(1);

      // Clear the history
      await clearChatHistory();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for DOM updates

      // Check if messages are cleared
      expect(answerDiv.querySelectorAll('.ai-chat-message').length).toBe(0);
      expect(mockStorage.chatHistories?.['https://example.com/']).toBeUndefined();
    });
  });
}); 