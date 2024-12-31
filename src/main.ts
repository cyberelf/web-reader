/// <reference types="chrome"/>

import { createSidebar } from './components/ui/sidebar';
import { setupContextModes } from './components/context/contextModes';
import { handleQuestion } from './components/chat/messageHandler';
import { loadChatHistory } from './components/chat/chatHistory';

function initializeExtension() {
  try {
    // Create sidebar first
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

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
} 