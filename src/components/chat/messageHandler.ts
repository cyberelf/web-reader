/// <reference types="chrome"/>

import { addMessage } from './chatHistory';
import { getSettings } from '../../settings';
import type { ModelType } from '../../config';
import { handleShortcut } from './promptShortcuts';

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

    const response = await fetch(`${settings.apiUrl}chat/completions`, {
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
        stream: false
      } as OpenAIRequest)
    });

    const data: OpenAIResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to get response from OpenAI');
    }

    const answer = data.choices[0]?.message.content || 'No response from the model.';
    await addMessage('assistant', answer, model || settings.model);

  } catch (error) {
    console.error('Error handling question:', error);
    await addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
  }
} 