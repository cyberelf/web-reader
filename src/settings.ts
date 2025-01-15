/// <reference types="chrome"/>

import { MODELS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL, ModelType } from './config';

interface TokenUsage {
  totalTokens: number;
  requestCount: number;
}

interface CustomPrompts {
  [key: string]: string;
}

interface StorageResult {
  settings?: {
    apiKey?: string;
    apiUrl?: string;
    model?: string;
    showIcon?: boolean;
    shortcuts?: { [key: string]: string };
  }
}

export interface Settings {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  showIcon: boolean;
  shortcuts: { [key: string]: string };
}

const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'https://api.openai.com/v1',
  showIcon: true,
  shortcuts: {
    '/help': 'Show available commands',
    '/clear': 'Clear chat history',
    '/model': 'Change AI model',
    '/screenshot': 'Take a screenshot',
    '/summarize': 'Summarize the content',
    '/explain': 'Explain in simple terms',
    '/generate': 'Generate similar content'
  }
};

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      const settings = result.settings || {};
      resolve({
        apiKey: settings.apiKey,
        apiUrl: settings.apiUrl || DEFAULT_SETTINGS.apiUrl,
        model: settings.model || DEFAULT_MODEL,
        showIcon: settings.showIcon !== false,
        shortcuts: DEFAULT_SETTINGS.shortcuts
      });
    });
  });
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      const currentSettings = result.settings || {};
      const updatedSettings = { ...currentSettings, ...settings };
      chrome.storage.sync.set({ settings: updatedSettings }, resolve);
    });
  });
}

export async function clearApiKey(): Promise<void> {
  const settings = await getSettings();
  delete settings.apiKey;
  return updateSettings(settings);
}

export async function clearTokenUsage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ tokenUsage: { totalTokens: 0, requestCount: 0 } }, resolve);
  });
}

function updateTokenDisplay(usage: TokenUsage): void {
  const totalTokensEl = document.getElementById('total-tokens');
  const requestCountEl = document.getElementById('request-count');
  const avgTokensEl = document.getElementById('avg-tokens');

  if (totalTokensEl) totalTokensEl.textContent = usage.totalTokens.toLocaleString();
  if (requestCountEl) requestCountEl.textContent = usage.requestCount.toLocaleString();
  
  const avg = usage.requestCount > 0 
    ? Math.round(usage.totalTokens / usage.requestCount) 
    : 0;
  if (avgTokensEl) avgTokensEl.textContent = avg.toLocaleString();
}

document.addEventListener('DOMContentLoaded', () => {
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
  
  // Initialize model selector
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
  getSettings().then(settings => {
    if (settings.apiKey) {
      (document.getElementById('api-key') as HTMLInputElement).value = settings.apiKey;
    }
    
    if (settings.model && modelSelector) {
      modelSelector.value = settings.model;
    } else if (modelSelector) {
      modelSelector.value = DEFAULT_MODEL;
    }
    
    if (settings.apiUrl) {
      (document.getElementById('openai-url') as HTMLInputElement).value = settings.apiUrl;
    }

    if (settings.showIcon !== undefined) {
      (document.getElementById('show-icon') as HTMLInputElement).checked = settings.showIcon;
    }
  });

  // Save settings
  document.querySelector('.save-button')?.addEventListener('click', async () => {
    const settings: Partial<Settings> = {
      apiKey: (document.getElementById('api-key') as HTMLInputElement).value,
      model: modelSelector?.value,
      apiUrl: (document.getElementById('openai-url') as HTMLInputElement).value || DEFAULT_SETTINGS.apiUrl,
      showIcon: (document.getElementById('show-icon') as HTMLInputElement).checked
    };
    
    await updateSettings(settings);

    // Show success message
    const button = document.querySelector('.save-button') as HTMLButtonElement;
    button.textContent = 'Saved!';
    button.style.backgroundColor = '#10b981';
    setTimeout(() => {
      button.textContent = 'Save Settings';
      button.style.backgroundColor = '#2962ff';
    }, 2000);

    // Send message to content script to update icon visibility
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'updateIconVisibility', showIcon: settings.showIcon });
      }
    });
  });
}); 