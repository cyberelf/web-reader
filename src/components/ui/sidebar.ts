/// <reference types="chrome"/>

import { configureMarked, renderMarkdown } from '../../utils/markdown';
import { applyTheme } from '../../utils/theme';
import { MODELS, MODEL_DISPLAY_NAMES } from '../../config';
import type { ModelType } from '../../config';
import type { Theme } from '../../utils/theme';
import { setupContextModes, getPageContent } from '../context/contextModes';
import { ShortcutHandler } from '../chat/shortcutHandler';
import { handleQuestion } from '../chat/messageHandler';
import { clearChatHistory } from '../chat/chatHistory';

interface Position {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  hasStartedDrag: boolean;
  currentPosition: Position;
  initialPosition: Position;
  pressTimer?: number;
  pressStartTime?: number;
}

interface StorageResult {
  showIcon?: boolean;
}

interface ModelSettings {
  selectedModel?: ModelType;
}

const DEFAULT_ICON_POSITION = {
  top: '20px',
  right: '20px'
};

// Add isProcessing state
let isProcessing = false;

export function setupToggleButton(toggleButton: HTMLButtonElement): void {
  const dragState: DragState = {
    isDragging: false,
    hasStartedDrag: false,
    currentPosition: { x: 0, y: 0 },
    initialPosition: { x: 0, y: 0 },
    pressTimer: undefined,
    pressStartTime: undefined
  };

  // Reset to default position on every page load
  toggleButton.style.top = DEFAULT_ICON_POSITION.top;
  toggleButton.style.right = DEFAULT_ICON_POSITION.right;
  toggleButton.style.left = 'auto';
  
  // Initialize drag event listeners
  function onDragStart(e: MouseEvent | TouchEvent): void {
    if (e instanceof MouseEvent) {
      // Only handle left click
      if (e.button !== 0 || e.target !== toggleButton) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();  // Prevent event from bubbling up
      
      // Start tracking potential drag
      dragState.pressStartTime = Date.now();
      dragState.currentPosition = {
        x: toggleButton.getBoundingClientRect().left,
        y: toggleButton.getBoundingClientRect().top
      };
    } else {
      // For touch events, start a timer for potential drag
      if (e.target !== toggleButton) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();  // Prevent event from bubbling up
      
      dragState.pressStartTime = Date.now();
      dragState.pressTimer = window.setTimeout(() => {
        startDragging(e);
      }, 500);
    }
  }

  function startDragging(e: MouseEvent | TouchEvent): void {
    if (e.target !== toggleButton) return;

    dragState.isDragging = true;
    dragState.hasStartedDrag = true;
    toggleButton.classList.add('dragging');
    
    const rect = toggleButton.getBoundingClientRect();
    dragState.currentPosition = {
      x: rect.left,
      y: rect.top
    };

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragState.initialPosition = {
      x: clientX - dragState.currentPosition.x,
      y: clientY - dragState.currentPosition.y
    };

    toggleButton.style.right = 'auto';
    toggleButton.style.left = dragState.currentPosition.x + 'px';
    toggleButton.style.top = dragState.currentPosition.y + 'px';
  }

  function onDragEnd(e: MouseEvent | TouchEvent): void {
    if (e.target !== toggleButton && !dragState.isDragging) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();  // Prevent event from bubbling up

    // Clear the press timer
    window.clearTimeout(dragState.pressTimer);

    // If we were dragging, finish the drag
    if (dragState.isDragging) {
      dragState.isDragging = false;
      dragState.hasStartedDrag = false;
      toggleButton.classList.remove('dragging');
      
      const rect = toggleButton.getBoundingClientRect();
      // move into the window viewport if it's not already there
      if (rect.left < 0) {
        toggleButton.style.left = '0px';
      } else if (rect.right > window.innerWidth) {
        toggleButton.style.right = (window.innerWidth - rect.right) + 'px';
      }
      toggleButton.style.top = rect.top + 'px';
    } else if (!dragState.hasStartedDrag) {
      // Handle click/tap to toggle sidebar if we weren't dragging
      if (e instanceof MouseEvent && e.button === 0) {
        // Toggle sidebar on left click release if no drag occurred
        const sidebar = document.getElementById('page-reader-sidebar');
        if (sidebar) {
          if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          } else {
            sidebar.classList.add('open');
          }
        }
      } else if (!(e instanceof MouseEvent)) {
        // For touch events, check if it was a quick tap
        const pressEndTime = Date.now();
        const pressDuration = pressEndTime - (dragState.pressStartTime || 0);
        
        if (pressDuration < 200) {
          const sidebar = document.getElementById('page-reader-sidebar');
          if (sidebar) {
            if (sidebar.classList.contains('open')) {
              sidebar.classList.remove('open');
            } else {
              sidebar.classList.add('open');
            }
          }
        }
      }
    }

    dragState.pressTimer = undefined;
    dragState.pressStartTime = undefined;
  }

  function onDragMove(e: MouseEvent | TouchEvent): void {
    if (e.target !== toggleButton && !dragState.isDragging) {
      return;
    }
    
    // If we haven't started dragging yet, check if we should start
    if (!dragState.isDragging && dragState.pressStartTime) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = toggleButton.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(clientX - (rect.left + rect.width / 2), 2) +
        Math.pow(clientY - (rect.top + rect.height / 2), 2)
      );
      
      // Start dragging if moved more than 5px
      if (distance > 5) {
        startDragging(e);
      }
    }

    if (!dragState.isDragging) return;

    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Calculate new position with smooth movement
    const dx = clientX - dragState.initialPosition.x;
    const dy = clientY - dragState.initialPosition.y;
    
    // Apply easing to make movement smoother
    dragState.currentPosition.x += (dx - dragState.currentPosition.x) * 0.2;
    dragState.currentPosition.y += (dy - dragState.currentPosition.y) * 0.2;

    // Keep button within viewport
    const buttonRect = toggleButton.getBoundingClientRect();
    const maxX = window.innerWidth - buttonRect.width;
    const maxY = window.innerHeight - buttonRect.height;
    
    dragState.currentPosition.x = Math.min(Math.max(0, dragState.currentPosition.x), maxX);
    dragState.currentPosition.y = Math.min(Math.max(0, dragState.currentPosition.y), maxY);

    // Update position using top/left instead of transform
    toggleButton.style.left = dragState.currentPosition.x + 'px';
    toggleButton.style.top = dragState.currentPosition.y + 'px';
  }

  // Add touch support with passive: false to prevent scrolling
  toggleButton.addEventListener('touchstart', onDragStart, { passive: false });
  toggleButton.addEventListener('touchend', onDragEnd, { passive: false });
  toggleButton.addEventListener('touchmove', onDragMove, { passive: false });

  // Add mouse support
  toggleButton.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // Cancel drag and press on mouse/touch leave
  document.addEventListener('mouseleave', () => {
    window.clearTimeout(dragState.pressTimer);
    dragState.pressTimer = undefined;
    dragState.pressStartTime = undefined;
    if (dragState.isDragging) {
      dragState.isDragging = false;
      dragState.hasStartedDrag = false;
      toggleButton.classList.remove('dragging');
    }
  });

  // Prevent context menu on right click
  toggleButton.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

export function createSidebar(): void {
  // Check if elements already exist
  let sidebar = document.getElementById('page-reader-sidebar');
  let toggleButton = document.getElementById('page-reader-toggle') as HTMLButtonElement | null;
  
  // If sidebar already exists, don't create it again
  if (sidebar) {
    console.log('Sidebar already exists');
    return;
  }

  // Create sidebar
  sidebar = document.createElement('div');
  sidebar.id = 'page-reader-sidebar';
  
  sidebar.innerHTML = `
    <div class="sidebar-container">
      <div class="sidebar-header">
        <h2>Page Reader Assistant</h2>
        <div class="header-controls">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
            <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
            <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button class="ai-sidebar-close-button" aria-label="Close sidebar">×</button>
        </div>
      </div>
      <div class="context-controls">
        <div class="context-header">
          <div class="context-mode-wrapper">
            <div class="slider-container">
              <div class="slider-option" data-mode="page">Full Page</div>
              <div class="slider-option" data-mode="selection">Selection</div>
              <div class="slider-option" data-mode="screenshot">Screenshot</div>
              <div class="slider-option" data-mode="youtube">YouTube</div>
              <div class="slider-highlight"></div>
            </div>
          </div>
          <button id="screenshot-btn" class="hidden" aria-label="Take Screenshot">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
        <div id="context-area">
          <div id="content-preview"></div>
          <div id="drop-zone" class="hidden">
            <p>Take a screenshot or drag and drop an image here</p>
            <input type="file" id="file-input" accept="image/*" hidden>
          </div>
        </div>
      </div>
      <div id="answer"></div>
      <div class="input-section">
        <textarea id="question" placeholder="What would you like to know about this page?" rows="4"></textarea>
        <div class="bottom-controls">
          <button id="ask-button">Ask Question</button>
          <select id="model-selector" class="model-selector"></select>
        </div>
      </div>
      <div class="modal" id="ai-clear-confirm-modal">
        <div class="modal-content">
          <h3>Clear Chat History</h3>
          <p>Are you sure you want to clear the chat history for this page?</p>
          <div class="modal-actions">
            <button class="modal-button cancel-button">Cancel</button>
            <button class="modal-button confirm-button">Clear History</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(sidebar);

  // Setup toggle button if it exists
  if (toggleButton) {
    setupToggleButton(toggleButton);
  }

  // Configure marked first
  configureMarked();

  // Set up event listeners
  setupEventListeners();

  // Add custom-scrollbar class to elements
  const contentPreview = document.getElementById('content-preview');
  const answer = document.getElementById('answer');
  contentPreview?.classList.add('custom-scrollbar');
  answer?.classList.add('custom-scrollbar');
}

function setupEventListeners(): void {
  const sidebar = document.getElementById('page-reader-sidebar');
  const themeToggle = document.getElementById('theme-toggle');
  const closeButton = document.querySelector('#page-reader-sidebar .sidebar-header .ai-sidebar-close-button');
  const modal = document.getElementById('ai-clear-confirm-modal');
  const clearButton = document.querySelector('.ai-clear-chat-history');
  const askButton = document.getElementById('ask-button') as HTMLButtonElement;
  const questionInput = document.getElementById('question') as HTMLTextAreaElement;
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
  
  // Initialize shortcut handler
  if (questionInput) {
    new ShortcutHandler(questionInput);
  }

  // Initialize model selector
  if (modelSelector) {
    // Clear existing options
    modelSelector.innerHTML = '';
    
    // Add model options
    Object.entries(MODELS)
      .filter(([key]) => key !== 'VISION')
      .forEach(([key, value]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = MODEL_DISPLAY_NAMES[value as ModelType];
        modelSelector.appendChild(option);
      });
  }

  // Set initial theme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let currentTheme: Theme = (localStorage.getItem('theme') as Theme) || (prefersDark ? 'dark' : 'light');
  applyTheme(currentTheme);

  // Theme toggle
  themeToggle?.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
  });

  // System theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      currentTheme = e.matches ? 'dark' : 'light';
      applyTheme(currentTheme);
    }
  });

  // Close button
  closeButton?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
  });

  // Ask button
  askButton?.addEventListener('click', async () => {
    if (questionInput && questionInput.value.trim() && !isProcessing) {
      isProcessing = true;
      askButton.disabled = true;
      askButton.style.opacity = '0.7';
      askButton.style.cursor = 'not-allowed';
      
      try {
        const content = getPageContent();
        const question = questionInput.value.trim();
        const selectedModel = modelSelector?.value as ModelType;
        
        // Send question to API
        await handleQuestion(question, content, selectedModel);
        
        questionInput.value = '';
      } finally {
        isProcessing = false;
        askButton.disabled = false;
        askButton.style.opacity = '';
        askButton.style.cursor = '';
      }
    }
  });

  // Question input enter key
  questionInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
      e.preventDefault();
      askButton?.click();
    }
  });

  // Clear chat confirmation modal
  const confirmButton = modal?.querySelector('.confirm-button');
  const cancelButton = modal?.querySelector('.cancel-button');
  const answerContainer = document.getElementById('answer');

  clearButton?.addEventListener('click', () => {
    modal?.classList.add('show');
  });

  const closeModal = (): void => {
    modal?.classList.remove('show');
  };

  const handleClear = async (): Promise<void> => {
    await clearChatHistory();
    closeModal();
  };

  confirmButton?.addEventListener('click', handleClear);
  cancelButton?.addEventListener('click', closeModal);

  // Close modal on outside click
  modal?.addEventListener('click', (e: Event) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Load saved model selection
  chrome.storage.sync.get(['settings'], (result: { settings?: { selectedModel?: ModelType } }) => {
    if (modelSelector && result.settings?.selectedModel) {
      modelSelector.value = result.settings.selectedModel;
    }
  });

  // Save model selection on change
  modelSelector?.addEventListener('change', () => {
    if (modelSelector) {
      chrome.storage.sync.get(['settings'], (result: { settings?: { selectedModel?: ModelType } }) => {
        const settings = result.settings || {};
        settings.selectedModel = modelSelector.value as ModelType;
        chrome.storage.sync.set({ settings });
      });
    }
  });
} 