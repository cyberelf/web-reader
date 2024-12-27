import { loadChatHistory, addMessage, clearChatHistory } from '../chatHistory';
import { renderMarkdown } from '../../../utils/markdown';

jest.mock('../../../utils/markdown', () => ({
  renderMarkdown: jest.fn(text => text)
}));

describe('Chat History', () => {
  let answerDiv: HTMLDivElement;
  let clearButton: HTMLButtonElement;
  let mockStorage: { chatHistories?: Record<string, any> } = {};

  beforeEach(() => {
    // Setup DOM elements
    answerDiv = document.createElement('div');
    answerDiv.id = 'answer';
    document.body.appendChild(answerDiv);

    clearButton = document.createElement('button');
    clearButton.className = 'clear-chat';
    answerDiv.appendChild(clearButton);

    // Reset storage mock
    mockStorage = {};
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
      callback?.(mockStorage);
      return Promise.resolve(mockStorage);
    });
    (chrome.storage.local.set as jest.Mock).mockImplementation((items, callback) => {
      mockStorage = { ...mockStorage, ...items };
      callback?.();
      return Promise.resolve();
    });

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: new URL('https://example.com'),
      writable: true
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('loadChatHistory', () => {
    it('should load chat history from storage', async () => {
      // Set up mock storage with test data
      const testUrl = String(window.location.href);
      mockStorage = {
        chatHistories: {
          [testUrl]: {
            messages: [
              { role: 'user', content: 'Hello', timestamp: 1234567890 }
            ],
            url: 'https://example.com'
          }
        }
      };

      // Add debug logging to mock
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys, callback) => {
        console.log('Mock storage get called with:', { keys, mockStorage });
        callback?.(mockStorage);
        return Promise.resolve(mockStorage);
      });

      await loadChatHistory();

      // Add debug logging for DOM state
      console.log('DOM after loadChatHistory:', {
        answerDivHTML: answerDiv.innerHTML,
        messageCount: answerDiv.querySelectorAll('.message').length,
        clearButtonPresent: answerDiv.querySelector('.clear-chat') !== null
      });

      // Verify storage was accessed
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatHistories'], expect.any(Function));
      
      // Wait for any potential microtasks to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify message was added to DOM
      const messages = Array.from(answerDiv.querySelectorAll('.message'));
      console.log('Messages after timeout:', {
        count: messages.length,
        html: messages.map(m => m.outerHTML)
      });
      
      expect(messages.length).toBe(1);
      
      const message = messages[0];
      expect(message).toBeTruthy();
      expect(message.classList.contains('user')).toBe(true);
      
      const content = message.querySelector('.message-content');
      expect(content).toBeTruthy();
      expect(content?.textContent).toBe('Hello');
      
      const time = message.querySelector('.message-time');
      expect(time).toBeTruthy();
      expect(time?.textContent).toBe(new Date(1234567890).toLocaleTimeString());
    });

    it('should handle empty history', async () => {
      await loadChatHistory();
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatHistories'], expect.any(Function));
      expect(answerDiv.querySelectorAll('.message').length).toBe(0);
    });
  });

  describe('addMessage', () => {
    it('should add a new message to history', async () => {
      const content = 'Test message';
      await addMessage('user', content);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          chatHistories: expect.any(Object)
        }),
        expect.any(Function)
      );

      const messages = answerDiv.querySelectorAll('.message');
      expect(messages.length).toBe(1);
      
      const message = messages[0];
      expect(message).toBeTruthy();
      expect(message.classList.contains('user')).toBe(true);
      
      const messageContent = message.querySelector('.message-content');
      expect(messageContent).toBeTruthy();
      expect(messageContent?.textContent).toBe(content);
    });

    it('should render markdown content', async () => {
      const markdownText = '**Bold text**';
      await addMessage('assistant', markdownText);

      expect(renderMarkdown).toHaveBeenCalledWith(markdownText);
      const message = answerDiv.querySelector('.message.assistant');
      expect(message).toBeTruthy();
      expect(message?.querySelector('.message-content')).toBeTruthy();
    });
  });

  describe('clearChatHistory', () => {
    it('should clear chat history for current URL', async () => {
      // Add a message first
      await addMessage('user', 'Test message');
      expect(answerDiv.querySelectorAll('.message').length).toBe(1);

      // Clear the history
      await clearChatHistory();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          chatHistories: expect.any(Object)
        }),
        expect.any(Function)
      );
      expect(answerDiv.querySelectorAll('.message').length).toBe(0);
    });
  });
}); 