document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(['openaiApiKey', 'tokenUsage', 'selectedModel'], (result) => {
    if (result.openaiApiKey) {
      document.getElementById('api-key').value = result.openaiApiKey;
    }
    
    if (result.selectedModel) {
      document.getElementById('model').value = result.selectedModel;
    } else {
      // Default to GPT-3.5 Turbo if no model is selected
      document.getElementById('model').value = 'gpt-3.5-turbo';
    }
    
    if (result.tokenUsage) {
      updateTokenDisplay(result.tokenUsage);
    }
  });

  // Save settings
  document.querySelector('.save-button').addEventListener('click', () => {
    const apiKey = document.getElementById('api-key').value;
    const selectedModel = document.getElementById('model').value;
    chrome.storage.sync.set({ 
      openaiApiKey: apiKey,
      selectedModel: selectedModel
    }, () => {
      // Show success message
      const button = document.querySelector('.save-button');
      button.textContent = 'Saved!';
      button.style.backgroundColor = '#10b981';
      setTimeout(() => {
        button.textContent = 'Save Settings';
        button.style.backgroundColor = '#2962ff';
      }, 2000);
    });
  });
});

function updateTokenDisplay(usage) {
  document.getElementById('total-tokens').textContent = usage.totalTokens.toLocaleString();
  document.getElementById('request-count').textContent = usage.requestCount.toLocaleString();
  const avg = usage.requestCount > 0 
    ? Math.round(usage.totalTokens / usage.requestCount) 
    : 0;
  document.getElementById('avg-tokens').textContent = avg.toLocaleString();
} 