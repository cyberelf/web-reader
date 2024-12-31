/// <reference types="chrome"/>

import { configureMarked, renderMarkdown } from '../../utils/markdown';
import { applyTheme } from '../../utils/theme';
import { MODELS, MODEL_DISPLAY_NAMES } from '../../config';
import type { ModelType } from '../../config';
import type { Theme } from '../../utils/theme';
import { setupContextModes } from '../context/contextModes';
import { ShortcutHandler } from '../chat/shortcutHandler';

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

const DEFAULT_ICON_POSITION = {
  top: '20px',
  right: '20px'
};

function setupToggleButton(toggleButton: HTMLButtonElement): void {
  const dragState: DragState = {
    isDragging: false,
    hasStartedDrag: false,
    currentPosition: { x: 0, y: 0 },
    initialPosition: { x: 0, y: 0 }
  };

  // Reset to default position on every page load
  toggleButton.style.top = DEFAULT_ICON_POSITION.top;
  toggleButton.style.right = DEFAULT_ICON_POSITION.right;
  toggleButton.style.left = 'auto';
  
  // Always show the button initially
  toggleButton.style.display = 'block';
  
  // Check visibility setting
  chrome.storage.sync.get(['showIcon'], (result: StorageResult) => {
    if (result.showIcon === false) {
      toggleButton.style.display = 'none';
    }
  });

  function onDragStart(e: MouseEvent | TouchEvent): void {
    if (e instanceof MouseEvent) {
      // Left click should open sidebar
      if (e.button === 0) {
        e.preventDefault();
        const sidebar = document.getElementById('page-reader-sidebar');
        if (sidebar) {
          if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          } else {
            sidebar.classList.add('open');
          }
        }
        return;
      }
      // Only start drag on right click
      if (e.button !== 2) {
        return;
      }
    }

    e.preventDefault();
    dragState.pressStartTime = Date.now();
    
    // Start press timer for touch events only
    if ('touches' in e) {
      dragState.pressTimer = window.setTimeout(() => {
        startDragging(e);
      }, 200);
    } else {
      // For right click, start dragging immediately
      startDragging(e);
    }
  }

  function startDragging(e: MouseEvent | TouchEvent): void {
    if (e.target === toggleButton) {
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
  }

  function onDragEnd(): void {
    window.clearTimeout(dragState.pressTimer);
    
    if (dragState.isDragging) {
      dragState.isDragging = false;
      dragState.hasStartedDrag = false;
      toggleButton.classList.remove('dragging');
      
      const rect = toggleButton.getBoundingClientRect();
      toggleButton.style.left = 'auto';
      toggleButton.style.right = (window.innerWidth - rect.right) + 'px';
      toggleButton.style.top = rect.top + 'px';
    }
  }

  function onDragMove(e: MouseEvent | TouchEvent): void {
    if (!dragState.isDragging) return;

    e.preventDefault();
    
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

  // Add touch support
  toggleButton.addEventListener('touchstart', onDragStart, { passive: false });
  toggleButton.addEventListener('touchend', onDragEnd);
  toggleButton.addEventListener('touchmove', onDragMove, { passive: false });

  // Add mouse support
  toggleButton.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // Cancel drag on mouse leave
  document.addEventListener('mouseleave', () => {
    window.clearTimeout(dragState.pressTimer);
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
  const sidebar = document.createElement('div');
  sidebar.id = 'page-reader-sidebar';
  
  const modelSelectorHtml = Object.entries(MODELS)
    .filter(([key]) => key !== 'VISION')
    .map(([, value]) => `
      <option value="${value}">${MODEL_DISPLAY_NAMES[value as ModelType]}</option>
    `)
    .join('');
  
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
      <div id="answer">
        <button class="clear-chat">Clear Chat History</button>
      </div>
      <div class="input-section">
        <textarea id="question" placeholder="What would you like to know about this page?" rows="4"></textarea>
        <div class="bottom-controls">
          <button id="ask-button">Ask Question</button>
          <select id="model-selector" class="model-selector">
            ${modelSelectorHtml}
          </select>
        </div>
      </div>
      <div class="modal" id="clear-confirm-modal">
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

  const toggleButton = document.createElement('button');
  toggleButton.id = 'page-reader-toggle';
  toggleButton.textContent = 'Ask AI';

  document.body.appendChild(sidebar);
  document.body.appendChild(toggleButton);

  // Configure marked first
  configureMarked();

  // Set up event listeners
  setupEventListeners();

  // Add custom-scrollbar class to elements
  const contentPreview = document.getElementById('content-preview');
  const answer = document.getElementById('answer');
  contentPreview?.classList.add('custom-scrollbar');
  answer?.classList.add('custom-scrollbar');

  // Set up toggle button last
  setupToggleButton(toggleButton);
}

function setupEventListeners(): void {
  const sidebar = document.getElementById('page-reader-sidebar');
  const themeToggle = document.getElementById('theme-toggle');
  const closeButton = document.querySelector('#page-reader-sidebar .sidebar-header .ai-sidebar-close-button');
  const modal = document.getElementById('clear-confirm-modal');
  const clearButton = document.querySelector('.clear-chat');
  const askButton = document.getElementById('ask-button');
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
  askButton?.addEventListener('click', () => {
    if (questionInput && questionInput.value.trim()) {
      // TODO: Implement question handling
      console.log('Question:', questionInput.value);
      questionInput.value = '';
    }
  });

  // Question input enter key
  questionInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askButton?.click();
    }
  });

  // Clear chat confirmation modal
  const confirmButton = modal?.querySelector('.confirm-button');
  const cancelButton = modal?.querySelector('.cancel-button');

  clearButton?.addEventListener('click', () => {
    modal?.classList.add('show');
  });

  const closeModal = (): void => {
    modal?.classList.remove('show');
  };

  const handleClear = async (): Promise<void> => {
    // TODO: Implement these functions
    // await clearChatHistory();
    // loadChatHistory();
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
} 