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
    setupChartEnlarge();
    
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
let chartEnlargeSetup = false;

// Chart enlarge functionality
function setupChartEnlarge(): void {
  if (chartEnlargeSetup) {
    console.log('Chart enlarge already set up, skipping...');
    return;
  }
  
  console.log('Setting up chart enlarge function...');
  
  // Main enlarge function
  function openChartInNewTab(diagramId: string) {
    console.log('Chart enlarge function called for:', diagramId);
    try {
      const container = document.querySelector(`[data-diagram-id="${diagramId}"]`) as HTMLElement;
      if (!container) {
        console.warn(`Chart container not found: ${diagramId}`);
        return;
      }

      // Get the SVG content from the chart container only
      const chartContent = container.querySelector('.chart-content');
      const svgElement = chartContent?.querySelector('svg');
      if (!svgElement) {
        console.warn('SVG element not found in chart container');
        return;
      }

      // Get chart type for filename
      const chartTypeLabel = container.querySelector('.chart-type-label')?.textContent || 'Chart';
      
      // Clone only the SVG element and enhance it for standalone display
      const svgClone = svgElement.cloneNode(true) as SVGElement;
      svgClone.removeAttribute('id');
      
      // Enhance SVG for standalone viewing
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      
      // Ensure the SVG has proper dimensions for standalone viewing
      const viewBox = svgClone.getAttribute('viewBox');
      if (viewBox && !svgClone.getAttribute('width')) {
        const [, , width, height] = viewBox.split(' ').map(Number);
        svgClone.setAttribute('width', Math.min(width, 1200).toString());
        svgClone.setAttribute('height', Math.min(height, 800).toString());
      }
      
      // Create a clean SVG with white background
      const svgWithBackground = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     viewBox="${svgClone.getAttribute('viewBox')}" 
     width="${svgClone.getAttribute('width')}" 
     height="${svgClone.getAttribute('height')}">
  <rect width="100%" height="100%" fill="white"/>
  ${svgClone.innerHTML}
</svg>`;
      
      // Create a blob URL for the SVG
      const blob = new Blob([svgWithBackground], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      // Open in new tab
      const newTab = window.open(url, '_blank');
      if (!newTab) {
        console.error('New tab blocked by browser');
        // Fallback: trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chartTypeLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      
      console.log(`Chart ${diagramId} opened in new tab`);
    } catch (error) {
      console.error('Error opening chart in new tab:', error);
    }
  }
  
  // Add to window for external access if needed
  (window as any).openChartInNewTab = openChartInNewTab;
  
  // Event delegation for chart enlarge buttons with click tracking
  let isProcessingClick = false;
  
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('.chart-enlarge-toggle') as HTMLElement;
    
    if (button) {
      // Prevent double clicks
      if (isProcessingClick) {
        console.log('Ignoring duplicate click event');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      isProcessingClick = true;
      console.log('Chart enlarge button clicked via event delegation');
      e.preventDefault();
      e.stopImmediatePropagation();
      
      // Get diagram ID from the button itself
      const diagramId = button.getAttribute('data-diagram-id');
      if (diagramId) {
        openChartInNewTab(diagramId);
      } else {
        console.error('Diagram ID not found on button');
      }
      
      // Reset flag after a short delay
      setTimeout(() => {
        isProcessingClick = false;
      }, 100);
    }
  }, { capture: true });
  
  chartEnlargeSetup = true;
  console.log('Chart enlarge setup complete');
}



// Setup chart enlarge immediately when script loads
setupChartEnlarge();

// Initialize extension when DOM is loaded or if it's already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startInitialization);
} else {
  startInitialization();
} 