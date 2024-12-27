/// <reference types="chrome"/>

import { renderMarkdown } from '../../utils/markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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
  debugger; 
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

export async function addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  const message: ChatMessage = {
    role,
    content,
    timestamp: Date.now()
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
      const messages = answerDiv.querySelectorAll('.message');
      messages.forEach(message => message.remove());
    }
  } catch (error) {
    console.error('Failed to clear chat history:', error);
  }
}

function createMessageElement(message: ChatMessage): HTMLDivElement {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = renderMarkdown(message.content);
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = new Date(message.timestamp).toLocaleTimeString();
  
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(timeDiv);
  
  return messageDiv;
} 