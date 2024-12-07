let markedReady = false;

// Add these functions near the top of sidebar.js
let PROMPT_SHORTCUTS = {
  '/summarize': 'Please provide a concise summary of this content, highlighting the main points and key takeaways.',
  '/explain': 'Please explain this content in simple terms, breaking down any complex concepts and providing clear explanations.',
  '/generate': 'Please analyze the style and tone of this content, then generate a new piece of text that matches this style but covers a similar topic.',
};

// Add storage change listener at the top level of sidebar.js
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.customPrompts) {
    // Update the PROMPT_SHORTCUTS with new custom prompts
    const customPrompts = changes.customPrompts.newValue || {};
    PROMPT_SHORTCUTS = {
      '/summarize': 'Please provide a concise summary of this content, highlighting the main points and key takeaways.',
      '/explain': 'Please explain this content in simple terms, breaking down any complex concepts and providing clear explanations.',
      '/generate': 'Please analyze the style and tone of this content, then generate a new piece of text that matches this style but covers a similar topic.',
      ...customPrompts
    };
  }
});

async function loadCustomPrompts() {
  const { customPrompts = {} } = await chrome.storage.sync.get(['customPrompts']);
  PROMPT_SHORTCUTS = {
    '/summarize': 'Please provide a concise summary of this content, highlighting the main points and key takeaways.',
    '/explain': 'Please explain this content in simple terms, breaking down any complex concepts and providing clear explanations.',
    '/generate': 'Please analyze the style and tone of this content, then generate a new piece of text that matches this style but covers a similar topic.',
    ...customPrompts
  };
  return PROMPT_SHORTCUTS;
}

function handleShortcut(input) {
  const command = Object.keys(PROMPT_SHORTCUTS).find(cmd => 
    input.trim().toLowerCase().startsWith(cmd.toLowerCase())
  );
  if (command) {
    const customText = input.slice(command.length).trim();
    const basePrompt = PROMPT_SHORTCUTS[command];
    return customText ? `${basePrompt}\nAdditional context: ${customText}` : basePrompt;
  }
  return null;
}

// Create and inject the sidebar HTML
function createSidebar() {
  const sidebar = document.createElement('div');
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
              <div class="slider-highlight"></div>
            </div>
          </div>
          <button id="screenshot-btn" class="hidden">Take Screenshot</button>
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
            <option value="gpt-4o-mini">GPT-4o-mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-o1-mini">GPT-o1 mini</option>
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

  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
  });
  
  setupEventListeners();
  loadChatHistory();

  // Add custom-scrollbar class to elements
  const contentPreview = document.getElementById('content-preview');
  const answer = document.getElementById('answer');
  contentPreview.classList.add('custom-scrollbar');
  answer.classList.add('custom-scrollbar');
}

// Function to save chat history
async function saveChatHistory(currentUrl, history) {
  const urlHash = btoa(currentUrl).replace(/[/+=]/g, '_');
  try {
    await chrome.storage.local.set({
      [`chat_history_${urlHash}`]: history
    });
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

// Function to load chat history
async function loadChatHistory() {
  try {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated, reloading page...');
      window.location.reload();
      return;
    }

    const currentUrl = window.location.href;
    const urlHash = btoa(currentUrl).replace(/[/+=]/g, '_');
    const key = `chat_history_${urlHash}`;
    
    const answerDiv = document.getElementById('answer');
    if (!answerDiv) return;
    
    // Clear existing messages except the clear button
    const clearButton = answerDiv.querySelector('.clear-chat');
    answerDiv.innerHTML = '';
    if (clearButton) {
      answerDiv.appendChild(clearButton);
    }

    try {
      // Load chat history from storage with timeout
      const result = await Promise.race([
        chrome.storage.local.get([key]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout')), 5000)
        )
      ]);
      
      const chatHistory = result[key] || [];
      
      // Add each message to the chat
      chatHistory.forEach(message => {
        if (message) {
          const role = message.r || message.role;
          const content = message.c || message.content;
          const timestamp = message.t || message.timestamp;
          
          if (role && content) {
            addMessageToChat(role, content, timestamp);
          }
        }
      });

      // Scroll to bottom
      answerDiv.scrollTop = answerDiv.scrollHeight;
    } catch (storageError) {
      console.error('Storage error:', storageError);
      // If storage fails, try to recover by clearing history
      await chrome.storage.local.remove(key);
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
    // If extension context is invalid, the page will reload
  }
}

// Add a new message to the chat
function addMessageToChat(role, content, timestamp = Date.now()) {
  const answerDiv = document.getElementById('answer');
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-chat-message ai-${role}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'ai-message-content';
  const sanitizedContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  messageContent.innerHTML = parseMarkdown(sanitizedContent);
  
  // Add message content first
  messageDiv.appendChild(messageContent);

  // Create footer div for time and model info
  const messageFooter = document.createElement('div');
  messageFooter.className = 'ai-message-footer';
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'ai-message-time';
  timeDiv.textContent = new Date(timestamp).toLocaleTimeString();
  messageFooter.appendChild(timeDiv);
  
  if (role === 'assistant') {
    const modelInfo = document.createElement('div');
    modelInfo.className = 'ai-model-info';
    const currentModel = document.getElementById('model-selector').value;
    modelInfo.textContent = currentModel;
    messageFooter.appendChild(modelInfo);
  }
  
  messageDiv.appendChild(messageFooter);
  
  // Insert before the clear button
  const clearButton = answerDiv.querySelector('.clear-chat');
  answerDiv.insertBefore(messageDiv, clearButton);
  
  // Scroll to bottom
  answerDiv.scrollTop = answerDiv.scrollHeight;
}

// Set up all event listeners
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

  themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      currentTheme = e.matches ? 'dark' : 'light';
      applyTheme(currentTheme);
    }
  });

  // Fix toggle button to always open sidebar
  toggleButton.addEventListener('click', async () => {
    if (!sidebar.classList.contains('open')) {
      sidebar.classList.add('open');
      await loadChatHistory(); // Load chat history when sidebar is opened
      updateContentPreview();
    }
  });

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      console.log('Close button clicked'); // For debugging
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  } else {
    console.error('Close button not found'); // For debugging
  }

  askButton.addEventListener('click', handleQuestion);

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
      
      // Clear history by setting empty array
      await chrome.storage.local.remove(key);
      loadChatHistory();
      closeModal();
    };

    cancelButton.addEventListener('click', closeModal);
    confirmButton.addEventListener('click', handleClear);
  });

  modelSelector.addEventListener('change', (e) => {
    chrome.storage.sync.set({ selectedModel: e.target.value });
  });

  // Set initial model selection
  chrome.storage.sync.get(['selectedModel'], (result) => {
    if (result.selectedModel) {
      modelSelector.value = result.selectedModel;
    }
  });

  setupContextModeHandlers();

  // Add Enter key handler for the question input
  const questionInput = document.getElementById('question');
  questionInput.addEventListener('keydown', (e) => {
    const autocompleteList = document.querySelector('.shortcut-autocomplete');
    const isAutocompleteVisible = autocompleteList.style.display === 'block';
    const autocompleteItems = autocompleteList.querySelectorAll('.autocomplete-item');
    
    if (isAutocompleteVisible && e.key === 'Tab') {
      e.preventDefault();
      if (autocompleteItems.length > 0) {
        const subcommand = autocompleteItems[0].querySelector('.command').textContent;
        questionInput.value = subcommand + ' ';
        autocompleteList.style.display = 'none';
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (questionInput.value.trim()) {
        handleQuestion();
      }
    }
  });

  // Add placeholder hint for Enter/Shift+Enter
  questionInput.placeholder = "What would you like to know about this page?\nPress Enter to send, Shift+Enter for new line";

  setupShortcutAutocomplete();

  // Also load chat history when the page loads
  loadChatHistory();

  // Add extension context check
  const checkExtensionContext = setInterval(() => {
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated, reloading page...');
      clearInterval(checkExtensionContext);
      window.location.reload();
    }
  }, 1000);

  // Clean up interval when page unloads
  window.addEventListener('unload', () => {
    clearInterval(checkExtensionContext);
  });
}

// Update the getPageContent function
function getPageContent() {
  const activeOption = document.querySelector('.slider-option.active');
  const mode = activeOption ? activeOption.dataset.mode : 'page';
  let content = '';

  switch (mode) {
    case 'page':
      const bodyClone = document.body.cloneNode(true);
      const scripts = bodyClone.getElementsByTagName('script');
      const styles = bodyClone.getElementsByTagName('style');
      while (scripts.length > 0) scripts[0].remove();
      while (styles.length > 0) styles[0].remove();
      content = bodyClone.innerText;
      break;
    case 'selection':
      const selection = window.getSelection();
      content = selection.toString().trim();
      if (!content) {
        content = document.getElementById('content-preview').getAttribute('data-selection') || '';
      }
      break;
    case 'screenshot':
      content = document.getElementById('drop-zone').getAttribute('data-content') || '';
      break;
  }
  
  return content;
}

// Update the content preview
function updateContentPreview() {
  const content = getPageContent();
  const preview = document.getElementById('content-preview');
  if (content) {
    preview.textContent = content.length > 200 
      ? `${content.substring(0, 200)}...` 
      : content;
  } else {
    const activeOption = document.querySelector('.slider-option.active');
    if (activeOption && activeOption.dataset.mode === 'selection') {
      preview.textContent = 'No text selected. Please select some text on the page.';
    } else {
      preview.textContent = 'No content available';
    }
  }
}

// Update the handleQuestion function
async function handleQuestion() {
  const questionInput = document.getElementById('question');
  let question = questionInput.value.trim();
  const activeOption = document.querySelector('.slider-option.active');
  const mode = activeOption ? activeOption.dataset.mode : 'page';
  
  // Check if it's just a slash or if autocomplete is visible
  const autocompleteList = document.querySelector('.shortcut-autocomplete');
  if (question === '/' || autocompleteList.style.display === 'block') {
    return;
  }

  if (!question) {
    alert('Please enter a question.');
    return;
  }

  // Check for shortcuts
  const shortcutPrompt = handleShortcut(question);
  if (shortcutPrompt) {
    question = shortcutPrompt;
  }

  const { openaiApiKey, openaiUrl } = await chrome.storage.sync.get(['openaiApiKey', 'openaiUrl']);
  if (!openaiApiKey) {
    alert('Please set your OpenAI API key in the extension settings (click extension icon).');
    return;
  }

  // Add user message to chat
  addMessageToChat('user', question);
  
  try {
    const content = getPageContent();
    if (mode === 'screenshot' && !content) {
      alert('Please take a screenshot or drop an image first.');
      return;
    }

    const { selectedModel } = await chrome.storage.sync.get(['selectedModel']);
    const model = selectedModel || 'gpt-4o-mini';
    
    // Create streaming message container with model info
    const { messageDiv, messageContent } = createStreamingMessage(model);
    const clearButton = document.getElementById('answer').querySelector('.clear-chat');
    document.getElementById('answer').insertBefore(messageDiv, clearButton);
    
    const apiUrl = (openaiUrl || 'https://api.openai.com/v1/') + 'chat/completions';
    
    // Prepare API request based on content type
    const isImage = content.startsWith('data:image');
    const apiModel = isImage ? 'gpt-4-vision-preview' : model;

    let messages = [
      {
        role: "system",
        content: isImage 
          ? "You are a helpful assistant that analyzes images and answers questions about them." 
          : "You are a helpful assistant that answers questions about content."
      }
    ];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            image_url: {
              url: content,
              detail: "auto"
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Content: ${content}\n\nQuestion: ${question}`
      });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: apiModel,
        messages: messages,
        stream: true,
        max_tokens: 2000,
        temperature: 0.7,
        stream_options: {"include_usage": true}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let totalTokens = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0]?.delta?.content) {
              const content = data.choices[0].delta.content;
              fullResponse += content;
              messageContent.innerHTML = parseMarkdown(fullResponse);
              messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
            if (data.usage?.total_tokens) {
              totalTokens = data.usage.total_tokens;
            }
          } catch (e) {
            console.error('Error parsing streaming response:', e);
          }
        }
      }
    }
    
    // Save to chat history file
    const currentUrl = window.location.href;
    const urlHash = btoa(currentUrl).replace(/[/+=]/g, '_');
    const filename = `chat_history_${urlHash}.json`;
    
    let currentHistory = [];
    try {
      const response = await fetch(chrome.runtime.getURL(`histories/${filename}`));
      if (response.ok) {
        currentHistory = await response.json();
      }
    } catch (error) {
      // No existing history, start fresh
    }
    
    // Add new messages
    const newMessages = [
      {
        r: 'user',
        c: question,
        t: Date.now()
      },
      {
        r: 'assistant',
        c: fullResponse,
        t: Date.now()
      }
    ];

    // Keep only the last 50 messages
    const maxHistoryLength = 50;
    const updatedHistory = [...currentHistory, ...newMessages]
      .slice(-maxHistoryLength);

    // Save to file
    await saveChatHistory(currentUrl, updatedHistory);

    // Clear the input
    questionInput.value = '';

  } catch (error) {
    console.error('Error:', error);
    addMessageToChat('assistant', `Error: ${error.message}`);
  }
}

// Parse markdown safely
function parseMarkdown(content) {
  try {
    // Ensure code blocks and inline code are properly formatted
    content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `\n\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`;
    });
    return marked.parse(content, { async: false });
  } catch (e) {
    console.error('Error parsing markdown:', e);
    return content;
  }
}

// Create a streaming message element
function createStreamingMessage(model) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'ai-chat-message ai-assistant-message';
  
  const messageContent = document.createElement('div');
  messageContent.className = 'ai-message-content streaming';
  
  const messageFooter = document.createElement('div');
  messageFooter.className = 'ai-message-footer';
  
  messageFooter.innerHTML = `
    <div class="ai-message-time">${new Date().toLocaleTimeString()}</div>
    <div class="ai-model-info">${model}</div>
  `;
  
  messageDiv.append(messageContent, messageFooter);
  return { messageDiv, messageContent };
}

function applyTheme(theme) {
  const sidebar = document.getElementById('page-reader-sidebar');
  const toggle = document.getElementById('page-reader-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  
  // Remove the document root theme setting
  // document.documentElement.setAttribute('data-theme', theme);
  
  // Apply theme classes to sidebar and related elements
  const isOpen = sidebar.classList.contains('open');
  sidebar.className = `page-reader-sidebar theme-${theme}${isOpen ? ' open' : ''}`;
  toggle.className = `page-reader-toggle theme-${theme}`;
  themeToggle.className = `theme-toggle ${theme === 'dark' ? 'theme-dark' : ''}`;
  
  // Apply theme to modal if it exists
  const modal = document.getElementById('clear-confirm-modal');
  if (modal) {
    modal.className = `modal ${theme === 'dark' ? 'theme-dark' : ''}`;
  }
}

// Add new functions for handling different modes
function setupContextModeHandlers() {
  const sliderContainer = document.querySelector('.slider-container');
  const sliderHighlight = document.querySelector('.slider-highlight');
  const sliderOptions = document.querySelectorAll('.slider-option');
  const dropZone = document.getElementById('drop-zone');
  const contentPreview = document.getElementById('content-preview');
  const screenshotBtn = document.getElementById('screenshot-btn');

  // Initialize the slider position
  const initializeSlider = () => {
    const activeOption = document.querySelector('.slider-option.active') || sliderOptions[0];
    const optionRect = activeOption.getBoundingClientRect();
    const containerRect = sliderContainer.getBoundingClientRect();
    
    sliderHighlight.style.width = `${optionRect.width}px`;
    sliderHighlight.style.transform = `translateX(${activeOption.offsetLeft}px)`;
  };

  // Set initial active state
  sliderOptions[0].classList.add('active');
  initializeSlider();

  // Handle option clicks
  sliderOptions.forEach(option => {
    option.addEventListener('click', () => {
      const mode = option.dataset.mode;
      
      // Update active state
      sliderOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      
      // Move highlight
      sliderHighlight.style.width = `${option.offsetWidth}px`;
      sliderHighlight.style.transform = `translateX(${option.offsetLeft}px)`;

      // Update UI based on mode
      if (mode === 'screenshot') {
        contentPreview.style.display = 'none';
        dropZone.style.display = 'block';
        screenshotBtn.classList.add('visible');
      } else {
        contentPreview.style.display = 'block';
        dropZone.style.display = 'none';
        screenshotBtn.classList.remove('visible');
        updateContentPreview();
      }

      // Handle selection mode
      if (mode === 'selection') {
        const selection = window.getSelection().toString().trim();
        if (selection) {
          contentPreview.setAttribute('data-selection', selection);
          updateContentPreview();
        } else {
          contentPreview.textContent = 'No text selected. Please select some text on the page.';
        }
      }
    });
  });

  // Add selection change listener
  document.addEventListener('selectionchange', () => {
    const activeOption = document.querySelector('.slider-option.active');
    if (activeOption && activeOption.dataset.mode === 'selection') {
      const selection = window.getSelection().toString().trim();
      if (selection) {
        contentPreview.setAttribute('data-selection', selection);
        updateContentPreview();
      }
    }
  });

  // Drag and drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    try {
      // Try to get image from files first
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file);
          
          // Check if it's an SVG file
          if (file.type === 'image/svg+xml') {
            const svgText = await file.text();
            const pngData = await svgToPng(svgText);
            dropZone.setAttribute('data-content', pngData);
            dropZone.innerHTML = `
              <div class="image-preview">
                <img src="${pngData}" alt="Converted SVG">
                <button class="remove-image" aria-label="Remove image">×</button>
              </div>
            `;
          } else {
            dropZone.setAttribute('data-content', base64);
            dropZone.innerHTML = `
              <div class="image-preview">
                <img src="${base64}" alt="Dropped image">
                <button class="remove-image" aria-label="Remove image">×</button>
              </div>
            `;
          }
        } else {
          dropZone.innerHTML = '<p>Please drop a valid image file (PNG, JPEG, GIF, WebP, SVG)</p>';
          return;
        }
      } else {
        // Try to get image from HTML or URL
        const html = e.dataTransfer.getData('text/html');
        const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        
        let imgSrc = '';
        if (html) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const img = doc.querySelector('img');
          if (img) {
            imgSrc = img.src;
          }
        }
        
        if (!imgSrc && url && url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          imgSrc = url;
        }

        if (!imgSrc) {
          dropZone.innerHTML = '<p>Please drop an image or an image link</p>';
          return;
        }

        // Handle SVG or regular images
        if (imgSrc.toLowerCase().endsWith('.svg') || imgSrc.includes('image/svg')) {
          const response = await fetch(imgSrc);
          const svgText = await response.text();
          const pngData = await svgToPng(svgText);
          dropZone.setAttribute('data-content', pngData);
          dropZone.innerHTML = `
            <div class="image-preview">
              <img src="${pngData}" alt="Converted SVG">
              <button class="remove-image" aria-label="Remove image">×</button>
            </div>
          `;
        } else {
          const imageData = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              { action: 'fetchImage', url: imgSrc },
              response => {
                if (chrome.runtime.lastError || response.error) {
                  reject(new Error(response.error || 'Failed to fetch image'));
                } else {
                  resolve(response.data);
                }
              }
            );
          });

          dropZone.setAttribute('data-content', imageData);
          dropZone.innerHTML = `
            <div class="image-preview">
              <img src="${imageData}" alt="Dropped image">
              <button class="remove-image" aria-label="Remove image">×</button>
            </div>
          `;
        }
      }

      // Add remove button handler - moved outside all conditionals
      const removeBtn = dropZone.querySelector('.remove-image');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
          dropZone.removeAttribute('data-content');
        });
      }

    } catch (error) {
      console.error('Error processing dropped content:', error);
      dropZone.innerHTML = '<p>Error processing dropped content. Please try again.</p>';
    }
  });

  // Add screenshot handler
  screenshotBtn.addEventListener('click', async () => {
    try {
      const sidebar = document.getElementById('page-reader-sidebar');
      sidebar.classList.remove('open');
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for sidebar animation
      
      const screenshot = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'takeScreenshot' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (!response) {
            reject(new Error('Failed to capture screenshot'));
          } else {
            resolve(response);
          }
        });
      });
      
      sidebar.classList.add('open');
      
      if (screenshot) {
        dropZone.setAttribute('data-content', screenshot);
        dropZone.innerHTML = `
          <div class="image-preview">
            <img src="${screenshot}" alt="Page screenshot">
            <button class="remove-image" aria-label="Remove screenshot">×</button>
          </div>
        `;
        
        const removeBtn = dropZone.querySelector('.remove-image');
        removeBtn.addEventListener('click', () => {
          dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
          dropZone.removeAttribute('data-content');
        });
      }
    } catch (error) {
      console.error('Screenshot failed:', error);
      dropZone.innerHTML = '<p>Failed to take screenshot. Please try again.</p>';
      
      // Make sure sidebar is open even if screenshot fails
      const sidebar = document.getElementById('page-reader-sidebar');
      sidebar.classList.add('open');
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Add this helper function to check and format image data
function formatImageData(base64Data) {
  // If it's already a proper data URL, return it
  if (base64Data.startsWith('data:image/')) {
    return base64Data;
  }
  
  // Try to determine image type from the base64 header or content
  let imageType = 'png'; // default to PNG
  
  // Check for common image headers
  if (base64Data.startsWith('/9j/')) {
    imageType = 'jpeg';
  } else if (base64Data.startsWith('R0lGOD')) {
    imageType = 'gif';
  } else if (base64Data.startsWith('UklGR')) {
    imageType = 'webp';
  } else if (base64Data.includes('<svg') || base64Data.startsWith('PHN2Zz')) {
    // Convert SVG to PNG using canvas
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        reject(new Error('Failed to convert SVG to PNG'));
      };
      img.src = base64Data.startsWith('data:') ? base64Data : `data:image/svg+xml;base64,${base64Data}`;
    });
  }
  
  return `data:image/${imageType};base64,${base64Data.replace(/^data:.+;base64,/, '')}`;
}

// Add SVG to PNG conversion function
async function svgToPng(svgText) {
  // Create a data URL from the SVG
  const svgData = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
  
  // Create an image element
  const img = new Image();
  img.width = 800;  // Set a fixed size
  img.height = 600;
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Get context and draw
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convert to PNG
      try {
        const pngData = canvas.toDataURL('image/png');
        resolve(pngData);
      } catch (error) {
        reject(new Error('Failed to convert to PNG'));
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load SVG'));
    };
    
    // Load the SVG
    img.src = svgData;
  });
}

// Add autocomplete functionality to the question input
async function setupShortcutAutocomplete() {
  await loadCustomPrompts();
  
  const questionInput = document.getElementById('question');
  const autocompleteList = document.createElement('div');
  autocompleteList.className = 'shortcut-autocomplete';
  autocompleteList.style.display = 'none';
  questionInput.parentNode.appendChild(autocompleteList);

  let selectedIndex = -1;
  let matches = [];

  function selectPrompt(command) {
    if (!command) return;
    
    // Just use the command directly from matches array
    const currentValue = questionInput.value;
    const lastSlashIndex = currentValue.lastIndexOf('/');
    const beforeSlash = lastSlashIndex >= 0 ? currentValue.substring(0, lastSlashIndex) : currentValue;
    const newValue = beforeSlash + command + ' ';
    
    questionInput.value = newValue;
    questionInput.setSelectionRange(newValue.length, newValue.length);
    autocompleteList.style.display = 'none';
    questionInput.focus();
  }

  function updateSelection() {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  // Input handler for showing suggestions
  questionInput.addEventListener('input', (e) => {
    const input = e.target.value.toLowerCase();
    selectedIndex = -1;
    
    if (input.startsWith('/')) {
      matches = Object.keys(PROMPT_SHORTCUTS).filter(cmd => 
        cmd.toLowerCase().startsWith(input)
      );

      if (matches.length > 0) {
        autocompleteList.innerHTML = matches
          .map((cmd, index) => `
            <div class="autocomplete-item" data-index="${index}" data-command="${cmd}">
              <span class="command">${cmd}</span>
              <span class="shortcut">${index < 9 ? `Alt+${index + 1}` : ''}</span>
            </div>
          `)
          .join('');
        autocompleteList.style.display = 'block';
      } else {
        autocompleteList.style.display = 'none';
      }
    } else {
      autocompleteList.style.display = 'none';
    }
  });

  // Keyboard navigation handler
  questionInput.addEventListener('keydown', (e) => {
    const isAutocompleteVisible = autocompleteList.style.display === 'block';
    
    if (!isAutocompleteVisible) return;

    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection();
        break;
        
      case 'Tab':
        e.preventDefault();
        if (matches.length > 0) {
          const selectedCommand = matches[selectedIndex >= 0 ? selectedIndex : 0];
          selectPrompt(selectedCommand);
        }
        break;
        
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          selectPrompt(matches[selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        autocompleteList.style.display = 'none';
        break;
    }
  });

  // Alt+number shortcuts handler
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !isNaN(e.key)) {
      const index = parseInt(e.key) - 1;
      if (index >= 0 && index < matches.length && autocompleteList.style.display === 'block') {
        e.preventDefault();
        e.stopPropagation();
        selectPrompt(matches[index]);
        return false;
      }
    }
  }, true);

  // Click handler for suggestions
  autocompleteList.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      const command = item.querySelector('.command').textContent;
      selectPrompt(command);
    }
  });

  // Hide autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-section')) {
      autocompleteList.style.display = 'none';
    }
  });
}

// Initialize the sidebar
createSidebar();

document.addEventListener('imageUploaded', function(e) {
    const imageData = e.detail.image;
    
    // If you have a chat input area, you can append the image
    const chatInput = document.querySelector('.chat-input'); // adjust selector as needed
    if (chatInput) {
        const imgElement = document.createElement('img');
        imgElement.src = imageData;
        imgElement.style.maxWidth = '200px';
        imgElement.style.maxHeight = '200px';
        
        // Insert the image before the input
        chatInput.parentNode.insertBefore(imgElement, chatInput);
    }
});