/// <reference types="chrome"/>

import { createSidebar } from './components/ui/sidebar';
import { setupContextModes } from './components/context/contextModes';
import { handleQuestion } from './components/chat/messageHandler';
import { loadChatHistory } from './components/chat/chatHistory';
import { loadCustomPrompts } from './components/chat/promptShortcuts';

// Add message listener for icon visibility updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateIconVisibility') {
    const toggleButton = document.getElementById('page-reader-toggle');
    if (toggleButton) {
      toggleButton.style.display = message.showIcon ? 'block' : 'none';
    }
  }
});

async function initializeExtension() {
  try {
    // Create toggle button first
    const toggleButton = document.createElement('button');
    toggleButton.id = 'page-reader-toggle';
    toggleButton.textContent = 'Ask AI';
    toggleButton.style.display = 'block'; // Show by default
    document.body.appendChild(toggleButton);

    // Initialize icon visibility
    chrome.storage.sync.get(['showIcon'], (result) => {
      if (toggleButton) {
        toggleButton.style.display = result.showIcon !== false ? 'block' : 'none';
      }
    });

    // Load custom prompts
    await loadCustomPrompts();

    // Create sidebar
    createSidebar();
    
    // Wait for sidebar to be fully created
    const maxAttempts = 10;
    let attempts = 0;
    
    function trySetupContextModes() {
      const sidebar = document.getElementById('page-reader-sidebar');
      const contentPreview = document.getElementById('content-preview');
      
      if (sidebar && contentPreview) {
        setupContextModes();
        loadChatHistory();
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(trySetupContextModes, 100);
      } else {
        console.error('Failed to initialize extension: Required elements not found');
      }
    }
    
    // Start initialization
    trySetupContextModes();
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// Initialize extension when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeExtension); 