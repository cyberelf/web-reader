import { saveChatHistory, addMessageToChat } from './chatHistory.js';
import { parseMarkdown } from '../../utils/markdown.js';
import { handleShortcut } from './promptShortcuts.js';
import { getPageContent } from '../context/contextModes.js';

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

async function getCurrentModel() {
    const { selectedModel } = await chrome.storage.sync.get(['selectedModel']);
    return selectedModel || 'gpt-4o-mini'; // default model
}

async function handleQuestion() {
    const questionInput = document.getElementById('question');
    let question = questionInput.value.trim();
    
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
        // Get current model from selector instead of storage
        const modelSelector = document.getElementById('model-selector');
        const model = modelSelector.value; // Use the current selected value
        
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

        await saveChatHistory(currentUrl, newMessages);

        // Clear the input
        questionInput.value = '';

        // Save model selection after successful request
        await chrome.storage.sync.set({ selectedModel: model });

    } catch (error) {
        console.error('Error:', error);
        addMessageToChat('assistant', `Error: ${error.message}`);
    }
}

export { createStreamingMessage, handleQuestion, getCurrentModel }; 