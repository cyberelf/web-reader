import { saveToStorage, loadFromStorage, removeFromStorage } from '../../utils/storage.js';
import { parseMarkdown } from '../../utils/markdown.js';

async function saveChatHistory(currentUrl, history) {
    const urlHash = btoa(currentUrl).replace(/[/+=]/g, '_');
    await saveToStorage(`chat_history_${urlHash}`, history);
}

async function loadChatHistory() {
    try {
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

        const chatHistory = await loadFromStorage(key) || [];
        
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
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

function addMessageToChat(role, content, timestamp = Date.now()) {
    const answerDiv = document.getElementById('answer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chat-message ai-${role}-message`;
    
    // Add copy button for assistant messages
    if (role === 'assistant') {
        const copyContainer = document.createElement('div');
        copyContainer.className = 'copy-container';
        copyContainer.innerHTML = `
            <button class="copy-button" aria-label="Copy response">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </button>
        `;
        messageDiv.appendChild(copyContainer);

        // Add copy functionality
        const copyButton = copyContainer.querySelector('.copy-button');
        copyButton.addEventListener('click', () => {
            const textToCopy = messageDiv.querySelector('.ai-message-content').textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                }, 2000);
            });
        });
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'ai-message-content';
    const sanitizedContent = content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    messageContent.innerHTML = parseMarkdown(sanitizedContent);
    
    messageDiv.appendChild(messageContent);

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
    
    const clearButton = answerDiv.querySelector('.clear-chat');
    answerDiv.insertBefore(messageDiv, clearButton);
    
    answerDiv.scrollTop = answerDiv.scrollHeight;
}

export { saveChatHistory, loadChatHistory, addMessageToChat }; 