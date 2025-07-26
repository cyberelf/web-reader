/// <reference types="chrome"/>

import {
  addMessage,
  updateLastMessage,
  getChatHistoryMessages,
} from "./chatHistory";
import { handleShortcut } from "./promptShortcuts";
import { resizeImage } from "../../utils/imageUtils";
import {
  createAPIClient,
  type LLMRequest,
  type APIError,
} from "../../utils/apiClient";
import { createRateLimiter, type RateLimiter } from "../../utils/rateLimiter";
import { modelManager } from "../../utils/modelManager";
import type { ModelType } from "../../config";
import { getTokenEstimate } from "../../utils/tokenCounter";
import { getSettings } from "../../settings";

interface TokenUsage {
  totalTokens: number;
  requestCount: number;
}

// Global rate limiter instance
let rateLimiter: RateLimiter | null = null;

function getRateLimiter(apiUrl: string): RateLimiter {
  if (!rateLimiter) {
    // Detect provider and create appropriate rate limiter
    if (apiUrl.includes("deepseek")) {
      rateLimiter = createRateLimiter("DEEPSEEK");
    } else if (
      apiUrl.includes("generativelanguage.googleapis.com") ||
      apiUrl.includes("gemini")
    ) {
      rateLimiter = createRateLimiter("GEMINI_FREE"); // Default to free tier, can be made configurable
    } else {
      // Default to conservative limits for unknown providers
      rateLimiter = createRateLimiter("CONSERVATIVE");
    }
  }
  return rateLimiter;
}

async function updateTokenUsage(newTokens: number): Promise<void> {
  const result = await new Promise<{ tokenUsage?: TokenUsage }>((resolve) => {
    chrome.storage.local.get(
      { tokenUsage: { totalTokens: 0, requestCount: 0 } },
      resolve,
    );
  });

  const currentUsage = result.tokenUsage || { totalTokens: 0, requestCount: 0 };
  const updatedUsage = {
    totalTokens: currentUsage.totalTokens + newTokens,
    requestCount: currentUsage.requestCount + 1,
  };

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ tokenUsage: updatedUsage }, resolve);
  });
}

function createUserFriendlyErrorMessage(error: APIError): string {
  switch (error.type) {
    case "network":
      return "Network error: Please check your internet connection and try again.";
    case "timeout":
      return "Request timeout: The request took too long to complete. Please try again.";
    case "rate_limit":
      return "Rate limit exceeded: Please wait a moment before making another request.";
    case "api":
      if (error.status === 401) {
        return "Authentication failed: Please check your API key in the extension settings.";
      } else if (error.status === 403) {
        return "Access forbidden: Your API key may not have permission to use this model.";
      } else if (error.status === 404) {
        return "Model not found: The selected model may not be available.";
      } else if (error.status === 429) {
        return "Rate limit exceeded: Please wait a moment before making another request.";
      }
      return `API error (${error.status}): ${error.message}`;
    default:
      return `Unexpected error: ${error.message}`;
  }
}

async function estimateTokensFromMessages(
  messages: any[],
  model: string,
): Promise<number> {
  // Use fallback estimation for now to avoid async complexity in rate limiting
  let totalChars = 0;

  for (const message of messages) {
    if (typeof message.content === "string") {
      totalChars += message.content.length;
    } else if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (item.type === "text" && item.text) {
          totalChars += item.text.length;
        } else if (item.type === "image_url") {
          totalChars += 4000; // Estimate for image tokens (roughly 1000 tokens * 4 chars/token)
        }
      }
    }
  }

  return Math.ceil(totalChars / 4) + 1000;
}

function formatWaitTime(ms: number): string {
  if (ms < 60000) {
    return `${Math.ceil(ms / 1000)} seconds`;
  } else if (ms < 3600000) {
    return `${Math.ceil(ms / 60000)} minutes`;
  } else {
    return `${Math.ceil(ms / 3600000)} hours`;
  }
}

export async function handleQuestion(
  question: string,
  context: string,
  model?: ModelType,
): Promise<void> {
  try {
    // Check if the question is a shortcut
    const shortcutPrompt = await handleShortcut(question);
    const finalQuestion = shortcutPrompt || question;

    // Initialize model manager if needed
    await modelManager.initialize();

    // Get current configuration
    const config = modelManager.getCurrentConfig();
    if (!config || !config.apiKey) {
      throw new Error(
        "Please configure an API provider in the extension settings.",
      );
    }

    await addMessage("user", finalQuestion);

    // Get user settings to check if chat history should be included
    const settings = await getSettings();

    // Create placeholder message for streaming
    const selectedModel = model || config.model || "gpt-4o-mini";
    await addMessage("assistant", "", selectedModel);

    // Prepare messages based on whether we have an image or text
    const messages = [];

    // Add system message
    if (context.startsWith("data:image")) {
      // Resize image if needed
      const resizedImage = await resizeImage(context);

      messages.push({
        role: "system" as const,
        content:
          "You are analyzing the provided image. Be specific and detailed in your observations.",
      });

      // Include chat history if enabled
      if (settings.includeChatHistory) {
        const historyMessages = getChatHistoryMessages();
        messages.push(...historyMessages);
      }

      // Add user message with image
      messages.push({
        role: "user" as const,
        content: [
          {
            type: "image_url" as const,
            image_url: {
              url: resizedImage,
            },
          },
          {
            type: "text" as const,
            text: finalQuestion,
          },
        ],
      });
    } else {
      messages.push({
        role: "system" as const,
        content: context
          ? `You are analyzing the following content:\n\n${context}`
          : "You are analyzing the current webpage.",
      });

      // Include chat history if enabled
      if (settings.includeChatHistory) {
        const historyMessages = getChatHistoryMessages();
        messages.push(...historyMessages);
      }

      // Add user message with text
      messages.push({
        role: "user" as const,
        content: finalQuestion,
      });
    }

    // Check rate limits before making the request
    const apiUrl = config.apiUrl;
    const limiter = getRateLimiter(apiUrl);
    const estimatedTokens = await estimateTokensFromMessages(
      messages,
      selectedModel,
    );

    const rateLimitCheck = await limiter.canMakeRequest(estimatedTokens);
    if (!rateLimitCheck.allowed) {
      const waitTimeText = rateLimitCheck.waitTime
        ? ` Please wait ${formatWaitTime(rateLimitCheck.waitTime)} before trying again.`
        : "";
      const errorMessage = `⏱️ **Rate Limit**: ${rateLimitCheck.reason}${waitTimeText}`;
      await updateLastMessage(errorMessage);
      return;
    }

    // Create API client
    const apiClient = createAPIClient(config.apiKey, apiUrl, {
      timeout: 60000, // 60 seconds timeout
      maxRetries: 3,
      retryDelay: 1000,
      requestQueue: true,
    });

    const request: LLMRequest = {
      model: selectedModel || "gpt-4o-mini",
      messages,
      max_tokens: 4000,
      temperature: 0.7,
    };

    let accumulatedContent = "";

    // Send streaming request
    const response = await apiClient.sendStreamingRequest(
      request,
      (chunk: string) => {
        accumulatedContent += chunk;
        updateLastMessage(accumulatedContent);
      },
    );

    // Record the request in rate limiter
    const actualTokens = response.usage?.total_tokens || estimatedTokens;
    await limiter.recordRequest(actualTokens);

    // Update token usage if available
    if (response.usage?.total_tokens) {
      await updateTokenUsage(response.usage.total_tokens);
    }

    // Trigger token update after response is complete
    // (to update token estimation when chat history is included)
    const tokenUpdateEvent = new CustomEvent("chatHistoryUpdate");
    document.dispatchEvent(tokenUpdateEvent);
  } catch (error) {
    console.error("Error in handleQuestion:", error);

    // Create user-friendly error message
    let errorMessage = "An unexpected error occurred. Please try again.";

    if (error instanceof Error) {
      if (
        error.message.includes("API") ||
        error.message.includes("configure")
      ) {
        errorMessage = error.message;
      } else {
        const apiError = error as APIError;
        errorMessage = createUserFriendlyErrorMessage(apiError);
      }
    }

    // Update the last message with error
    await updateLastMessage(`❌ **Error**: ${errorMessage}`);

    throw error;
  }
}

// Export function to reset rate limiter (useful for settings changes)
export function resetRateLimiter(): void {
  rateLimiter = null;
}
