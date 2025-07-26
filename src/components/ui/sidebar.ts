/// <reference types="chrome"/>

import { configureMarked } from "../../utils/markdown";
import { applyTheme } from "../../utils/theme";
import {
  MODELS,
  MODEL_DISPLAY_NAMES,
  ModelDisplayType,
  ModelType,
} from "../../config";
import type { Theme } from "../../utils/theme";
import { setupContextModes, getPageContent } from "../context/contextModes";
import { ShortcutHandler } from "../chat/shortcutHandler";
import { handleQuestion } from "../chat/messageHandler";
import { clearChatHistory } from "../chat/chatHistory";
import { modelManager } from "../../utils/modelManager";
import { initializeLanguage, t } from "../../utils/i18n";
import { getTokenEstimate, getTokenStatus } from "../../utils/tokenCounter";
import {
  simpleTokenEstimate,
  getSimpleTokenStatus,
  simpleTokenEstimation,
} from "../../utils/simpleTokenCounter";
import { getSettings, updateSettings } from "../../settings";
import { getChatHistoryMessages } from "../chat/chatHistory";

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
  top: "20px",
  right: "20px",
};

// Add isProcessing state
let isProcessing = false;

const dragState: DragState = {
  isDragging: false,
  hasStartedDrag: false,
  currentPosition: { x: 0, y: 0 },
  initialPosition: { x: 0, y: 0 },
};

export function setupToggleButton(toggleButton: HTMLButtonElement): void {
  // Reset to default position on every page load
  toggleButton.style.top = DEFAULT_ICON_POSITION.top;
  toggleButton.style.right = DEFAULT_ICON_POSITION.right;
  toggleButton.style.left = "auto";

  // Initialize drag event listeners
  function onDragStart(e: MouseEvent | TouchEvent): void {
    if (e instanceof MouseEvent) {
      // Only handle left click
      if (e.button !== 0 || e.target !== toggleButton) {
        return;
      }
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling up

      // Start tracking potential drag
      dragState.pressStartTime = Date.now();
      dragState.currentPosition = {
        x: toggleButton.getBoundingClientRect().left,
        y: toggleButton.getBoundingClientRect().top,
      };
    } else {
      // For touch events, start a timer for potential drag
      if (e.target !== toggleButton) {
        return;
      }
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling up

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
    toggleButton.classList.add("ai-dragging");

    const rect = toggleButton.getBoundingClientRect();
    dragState.currentPosition = {
      x: rect.left,
      y: rect.top,
    };

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    dragState.initialPosition = {
      x: clientX - dragState.currentPosition.x,
      y: clientY - dragState.currentPosition.y,
    };

    toggleButton.style.right = "auto";
    toggleButton.style.left = dragState.currentPosition.x + "px";
    toggleButton.style.top = dragState.currentPosition.y + "px";
  }

  function onDragEnd(e: MouseEvent | TouchEvent): void {
    if (e.target !== toggleButton && !dragState.isDragging) {
      return;
    }

    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up

    // Clear the press timer
    window.clearTimeout(dragState.pressTimer);

    // If we were dragging, finish the drag
    if (dragState.isDragging) {
      dragState.isDragging = false;
      dragState.hasStartedDrag = false;
      toggleButton.classList.remove("ai-dragging");

      const rect = toggleButton.getBoundingClientRect();
      // move into the window viewport if it's not already there
      if (rect.left < 0) {
        toggleButton.style.left = "0px";
      } else if (rect.right > window.innerWidth) {
        toggleButton.style.right = window.innerWidth - rect.right + "px";
      }
      toggleButton.style.top = rect.top + "px";
    } else if (!dragState.hasStartedDrag) {
      // Handle click/tap to toggle sidebar if we weren't dragging
      if (e instanceof MouseEvent && e.button === 0) {
        // Toggle sidebar on left click release if no drag occurred
        const sidebar = document.getElementById("ai-page-reader-sidebar");
        if (sidebar) {
          if (sidebar.classList.contains("ai-open")) {
            sidebar.classList.remove("ai-open");
          } else {
            sidebar.classList.add("ai-open");
          }
        }
      } else if (!(e instanceof MouseEvent)) {
        // For touch events, check if it was a quick tap
        const pressEndTime = Date.now();
        const pressDuration = pressEndTime - (dragState.pressStartTime || 0);

        if (pressDuration < 200) {
          const sidebar = document.getElementById("ai-page-reader-sidebar");
          if (sidebar) {
            if (sidebar.classList.contains("ai-open")) {
              sidebar.classList.remove("ai-open");
            } else {
              sidebar.classList.add("ai-open");
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
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = toggleButton.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(clientX - (rect.left + rect.width / 2), 2) +
          Math.pow(clientY - (rect.top + rect.height / 2), 2),
      );

      // Start dragging if moved more than 5px
      if (distance > 5) {
        startDragging(e);
      }
    }

    if (!dragState.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

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

    dragState.currentPosition.x = Math.min(
      Math.max(0, dragState.currentPosition.x),
      maxX,
    );
    dragState.currentPosition.y = Math.min(
      Math.max(0, dragState.currentPosition.y),
      maxY,
    );

    // Update position using top/left instead of transform
    toggleButton.style.left = dragState.currentPosition.x + "px";
    toggleButton.style.top = dragState.currentPosition.y + "px";
  }

  // Add touch support with passive: false to prevent scrolling
  toggleButton.addEventListener("touchstart", onDragStart, { passive: false });
  toggleButton.addEventListener("touchend", onDragEnd, { passive: false });
  toggleButton.addEventListener("touchmove", onDragMove, { passive: false });

  // Add mouse support
  toggleButton.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);

  // Cancel drag and press on mouse/touch leave
  document.addEventListener("mouseleave", () => {
    window.clearTimeout(dragState.pressTimer);
    dragState.pressTimer = undefined;
    dragState.pressStartTime = undefined;
    if (dragState.isDragging) {
      dragState.isDragging = false;
      dragState.hasStartedDrag = false;
      toggleButton.classList.remove("ai-dragging");
    }
  });

  // Prevent context menu on right click
  toggleButton.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

export async function createSidebar(): Promise<void> {
  // Initialize language first
  await initializeLanguage();

  // Check if elements already exist
  let sidebar = document.getElementById("ai-page-reader-sidebar");
  let toggleButton = document.getElementById(
    "ai-page-reader-toggle",
  ) as HTMLButtonElement | null;

  // If sidebar already exists, don't create it again
  if (sidebar) {
    console.log("Sidebar already exists");
    return;
  }

  // Create sidebar
  sidebar = document.createElement("div");
  sidebar.id = "ai-page-reader-sidebar";

  // Create sidebar with translations
  function createSidebarHTML(): string {
    return `
      <div class="ai-sidebar-container">
        <div class="ai-sidebar-header">
          <h2>${t("sidebar.title")}</h2>
          <div class="ai-header-controls">
            <button id="ai-theme-toggle" class="ai-theme-toggle" aria-label="Toggle theme">
              <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
              </svg>
              <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>
            <button class="ai-sidebar-close-button" aria-label="${t("common.close")}">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="ai-context-controls">
          <div class="ai-context-header">
            <div class="ai-context-mode-wrapper">
              <div class="ai-slider-container">
                <div class="ai-slider-option" data-mode="page">${t("sidebar.modes.page")}</div>
                <div class="ai-slider-option" data-mode="selection">${t("sidebar.modes.selection")}</div>
                <div class="ai-slider-option" data-mode="element">${t("sidebar.modes.element")}</div>
                <div class="ai-slider-option" data-mode="screenshot">${t("sidebar.modes.screenshot")}</div>
                <div class="ai-slider-option" data-mode="video">${t("sidebar.modes.video")}</div>
                <div class="ai-slider-highlight"></div>
              </div>
            </div>
            <button id="ai-screenshot-btn" class="hidden" aria-label="Take Screenshot">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>
          <div id="ai-context-area">
            <div id="ai-content-preview"></div>
            <div id="ai-drop-zone" class="hidden">
              <p>${t("sidebar.preview.dropImage")}</p>
              <input type="file" id="ai-file-input" accept="image/*" hidden>
            </div>
          </div>
        </div>
        <div class="ai-chat-controls">
          <div class="ai-chat-history-toggle">
            <label for="ai-include-history" class="ai-toggle-label">
              <span>${t("sidebar.includeChatHistory")}</span>
              <label class="ai-toggle-switch">
                <input type="checkbox" id="ai-include-history" checked>
                <span class="ai-toggle-slider"></span>
              </label>
            </label>
          </div>
        </div>
        <div id="ai-answer"></div>
        <div class="ai-input-section">
          <textarea id="ai-question" placeholder="${t("sidebar.askPlaceholder")}" rows="4"></textarea>
          <div class="ai-token-indicator" id="ai-token-indicator">
            <span class="ai-token-count" id="ai-token-count">0 tokens</span>
            <span class="ai-token-status" id="ai-token-status"></span>
          </div>
          <div class="ai-bottom-controls">
            <button id="ai-ask-button">${t("sidebar.askButton")}</button>
            <select id="ai-model-selector" class="ai-model-selector"></select>
          </div>
        </div>
        <div class="ai-modal" id="ai-clear-confirm-modal">
          <div class="ai-modal-content">
            <h3>${t("sidebar.clearHistory")}</h3>
            <p>${t("sidebar.clearHistoryMessage")}</p>
            <div class="ai-modal-actions">
              <button class="ai-modal-button ai-cancel-button">${t("common.cancel")}</button>
              <button class="ai-modal-button ai-confirm-button">${t("sidebar.clearHistoryConfirm")}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  sidebar.innerHTML = createSidebarHTML();
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
  const contentPreview = document.getElementById("ai-content-preview");
  const answer = document.getElementById("ai-answer");
  contentPreview?.classList.add("ai-custom-scrollbar");
  answer?.classList.add("ai-custom-scrollbar");
}

function setupEventListeners(): void {
  const sidebar = document.getElementById("ai-page-reader-sidebar");
  const themeToggle = document.getElementById("ai-theme-toggle");
  const closeButton = document.querySelector(
    "#ai-page-reader-sidebar .ai-sidebar-header .ai-sidebar-close-button",
  );
  const modal = document.getElementById("ai-clear-confirm-modal");
  const clearButton = document.querySelector(".ai-clear-chat-history");
  const askButton = document.getElementById(
    "ai-ask-button",
  ) as HTMLButtonElement;
  const questionInput = document.getElementById(
    "ai-question",
  ) as HTMLTextAreaElement;
  const modelSelector = document.getElementById(
    "ai-model-selector",
  ) as HTMLSelectElement;

  // Initialize shortcut handler
  if (questionInput) {
    new ShortcutHandler(questionInput);
  }

  // Initialize model selector
  if (modelSelector) {
    initializeModelSelector(modelSelector);
  }

  // Token counting function
  async function updateTokenIndicator(): Promise<void> {
    const question = questionInput?.value.trim() || "";
    const selectedModel = (modelSelector?.value as ModelType) || "gpt-4o-mini";
    const tokenCount = document.getElementById("ai-token-count");
    const tokenStatus = document.getElementById("ai-token-status");
    const tokenIndicator = document.getElementById("ai-token-indicator");

    if (!tokenCount || !tokenStatus || !tokenIndicator) return;

    // if (!question) {
    //   tokenCount.textContent = '0 tokens';
    //   tokenStatus.textContent = '';
    //   tokenIndicator.className = 'ai-token-indicator';
    //   return;
    // }

    // Show loading state
    tokenCount.textContent = "Counting...";
    tokenStatus.textContent = "";
    tokenIndicator.className = "ai-token-indicator";

    try {
      const content = getPageContent();

      // Check if chat history should be included
      const chatHistoryToggle = document.getElementById(
        "ai-include-history",
      ) as HTMLInputElement;
      const includeChatHistory = chatHistoryToggle?.checked ?? true;

      // Get chat history if needed
      let historyTokens = 0;
      if (includeChatHistory) {
        const historyMessages = getChatHistoryMessages();
        historyTokens = historyMessages.reduce((sum, msg) => {
          return sum + simpleTokenEstimation(msg.content, selectedModel);
        }, 0);
      }

      // Use simple token estimation (no tiktoken dependency)
      const estimate = simpleTokenEstimate(question, content, selectedModel);

      // Add history tokens to the estimate
      if (historyTokens > 0) {
        estimate.tokens += historyTokens;
        estimate.totalTokens += historyTokens;
      }

      const { text, status } = getSimpleTokenStatus(estimate);

      tokenCount.textContent = text;
      tokenStatus.textContent = estimate.warning || "Token count estimated";
      tokenIndicator.className = `ai-token-indicator ai-token-${status}`;
    } catch (error) {
      console.warn("All token counting methods failed:", error);
      tokenCount.textContent = "Token count unavailable";
      tokenStatus.textContent = "Error loading token counter";
      tokenIndicator.className = "ai-token-indicator";
    }
  }

  // Set initial theme
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let currentTheme: Theme =
    (localStorage.getItem("theme") as Theme) ||
    (prefersDark ? "dark" : "light");
  applyTheme(currentTheme);

  // Theme toggle
  themeToggle?.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    localStorage.setItem("theme", currentTheme);
    applyTheme(currentTheme);
  });

  // System theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        currentTheme = e.matches ? "dark" : "light";
        applyTheme(currentTheme);
      }
    });

  // Close button
  closeButton?.addEventListener("click", () => {
    sidebar?.classList.remove("ai-open");
  });

  // Ask button
  askButton?.addEventListener("click", async () => {
    if (questionInput && questionInput.value.trim() && !isProcessing) {
      isProcessing = true;
      askButton.disabled = true;
      askButton.style.opacity = "0.7";
      askButton.style.cursor = "not-allowed";

      try {
        const content = getPageContent();
        const question = questionInput.value.trim();
        const selectedModel = modelSelector?.value as ModelType;

        // Send question to API
        await handleQuestion(question, content, selectedModel);

        questionInput.value = "";
      } finally {
        isProcessing = false;
        askButton.disabled = false;
        askButton.style.opacity = "";
        askButton.style.cursor = "";
      }
    }
  });

  // Question input enter key
  questionInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
      e.preventDefault();
      askButton?.click();
    }
  });

  // Update token count when question changes
  questionInput?.addEventListener("input", debouncedTokenUpdate);

  // Update token count when model changes
  modelSelector?.addEventListener("change", debouncedTokenUpdate);

  // Update token count when chat history toggle changes
  const chatHistoryToggle = document.getElementById(
    "ai-include-history",
  ) as HTMLInputElement;
  chatHistoryToggle?.addEventListener("change", async () => {
    // Save the setting
    const settings = await getSettings();
    await updateSettings({ includeChatHistory: chatHistoryToggle.checked });
    // Update token count
    debouncedTokenUpdate();
  });

  // Debounce function to prevent too many rapid token updates
  let tokenUpdateTimeout: number | undefined;
  function debouncedTokenUpdate() {
    if (tokenUpdateTimeout) {
      clearTimeout(tokenUpdateTimeout);
    }
    tokenUpdateTimeout = window.setTimeout(() => {
      updateTokenIndicator();
    }, 100); // 100ms debounce
  }

  // Update token count when context changes
  document.addEventListener("contextUpdate", debouncedTokenUpdate);

  // Update token count when chat history changes (new messages added)
  document.addEventListener("chatHistoryUpdate", debouncedTokenUpdate);

  // Initial token count update
  setTimeout(() => {
    debouncedTokenUpdate();
  }, 200);

  // Clear chat confirmation modal
  const confirmButton = modal?.querySelector(".ai-confirm-button");
  const cancelButton = modal?.querySelector(".ai-cancel-button");
  const answerContainer = document.getElementById("ai-answer");

  clearButton?.addEventListener("click", () => {
    modal?.classList.add("show");
  });

  const closeModal = (): void => {
    modal?.classList.remove("show");
  };

  const handleClear = async (): Promise<void> => {
    await clearChatHistory();
    closeModal();
  };

  confirmButton?.addEventListener("click", handleClear);
  cancelButton?.addEventListener("click", closeModal);

  // Close modal on outside click
  modal?.addEventListener("click", (e: Event) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Load saved model selection and save model selection on change
  const selectedModel = modelManager.getSelectedModel();
  if (modelSelector && selectedModel) {
    // The model selector will be updated by updateModelSelector function
  }

  // Save model selection on change
  modelSelector?.addEventListener("change", async () => {
    if (modelSelector && modelSelector.value) {
      try {
        await modelManager.setSelectedModel(modelSelector.value);
      } catch (error) {
        console.error("Failed to save model selection:", error);
      }
    }
  });

  // Load saved chat history setting
  if (chatHistoryToggle) {
    getSettings()
      .then((settings) => {
        chatHistoryToggle.checked = settings.includeChatHistory;
      })
      .catch((error) => {
        console.error("Failed to load chat history setting:", error);
      });
  }
}

async function initializeModelSelector(
  modelSelector: HTMLSelectElement,
): Promise<void> {
  try {
    // Initialize model manager
    await modelManager.initialize();

    // Update the model selector
    updateModelSelector(modelSelector);

    // Listen for storage changes to sync models
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync" && changes.modelManagerData) {
        updateModelSelector(modelSelector);
      }
    });
  } catch (error) {
    console.error("Failed to initialize model selector:", error);

    // Fallback to default models
    Object.entries(MODELS)
      .filter(([key]) => key !== "VISION")
      .forEach(([key, value]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent =
          MODEL_DISPLAY_NAMES[value as ModelDisplayType] || value;
        modelSelector.appendChild(option);
      });
  }
}

function updateModelSelector(modelSelector: HTMLSelectElement): void {
  // Clear existing options
  modelSelector.innerHTML = "";

  // Get all available models
  const allModels = modelManager.getAllModels();
  const selectedModel = modelManager.getSelectedModel();

  if (allModels.length === 0) {
    // Fallback to default models if none are available
    Object.entries(MODELS)
      .filter(([key]) => key !== "VISION")
      .forEach(([key, value]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent =
          MODEL_DISPLAY_NAMES[value as ModelDisplayType] || value;
        modelSelector.appendChild(option);
      });
  } else {
    // Group models by provider
    const modelsByProvider: Record<string, typeof allModels> = {};
    allModels.forEach((model) => {
      if (!modelsByProvider[model.provider]) {
        modelsByProvider[model.provider] = [];
      }
      modelsByProvider[model.provider].push(model);
    });

    // Add models grouped by provider
    Object.entries(modelsByProvider).forEach(([providerId, models]) => {
      const provider = modelManager.getProvider(providerId);
      if (provider && models.length > 0) {
        // Only show providers that are configured or have models
        const hasConfiguredModels =
          provider.isConfigured || models.some((m) => m.isManual);

        if (hasConfiguredModels) {
          const optgroup = document.createElement("optgroup");
          optgroup.label = provider.name;

          models.forEach((model) => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = `${model.name}${model.isVision ? " (Vision)" : ""}`;
            if (model.id === selectedModel) {
              option.selected = true;
            }
            optgroup.appendChild(option);
          });

          modelSelector.appendChild(optgroup);
        }
      }
    });
  }

  // If no model is selected or the selected model is not available, select the first available one
  if (
    (!selectedModel ||
      !Array.from(modelSelector.options).some(
        (opt) => opt.value === selectedModel,
      )) &&
    modelSelector.options.length > 0
  ) {
    const firstOption = modelSelector.options[0];
    if (firstOption.value) {
      modelManager.setSelectedModel(firstOption.value);
      firstOption.selected = true;
    }
  }
}
