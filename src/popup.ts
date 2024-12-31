/// <reference types="chrome"/>

import { MODELS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL, ModelType } from './config';

interface TokenUsage {
  totalTokens: number;
  requestCount: number;
}

interface CustomPrompts {
  [key: string]: string;
}

interface Settings {
  openaiApiKey?: string;
  tokenUsage?: TokenUsage;
  selectedModel?: ModelType;
  openaiUrl?: string;
  showIcon?: boolean;
  customPrompts?: CustomPrompts;
}

function initializeSettings(): void {
  // Initialize model selector
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
  if (modelSelector) {
    // Clear existing options
    modelSelector.innerHTML = '';
    
    // Add model options
    Object.entries(MODELS)
      .filter(([key]) => key !== 'VISION')
      .forEach(([key, value]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = MODEL_DISPLAY_NAMES[value as ModelType];
        modelSelector.appendChild(option);
      });
  }

  // Load saved settings
  chrome.storage.sync.get(['settings'], (result: { settings?: Settings }) => {
    const settings = result.settings || {};
    
    // Set API key
    const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
    if (apiKeyInput && settings.openaiApiKey) {
      apiKeyInput.value = settings.openaiApiKey;
    }

    // Set model
    if (modelSelector && settings.selectedModel) {
      modelSelector.value = settings.selectedModel;
    }

    // Set API URL
    const apiUrlInput = document.getElementById('openai-url') as HTMLInputElement;
    if (apiUrlInput && settings.openaiUrl) {
      apiUrlInput.value = settings.openaiUrl;
    }

    // Set show icon toggle
    const showIconToggle = document.getElementById('show-icon') as HTMLInputElement;
    if (showIconToggle) {
      showIconToggle.checked = settings.showIcon !== false;
    }

    // Load custom prompts
    if (settings.customPrompts) {
      loadCustomPrompts(settings.customPrompts);
    }

    // Update usage stats
    if (settings.tokenUsage) {
      updateUsageStats(settings.tokenUsage);
    }
  });
}

function loadCustomPrompts(prompts: CustomPrompts): void {
  const container = document.querySelector('.custom-prompts-container');
  if (!container) return;

  // Clear existing prompts
  container.innerHTML = '';

  // Add each prompt
  Object.entries(prompts).forEach(([command, text]) => {
    const promptItem = createPromptItem(command, text);
    container.appendChild(promptItem);
  });
}

function createPromptItem(command: string = '', text: string = ''): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'custom-prompt-item';
  
  item.innerHTML = `
    <div class="prompt-inputs">
      <input type="text" class="prompt-command" placeholder="/command" value="${command}" />
      <input type="text" class="prompt-text" placeholder="Prompt text" value="${text}" />
    </div>
    <div class="prompt-actions">
      <button class="ai-button-base ai-danger-button delete-prompt">Delete</button>
    </div>
  `;

  // Add event listeners
  const deleteButton = item.querySelector('.delete-prompt');
  deleteButton?.addEventListener('click', () => {
    item.remove();
    saveSettings();
  });

  const inputs = item.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('change', saveSettings);
    input.addEventListener('blur', saveSettings);
  });

  return item;
}

function updateUsageStats(usage: TokenUsage): void {
  const totalTokens = document.getElementById('total-tokens');
  const requestCount = document.getElementById('request-count');
  const avgTokens = document.getElementById('avg-tokens');

  if (totalTokens) totalTokens.textContent = usage.totalTokens.toString();
  if (requestCount) requestCount.textContent = usage.requestCount.toString();
  if (avgTokens && usage.requestCount > 0) {
    avgTokens.textContent = Math.round(usage.totalTokens / usage.requestCount).toString();
  }
}

function saveSettings(): void {
  const settings: Settings = {};

  // Get API key
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  if (apiKeyInput) {
    settings.openaiApiKey = apiKeyInput.value;
  }

  // Get selected model
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
  if (modelSelector) {
    settings.selectedModel = modelSelector.value as ModelType;
  }

  // Get API URL
  const apiUrlInput = document.getElementById('openai-url') as HTMLInputElement;
  if (apiUrlInput) {
    settings.openaiUrl = apiUrlInput.value;
  }

  // Get show icon setting
  const showIconToggle = document.getElementById('show-icon') as HTMLInputElement;
  if (showIconToggle) {
    settings.showIcon = showIconToggle.checked;
  }

  // Get custom prompts
  const customPrompts: CustomPrompts = {};
  document.querySelectorAll('.custom-prompt-item').forEach(item => {
    const commandInput = item.querySelector('.prompt-command') as HTMLInputElement;
    const textInput = item.querySelector('.prompt-text') as HTMLInputElement;
    if (commandInput && textInput && commandInput.value && textInput.value) {
      customPrompts[commandInput.value] = textInput.value;
    }
  });
  settings.customPrompts = customPrompts;

  // Save settings
  chrome.storage.sync.set({ settings }, () => {
    const saveButton = document.querySelector('.save-button');
    if (saveButton) {
      saveButton.textContent = 'Saved!';
      setTimeout(() => {
        saveButton.textContent = 'Save Settings';
      }, 2000);
    }
  });
}

// Initialize settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  initializeSettings();

  // Add event listeners
  const addPromptButton = document.querySelector('.ai-add-prompt');
  addPromptButton?.addEventListener('click', () => {
    const container = document.querySelector('.custom-prompts-container');
    if (container) {
      container.appendChild(createPromptItem());
    }
  });

  const saveButton = document.querySelector('.save-button');
  saveButton?.addEventListener('click', saveSettings);

  const toggleApiKey = document.getElementById('toggle-api-key');
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  
  toggleApiKey?.addEventListener('click', () => {
    if (apiKeyInput) {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      toggleApiKey.classList.toggle('show');
    }
  });
}); 