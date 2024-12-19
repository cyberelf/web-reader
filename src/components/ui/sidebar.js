import { configureMarked } from '../../utils/markdown.js';
import { setupContextModes, getPageContent } from '../context/contextModes.js';
import { setupSelectionHandler, updateContentPreview } from '../context/selection.js';
import { loadChatHistory } from '../chat/chatHistory.js';
import { handleQuestion } from '../chat/messageHandler.js';
import { setupShortcutAutocomplete } from './autocomplete.js';
import { applyTheme } from './theme.js';
import { MODELS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL, DEFAULT_ICON_POSITION } from '../../config.js';

function setupToggleButton(toggleButton) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let pressTimer;
    let hasStartedDrag = false;
    let pressStartTime;

    // Reset to default position on every page load
    toggleButton.style.top = DEFAULT_ICON_POSITION.top;
    toggleButton.style.right = DEFAULT_ICON_POSITION.right;
    toggleButton.style.left = 'auto';
    currentX = window.innerWidth - toggleButton.offsetWidth - 20;
    currentY = 20;

    // Check visibility setting only
    chrome.storage.sync.get(['showIcon'], (result) => {
        toggleButton.style.display = result.showIcon === false ? 'none' : 'block';
    });

    function onDragStart(e) {
        pressStartTime = Date.now();
        // Start press timer
        pressTimer = setTimeout(() => {
            if (e.target === toggleButton) {
                isDragging = true;
                hasStartedDrag = true;
                toggleButton.classList.add('dragging');
                
                const rect = toggleButton.getBoundingClientRect();
                currentX = rect.left;
                currentY = rect.top;
                initialX = e.clientX - currentX;
                initialY = e.clientY - currentY;

                toggleButton.style.right = 'auto';
                toggleButton.style.left = currentX + 'px';
                toggleButton.style.top = currentY + 'px';
            }
        }, 200);

        e.preventDefault();
    }

    function onDragEnd(e) {
        clearTimeout(pressTimer);
        const pressDuration = Date.now() - pressStartTime;
        
        if (!isDragging && pressDuration < 200) {
            // Handle as click if press was short and no drag occurred
            const sidebar = document.getElementById('page-reader-sidebar');
            if (sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            } else {
                sidebar.classList.add('open');
                loadChatHistory();
                updateContentPreview();
            }
        } else if (isDragging) {
            isDragging = false;
            hasStartedDrag = false;
            toggleButton.classList.remove('dragging');
            
            const rect = toggleButton.getBoundingClientRect();
            toggleButton.style.left = 'auto';
            toggleButton.style.right = (window.innerWidth - rect.right) + 'px';
            toggleButton.style.top = rect.top + 'px';
        }
    }

    function onDragMove(e) {
        if (!isDragging) return;

        e.preventDefault();
        
        // Calculate new position with smooth movement
        const dx = e.clientX - initialX;
        const dy = e.clientY - initialY;
        
        // Apply easing to make movement smoother
        currentX += (dx - currentX) * 0.2;
        currentY += (dy - currentY) * 0.2;

        // Keep button within viewport
        const buttonRect = toggleButton.getBoundingClientRect();
        const maxX = window.innerWidth - buttonRect.width;
        const maxY = window.innerHeight - buttonRect.height;
        
        currentX = Math.min(Math.max(0, currentX), maxX);
        currentY = Math.min(Math.max(0, currentY), maxY);

        // Update position using top/left instead of transform
        toggleButton.style.left = currentX + 'px';
        toggleButton.style.top = currentY + 'px';
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
        clearTimeout(pressTimer);
        if (isDragging) {
            isDragging = false;
            hasStartedDrag = false;
            toggleButton.classList.remove('dragging');
        }
    });
}

function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'page-reader-sidebar';
    const modelSelectorHtml = Object.entries(MODELS)
        .filter(([key]) => key !== 'VISION')
        .map(([_, value]) => `
            <option value="${value}">${MODEL_DISPLAY_NAMES[value]}</option>
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

    setupToggleButton(toggleButton);

    configureMarked();
    setupEventListeners();
    loadChatHistory();

    // Add custom-scrollbar class to elements
    const contentPreview = document.getElementById('content-preview');
    const answer = document.getElementById('answer');
    contentPreview.classList.add('custom-scrollbar');
    answer.classList.add('custom-scrollbar');
}

function setupEventListeners() {
    const sidebar = document.getElementById('page-reader-sidebar');
    const toggleButton = document.getElementById('page-reader-toggle');
    const closeButton = document.querySelector('#page-reader-sidebar .sidebar-header .ai-sidebar-close-button');
    const askButton = document.getElementById('ask-button');
    const clearButton = document.querySelector('.clear-chat');
    const modelSelector = document.getElementById('model-selector');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Set initial theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let currentTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    applyTheme(currentTheme);

    // Theme toggle
    themeToggle.addEventListener('click', () => {
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

    // Close sidebar when clicking close button
    closeButton.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            toggleButton.style.display = 'block'; // Show toggle button when sidebar closes
        }
    });

    // Listen for sidebar open/close to manage toggle button visibility
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (sidebar.classList.contains('open')) {
                    toggleButton.style.display = 'none';
                } else {
                    toggleButton.style.display = 'block';
                }
            }
        });
    });

    observer.observe(sidebar, { attributes: true });

    // Ask question
    askButton.addEventListener('click', handleQuestion);

    // Clear chat history
    clearButton.addEventListener('click', () => {
        const modal = document.getElementById('clear-confirm-modal');
        modal.classList.add('show');

        const cancelButton = modal.querySelector('.cancel-button');
        const confirmButton = modal.querySelector('.confirm-button');

        const closeModal = () => {
            modal.classList.remove('show');
            cancelButton.removeEventListener('click', closeModal);
            confirmButton.removeEventListener('click', handleClear);
        };

        const handleClear = async () => {
            const currentUrl = window.location.href;
            const urlHash = btoa(currentUrl).replace(/[/+=]/g, '_');
            const key = `chat_history_${urlHash}`;
            
            await chrome.storage.local.remove(key);
            loadChatHistory();
            closeModal();
        };

        cancelButton.addEventListener('click', closeModal);
        confirmButton.addEventListener('click', handleClear);
    });

    // Listen for model changes from settings
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.selectedModel) {
            const newModel = changes.selectedModel.newValue;
            const modelSelector = document.getElementById('model-selector');
            if (modelSelector && modelSelector.value !== newModel) {
                modelSelector.value = newModel;
                console.log('Model updated from settings:', newModel);
            }
        }
    });

    // Model selection
    modelSelector.addEventListener('change', async (e) => {
        const newModel = e.target.value;
        await chrome.storage.sync.set({ selectedModel: newModel });
        console.log('Model changed to:', newModel);
    });

    // Set initial model from storage
    chrome.storage.sync.get(['selectedModel'], (result) => {
        if (result.selectedModel) {
            modelSelector.value = result.selectedModel;
            console.log('Initial model set to:', result.selectedModel);
        }
    });

    // Question input handlers
    const questionInput = document.getElementById('question');
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (questionInput.value.trim()) {
                handleQuestion();
            }
        }
    });

    // Add placeholder hint
    questionInput.placeholder = "What would you like to know about this page?\nPress Enter to send, Shift+Enter for new line";

    // Setup other handlers
    setupContextModes();
    setupSelectionHandler();
    setupShortcutAutocomplete();

    // Extension context check
    const checkExtensionContext = setInterval(() => {
        if (!chrome.runtime?.id) {
            console.log('Extension context invalidated, reloading page...');
            clearInterval(checkExtensionContext);
            window.location.reload();
        }
    }, 1000);

    // Clean up on page unload - using beforeunload instead of unload
    window.addEventListener('beforeunload', () => {
        clearInterval(checkExtensionContext);
    });
}

export { createSidebar }; 