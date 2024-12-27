/// <reference types="chrome"/>

import type { MessageRequest, FetchImageResponse } from './types';

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