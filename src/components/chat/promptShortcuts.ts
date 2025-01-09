interface PromptShortcuts {
  [key: string]: string;
}

let PROMPT_SHORTCUTS: PromptShortcuts = {
  '/summarize': 'Please provide a concise summary of this content, highlighting the main points and key takeaways.',
  '/explain': 'Please explain this content in simple terms, breaking down any complex concepts and providing clear explanations.',
  '/generate': 'Please analyze the style and tone of this content, then generate a new piece of text that matches this style but covers a similar topic.',
};

async function loadCustomPrompts() {
  const { customPrompts = {} } = await chrome.storage.sync.get(['customPrompts']);
  PROMPT_SHORTCUTS = {
    ...PROMPT_SHORTCUTS,
    ...customPrompts
  };
  return PROMPT_SHORTCUTS;
}

async function handleShortcut(input: string) {
  // Load custom prompts first
  await loadCustomPrompts();

  const command = Object.keys(PROMPT_SHORTCUTS).find(cmd => 
    input.trim().toLowerCase().startsWith(cmd.toLowerCase())
  );
  if (command) {
    const customText = input.slice(command.length).trim();
    const basePrompt = PROMPT_SHORTCUTS[command];
    return customText ? `${basePrompt}\nAdditional context: ${customText}` : basePrompt;
  }
  return null;
}

// Listen for custom prompt changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.customPrompts) {
    const customPrompts = changes.customPrompts.newValue || {};
    PROMPT_SHORTCUTS = {
      '/summarize': 'Please provide a concise summary of this content, highlighting the main points and key takeaways.',
      '/explain': 'Please explain this content in simple terms, breaking down any complex concepts and providing clear explanations.',
      '/generate': 'Please analyze the style and tone of this content, then generate a new piece of text that matches this style but covers a similar topic.',
      ...customPrompts
    };
  }
});

export { PROMPT_SHORTCUTS, loadCustomPrompts, handleShortcut }; 