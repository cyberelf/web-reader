/// <reference types="chrome"/>

import { renderMarkdown } from '../../utils/markdown';
import { MODELS, MODEL_DISPLAY_NAMES, ModelDisplayType } from '../../config';
import type { ModelType } from '../../config';
import { handleQuestion } from './messageHandler';
import { getPageContent } from '../context/contextModes';

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
    const result = await new Promise<{ chatHistories?: Record<string, ChatHistory> }>((resolve) => {
      chrome.storage.local.get(['chatHistories'], resolve);
    });
    
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
    const result = await new Promise<{ chatHistories?: Record<string, ChatHistory> }>((resolve) => {
      chrome.storage.local.get(['chatHistories'], resolve);
    });
    
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
    const result = await new Promise<{ chatHistories?: Record<string, ChatHistory> }>((resolve) => {
      chrome.storage.local.get(['chatHistories'], resolve);
    });
    
    const histories = result.chatHistories || {};
    histories[window.location.href] = currentHistory;
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ chatHistories: histories }, resolve);
    });
    
    const answerDiv = document.getElementById('ai-answer');
    if (answerDiv) {
      const lastMessageDiv = answerDiv.querySelector('.ai-chat-messages .ai-assistant-message:last-of-type .ai-message-content');
      if (lastMessageDiv) {
        lastMessageDiv.innerHTML = renderMarkdown(content);
      }
    }
  } catch (error) {
    console.error('Failed to update message:', error);
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    const result = await new Promise<{ chatHistories?: Record<string, ChatHistory> }>((resolve) => {
      chrome.storage.local.get(['chatHistories'], resolve);
    });
    
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
  } catch (error) {
    console.error('Failed to clear chat history:', error);
  }
}

function createMessageElement(message: ChatMessage): HTMLDivElement {
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-chat-message ai-${message.role}-message`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'ai-message-content';
  contentDiv.textContent = message.content;
  if (message.role === 'assistant') {
    contentDiv.innerHTML = renderMarkdown(message.content);
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
      
      // Add built-in models
      Object.entries(MODELS)
        .filter(([key]) => key !== 'VISION')
        .forEach(([key, value]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = MODEL_DISPLAY_NAMES[value as ModelDisplayType] || value;
          if (value === message.model) {
            option.selected = true;
          }
          modelSelector.appendChild(option);
        });

      // Add custom models
      chrome.storage.sync.get(['customModels'], (result: { customModels?: string[] }) => {
        const customModels = result.customModels || [];
        customModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          if (model === message.model) {
            option.selected = true;
          }
          modelSelector.appendChild(option);
        });
      });

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
      modelInfo.textContent = MODEL_DISPLAY_NAMES[message.model as ModelDisplayType] || message.model || 'Unknown Model';
      modelInfoContainer.appendChild(modelInfo);
    }
  }
  
  footerDiv.appendChild(timeDiv);
  footerDiv.appendChild(modelInfoContainer);
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(footerDiv);
  
  return messageDiv;
} 