/// <reference types="chrome"/>

import { createSidebar, setupToggleButton } from './components/ui/sidebar';
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
      chrome.storage.sync.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.showIcon = message.showIcon;
        chrome.storage.sync.set({ settings });
      });
    }
  }
});

async function initializeExtension() {
  try {
    // Check if button already exists
    let toggleButton = document.getElementById('page-reader-toggle') as HTMLButtonElement | null;
    
    // Create toggle button if it doesn't exist
    if (!toggleButton) {
      toggleButton = document.createElement('button');
      toggleButton.id = 'page-reader-toggle';
      toggleButton.textContent = 'Ask AI';
      toggleButton.style.visibility = 'hidden'; // Hide initially
      document.body.appendChild(toggleButton);
    }

    // Initialize icon visibility using settings format
    chrome.storage.sync.get(['settings'], (result) => {
      if (toggleButton) {
        const settings = result.settings || {};
        toggleButton.style.display = settings.showIcon !== false ? 'block' : 'none';
        toggleButton.style.visibility = 'visible'; // Show after display is set
      }
    });

    // Setup toggle button event handlers
    setupToggleButton(toggleButton);

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

// Initialize extension when DOM is loaded or if it's already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
} 