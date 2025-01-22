/// <reference types="chrome"/>

import { MODELS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL, ModelType, ModelDisplayType } from './config';
import { Settings as GlobalSettings, getSettings, updateSettings, clearTokenUsage } from './settings';

interface TokenUsage {
  totalTokens: number;
  requestCount: number;
}

interface CustomPrompts {
  [key: string]: string;
}

// Load token usage from storage
async function loadTokenUsage(): Promise<TokenUsage> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['tokenUsage'], (result) => {
      resolve(result.tokenUsage || { totalTokens: 0, requestCount: 0 });
    });
  });
}

function initializeSettings(): void {
  // Initialize model selector
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
  const customModelInput = document.getElementById('custom-model') as HTMLInputElement;
  const addCustomModelButton = document.getElementById('add-custom-model') as HTMLButtonElement;

  if (modelSelector) {
    // Clear existing options
    modelSelector.innerHTML = '';
    
    // Add model options
    Object.entries(MODELS).forEach(([key, value]) => {
      // Include all models except VISION
      if (key !== 'VISION') {
        const option = document.createElement('option');
        option.value = value;
        const displayName = MODEL_DISPLAY_NAMES[value as ModelDisplayType];
        option.textContent = displayName || value;
        modelSelector.appendChild(option);
      }
    });

    // Load custom models from storage
    chrome.storage.sync.get(['customModels'], (result: { customModels?: string[] }) => {
      const customModels = result.customModels || [];
      customModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelector.appendChild(option);
      });
    });

    // Add event listener for custom model input
    const addCustomModel = async () => {
      const newModel = customModelInput.value.trim();
      if (newModel) {
        // Add to storage
        const result = await chrome.storage.sync.get(['customModels']);
        const customModels = result.customModels || [];
        if (!customModels.includes(newModel)) {
          customModels.push(newModel);
          await chrome.storage.sync.set({ customModels });
          
          // Add to dropdown
          const option = document.createElement('option');
          option.value = newModel;
          option.textContent = newModel;
          modelSelector.appendChild(option);
          
          // Select the new model
          modelSelector.value = newModel;
          customModelInput.value = '';
          saveSettings();
        }
      }
    };

    // Add event listeners for adding custom models
    addCustomModelButton?.addEventListener('click', addCustomModel);
    customModelInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomModel();
      }
    });
  }

  // Load saved settings
  getSettings().then((settings: GlobalSettings) => {
    // Set API key
    const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
    if (apiKeyInput && settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
    }

    // Set model
    if (settings.model) {
      modelSelector.value = settings.model;
    }

    // Set API URL
    const apiUrlInput = document.getElementById('openai-url') as HTMLInputElement;
    if (apiUrlInput && settings.apiUrl) {
      apiUrlInput.value = settings.apiUrl;
    }

    // Set show icon toggle
    const showIconToggle = document.getElementById('show-icon') as HTMLInputElement;
    if (showIconToggle) {
      showIconToggle.checked = settings.showIcon;
    }
  });

  // Load token usage
  loadTokenUsage().then(updateUsageStats);
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
  const settings: Partial<GlobalSettings> = {};
  
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  const apiUrlInput = document.getElementById('openai-url') as HTMLInputElement;
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
  const customModelInput = document.getElementById('custom-model') as HTMLInputElement;
  const showIconCheckbox = document.getElementById('show-icon') as HTMLInputElement;

  if (apiKeyInput?.value) settings.apiKey = apiKeyInput.value;
  if (apiUrlInput?.value) settings.apiUrl = apiUrlInput.value;
  if (modelSelector?.value) {
    settings.model = modelSelector.value;
  }
  if (showIconCheckbox) settings.showIcon = showIconCheckbox.checked;

  updateSettings(settings);
}

// Initialize settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  initializeSettings();

  // Setup tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Function to switch tabs
  const switchTab = (tabName: string) => {
    // Hide all panes first
    tabPanes.forEach(pane => {
      (pane as HTMLElement).style.display = 'none';
      pane.classList.remove('active');
    });

    // Deactivate all buttons
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });

    // Activate selected tab and pane
    const selectedButton = Array.from(tabButtons).find(btn => btn.getAttribute('data-tab') === tabName);
    const selectedPane = document.getElementById(`${tabName}-tab`);

    if (selectedButton && selectedPane) {
      selectedButton.classList.add('active');
      (selectedPane as HTMLElement).style.display = 'block';
      selectedPane.classList.add('active');
    }
  };

  // Add click event listeners to tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });

  // Initialize first tab
  const firstTab = tabButtons[0]?.getAttribute('data-tab');
  if (firstTab) {
    switchTab(firstTab);
  }

  // Add event listener for clear usage button
  const clearUsageButton = document.getElementById('clear-usage');
  if (clearUsageButton) {
    clearUsageButton.addEventListener('click', async () => {
      await clearTokenUsage();
      updateUsageStats({ totalTokens: 0, requestCount: 0 });
    });
  }

  // Load custom prompts
  chrome.storage.sync.get(['customPrompts'], (result: { customPrompts?: Record<string, string> }) => {
    const customPrompts = result.customPrompts || {};
    const container = document.querySelector('.custom-prompts-container');
    if (container) {
      Object.entries(customPrompts).forEach(([command, text]) => {
        container.appendChild(createPromptItem(command, text));
      });
    }
  });

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