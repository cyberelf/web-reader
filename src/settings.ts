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
  openaiApiKey?: string;
  tokenUsage?: TokenUsage;
  selectedModel?: ModelType;
  openaiUrl?: string;
  showIcon?: boolean;
  customPrompts?: CustomPrompts;
}

// Add this type definition
const AVAILABLE_MODELS = {
  'GPT-3.5': 'gpt-3.5-turbo',
  'GPT-4': 'gpt-4',
  'GPT-4 Turbo': 'gpt-4-1106-preview'
} as const;

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
    '/screenshot': 'Take a screenshot'
  }
};

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings'], (result) => {
      resolve(result.settings || DEFAULT_SETTINGS);
    });
  });
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings: updated }, resolve);
  });
}

export async function clearApiKey(): Promise<void> {
  const settings = await getSettings();
  delete settings.apiKey;
  return updateSettings(settings);
}

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(['openaiApiKey', 'tokenUsage', 'selectedModel', 'openaiUrl'], (result: StorageResult) => {
    if (result.openaiApiKey) {
      (document.getElementById('api-key') as HTMLInputElement).value = result.openaiApiKey;
    }
    
    if (result.selectedModel) {
      (document.getElementById('model-selector') as HTMLSelectElement).value = result.selectedModel;
    } else {
      (document.getElementById('model-selector') as HTMLSelectElement).value = DEFAULT_MODEL;
    }
    
    if (result.tokenUsage) {
      updateTokenDisplay(result.tokenUsage);
    }
    
    if (result.openaiUrl) {
      (document.getElementById('openai-url') as HTMLInputElement).value = result.openaiUrl;
    }
  });

  // Save settings
  document.querySelector('.save-button')?.addEventListener('click', () => {
    const apiKey = (document.getElementById('api-key') as HTMLInputElement).value;
    const selectedModel = (document.getElementById('model-selector') as HTMLSelectElement).value as ModelType;
    const openaiUrl = (document.getElementById('openai-url') as HTMLInputElement).value;
    
    chrome.storage.sync.set({
      openaiApiKey: apiKey,
      selectedModel: selectedModel || DEFAULT_MODEL,
      openaiUrl: openaiUrl || 'https://api.openai.com/v1/'
    }, () => {
      // Show success message
      const button = document.querySelector('.save-button') as HTMLButtonElement;
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
  chrome.storage.sync.get(['showIcon'], (result: StorageResult) => {
    (document.getElementById('show-icon') as HTMLInputElement).checked = result.showIcon !== false;
  });

  // Handle icon visibility toggle
  document.getElementById('show-icon')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    chrome.storage.sync.set({ showIcon: target.checked });
  });
});

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

function setupCustomPrompts(): void {
  const addPromptButton = document.getElementById('add-prompt');
  const promptsList = document.querySelector('.custom-prompts-list');
  
  // Create a template element for new prompts
  function createPromptItem(command = '', text = ''): HTMLDivElement {
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
    const commandInput = promptItem.querySelector('.prompt-command') as HTMLInputElement;
    const textInput = promptItem.querySelector('.prompt-text') as HTMLInputElement;

    saveButton?.addEventListener('click', () => {
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

      chrome.storage.sync.get(['customPrompts'], (result: StorageResult) => {
        const customPrompts: CustomPrompts = result.customPrompts || {};
        customPrompts[newCommand] = newText;
        chrome.storage.sync.set({ customPrompts }, () => {
          alert('Custom prompt saved!');
        });
      });
    });

    deleteButton?.addEventListener('click', () => {
      const command = commandInput.value.trim();
      chrome.storage.sync.get(['customPrompts'], (result: StorageResult) => {
        const customPrompts: CustomPrompts = result.customPrompts || {};
        delete customPrompts[command];
        chrome.storage.sync.set({ customPrompts }, () => {
          promptItem.remove();
        });
      });
    });

    return promptItem;
  }

  // Load existing custom prompts
  chrome.storage.sync.get(['customPrompts'], (result: StorageResult) => {
    const customPrompts: CustomPrompts = result.customPrompts || {};
    if (promptsList) {
      Object.entries(customPrompts).forEach(([command, text]) => {
        const promptItem = createPromptItem(command, text);
        promptsList.appendChild(promptItem);
      });
    }
  });

  // Add new prompt handler
  addPromptButton?.addEventListener('click', () => {
    if (promptsList) {
      const promptItem = createPromptItem();
      promptsList.appendChild(promptItem);
    }
  });
} 