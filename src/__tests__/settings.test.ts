import { Settings, getSettings, updateSettings } from '../settings';

// Mock chrome.storage.sync
const mockChromeStorage = {
  get: jest.fn(),
  set: jest.fn()
};

Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: {
      sync: mockChromeStorage
    }
  },
  writable: true
});

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return default settings when no settings exist', async () => {
      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const settings = await getSettings();
      expect(settings).toMatchObject({
        apiUrl: 'https://api.openai.com/v1',
        showIcon: true,
        shortcuts: {
          '/help': 'Show available commands',
          '/clear': 'Clear chat history',
          '/model': 'Change AI model',
          '/screenshot': 'Take a screenshot',
          '/summarize': 'Summarize the content',
          '/explain': 'Explain in simple terms',
          '/generate': 'Generate similar content'
        }
      });
    });

    it('should return stored settings when they exist', async () => {
      const storedSettings = {
        settings: {
          apiKey: 'test-api-key',
          apiUrl: 'https://custom-url.com',
          model: 'gpt-4',
          showIcon: false
        }
      };

      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback(storedSettings);
      });

      const settings = await getSettings();
      expect(settings).toMatchObject({
        apiKey: 'test-api-key',
        apiUrl: 'https://custom-url.com',
        model: 'gpt-4',
        showIcon: false
      });
    });
  });

  describe('updateSettings', () => {
    it('should merge new settings with existing settings', async () => {
      const existingSettings = {
        settings: {
          apiKey: 'old-api-key',
          apiUrl: 'https://old-url.com',
          showIcon: true
        }
      };

      const newSettings = {
        apiKey: 'new-api-key',
        showIcon: false
      };

      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback(existingSettings);
      });

      mockChromeStorage.set.mockImplementation((settings, callback) => {
        callback();
      });

      await updateSettings(newSettings);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        {
          settings: {
            apiKey: 'new-api-key',
            apiUrl: 'https://old-url.com', // Should keep existing values
            includeChatHistory: true, // Default value should be added
            shortcuts: {
              '/help': 'Show available commands',
              '/clear': 'Clear chat history',
              '/explain': 'Explain in simple terms',
              '/generate': 'Generate similar content'
            }
          }
        },
        expect.any(Function)
      );
    }, 10000);

    it('should handle empty existing settings', async () => {
      mockChromeStorage.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChromeStorage.set.mockImplementation((settings, callback) => {
        callback();
      });

      const newSettings = {
        apiKey: 'new-api-key',
        showIcon: false
      };

      await updateSettings(newSettings);

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        {
          settings: {
            apiKey: 'new-api-key',
            apiUrl: 'https://api.openai.com/v1', // Default value
            includeChatHistory: true, // Default value should be added
            shortcuts: {
              '/clear': 'Clear chat history',
              '/explain': 'Explain in simple terms',
              '/generate': 'Generate similar content',
              '/help': 'Show available commands',
              '/model': 'Change AI model',
              '/screenshot': 'Take a screenshot',
              '/summarize': 'Summarize the content',
            }
          }
        },
        expect.any(Function)
      );
    }, 10000);
  });

  describe('Settings UI Integration', () => {
    it('should save settings correctly from UI inputs', async () => {
      // Mock DOM elements
      document.body.innerHTML = `
        <input id="api-key" value="test-api-key" />
        <select id="model-selector">
          <option value="gpt-4o" selected>GPT-4</option>
        </select>
        <input id="openai-url" value="https://custom-url.com" />
        <input id="show-icon" type="checkbox" checked />
        <button class="save-button">Save Settings</button>
      `;

      // Mock chrome.tabs.query
      const mockTabs = { query: jest.fn() };
      Object.defineProperty(globalThis.chrome, 'tabs', { value: mockTabs });

      // Mock storage.set to resolve immediately
      mockChromeStorage.set.mockImplementation((settings, callback) => {
        callback();
      });

      // Simulate DOMContentLoaded to set up event listeners
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Click the save button
      const saveButton = document.querySelector('.save-button') as HTMLButtonElement;
      saveButton.click();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChromeStorage.set).toHaveBeenCalledWith(
        {
          settings: {
            apiKey: 'test-api-key',
            apiUrl: 'https://custom-url.com',
            model: 'gpt-4o',
            includeChatHistory: true, // Default value should be added
            shortcuts: {
              '/clear': 'Clear chat history',
              '/explain': 'Explain in simple terms',
              '/generate': 'Generate similar content',
              '/help': 'Show available commands',
              '/model': 'Change AI model',
              '/screenshot': 'Take a screenshot',
              '/summarize': 'Summarize the content',
            }
          }
        },
        expect.any(Function)
      );
    }, 10000);
  });
}); 