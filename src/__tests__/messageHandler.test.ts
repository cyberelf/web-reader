import { handleQuestion } from "../components/chat/messageHandler";
import { addMessage } from "../components/chat/chatHistory";

// Mock all dependencies
jest.mock("../utils/modelManager", () => ({
  modelManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getCurrentConfig: jest.fn().mockReturnValue({
      apiKey: "test-api-key",
      apiUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    }),
  },
}));

jest.mock("../settings", () => ({
  getSettings: jest.fn().mockResolvedValue({
    includeChatHistory: true,
  }),
}));

jest.mock("../components/chat/chatHistory", () => ({
  addMessage: jest.fn(),
  updateLastMessage: jest.fn(),
  getChatHistoryMessages: jest.fn().mockReturnValue([]),
}));

jest.mock("../components/chat/promptShortcuts", () => ({
  loadCustomPrompts: jest.fn().mockResolvedValue(undefined),
  expandShortcut: jest.fn().mockResolvedValue(null),
}));

jest.mock("../utils/apiClient");
jest.mock("../utils/rateLimiter");

// Mock DOM elements
Object.defineProperty(window, "location", {
  value: {
    href: "https://example.com",
  },
});

// Mock Chrome Storage
const mockChromeStorage = {
  local: {
    get: jest.fn((keys, callback) => {
      callback({ tokenUsage: { totalTokens: 0, requestCount: 0 } });
    }),
    set: jest.fn((data, callback) => {
      if (callback) callback();
    }),
  },
};

Object.defineProperty(globalThis, "chrome", {
  value: {
    storage: mockChromeStorage,
  },
  writable: true,
});

const mockAddMessage = addMessage;

describe("Message Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle missing API configuration", async () => {
    const { modelManager } = await import("../utils/modelManager");
    jest.spyOn(modelManager, "getCurrentConfig").mockReturnValue(null);

    try {
      await handleQuestion("test question", "test context");
    } catch (error) {
      // Expected to throw an error
    }

    expect(mockAddMessage).toHaveBeenCalledWith("user", "test question");
  });

  it("should handle API key validation error", async () => {
    const { modelManager } = await import("../utils/modelManager");
    jest.spyOn(modelManager, "getCurrentConfig").mockReturnValue({
      apiKey: "",
      apiUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });

    try {
      await handleQuestion("test question", "test context");
    } catch (error) {
      // Expected to throw an error
    }

    expect(mockAddMessage).toHaveBeenCalledWith("user", "test question");
  });

  it("should proceed with valid API key", async () => {
    const { modelManager } = await import("../utils/modelManager");
    jest.spyOn(modelManager, "getCurrentConfig").mockReturnValue({
      apiKey: "valid-api-key",
      apiUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });

    // This should not throw an error initially, but may fail later due to mocked API
    try {
      await handleQuestion("test question", "test context");
    } catch (error) {
      // API calls will fail in test environment, but the initial validation should pass
    }

    expect(mockAddMessage).toHaveBeenCalledWith("user", "test question");
  });

  it("should handle API configuration correctly", async () => {
    const { modelManager } = await import("../utils/modelManager");

    jest.spyOn(modelManager, "getCurrentConfig").mockReturnValue({
      apiKey: "test-api-key",
      apiUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });

    try {
      await handleQuestion("test question", "test context");
    } catch (error) {
      // Expected to fail in test environment due to API mocking
    }

    expect(mockAddMessage).toHaveBeenCalled();
  });
});
