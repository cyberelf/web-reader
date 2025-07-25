/// <reference types="chrome"/>

import { createSidebar, setupToggleButton } from './components/ui/sidebar';
import { setupContextModes, clearVideoSubtitles } from './components/context/contextModes';
import { handleQuestion } from './components/chat/messageHandler';
import { loadChatHistory } from './components/chat/chatHistory';
import { loadCustomPrompts } from './components/chat/promptShortcuts';

// Track current URL to detect navigation in SPAs
let currentUrl = window.location.href;

// Add message listener for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    const toggleButton = document.getElementById('ai-page-reader-toggle');
    if (toggleButton) {
      toggleButton.style.display = message.showIcon ? 'block' : 'none';
      chrome.storage.sync.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.showIcon = message.showIcon;
        settings.language = message.language;
        chrome.storage.sync.set({ settings });
      });
    }
    
    // If language changed, reload the page to apply new language
    if (message.language) {
      location.reload();
    }
  }
  
  // Legacy support for old message format
  if (message.action === 'updateIconVisibility') {
    const toggleButton = document.getElementById('ai-page-reader-toggle');
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

// Monitor URL changes for single-page applications
function monitorUrlChanges() {
  // Use both popstate and pushstate/replacestate detection
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      
      // Reinitialize extension components for new page
      setTimeout(() => {
        reinitializeForNewPage();
      }, 1000);
    }
  });
  
  observer.observe(document, { subtree: true, childList: true });
  
  // Also listen for popstate events
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      reinitializeForNewPage();
    }, 500);
  });
  
  // Override pushState and replaceState to detect programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => {
      reinitializeForNewPage();
    }, 500);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(() => {
      reinitializeForNewPage();
    }, 500);
  };
}

// Reinitialize components when navigating to new pages
async function reinitializeForNewPage() {
  const newUrl = window.location.href;
  if (newUrl === currentUrl) return;
  
  console.log('Reinitializing extension for new page:', newUrl);
  currentUrl = newUrl;
  
  // Clear video subtitle cache for new page
  clearVideoSubtitles();
  
  // Check if we need to update context modes for the new page
  const contextModes = document.querySelector('.ai-slider-container');
  if (contextModes) {
    // Reset context modes for new page
    try {
      setupContextModes();
    } catch (error) {
      console.warn('Failed to reinitialize context modes:', error);
    }
  }
}

async function initializeExtension() {
  try {
    console.log('Initializing Web Reader Extension...');
    
    // Check if button already exists
    let toggleButton = document.getElementById('ai-page-reader-toggle') as HTMLButtonElement | null;
    
    // Create toggle button if it doesn't exist
    if (!toggleButton) {
      toggleButton = document.createElement('button');
      toggleButton.id = 'ai-page-reader-toggle';
      toggleButton.textContent = 'Ask AI';
      toggleButton.style.visibility = 'hidden'; // Hide initially
      document.body.appendChild(toggleButton);
      console.log('Created toggle button');
    }

    // Initialize icon visibility using settings format
    chrome.storage.sync.get(['settings'], (result) => {
      if (toggleButton) {
        const settings = result.settings || {};
        toggleButton.style.display = settings.showIcon !== false ? 'block' : 'none';
        toggleButton.style.visibility = 'visible'; // Show after display is set
        console.log('Toggle button visibility set:', settings.showIcon !== false);
      }
    });

    // Setup toggle button event handlers
    setupToggleButton(toggleButton);
    console.log('Toggle button setup complete');

    // Load custom prompts
    await loadCustomPrompts();
    console.log('Custom prompts loaded');

    // Create sidebar with retry mechanism
    let sidebarCreated = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!sidebarCreated && attempts < maxAttempts) {
      try {
        await createSidebar();
        sidebarCreated = true;
        console.log('Sidebar created successfully');
      } catch (error) {
        attempts++;
        console.warn(`Sidebar creation attempt ${attempts} failed:`, error);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!sidebarCreated) {
      throw new Error('Failed to create sidebar after multiple attempts');
    }
    
    // Wait for sidebar to be fully created with improved detection
    const maxSetupAttempts = 15;
    let setupAttempts = 0;
    
    function trySetupContextModes() {
      const sidebar = document.getElementById('ai-page-reader-sidebar');
      const contentPreview = document.getElementById('ai-content-preview');
      
      if (sidebar && contentPreview) {
        try {
          setupContextModes();
          loadChatHistory();
          console.log('Context modes and chat history setup complete');
          
          // Start monitoring URL changes for SPAs
          monitorUrlChanges();
          console.log('URL change monitoring started');
          
        } catch (error) {
          console.error('Error setting up context modes:', error);
        }
      } else if (setupAttempts < maxSetupAttempts) {
        setupAttempts++;
        console.log(`Waiting for sidebar elements, attempt ${setupAttempts}/${maxSetupAttempts}`);
        setTimeout(trySetupContextModes, 200);
      } else {
        console.error('Failed to initialize extension: Required elements not found after', maxSetupAttempts, 'attempts');
      }
    }
    
    // Start initialization
    trySetupContextModes();
    
    // Setup chart resize functionality (if not already done)
    setupChartResize();
    
  } catch (error) {
    console.error('Error initializing extension:', error);
    
    // Fallback: try again after a delay
    setTimeout(() => {
      console.log('Retrying extension initialization...');
      initializeExtension();
    }, 3000);
  }
}

// Enhanced initialization with better timing
function startInitialization() {
  // For Bilibili and other SPAs, wait a bit longer for dynamic content
  const isSPA = window.location.hostname.includes('bilibili.com') || 
                window.location.hostname.includes('youtube.com');
  
  const delay = isSPA ? 2000 : 0;
  
  setTimeout(() => {
    initializeExtension();
  }, delay);
}

// Global flag to prevent multiple event listener setup
let chartResizeSetup = false;

// Chart resize functionality
function setupChartResize(): void {
  if (chartResizeSetup) {
    console.log('Chart resize already set up, skipping...');
    return;
  }
  
  console.log('Setting up chart resize function... Call stack:', new Error().stack?.split('\n')[1]);
  
  // Main resize function
  function toggleChartSize(diagramId: string) {
    console.log('Chart resize function called for:', diagramId);
    try {
      const container = document.querySelector(`[data-diagram-id="${diagramId}"]`) as HTMLElement;
      if (!container) {
        console.warn(`Chart container not found: ${diagramId}`);
        return;
      }

      const currentMode = container.getAttribute('data-fit-mode') || 'fit';
      const newMode = currentMode === 'fit' ? 'original' : 'fit';
      
      // Update container mode
      container.setAttribute('data-fit-mode', newMode);
      
      // Update button tooltip
      const button = container.querySelector('.chart-resize-toggle') as HTMLElement;
      if (button) {
        button.title = newMode === 'fit' ? 'Switch to original size' : 'Switch to fit container';
      }
      
      console.log(`Chart ${diagramId} resized from ${currentMode} to ${newMode}`);
    } catch (error) {
      console.error('Error resizing chart:', error);
    }
  }
  
  // Add to window for external access if needed
  (window as any).toggleChartResize = toggleChartSize;
  
  // Event delegation for chart resize buttons with click tracking
  let isProcessingClick = false;
  
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('chart-resize-toggle')) {
      // Prevent double clicks
      if (isProcessingClick) {
        console.log('Ignoring duplicate click event');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      isProcessingClick = true;
      console.log('Chart resize button clicked via event delegation');
      e.preventDefault();
      e.stopImmediatePropagation();
      
      // Get diagram ID from the button itself
      const diagramId = target.getAttribute('data-diagram-id');
      if (diagramId) {
        toggleChartSize(diagramId);
      } else {
        console.error('Diagram ID not found on button');
      }
      
      // Reset flag after a short delay
      setTimeout(() => {
        isProcessingClick = false;
      }, 100);
    }
  }, { capture: true });
  
  chartResizeSetup = true;
  console.log('Chart resize setup complete');
}



// Setup chart resize immediately when script loads
setupChartResize();

// Initialize extension when DOM is loaded or if it's already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startInitialization);
} else {
  startInitialization();
} 