/// <reference types="chrome"/>

interface CustomPrompts {
  [key: string]: string;
}

interface StorageResult {
  customPrompts?: CustomPrompts;
}

export function setupShortcutAutocomplete(): void {
  const textarea = document.getElementById('question') as HTMLTextAreaElement;
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    const cursorPosition = textarea.selectionStart;
    const text = textarea.value;
    const lastSlash = text.lastIndexOf('/', cursorPosition);
    
    if (lastSlash >= 0 && lastSlash < cursorPosition) {
      const command = text.substring(lastSlash, cursorPosition);
      if (command.length > 1) {
        chrome.storage.sync.get(['customPrompts'], (result: StorageResult) => {
          const customPrompts = result.customPrompts || {};
          const matchingPrompt = Object.entries(customPrompts)
            .find(([key]) => key.startsWith(command));
          
          if (matchingPrompt) {
            const [key, value] = matchingPrompt;
            if (key === command) {
              const newText = text.substring(0, lastSlash) + value + text.substring(cursorPosition);
              textarea.value = newText;
              textarea.selectionStart = textarea.selectionEnd = lastSlash + value.length;
            }
          }
        });
      }
    }
  });

  // Handle keyboard shortcuts (Alt + number)
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !isNaN(Number(e.key))) {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      
      chrome.storage.sync.get(['customPrompts'], (result: StorageResult) => {
        const customPrompts = result.customPrompts || {};
        const prompts = Object.values(customPrompts);
        
        if (index >= 0 && index < prompts.length) {
          textarea.value = prompts[index];
          textarea.focus();
        }
      });
    }
  });
} 