/// <reference types="chrome"/>

import type { MessageRequest, FetchImageResponse } from './types';

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({
    showIcon: true,
    // other default settings...
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_sidebar') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'toggleSidebar' });
      }
    });
  }
});

// Ensure content script runs on all pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Skip chrome:// and chrome-extension:// pages
    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => {
        console.error('Failed to inject content script:', err);
        // Try again with world: 'MAIN' if initial injection fails
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js'],
          world: 'MAIN'
        }).catch(err2 => console.error('Failed second injection attempt:', err2));
      });
    }
  }
});

// Handle screenshot requests
chrome.runtime.onMessage.addListener((
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: string | null | FetchImageResponse) => void
) => {
  if (request.action === 'takeScreenshot') {
    chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'png' }, (dataUrl: string) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse(null);
      } else {
        sendResponse(dataUrl);
      }
    });
    return true; // Required for async response
  }

  if (request.action === 'fetchImage' && request.url) {
    fetch(request.url)
      .then((response: Response): Promise<Blob> => response.blob())
      .then((blob: Blob): void => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ data: reader.result as string });
        reader.onerror = () => sendResponse({ error: 'Failed to read image data' });
        reader.readAsDataURL(blob);
      })
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async response
  }
}); 