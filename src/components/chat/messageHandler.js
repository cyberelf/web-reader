import { saveChatHistory, addMessageToChat } from './chatHistory.js';
import { parseMarkdown } from '../../utils/markdown.js';
import { handleShortcut } from './promptShortcuts.js';
import { getPageContent } from '../context/contextModes.js';
import { MODELS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL } from '../../config.js';

function createStreamingMessage(model) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-chat-message ai-assistant-message';
    
    // Add copy button container
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
    
    const messageContent = document.createElement('div');
    messageContent.className = 'ai-message-content streaming';
    
    const messageFooter = document.createElement('div');
    messageFooter.className = 'ai-message-footer';
    
    // Create model info/selector with refresh icon
    const modelInfo = document.createElement('div');
    modelInfo.className = 'model-info-container';
    
    // Create refresh icon
    const refreshIcon = document.createElement('span');
    refreshIcon.className = 'refresh-icon';
    refreshIcon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.5 2.5C5.05228 2.5 5.5 2.94772 5.5 3.5V4.07196C7.19872 2.79481 9.43483 2 11.9091 2C16.3871 2 20 5.61294 20 10.0909C20 14.5689 16.3871 18.1818 11.9091 18.1818C8.11737 18.1818 4.96036 15.5665 4.21462 12.0491C4.09625 11.5127 4.4074 10.9905 4.94371 10.8721C5.48002 10.7537 6.00229 11.0649 6.12066 11.6013C6.69697 14.2831 9.06864 16.2727 11.9091 16.2727C15.3321 16.2727 18.0909 13.5139 18.0909 10.0909C18.0909 6.66797 15.3321 3.90909 11.9091 3.90909C9.92876 3.90909 8.16865 4.75821 6.96624 6.13641L8.5 6.13641C9.05228 6.13641 9.5 6.58412 9.5 7.13641C9.5 7.68869 9.05228 8.13641 8.5 8.13641H4.5C3.94772 8.13641 3.5 7.68869 3.5 7.13641V3.5C3.5 2.94772 3.94772 2.5 4.5 2.5Z"/>
        </svg>
    `;
    
    // Create model selector with config values
    const modelSelect = document.createElement('select');
    modelSelect.className = 'message-model-selector';
    modelSelect.innerHTML = Object.entries(MODELS)
        .filter(([key]) => key !== 'VISION') // Exclude vision model from dropdown
        .map(([_, value]) => `
            <option value="${value}" ${model === value ? 'selected' : ''}>
                ${MODEL_DISPLAY_NAMES[value]}
            </option>
        `)
        .join('');
    
    // Add refresh icon and model selector to container
    modelInfo.appendChild(refreshIcon);
    modelInfo.appendChild(modelSelect);
    
    modelSelect.addEventListener('change', async () => {
        const newModel = modelSelect.value;
        const userMessage = messageDiv.previousElementSibling;
        if (userMessage && userMessage.classList.contains('ai-user-message')) {
            const question = userMessage.querySelector('.ai-message-content').textContent;
            messageDiv.remove();
            userMessage.remove();
            await handleQuestion(question, newModel);
        }
    });
    messageFooter.appendChild(modelInfo);
    
    messageFooter.innerHTML = `
        <div class="ai-message-time">${new Date().toLocaleTimeString()}</div>
    `;
    messageFooter.appendChild(modelInfo);
    
    messageDiv.append(messageContent, messageFooter);
    
    // Convert previous message's dropdown to static text
    const answerDiv = document.getElementById('answer');
    const previousMessages = answerDiv.querySelectorAll('.ai-assistant-message');
    previousMessages.forEach(msg => {
        const oldSelect = msg.querySelector('.message-model-selector');
        if (oldSelect) {
            const modelText = document.createElement('div');
            modelText.className = 'ai-model-info';
            modelText.textContent = oldSelect.value;
            oldSelect.parentNode.replaceChild(modelText, oldSelect);
        }
    });
    
    // Add copy functionality
    const copyButton = copyContainer.querySelector('.copy-button');
    copyButton.addEventListener('click', () => {
        const textToCopy = messageContent.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Show feedback
            copyButton.classList.add('copied');
            setTimeout(() => {
                copyButton.classList.remove('copied');
            }, 2000);
        });
    });

    return { messageDiv, messageContent };
}

async function getCurrentModel() {
    const { selectedModel } = await chrome.storage.sync.get(['selectedModel']);
    return selectedModel || DEFAULT_MODEL;
}

async function handleQuestion(forcedQuestion = null, forcedModel = null) {
    const questionInput = document.getElementById('question');
    let question = forcedQuestion || questionInput.value.trim();
    
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
        // Use forced model or get from selector
        const model = forcedModel || document.getElementById('model-selector').value;
        
        // Create streaming message container with model info
        const { messageDiv, messageContent } = createStreamingMessage(model);
        const clearButton = document.getElementById('answer').querySelector('.clear-chat');
        document.getElementById('answer').insertBefore(messageDiv, clearButton);
        
        const apiUrl = (openaiUrl || 'https://api.openai.com/v1/') + 'chat/completions';
        
        // Prepare API request based on content type
        const isImage = content.startsWith('data:image');
        const apiModel = isImage ? 'gpt-4-vision-preview' : model; // Use current model

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
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        
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
                    } catch (e) {
                        console.error('Error parsing streaming response:', e);
                    }
                }
            }
        }

        // Save to chat history
        const currentUrl = window.location.href;
        const urlHash = btoa(currentUrl).replace(/[/+=]/g, '_');
        const key = `chat_history_${urlHash}`;

        try {
            // Get existing history
            const result = await chrome.storage.local.get([key]);
            const currentHistory = result[key] || [];
            
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
                    t: Date.now(),
                    m: model // Save the model used
                }
            ];

            // Keep only the last 50 messages
            const updatedHistory = [...currentHistory, ...newMessages].slice(-50);

            // Save updated history
            await chrome.storage.local.set({ [key]: updatedHistory });
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }

        // Only clear input if it's not a forced question
        if (!forcedQuestion) {
            questionInput.value = '';
        }

        // Save model selection after successful request
        await chrome.storage.sync.set({ selectedModel: model });

    } catch (error) {
        console.error('Error:', error);
        addMessageToChat('assistant', `Error: ${error.message}`);
    }
}

export { createStreamingMessage, handleQuestion, getCurrentModel }; 