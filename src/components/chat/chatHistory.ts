/// <reference types="chrome"/>

import { renderMarkdown } from '../../utils/markdown';
import { MODELS, MODEL_DISPLAY_NAMES } from '../../config';
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
  const answerDiv = document.getElementById('answer');
  if (!answerDiv) return;

  try {
    const result = await new Promise<{ chatHistories?: Record<string, ChatHistory> }>((resolve) => {
      chrome.storage.local.get(['chatHistories'], resolve);
    });
    
    const histories = result.chatHistories || {};
    const currentUrl = String(window.location.href);
    currentHistory = histories[currentUrl] || { messages: [], url: window.location.href };
    
    // Clear existing messages except the clear button
    const clearButton = answerDiv.querySelector('.clear-chat');
    const messages = answerDiv.querySelectorAll('.message');
    messages.forEach(message => message.remove());
    
    // Add messages
    currentHistory.messages.forEach(message => {
      const messageDiv = createMessageElement(message);
      if (clearButton) {
        answerDiv.insertBefore(messageDiv, clearButton);
      } else {
        answerDiv.appendChild(messageDiv);
      }
    });
    
    // Scroll to bottom
    answerDiv.scrollTop = answerDiv.scrollHeight;

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
    
    const answerDiv = document.getElementById('answer');
    const clearButton = answerDiv?.querySelector('.clear-chat');
    if (answerDiv) {
      const messageDiv = createMessageElement(message);
      if (clearButton) {
        answerDiv.insertBefore(messageDiv, clearButton);
      } else {
        answerDiv.appendChild(messageDiv);
      }
      answerDiv.scrollTop = answerDiv.scrollHeight;
    }
  } catch (error) {
    console.error('Failed to save message:', error);
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
    const answerDiv = document.getElementById('answer');
    if (answerDiv) {
      // Keep the clear chat button and remove all messages
      const clearButton = answerDiv.querySelector('.clear-chat');
      answerDiv.innerHTML = '';
      if (clearButton) {
        answerDiv.appendChild(clearButton);
      }
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
  contentDiv.innerHTML = renderMarkdown(message.content);
  
  const footerDiv = document.createElement('div');
  footerDiv.className = 'ai-message-footer';
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'ai-message-time';
  timeDiv.textContent = new Date(message.timestamp).toLocaleTimeString();

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
      navigator.clipboard.writeText(message.content).then(() => {
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
      });
    });
    
    copyContainer.appendChild(copyButton);
    messageDiv.appendChild(copyContainer);

    // Add model selector or static model info
    if (message === currentHistory.messages[currentHistory.messages.length - 1]) {
      const modelSelector = document.createElement('select');
      modelSelector.className = 'message-model-selector';
      
      Object.entries(MODELS)
        .filter(([key]) => key !== 'VISION')
        .forEach(([key, value]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = MODEL_DISPLAY_NAMES[value as ModelType];
          if (value === message.model) {
            option.selected = true;
          }
          modelSelector.appendChild(option);
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
      modelInfo.textContent = MODEL_DISPLAY_NAMES[message.model as ModelType] || message.model || 'Unknown Model';
      modelInfoContainer.appendChild(modelInfo);
    }
  }
  
  footerDiv.appendChild(timeDiv);
  footerDiv.appendChild(modelInfoContainer);
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(footerDiv);
  
  return messageDiv;
} 