/// <reference types="chrome"/>

import { addMessage, updateLastMessage } from './chatHistory';
import { getSettings } from '../../settings';
import type { ModelType } from '../../config';
import { handleShortcut } from './promptShortcuts';
import { resizeImage } from '../../utils/imageUtils';

interface OpenAIResponse {
  choices: Array<{
    message?: {
      content: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  error?: {
    message: string;
  };
}

interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'system' | 'assistant';
    content: string | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: {
        url: string;
      };
    }>;
  }>;
  stream: boolean;
  max_tokens?: number;
}

interface TokenUsage {
  totalTokens: number;
  requestCount: number;
}

async function updateTokenUsage(newTokens: number): Promise<void> {
  const result = await new Promise<{ tokenUsage?: TokenUsage }>((resolve) => {
    chrome.storage.local.get(['tokenUsage'], resolve);
  });
  
  const currentUsage = result.tokenUsage || { totalTokens: 0, requestCount: 0 };
  const updatedUsage = {
    totalTokens: currentUsage.totalTokens + newTokens,
    requestCount: currentUsage.requestCount + 1
  };
  
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ tokenUsage: updatedUsage }, resolve);
  });
}

export async function handleQuestion(question: string, context: string, model?: ModelType): Promise<void> {
  try {
    // Check if the question is a shortcut
    const shortcutPrompt = await handleShortcut(question);
    const finalQuestion = shortcutPrompt || question;

    const settings = await getSettings();
    if (!settings.apiKey) {
      throw new Error('Please set your OpenAI API key in the extension settings.');
    }

    await addMessage('user', finalQuestion);

    // Create placeholder message for streaming
    const selectedModel = model || settings.model;
    await addMessage('assistant', '', selectedModel);

    // Prepare messages based on whether we have an image or text
    const messages = [];
    
    // Add system message
    if (context.startsWith('data:image')) {
      // Resize image if needed
      const resizedImage = await resizeImage(context);
      
      messages.push({
        role: 'system',
        content: 'You are analyzing the provided image. Be specific and detailed in your observations.'
      });
      // Add user message with image
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: resizedImage
            }
          },
          {
            type: 'text',
            text: finalQuestion
          }
        ]
      });
    } else {
      messages.push({
        role: 'system',
        content: context ? `You are analyzing the following content:\n\n${context}` : 'You are analyzing the current webpage.'
      });
      // Add user message with text
      messages.push({
        role: 'user',
        content: finalQuestion
      });
    }

    // First make a non-streaming request to get token usage
    const nonStreamingResponse = await fetch(`${settings.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        stream: false
      } as OpenAIRequest)
    });

    if (!nonStreamingResponse.ok) {
      const data = await nonStreamingResponse.json();
      throw new Error(data.error?.message || 'Failed to get response from OpenAI');
    }

    const nonStreamingData = await nonStreamingResponse.json();
    const totalTokens = nonStreamingData.usage?.total_tokens || 0;

    // Now make the streaming request for the actual response
    const response = await fetch(`${settings.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        stream: true
      } as OpenAIRequest)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || 'Failed to get response from OpenAI');
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data: OpenAIResponse = JSON.parse(line.slice(6));
              const content = data.choices[0]?.delta?.content || '';
              accumulatedContent += content;
              await updateLastMessage(accumulatedContent);
            } catch (e) {
              console.error('Error parsing streaming response:', e);
            }
          }
        }
      }

      // Update token usage after successful completion
      await updateTokenUsage(totalTokens);
    } catch (error) {
      console.error('Error reading stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Error in handleQuestion:', error);
    throw error;
  }
} 