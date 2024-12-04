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
          <select id="theme-selector" class="theme-selector">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </select>
          <button class="close-button" aria-label="Close sidebar">×</button>
        </div>
      </div>
      <div id="content-preview"></div>
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
  messageDiv.className = `chat-message ${role}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  const sanitizedContent = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  messageContent.innerHTML = parseMarkdown(sanitizedContent);
  
  // Add message content first
  messageDiv.appendChild(messageContent);

  // Create footer div for time and model info
  const messageFooter = document.createElement('div');
  messageFooter.className = 'message-footer';
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = new Date(timestamp).toLocaleTimeString();
  messageFooter.appendChild(timeDiv);
  
  if (role === 'assistant') {
    const modelInfo = document.createElement('div');
    modelInfo.className = 'model-info';
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

  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
      updateContentPreview();
    }
  });

  closeButton.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

  askButton.addEventListener('click', handleQuestion);

  clearButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the chat history for this page?')) {
      const currentUrl = window.location.href;
      chrome.storage.sync.get(['urlChatHistory'], (result) => {
        const urlChatHistory = result.urlChatHistory || {};
        delete urlChatHistory[currentUrl];
        chrome.storage.sync.set({ urlChatHistory }, () => {
          loadChatHistory();
        });
      });
    }
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

  const themeSelector = document.getElementById('theme-selector');
  
  // Set initial theme
  chrome.storage.sync.get(['theme'], (result) => {
    const savedTheme = result.theme || 'auto';
    themeSelector.value = savedTheme;
    applyTheme(savedTheme);
  });

  themeSelector.addEventListener('change', (e) => {
    const theme = e.target.value;
    chrome.storage.sync.set({ theme });
    applyTheme(theme);
  });

  // Listen for system theme changes if using auto theme
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      chrome.storage.sync.get(['theme'], (result) => {
        if (result.theme === 'auto') {
          applyTheme('auto');
        }
      });
    });
  }
}

// Get the page content
function getPageContent() {
  const scripts = document.getElementsByTagName('script');
  const styles = document.getElementsByTagName('style');
  
  Array.from(scripts).forEach(script => script.remove());
  Array.from(styles).forEach(style => style.remove());
  
  return document.body.innerText;
}

// Update the content preview
function updateContentPreview() {
  const content = getPageContent();
  const preview = document.getElementById('content-preview');
  preview.textContent = `Page content (preview): ${content.substring(0, 200)}...`;
}

// Handle question submission
async function handleQuestion() {
  const question = document.getElementById('question').value;
  
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
    const { selectedModel } = await chrome.storage.sync.get(['selectedModel']);
    const model = selectedModel || 'gpt-4o-mini';
    
    // Create streaming message container with model info
    const { messageDiv, messageContent } = createStreamingMessage(model);
    const clearButton = document.getElementById('answer').querySelector('.clear-chat');
    document.getElementById('answer').insertBefore(messageDiv, clearButton);
    
    const apiUrl = (openaiUrl || 'https://api.openai.com/v1/') + 'chat/completions';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: model,
        stream: true,
        stream_options: {"include_usage": true},
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that answers questions about webpage content."
          },
          {
            role: "user",
            content: `Context: ${content}\n\nQuestion: ${question}`
          }
        ]
      })
    });

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
              const sanitizedContent = fullResponse
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              messageContent.innerHTML = parseMarkdown(sanitizedContent);
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

    chrome.storage.sync.get(['tokenUsage'], (result) => {
      const currentUsage = result.tokenUsage || { totalTokens: 0, requestCount: 0 };
      const newUsage = {
        totalTokens: currentUsage.totalTokens + totalTokens,
        requestCount: currentUsage.requestCount + 1
      };
      chrome.storage.sync.set({ tokenUsage: newUsage });
    });
  } catch (error) {
    addMessageToChat('assistant', 'Error processing your question. Please try again.');
    console.error(error);
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
  messageDiv.className = 'chat-message assistant-message';
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content streaming';
  messageDiv.appendChild(messageContent);
  
  const messageFooter = document.createElement('div');
  messageFooter.className = 'message-footer';
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = new Date().toLocaleTimeString();
  messageFooter.appendChild(timeDiv);
  
  const modelInfo = document.createElement('div');
  modelInfo.className = 'model-info';
  modelInfo.textContent = model;
  messageFooter.appendChild(modelInfo);
  
  messageDiv.appendChild(messageFooter);
  
  return { messageDiv, messageContent };
}

function applyTheme(theme) {
  const sidebar = document.getElementById('page-reader-sidebar');
  const toggle = document.getElementById('page-reader-toggle');
  
  // Remove existing theme classes
  sidebar.classList.remove('theme-light', 'theme-dark');
  toggle.classList.remove('theme-light', 'theme-dark');
  
  let effectiveTheme = theme;
  if (theme === 'auto') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  sidebar.classList.add(`theme-${effectiveTheme}`);
  toggle.classList.add(`theme-${effectiveTheme}`);
}

// Initialize the sidebar
createSidebar();