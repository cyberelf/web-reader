/// <reference types="chrome"/>

import { addMessage } from './chatHistory';
import type { ExtensionSettings } from '../../types';

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
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
  stream?: boolean;
  max_tokens?: number;
}

async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(['openaiApiKey', 'selectedModel', 'openaiUrl']);
  return {
    apiKey: result.openaiApiKey || '',
    model: result.selectedModel || 'gpt-3.5-turbo',
    theme: 'light',
    customEndpoint: result.openaiUrl || 'https://api.openai.com/v1/'
  };
}

export async function handleQuestion(question: string, context: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) {
      throw new Error('Please set your OpenAI API key in the extension settings.');
    }

    await addMessage('user', question);

    const systemMessage = context ? 
      `You are analyzing the following content:\n\n${context}` :
      'You are analyzing the current webpage.';

    const response = await fetch(`${settings.customEndpoint}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: question }
        ],
        stream: false
      } as OpenAIRequest)
    });

    const data: OpenAIResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to get response from OpenAI');
    }

    const answer = data.choices[0]?.message.content || 'No response from the model.';
    await addMessage('assistant', answer);

  } catch (error) {
    console.error('Error handling question:', error);
    await addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
  }
} 