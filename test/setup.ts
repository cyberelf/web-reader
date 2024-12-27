/// <reference types="chrome"/>
/// <reference types="node"/>

declare global {
  namespace NodeJS {
    interface Global {
      chrome: typeof chrome;
      localStorage: Storage;
    }
  }
}

const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (callback) {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        if (callback) {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    }
  },
  tabs: {
    captureVisibleTab: jest.fn(),
  },
  windows: {
    WINDOW_ID_CURRENT: -2
  }
};

// Add Chrome to global scope
(globalThis as any).chrome = mockChrome;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  removeItem: jest.fn(),
  length: 0,
  key: jest.fn()
};

(globalThis as any).localStorage = localStorageMock;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock DataTransfer
class DataTransferMock {
  items = {
    add: jest.fn(),
    clear: jest.fn(),
    remove: jest.fn()
  };
  setData = jest.fn();
  getData = jest.fn();
  clearData = jest.fn();
}

(globalThis as any).DataTransfer = DataTransferMock;

export {}; 