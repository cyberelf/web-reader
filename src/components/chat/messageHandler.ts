/// <reference types="chrome"/>

import { addMessage, updateLastMessage } from './chatHistory';
import { getSettings } from '../../settings';
import type { ModelType } from '../../config';
import { handleShortcut } from './promptShortcuts';

interface OpenAIResponse {
  choices: Array<{
    message?: {
      content: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
  };
}

interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'system' | 'assistant';
    content: string;
  }>;
  stream: boolean;
  max_tokens?: number;
}

export async function handleQuestion(question: string, context: string, model?: ModelType): Promise<void> {
  try {
    // Check if the question is a shortcut
    const shortcutPrompt = handleShortcut(question);
    const finalQuestion = shortcutPrompt || question;

    const settings = await getSettings();
    if (!settings.apiKey) {
      throw new Error('Please set your OpenAI API key in the extension settings.');
    }

    await addMessage('user', finalQuestion);

    const systemMessage = context ? 
      `You are analyzing the following content:\n\n${context}` :
      'You are analyzing the current webpage.';

    // Create placeholder message for streaming
    await addMessage('assistant', '', model || settings.model);

    const response = await fetch(`${settings.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: model || settings.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: finalQuestion }
        ],
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
    } catch (error) {
      console.error('Error reading stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    console.error('Error handling question:', error);
    await addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
  }
} 