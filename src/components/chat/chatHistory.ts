/// <reference types="chrome"/>

import { renderMarkdown, renderMarkdownSync } from '../../utils/markdown';
import { MODEL_DISPLAY_NAMES, ModelDisplayType } from '../../config';
import type { ModelType } from '../../config';
import { handleQuestion } from './messageHandler';
import { getPageContent } from '../context/contextModes';
import { modelManager } from '../../utils/modelManager';
import { getChromeStorageLocal, setChromeStorageLocal } from '../../utils/storage';


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
}

interface ChatHistory {
  messages: ChatMessage[];
  url: string;
}

let currentHistory: ChatHistory = {
  messages: [],
  url: window.location.href
};

export async function loadChatHistory(): Promise<void> {
  const answerDiv = document.getElementById('ai-answer');
  if (!answerDiv) return;

  try {
    // Initialize model manager first
    await modelManager.initialize();
    
    const result = await getChromeStorageLocal<{ chatHistories?: Record<string, ChatHistory> }>({ chatHistories: {} });

    const histories = result.chatHistories || {};
    const currentUrl = String(window.location.href);
    const urlHistory = histories[currentUrl];
    currentHistory = urlHistory ? { ...urlHistory } : { messages: [], url: currentUrl };
    
    // Clear existing content
    answerDiv.innerHTML = '';
    
    // Create messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'ai-chat-messages';
    answerDiv.appendChild(messagesContainer);
    
    // Add messages
    currentHistory.messages.forEach(message => {
      const messageDiv = createMessageElement(message);
      messagesContainer.appendChild(messageDiv);
    });

    // Add clear button only if there are messages
    if (currentHistory.messages.length > 0) {
      const clearButton = document.createElement('button');
      clearButton.className = 'ai-clear-chat-history';
      clearButton.textContent = 'Clear Chat History';
      answerDiv.appendChild(clearButton);

      // Add click handler for clear button
      clearButton.addEventListener('click', () => {
        const modal = document.getElementById('ai-clear-confirm-modal');
        if (modal) {
          modal.classList.add('show');
        }
      });
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Return a promise that resolves after DOM updates
    await new Promise(resolve => setTimeout(resolve, 0));
  } catch (error) {
    console.error('Failed to load chat history:', error);
  }
}

export async function addMessage(role: 'user' | 'assistant', content: string, model?: string): Promise<void> {
  const message: ChatMessage = {
    role,
    content,
    timestamp: Date.now(),
    model
  };
  
  currentHistory.messages.push(message);
  
  try {
    // Initialize model manager if not already initialized
    await modelManager.initialize();
    
    const result = await getChromeStorageLocal<{ chatHistories?: Record<string, ChatHistory> }>({ chatHistories: {} });
    
    const histories = result.chatHistories || {};
    histories[window.location.href] = currentHistory;
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ chatHistories: histories }, resolve);
    });
    
    const answerDiv = document.getElementById('ai-answer');
    if (answerDiv) {
      let messagesContainer = answerDiv.querySelector('.ai-chat-messages');
      if (!messagesContainer) {
        messagesContainer = document.createElement('div');
        messagesContainer.className = 'ai-chat-messages';
        answerDiv.appendChild(messagesContainer);
      }

      const messageDiv = createMessageElement(message);
      messagesContainer.appendChild(messageDiv);

      // Add clear button if this is the first message
      if (currentHistory.messages.length === 1) {
        const clearButton = document.createElement('button');
        clearButton.className = 'ai-clear-chat-history';
        clearButton.textContent = 'Clear Chat History';
        answerDiv.appendChild(clearButton);

        // Add click handler for clear button
        clearButton.addEventListener('click', () => {
          const modal = document.getElementById('ai-clear-confirm-modal');
          if (modal) {
            modal.classList.add('show');
          }
        });
      }

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    

  } catch (error) {
    console.error('Failed to save message:', error);
  }
}

export async function updateLastMessage(content: string): Promise<void> {
  if (currentHistory.messages.length === 0) return;

  const lastMessage = currentHistory.messages[currentHistory.messages.length - 1];
  if (lastMessage.role !== 'assistant') return;

  lastMessage.content = content;

  try {
    const result = await getChromeStorageLocal<{ chatHistories?: Record<string, ChatHistory> }>({ chatHistories: {} });

    const histories = result.chatHistories || {};
    histories[window.location.href] = currentHistory;
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ chatHistories: histories }, resolve);
    });
    
    const answerDiv = document.getElementById('ai-answer');
    if (answerDiv) {
      const lastMessageDiv = answerDiv.querySelector('.ai-chat-messages .ai-assistant-message:last-of-type .ai-message-content') as HTMLElement;
      if (lastMessageDiv) {
        // Use async renderMarkdown to support mermaid charts
        renderMarkdown(content).then((renderedContent) => {
          lastMessageDiv.innerHTML = renderedContent;
        }).catch((error) => {
          console.error('Failed to render markdown with mermaid:', error);
          // Fallback to sync rendering without mermaid
          lastMessageDiv.innerHTML = renderMarkdownSync(content);
        });
      }
    }
    

  } catch (error) {
    console.error('Failed to update message:', error);
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    const result = await getChromeStorageLocal<{ chatHistories?: Record<string, ChatHistory> }>({ chatHistories: {} });

    const histories = result.chatHistories || {};
    delete histories[window.location.href];
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ chatHistories: histories }, resolve);
    });
    
    currentHistory = { messages: [], url: window.location.href };
    
    // Clear messages from the UI
    const answerDiv = document.getElementById('ai-answer');
    if (answerDiv) {
      answerDiv.innerHTML = '';
    }
    
    // Trigger token update after clearing history
    // (to update token estimation when chat history is included)
    const tokenUpdateEvent = new CustomEvent('chatHistoryUpdate');
    document.dispatchEvent(tokenUpdateEvent);
  } catch (error) {
    console.error('Failed to clear chat history:', error);
  }
}

export function getChatHistoryMessages(): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  // Return all messages except the current incomplete assistant message
  const messages = currentHistory.messages.slice();
  
  // If the last message is an empty assistant message (placeholder), remove it
  if (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content.trim()) {
    messages.pop();
  }
  
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

function createMessageElement(message: ChatMessage): HTMLDivElement {
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-chat-message ai-${message.role}-message`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'ai-message-content';
  contentDiv.textContent = message.content;
  if (message.role === 'assistant') {
    // Use async renderMarkdown to support mermaid charts
    renderMarkdown(message.content).then((renderedContent) => {
      contentDiv.innerHTML = renderedContent;
    }).catch((error) => {
      console.error('Failed to render markdown with mermaid:', error);
      // Fallback to sync rendering without mermaid
      contentDiv.innerHTML = renderMarkdownSync(message.content);
    });
  }
  
  const footerDiv = document.createElement('div');
  footerDiv.className = 'ai-message-footer';
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'ai-message-time';
  timeDiv.textContent = typeof message.timestamp === 'string' 
    ? message.timestamp 
    : new Date(message.timestamp).toLocaleTimeString();

  const modelInfoContainer = document.createElement('div');
  modelInfoContainer.className = 'model-info-container';
  
  // Add copy button for assistant messages
  if (message.role === 'assistant') {
    const copyContainer = document.createElement('div');
    copyContainer.className = 'copy-container';
    
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
    copyButton.setAttribute('aria-label', 'Copy message');
    
    copyButton.addEventListener('click', () => {
      // Create a temporary textarea element
      const textarea = document.createElement('textarea');
      textarea.value = message.content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      // Try to copy using both methods
      try {
        // Try clipboard API first
        navigator.clipboard.writeText(message.content)
          .then(showCopySuccess)
          .catch(() => {
            // Fallback to execCommand
            try {
              document.execCommand('copy');
              showCopySuccess();
            } catch (err) {
              console.error('Copy failed:', err);
            }
          });
      } catch (err) {
        // If clipboard API fails immediately, try execCommand
        try {
          document.execCommand('copy');
          showCopySuccess();
        } catch (err) {
          console.error('Copy failed:', err);
        }
      }
      
      // Clean up
      document.body.removeChild(textarea);
    });
    
    // Function to show copy success feedback
    function showCopySuccess() {
      copyButton.classList.add('copied');
      copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>`;
      setTimeout(() => {
        copyButton.classList.remove('copied');
        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>`;
      }, 2000);
    }
    
    copyContainer.appendChild(copyButton);
    messageDiv.appendChild(copyContainer);

    // Add model selector or static model info
    if (message === currentHistory.messages[currentHistory.messages.length - 1]) {
      const modelSelector = document.createElement('select');
      modelSelector.className = 'message-model-selector';
      
      // Get all available models from model manager
      const allModels = modelManager.getAllModels();
      const selectedModel = modelManager.getSelectedModel();
      
      if (allModels.length === 0) {
        // Fallback to a simple option if no models are available
        const option = document.createElement('option');
        option.value = message.model || '';
        option.textContent = message.model || 'Unknown Model';
        option.selected = true;
        modelSelector.appendChild(option);
      } else {
        // Group models by provider
        const modelsByProvider: Record<string, typeof allModels> = {};
        allModels.forEach(model => {
          if (!modelsByProvider[model.provider]) {
            modelsByProvider[model.provider] = [];
          }
          modelsByProvider[model.provider].push(model);
        });
        
        // Add models grouped by provider
        Object.entries(modelsByProvider).forEach(([providerId, models]) => {
          const provider = modelManager.getProvider(providerId);
          if (provider && models.length > 0) {
            // Only show providers that are configured or have models
            const hasConfiguredModels = provider.isConfigured || models.some(m => m.isManual);
            
            if (hasConfiguredModels) {
              const optgroup = document.createElement('optgroup');
              optgroup.label = provider.name;
              
              models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = `${model.name}${model.isVision ? ' (Vision)' : ''}`;
                if (model.id === message.model) {
                  option.selected = true;
                }
                optgroup.appendChild(option);
              });
              
              modelSelector.appendChild(optgroup);
            }
          }
        });
      }

      const refreshIcon = document.createElement('div');
      refreshIcon.className = 'refresh-icon';
      refreshIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>`;

      refreshIcon.addEventListener('click', async () => {
        const lastUserMessage = currentHistory.messages
          .slice(0, -1)
          .reverse()
          .find(msg => msg.role === 'user');
        
        if (lastUserMessage) {
          const selectedModel = modelSelector.value as ModelType;
          await handleQuestion(lastUserMessage.content, getPageContent(), selectedModel);
        }
      });

      modelInfoContainer.appendChild(modelSelector);
      modelInfoContainer.appendChild(refreshIcon);
    } else {
      const modelInfo = document.createElement('div');
      modelInfo.className = 'ai-model-info';
      
      // Try to get model display name from model manager first
      const model = modelManager.getAllModels().find(m => m.id === message.model);
      const displayName = model ? model.name : (MODEL_DISPLAY_NAMES[message.model as ModelDisplayType] || message.model || 'Unknown Model');
      
      modelInfo.textContent = displayName;
      modelInfoContainer.appendChild(modelInfo);
    }
  }
  
  footerDiv.appendChild(timeDiv);
  footerDiv.appendChild(modelInfoContainer);
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(footerDiv);
  
  return messageDiv;
} 