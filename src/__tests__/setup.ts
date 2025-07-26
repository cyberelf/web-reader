/// <reference types="jest" />

export {};

declare global {
  namespace NodeJS {
    interface Global {
      chrome: {
        storage: {
          sync: {
            get: jest.Mock;
            set: jest.Mock;
            remove: jest.Mock;
            clear: jest.Mock;
          };
        };
        runtime: {
          sendMessage: jest.Mock;
          onMessage: {
            addListener: jest.Mock;
          };
        };
        tabs: {
          query: jest.Mock;
          sendMessage: jest.Mock;
        };
      };
      fetch: jest.Mock;
    }
  }
}

// Mock chrome.storage.sync
const mockChromeStorage = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
};

// Mock chrome API
Object.defineProperty(globalThis, "chrome", {
  value: {
    storage: {
      sync: mockChromeStorage,
    },
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
      },
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn(),
    },
  },
  writable: true,
});

// Mock window.fetch
Object.defineProperty(globalThis, "fetch", {
  value: jest.fn(),
  writable: true,
});
