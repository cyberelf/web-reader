/// <reference types="chrome"/>

interface MessageRequest {
  action: string;
  url?: string;
}

interface FetchImageResponse {
  data?: string;
  error?: string;
}

// URL validation function to prevent SSRF attacks
function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    // Block localhost and private IP ranges
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname === "0.0.0.0" ||
      hostname.includes("..")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.get(["showIcon"], (result) => {
    if (result.showIcon === undefined) {
      chrome.storage.sync.set({
        showIcon: true,
        // other default settings...
      });
    }
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle_sidebar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: "toggleSidebar" });
      }
    });
  }
});

// Ensure content script runs on all pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject when the tab is ready and has a valid URL
  if (changeInfo.status === "complete" && tab.url && tab.id) {
    // Skip chrome:// and chrome-extension:// pages
    if (
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("chrome-extension://")
    ) {
      // Check if the tab still exists before injecting
      chrome.tabs.get(tab.id, (currentTab) => {
        if (chrome.runtime.lastError) {
          console.error("Tab no longer exists:", chrome.runtime.lastError);
          return;
        }

        // Only inject if the tab is still active and complete
        if (currentTab.status === "complete") {
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              files: ["content.js"],
            })
            .catch((err) => {
              console.error("Failed to inject content script:", err);
              // Use ISOLATED world for better security
              chrome.scripting
                .executeScript({
                  target: { tabId: tabId },
                  files: ["content.js"],
                  world: "ISOLATED",
                })
                .catch((err2) =>
                  console.error("Failed second injection attempt:", err2),
                );
            });
        }
      });
    }
  }
});

// Handle screenshot requests
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: string | null | FetchImageResponse) => void,
  ) => {
    if (request.action === "takeScreenshot") {
      chrome.tabs.captureVisibleTab(
        chrome.windows.WINDOW_ID_CURRENT,
        { format: "png" },
        (dataUrl: string) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Screenshot failed:",
              chrome.runtime.lastError.message,
            );
            sendResponse(null);
          } else {
            sendResponse(dataUrl);
          }
        },
      );
      return true; // Required for async response
    }

    if (request.action === "fetchImage" && request.url) {
      // Validate URL before fetching
      if (!isValidImageUrl(request.url)) {
        sendResponse({ error: "Invalid or unsafe URL" });
        return true;
      }

      // Add timeout and proper error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      fetch(request.url, {
        signal: controller.signal,
        method: "GET",
        headers: {
          "User-Agent": "Page Reader Assistant Chrome Extension",
        },
      })
        .then((response: Response) => {
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Check content type
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.startsWith("image/")) {
            throw new Error("Response is not an image");
          }

          // Check content length (max 10MB)
          const contentLength = response.headers.get("content-length");
          if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
            throw new Error("Image too large");
          }

          return response.blob();
        })
        .then((blob: Blob): void => {
          const reader = new FileReader();
          reader.onloadend = () =>
            sendResponse({ data: reader.result as string });
          reader.onerror = () =>
            sendResponse({ error: "Failed to read image data" });
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          sendResponse({ error: error.message || "Failed to fetch image" });
        });
      return true; // Required for async response
    }
  },
);
