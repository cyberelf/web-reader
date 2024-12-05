chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'takeScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse(null);
      } else {
        sendResponse(dataUrl);
      }
    });
    return true; // Required for async response
  }

  if (request.action === 'fetchImage') {
    fetch(request.url)
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ data: reader.result });
        reader.onerror = () => sendResponse({ error: 'Failed to read image data' });
        reader.readAsDataURL(blob);
      })
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async response
  }
});