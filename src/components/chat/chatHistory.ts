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

interface StorageResult {
  chatHistories?: Record<string, ChatHistory>;
}

let currentHistory: ChatHistory = {
  messages: [],
  url: window.location.href
};

export async function loadChatHistory(): Promise<void> {
  const answerDiv = document.getElementById('answer');
  if (!answerDiv) return;

  try {
    const result = await chrome.storage.local.get(['chatHistories']);
    const histories: Record<string, ChatHistory> = result.chatHistories || {};
    currentHistory = histories[window.location.href] || { messages: [], url: window.location.href };
    
    // Clear existing messages
    const clearButton = answerDiv.querySelector('.clear-chat');
    answerDiv.innerHTML = '';
    if (clearButton) answerDiv.appendChild(clearButton);
    
    // Add messages
    currentHistory.messages.forEach(message => {
      const messageDiv = createMessageElement(message);
      answerDiv.insertBefore(messageDiv, clearButton);
    });
    
    // Scroll to bottom
    answerDiv.scrollTop = answerDiv.scrollHeight;
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
    const result = await chrome.storage.local.get(['chatHistories']);
    const histories: Record<string, ChatHistory> = result.chatHistories || {};
    histories[window.location.href] = currentHistory;
    await chrome.storage.local.set({ chatHistories: histories });
    
    const answerDiv = document.getElementById('answer');
    const clearButton = answerDiv?.querySelector('.clear-chat');
    if (answerDiv && clearButton) {
      const messageDiv = createMessageElement(message);
      answerDiv.insertBefore(messageDiv, clearButton);
      answerDiv.scrollTop = answerDiv.scrollHeight;
    }
  } catch (error) {
    console.error('Failed to save message:', error);
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['chatHistories']);
    const histories: Record<string, ChatHistory> = result.chatHistories || {};
    delete histories[window.location.href];
    await chrome.storage.local.set({ chatHistories: histories });
    currentHistory = { messages: [], url: window.location.href };
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