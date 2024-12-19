import { MODELS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL } from './src/config.js';

document.addEventListener('DOMContentLoaded', () => {
  // Populate model selector
  const modelSelect = document.getElementById('model');
  Object.entries(MODELS)
    .filter(([key]) => key !== 'VISION') // Exclude vision model from settings
    .forEach(([_, value]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = MODEL_DISPLAY_NAMES[value];
      modelSelect.appendChild(option);
    });

  // Load saved settings
  chrome.storage.sync.get(['openaiApiKey', 'tokenUsage', 'selectedModel', 'openaiUrl'], (result) => {
    if (result.openaiApiKey) {
      document.getElementById('api-key').value = result.openaiApiKey;
    }
    
    if (result.selectedModel) {
      document.getElementById('model').value = result.selectedModel;
    } else {
      document.getElementById('model').value = DEFAULT_MODEL;
    }
    
    if (result.tokenUsage) {
      updateTokenDisplay(result.tokenUsage);
    }
    
    if (result.openaiUrl) {
      document.getElementById('openai-url').value = result.openaiUrl;
    }
  });

  // Save settings
  document.querySelector('.save-button').addEventListener('click', () => {
    const apiKey = document.getElementById('api-key').value;
    const selectedModel = document.getElementById('model').value;
    const openaiUrl = document.getElementById('openai-url').value;
    
    chrome.storage.sync.set({
      openaiApiKey: apiKey,
      selectedModel: selectedModel || DEFAULT_MODEL,
      openaiUrl: openaiUrl || 'https://api.openai.com/v1/'
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

  setupCustomPrompts();

  // Load icon visibility setting
  chrome.storage.sync.get(['showIcon'], (result) => {
    document.getElementById('show-icon').checked = result.showIcon !== false;
  });

  // Handle icon visibility toggle
  document.getElementById('show-icon').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showIcon: e.target.checked });
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

function setupCustomPrompts() {
  const addPromptButton = document.getElementById('add-prompt');
  const promptsList = document.querySelector('.custom-prompts-list');
  
  // Create a template element for new prompts
  function createPromptItem(command = '', text = '') {
    const promptItem = document.createElement('div');
    promptItem.className = 'custom-prompt-item';
    promptItem.innerHTML = `
      <div class="prompt-inputs">
        <input type="text" class="prompt-command" placeholder="/command" value="${command}">
        <input type="text" class="prompt-text" placeholder="Prompt text" value="${text}">
      </div>
      <div class="prompt-actions">
        <button class="save-prompt ai-button-base ai-primary-button">Save</button>
        <button class="delete-prompt ai-button-base ai-danger-button">Delete</button>
      </div>
    `;

    // Add event listeners to the new buttons
    const saveButton = promptItem.querySelector('.save-prompt');
    const deleteButton = promptItem.querySelector('.delete-prompt');
    const commandInput = promptItem.querySelector('.prompt-command');
    const textInput = promptItem.querySelector('.prompt-text');

    saveButton.addEventListener('click', () => {
      const newCommand = commandInput.value.trim();
      const newText = textInput.value.trim();

      if (!newCommand.startsWith('/')) {
        alert('Command must start with /');
        return;
      }

      if (!newCommand || !newText) {
        alert('Both command and prompt text are required');
        return;
      }

      chrome.storage.sync.get(['customPrompts'], function(result) {
        const customPrompts = result.customPrompts || {};
        customPrompts[newCommand] = newText;
        chrome.storage.sync.set({ customPrompts }, () => {
          alert('Custom prompt saved!');
        });
      });
    });

    deleteButton.addEventListener('click', () => {
      const command = commandInput.value.trim();
      chrome.storage.sync.get(['customPrompts'], function(result) {
        const customPrompts = result.customPrompts || {};
        delete customPrompts[command];
        chrome.storage.sync.set({ customPrompts }, () => {
          promptItem.remove();
        });
      });
    });

    return promptItem;
  }

  // Load existing custom prompts
  chrome.storage.sync.get(['customPrompts'], function(result) {
    const customPrompts = result.customPrompts || {};
    Object.entries(customPrompts).forEach(([command, text]) => {
      const promptItem = createPromptItem(command, text);
      promptsList.appendChild(promptItem);
    });
  });

  // Add new prompt handler
  addPromptButton.addEventListener('click', () => {
    const promptItem = createPromptItem();
    promptsList.appendChild(promptItem);
  });
}