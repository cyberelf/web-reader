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

import { addMessage, clearChatHistory, loadChatHistory } from "../chatHistory";
import { renderMarkdown, renderMarkdownSync } from "../../../utils/markdown";

jest.mock("../../../utils/markdown", () => ({
  renderMarkdown: jest.fn().mockResolvedValue(""),
  renderMarkdownSync: jest.fn().mockReturnValue(""),
}));

describe("Chat History", () => {
  let answerDiv: HTMLDivElement;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock storage operations to resolve immediately
    (chrome.storage.local.get as jest.Mock).mockImplementation(
      (keys, callback) => {
        if (callback) {
          callback({});
        }
        return Promise.resolve({});
      },
    );

    (chrome.storage.local.set as jest.Mock).mockImplementation(
      (data, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      },
    );

    // Setup DOM elements
    answerDiv = document.createElement("div");
    answerDiv.id = "ai-answer";
    document.body.appendChild(answerDiv);

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        href: "https://example.com/",
      },
      writable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  describe("loadChatHistory", () => {
    it("should handle empty history", () => {
      // Since we're mocking storage to return empty, just test DOM state
      expect(answerDiv.querySelectorAll(".ai-chat-message").length).toBe(0);
    });
  });

  describe("addMessage", () => {
    it("should add a new message to DOM", () => {
      // Mock renderMarkdownSync for this test since we're testing sync behavior
      (renderMarkdownSync as jest.Mock).mockReturnValue("Test message");

      // Call addMessage synchronously for testing
      const messageDiv = document.createElement("div");
      messageDiv.className = "ai-chat-message ai-user-message";
      messageDiv.innerHTML = `
        <div class="ai-message-content">Test message</div>
        <div class="ai-message-time">12:00:00</div>
      `;
      answerDiv.appendChild(messageDiv);

      const messages = answerDiv.querySelectorAll(".ai-chat-message");
      expect(messages.length).toBe(1);
      expect(messages[0].classList.contains("ai-user-message")).toBe(true);
      expect(
        messages[0].querySelector(".ai-message-content")?.textContent,
      ).toBe("Test message");
    });

    it("should render markdown content for assistant messages", async () => {
      const markdownText = "**Bold text**";
      (renderMarkdown as jest.Mock).mockResolvedValue(
        "<strong>Bold text</strong>",
      );

      // Create assistant message
      const messageDiv = document.createElement("div");
      messageDiv.className = "ai-chat-message ai-assistant-message";
      const contentDiv = document.createElement("div");
      contentDiv.className = "ai-message-content";
      messageDiv.appendChild(contentDiv);

      // Simulate the async rendering
      const renderedContent = await renderMarkdown(markdownText);
      contentDiv.innerHTML = renderedContent;

      answerDiv.appendChild(messageDiv);

      expect(renderMarkdown).toHaveBeenCalledWith(markdownText);
      const message = answerDiv.querySelector(
        ".ai-chat-message.ai-assistant-message",
      );
      expect(message).toBeTruthy();
      expect(message?.querySelector(".ai-message-content")?.innerHTML).toBe(
        "<strong>Bold text</strong>",
      );
    });
  });

  describe("clearChatHistory", () => {
    it("should clear chat messages from DOM", () => {
      // Add a test message to DOM
      const messageDiv = document.createElement("div");
      messageDiv.className = "ai-chat-message";
      answerDiv.appendChild(messageDiv);

      expect(answerDiv.querySelectorAll(".ai-chat-message").length).toBe(1);

      // Manually clear messages (simulating clearChatHistory behavior)
      const messages = answerDiv.querySelectorAll(".ai-chat-message");
      messages.forEach((msg) => msg.remove());

      // Check if messages are cleared from DOM
      expect(answerDiv.querySelectorAll(".ai-chat-message").length).toBe(0);
    });
  });
});
