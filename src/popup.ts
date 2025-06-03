/// <reference types="chrome"/>

import { modelManager, type ModelInfo, type ProviderConfig } from './utils/modelManager';

interface TokenUsage {
  totalTokens: number;
  requestCount: number;
}

let currentProvider = 'openai';
let isInitialized = false;

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  await initializeModelManager();
  initializeTabs();
  initializeProviderManagement();
  initializeModelManagement();
  initializeSettings();
  initializeStats();
  initializeCustomPrompts();
  
  isInitialized = true;
});

async function initializeModelManager(): Promise<void> {
  try {
    await modelManager.initialize();
  } catch (error) {
    console.error('Failed to initialize model manager:', error);
  }
}

function initializeTabs(): void {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      if (!targetTab) return;
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update active tab pane
      tabPanes.forEach(pane => pane.classList.remove('active'));
      const targetPane = document.getElementById(`${targetTab}-tab`);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

function initializeProviderManagement(): void {
  const providerSelector = document.getElementById('provider-selector') as HTMLSelectElement;
  const providerConfigs = document.querySelectorAll('.provider-config');
  
  if (!providerSelector) return;

  // Load providers
  loadProviders();
  
  // Handle provider selection
  providerSelector.addEventListener('change', async () => {
    const selectedProvider = providerSelector.value;
    currentProvider = selectedProvider;
    
    // Show/hide provider configs
    providerConfigs.forEach(config => {
      config.classList.add('hidden');
    });
    
    const targetConfig = document.getElementById(`${selectedProvider}-config`);
    if (targetConfig) {
      targetConfig.classList.remove('hidden');
    }
    
    // Update model list
    loadModels();
    
    // Save selected provider
    try {
      await modelManager.setSelectedProvider(selectedProvider);
    } catch (error) {
      console.error('Failed to save selected provider:', error);
    }
  });

  // Initialize API key toggles
  initializeAPIKeyToggles();
  
  // Initialize provider config inputs
  initializeProviderInputs();
}

function loadProviders(): void {
  const providerSelector = document.getElementById('provider-selector') as HTMLSelectElement;
  if (!providerSelector) return;

  const providers = modelManager.getProviders();
  const selectedProvider = modelManager.getSelectedProvider();
  
  // Update currentProvider to match the saved selection
  if (selectedProvider) {
    currentProvider = selectedProvider;
  }
  
  // Clear existing options
  providerSelector.innerHTML = '';
  
  providers.forEach(provider => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.name;
    if (provider.id === selectedProvider) {
      option.selected = true;
      currentProvider = provider.id;
    }
    providerSelector.appendChild(option);
  });

  // Load provider configurations
  loadProviderConfigs();
  
  // Show current provider config
  const providerConfigs = document.querySelectorAll('.provider-config');
  providerConfigs.forEach(config => config.classList.add('hidden'));
  
  const currentConfig = document.getElementById(`${currentProvider}-config`);
  if (currentConfig) {
    currentConfig.classList.remove('hidden');
  }
}

function loadProviderConfigs(): void {
  const providers = modelManager.getProviders();
  
  providers.forEach(provider => {
    const apiKeyInput = document.getElementById(`${provider.id}-api-key`) as HTMLInputElement;
    const apiUrlInput = document.getElementById(`${provider.id}-url`) as HTMLInputElement;
    
    if (apiKeyInput && provider.apiKey) {
      apiKeyInput.value = provider.apiKey;
    }
    
    if (apiUrlInput) {
      apiUrlInput.value = provider.apiUrl;
    }
  });
}

function initializeAPIKeyToggles(): void {
  const toggleButtons = document.querySelectorAll('.toggle-api-key');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      if (!targetId) return;
      
      const targetInput = document.getElementById(targetId) as HTMLInputElement;
      
      if (targetInput) {
        const isPassword = targetInput.type === 'password';
        targetInput.type = isPassword ? 'text' : 'password';
        
        // Toggle the 'show' class on the button to control icon visibility
        if (isPassword) {
          button.classList.add('show');
        } else {
          button.classList.remove('show');
        }
      }
    });
  });
}

function initializeProviderInputs(): void {
  const providers = ['openai', 'deepseek', 'gemini', 'custom'];
  
  providers.forEach(providerId => {
    const apiKeyInput = document.getElementById(`${providerId}-api-key`) as HTMLInputElement;
    const apiUrlInput = document.getElementById(`${providerId}-url`) as HTMLInputElement;
    const nameInput = document.getElementById(`${providerId}-name`) as HTMLInputElement;
    
    // Save API key changes
    if (apiKeyInput) {
      apiKeyInput.addEventListener('blur', () => {
        if (providerId === 'custom') {
          // Handle custom provider separately
          return;
        }
        
        modelManager.updateProviderConfig(providerId, {
          apiKey: apiKeyInput.value
        });
        
        // Update provider status
        updateProviderStatus(providerId);
      });
    }
    
    // Save URL changes (for custom provider)
    if (apiUrlInput && providerId === 'custom') {
      apiUrlInput.addEventListener('blur', () => {
        // Custom provider URL handling will be implemented separately
      });
    }
  });
}

function updateProviderStatus(providerId: string): void {
  const provider = modelManager.getProvider(providerId);
  if (!provider) return;
  
  const statusElement = document.querySelector(`#${providerId}-config .provider-status-indicator`);
  if (statusElement) {
    statusElement.className = 'provider-status-indicator';
    if (provider.isConfigured) {
      statusElement.classList.add('connected');
    } else {
      statusElement.classList.add('disconnected');
    }
  }
}

function initializeModelManagement(): void {
  const syncButton = document.getElementById('sync-models');
  const addModelButton = document.getElementById('add-manual-model');
  const saveModelButton = document.getElementById('save-manual-model');
  const cancelModelButton = document.getElementById('cancel-manual-model');
  const selectedModelSelect = document.getElementById('selected-model') as HTMLSelectElement;
  
  // Delete model modal buttons
  const confirmDeleteButton = document.getElementById('confirm-delete-model');
  const cancelDeleteButton = document.getElementById('cancel-delete-model');
  const deleteModal = document.getElementById('delete-model-modal');
  
  // Sync models button
  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      await syncModels();
    });
  }
  
  // Add manual model button
  if (addModelButton) {
    addModelButton.addEventListener('click', () => {
      showManualModelForm();
    });
  }
  
  // Save manual model button
  if (saveModelButton) {
    saveModelButton.addEventListener('click', () => {
      saveManualModel();
    });
  }
  
  // Cancel manual model button
  if (cancelModelButton) {
    cancelModelButton.addEventListener('click', () => {
      hideManualModelForm();
    });
  }
  
  // Delete model confirmation
  if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', () => {
      confirmDeleteModel();
    });
  }
  
  // Cancel delete model
  if (cancelDeleteButton) {
    cancelDeleteButton.addEventListener('click', () => {
      hideDeleteModelModal();
    });
  }
  
  // Close modal on outside click
  if (deleteModal) {
    deleteModal.addEventListener('click', (e: Event) => {
      if (e.target === deleteModal) {
        hideDeleteModelModal();
      }
    });
  }
  
  // Selected model change
  if (selectedModelSelect) {
    selectedModelSelect.addEventListener('change', async () => {
      const selectedModel = selectedModelSelect.value;
      if (selectedModel) {
        try {
          await modelManager.setSelectedModel(selectedModel);
          updateModelList(); // Refresh to show selection
          showNotification('Model selected', 'success');
        } catch (error) {
          console.error('Failed to save selected model:', error);
          showNotification('Failed to save model selection', 'error');
        }
      }
    });
  }
  
  // Load initial models
  loadModels();
}

async function syncModels(): Promise<void> {
  const syncButton = document.getElementById('sync-models') as HTMLButtonElement;
  const modelList = document.getElementById('model-list');
  
  if (!syncButton || !modelList) return;
  
  // Show loading state
  syncButton.disabled = true;
  syncButton.innerHTML = `
    <div class="loading-spinner"></div>
    Syncing...
  `;
  
  modelList.innerHTML = `
    <div class="model-list-loading">
      <div class="loading-spinner"></div>
      <span>Syncing models...</span>
    </div>
  `;
  
  try {
    const result = await modelManager.syncModels(currentProvider);
    
    if (result.success) {
      loadModels();
      showNotification('Models synced successfully', 'success');
    } else {
      showModelError(result.error || 'Failed to sync models');
      showNotification('Failed to sync models: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showModelError('Network error occurred');
    showNotification('Network error occurred', 'error');
  } finally {
    // Restore button state
    syncButton.disabled = false;
    syncButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
      Sync Models
    `;
  }
}

function loadModels(): void {
  const models = modelManager.getModels(currentProvider);
  updateModelList(models);
  updateSelectedModelDropdown(models);
}

function updateModelList(models?: ModelInfo[]): void {
  const modelList = document.getElementById('model-list');
  if (!modelList) return;
  
  const modelData = models || modelManager.getModels(currentProvider);
  const selectedModel = modelManager.getSelectedModel();
  
  if (modelData.length === 0) {
    modelList.innerHTML = `
      <div class="model-list-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
        <p>No models available</p>
      </div>
    `;
    return;
  }
  
  modelList.innerHTML = modelData.map(model => `
    <div class="model-item ${model.id === selectedModel ? 'selected' : ''}" data-model-id="${model.id}">
      <div class="model-info">
        <div class="model-name">${model.name}</div>
        <div class="model-id">${model.id}</div>
        <div class="model-badges">
          <span class="model-badge ${model.isManual ? 'manual' : 'auto'}">${model.isManual ? 'manual' : 'auto'}</span>
          ${model.isVision ? '<span class="model-badge vision">vision</span>' : ''}
        </div>
      </div>
      <div class="model-actions-item">
        <button class="model-action-btn select" data-action="select" data-model-id="${model.id}" title="Select Model">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        </button>
        ${model.isManual ? `
          <button class="model-action-btn delete" data-action="delete" data-model-id="${model.id}" data-provider-id="${currentProvider}" title="Delete Model">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
            </svg>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Add event delegation for model actions
  modelList.removeEventListener('click', handleModelListClick); // Remove existing listener if any
  modelList.addEventListener('click', handleModelListClick);
}

function handleModelListClick(event: Event): void {
  const target = event.target as HTMLElement;
  const button = target.closest('.model-action-btn') as HTMLButtonElement;
  
  if (!button) return;
  
  const action = button.getAttribute('data-action');
  const modelId = button.getAttribute('data-model-id');
  const providerId = button.getAttribute('data-provider-id');
  
  if (!action || !modelId) return;
  
  switch (action) {
    case 'select':
      selectModel(modelId);
      break;
    case 'delete':
      if (providerId) {
        deleteModel(providerId, modelId);
      }
      break;
  }
}

function selectModel(modelId: string): void {
  try {
    modelManager.setSelectedModel(modelId).then(() => {
      updateModelList();
      updateSelectedModelDropdown();
      showNotification('Model selected', 'success');
    }).catch(error => {
      console.error('Failed to save selected model:', error);
      showNotification('Failed to save model selection', 'error');
    });
  } catch (error) {
    console.error('Failed to select model:', error);
    showNotification('Failed to select model', 'error');
  }
}

function deleteModel(providerId: string, modelId: string): void {
  // Find the model to get its display information
  const models = modelManager.getModels(providerId);
  const model = models.find(m => m.id === modelId);
  
  if (!model) {
    showNotification('Model not found', 'error');
    return;
  }
  
  // Show the delete confirmation modal
  showDeleteModelModal(model, providerId);
}

function showDeleteModelModal(model: ModelInfo, providerId: string): void {
  const modal = document.getElementById('delete-model-modal');
  const modelNameElement = document.getElementById('delete-model-name');
  const modelIdElement = document.getElementById('delete-model-id');
  
  if (!modal || !modelNameElement || !modelIdElement) return;
  
  // Set model information in the modal
  modelNameElement.textContent = model.name;
  modelIdElement.textContent = model.id;
  
  // Store the model info for deletion
  modal.setAttribute('data-model-id', model.id);
  modal.setAttribute('data-provider-id', providerId);
  
  // Show the modal
  modal.classList.remove('hidden');
}

function hideDeleteModelModal(): void {
  const modal = document.getElementById('delete-model-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.removeAttribute('data-model-id');
    modal.removeAttribute('data-provider-id');
  }
}

function confirmDeleteModel(): void {
  const modal = document.getElementById('delete-model-modal');
  if (!modal) return;
  
  const modelId = modal.getAttribute('data-model-id');
  const providerId = modal.getAttribute('data-provider-id');
  
  if (!modelId || !providerId) return;
  
  try {
    // Perform the deletion
    modelManager.removeModel(providerId, modelId);
    loadModels();
    showNotification('Model deleted', 'success');
    
    // Hide the modal
    hideDeleteModelModal();
  } catch (error) {
    console.error('Failed to delete model:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete model';
    showNotification(errorMessage, 'error');
    
    // Hide the modal even if there was an error
    hideDeleteModelModal();
  }
}

function updateSelectedModelDropdown(models?: ModelInfo[]): void {
  const selectedModelSelect = document.getElementById('selected-model') as HTMLSelectElement;
  if (!selectedModelSelect) return;
  
  const modelData = models || modelManager.getModels(currentProvider);
  const selectedModel = modelManager.getSelectedModel();
  
  // Clear existing options
  selectedModelSelect.innerHTML = '<option value="">Select a model...</option>';
  
  modelData.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.name} (${model.id})`;
    if (model.id === selectedModel) {
      option.selected = true;
    }
    selectedModelSelect.appendChild(option);
  });
}

function showModelError(message: string): void {
  const modelList = document.getElementById('model-list');
  if (!modelList) return;
  
  modelList.innerHTML = `
    <div class="model-list-error">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <p>Error loading models</p>
      <small>${message}</small>
    </div>
  `;
}

function showManualModelForm(): void {
  const manualModelSection = document.getElementById('manual-model-section');
  if (manualModelSection) {
    manualModelSection.classList.remove('hidden');
    
    // Clear form
    const modelIdInput = document.getElementById('manual-model-id') as HTMLInputElement;
    const modelNameInput = document.getElementById('manual-model-name') as HTMLInputElement;
    
    if (modelIdInput) modelIdInput.value = '';
    if (modelNameInput) modelNameInput.value = '';
    
    // Focus on first input
    if (modelIdInput) modelIdInput.focus();
  }
}

function hideManualModelForm(): void {
  const manualModelSection = document.getElementById('manual-model-section');
  if (manualModelSection) {
    manualModelSection.classList.add('hidden');
  }
}

function saveManualModel(): void {
  const modelIdInput = document.getElementById('manual-model-id') as HTMLInputElement;
  const modelNameInput = document.getElementById('manual-model-name') as HTMLInputElement;
  
  if (!modelIdInput || !modelNameInput) return;
  
  const modelId = modelIdInput.value.trim();
  const modelName = modelNameInput.value.trim();
  
  if (!modelId) {
    showNotification('Model ID is required', 'error');
    return;
  }
  
  const displayName = modelName || modelId;
  
  try {
    modelManager.addManualModel(currentProvider, {
      id: modelId,
      name: displayName
    });
    
    hideManualModelForm();
    loadModels();
    showNotification('Model added successfully', 'success');
  } catch (error) {
    console.error('Failed to add model:', error);
    showNotification('Failed to add model', 'error');
  }
}

function initializeSettings(): void {
  const showIconCheckbox = document.getElementById('show-icon') as HTMLInputElement;
  const saveButton = document.querySelector('.save-button') as HTMLButtonElement;
  
  // Load show icon setting
  chrome.storage.sync.get(['showIcon'], (result) => {
    if (showIconCheckbox) {
      showIconCheckbox.checked = result.showIcon !== false; // Default to true
    }
  });
  
  // Save settings
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      const showIcon = showIconCheckbox?.checked !== false;
      
      await chrome.storage.sync.set({ showIcon });
      
      // Show success message
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saved!';
      saveButton.classList.add('saved');
      
      setTimeout(() => {
        saveButton.textContent = originalText || 'Save Settings';
        saveButton.classList.remove('saved');
      }, 2000);
      
      // Send message to content script to update icon visibility
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updateIconVisibility', showIcon }, (response) => {
            // Handle the response or error silently
            if (chrome.runtime.lastError) {
              // Content script not available on this page (e.g., chrome:// pages)
              // This is expected behavior and not an error
            }
          });
        }
      });
    });
  }
}

function initializeStats(): void {
  loadTokenUsage().then(updateUsageStats);
  
  const clearButton = document.getElementById('clear-usage');
  const confirmClearButton = document.getElementById('confirm-clear-stats');
  const cancelClearButton = document.getElementById('cancel-clear-stats');
  const clearStatsModal = document.getElementById('clear-stats-modal');
  
  // Clear stats button - show modal instead of confirm
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      showClearStatsModal();
    });
  }
  
  // Confirm clear stats
  if (confirmClearButton) {
    confirmClearButton.addEventListener('click', async () => {
      await clearTokenUsage();
      updateUsageStats({ totalTokens: 0, requestCount: 0 });
      showNotification('Usage statistics cleared', 'success');
      hideClearStatsModal();
    });
  }
  
  // Cancel clear stats
  if (cancelClearButton) {
    cancelClearButton.addEventListener('click', () => {
      hideClearStatsModal();
    });
  }
  
  // Close modal on outside click
  if (clearStatsModal) {
    clearStatsModal.addEventListener('click', (e: Event) => {
      if (e.target === clearStatsModal) {
        hideClearStatsModal();
      }
    });
  }
}

function showClearStatsModal(): void {
  const modal = document.getElementById('clear-stats-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideClearStatsModal(): void {
  const modal = document.getElementById('clear-stats-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function loadTokenUsage(): Promise<TokenUsage> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['tokenUsage'], (result) => {
      resolve(result.tokenUsage || { totalTokens: 0, requestCount: 0 });
    });
  });
}

async function clearTokenUsage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ tokenUsage: { totalTokens: 0, requestCount: 0 } }, resolve);
  });
}

function updateUsageStats(usage: TokenUsage): void {
  const totalTokensElement = document.getElementById('total-tokens');
  const requestCountElement = document.getElementById('request-count');
  const avgTokensElement = document.getElementById('avg-tokens');
  
  if (totalTokensElement) {
    totalTokensElement.textContent = usage.totalTokens.toLocaleString();
  }
  
  if (requestCountElement) {
    requestCountElement.textContent = usage.requestCount.toLocaleString();
  }
  
  if (avgTokensElement) {
    const avgTokens = usage.requestCount > 0 ? Math.round(usage.totalTokens / usage.requestCount) : 0;
    avgTokensElement.textContent = avgTokens.toLocaleString();
  }
}

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function initializeCustomPrompts(): void {
  const addPromptButton = document.querySelector('.ai-add-prompt') as HTMLButtonElement;
  const promptsContainer = document.querySelector('.custom-prompts-container') as HTMLElement;
  
  if (!addPromptButton || !promptsContainer) return;
  
  // Load existing custom prompts
  loadCustomPrompts();
  
  // Add event listener for the "Add Custom Prompt" button
  addPromptButton.addEventListener('click', () => {
    addNewPromptItem();
  });
}

async function loadCustomPrompts(): Promise<void> {
  const promptsContainer = document.querySelector('.custom-prompts-container') as HTMLElement;
  if (!promptsContainer) return;
  
  try {
    const result = await chrome.storage.sync.get(['customPrompts']);
    const customPrompts = result.customPrompts || {};
    
    // Clear existing prompts
    promptsContainer.innerHTML = '';
    
    // Add each custom prompt
    Object.entries(customPrompts).forEach(([command, text]) => {
      addPromptItem(command, text as string);
    });
  } catch (error) {
    console.error('Failed to load custom prompts:', error);
  }
}

function addNewPromptItem(): void {
  addPromptItem('', '');
}

function addPromptItem(command: string, text: string): void {
  const promptsContainer = document.querySelector('.custom-prompts-container') as HTMLElement;
  if (!promptsContainer) return;
  
  const promptItem = document.createElement('div');
  promptItem.className = 'custom-prompt-item';
  
  promptItem.innerHTML = `
    <div class="prompt-inputs">
      <input type="text" class="prompt-command" placeholder="/command" value="${command}" />
      <textarea class="prompt-text" placeholder="Prompt text..." rows="2">${text}</textarea>
    </div>
    <div class="prompt-actions">
      <button class="ai-button-base ai-primary-button save-prompt">Save</button>
      <button class="ai-button-base delete-prompt">Delete</button>
    </div>
  `;
  
  promptsContainer.appendChild(promptItem);
  
  // Add event listeners for this prompt item
  const saveButton = promptItem.querySelector('.save-prompt') as HTMLButtonElement;
  const deleteButton = promptItem.querySelector('.delete-prompt') as HTMLButtonElement;
  const commandInput = promptItem.querySelector('.prompt-command') as HTMLInputElement;
  const textInput = promptItem.querySelector('.prompt-text') as HTMLTextAreaElement;
  
  saveButton.addEventListener('click', () => {
    savePromptItem(promptItem, commandInput.value.trim(), textInput.value.trim());
  });
  
  deleteButton.addEventListener('click', () => {
    deletePromptItem(promptItem, commandInput.value.trim());
  });
  
  // Focus on command input if it's empty (new prompt)
  if (!command) {
    commandInput.focus();
  }
}

async function savePromptItem(promptItem: HTMLElement, command: string, text: string): Promise<void> {
  if (!command || !text) {
    showNotification('Both command and text are required', 'error');
    return;
  }
  
  if (!command.startsWith('/')) {
    showNotification('Command must start with /', 'error');
    return;
  }
  
  try {
    const result = await chrome.storage.sync.get(['customPrompts']);
    const customPrompts = result.customPrompts || {};
    
    customPrompts[command] = text;
    
    await chrome.storage.sync.set({ customPrompts });
    
    showNotification('Custom prompt saved', 'success');
    
    // Update the prompt item to show it's saved
    const saveButton = promptItem.querySelector('.save-prompt') as HTMLButtonElement;
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saved!';
    saveButton.classList.add('saved');
    
    setTimeout(() => {
      saveButton.textContent = originalText || 'Save';
      saveButton.classList.remove('saved');
    }, 2000);
    
  } catch (error) {
    console.error('Failed to save custom prompt:', error);
    showNotification('Failed to save custom prompt', 'error');
  }
}

async function deletePromptItem(promptItem: HTMLElement, command: string): Promise<void> {
  if (!command) {
    // If no command, just remove the item from DOM
    promptItem.remove();
    return;
  }
  
  try {
    const result = await chrome.storage.sync.get(['customPrompts']);
    const customPrompts = result.customPrompts || {};
    
    delete customPrompts[command];
    
    await chrome.storage.sync.set({ customPrompts });
    
    promptItem.remove();
    showNotification('Custom prompt deleted', 'success');
    
  } catch (error) {
    console.error('Failed to delete custom prompt:', error);
    showNotification('Failed to delete custom prompt', 'error');
  }
} 