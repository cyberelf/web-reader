let markedReady = false;

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
          <button class="close-button" aria-label="Close sidebar">×</button>
        </div>
      </div>
      <div class="context-controls">
        <div class="context-header">
          <select id="context-mode" class="context-mode-selector">
            <option value="page">Full Page</option>
            <option value="screenshot">Screenshot/Image</option>
          </select>
          <button id="screenshot-btn" class="hidden">Take Screenshot</button>
        </div>
        <div id="context-area">
          <div id="content-preview"></div>
          <div id="drop-zone" class="hidden">
            <p>Drag and drop an image here</p>
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

// Load chat history from storage
async function loadChatHistory() {
  const currentUrl = window.location.href;
  const { urlChatHistory = {} } = await chrome.storage.sync.get(['urlChatHistory']);
  const chatHistory = urlChatHistory[currentUrl] || [];
  
  const answerDiv = document.getElementById('answer');
  
  // Clear existing messages except the clear button
  const clearButton = answerDiv.querySelector('.clear-chat');
  answerDiv.innerHTML = '';
  answerDiv.appendChild(clearButton);
  
  // Add each message to the chat
  chatHistory.forEach(message => {
    addMessageToChat(message.role, message.content, message.timestamp);
  });
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
  const closeButton = document.querySelector('.close-button');
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
  toggleButton.addEventListener('click', () => {
    if (!sidebar.classList.contains('open')) {
      sidebar.classList.add('open');
      updateContentPreview();
    }
  });

  closeButton.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

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

    const handleClear = () => {
      const currentUrl = window.location.href;
      chrome.storage.sync.get(['urlChatHistory'], (result) => {
        const urlChatHistory = result.urlChatHistory || {};
        delete urlChatHistory[currentUrl];
        chrome.storage.sync.set({ urlChatHistory }, () => {
          loadChatHistory();
          closeModal();
        });
      });
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
}

// Get the page content
function getPageContent() {
  const mode = document.getElementById('context-mode').value;
  let content = '';

  switch (mode) {
    case 'page':
      // Create a clone of the body to avoid modifying the original
      const bodyClone = document.body.cloneNode(true);
      // Remove scripts and styles from the clone
      const scripts = bodyClone.getElementsByTagName('script');
      const styles = bodyClone.getElementsByTagName('style');
      while (scripts.length > 0) scripts[0].remove();
      while (styles.length > 0) styles[0].remove();
      content = bodyClone.innerText;
      break;
    case 'screenshot':
      content = document.getElementById('drop-zone').getAttribute('data-content') || '';
      break;
    case 'selection':
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
    preview.textContent = 'No content available';
  }
}

// Handle question submission
async function handleQuestion() {
  const question = document.getElementById('question').value;
  const mode = document.getElementById('context-mode').value;
  
  if (!question) {
    alert('Please enter a question.');
    return;
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
    
    // Save to chat history
    const currentUrl = window.location.href;
    const { urlChatHistory = {} } = await chrome.storage.sync.get(['urlChatHistory']);
    const currentUrlHistory = urlChatHistory[currentUrl] || [];
    currentUrlHistory.push(
      { role: 'user', content: question, timestamp: Date.now() },
      { role: 'assistant', content: fullResponse, timestamp: Date.now() }
    );
    urlChatHistory[currentUrl] = currentUrlHistory;
    chrome.storage.sync.set({ urlChatHistory });

  } catch (error) {
    console.error('Error:', error);
    addMessageToChat('assistant', `Error: ${error.message}`);
  }
  
  // Clear the input
  document.getElementById('question').value = '';
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
  const contextMode = document.getElementById('context-mode');
  const dropZone = document.getElementById('drop-zone');
  const contentPreview = document.getElementById('content-preview');
  const fileInput = document.getElementById('file-input');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const sidebar = document.getElementById('page-reader-sidebar');

  contextMode.addEventListener('change', (e) => {
    const mode = e.target.value;
    // Show/hide content preview based on mode
    contentPreview.style.display = mode === 'page' ? 'block' : 'none';
    // Show/hide drop zone based on mode
    dropZone.style.display = mode === 'page' ? 'none' : 'block';
    // Show/hide screenshot button
    screenshotBtn.className = mode === 'screenshot' ? 'visible' : '';
    
    // Reset drop zone content
    if (mode === 'screenshot') {
      dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
      dropZone.removeAttribute('data-content');
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
      sidebar.classList.remove('open');
      await new Promise(resolve => setTimeout(resolve, 300));
      
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

// Initialize the sidebar
createSidebar();