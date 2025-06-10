import { getSettings } from '../../settings';

interface ShortcutMatch {
  command: string;
  description: string;
}

export class ShortcutHandler {
  private input: HTMLTextAreaElement;
  private dropdown: HTMLDivElement | null = null;
  private matches: ShortcutMatch[] = [];
  private selectedIndex = 0;

  constructor(input: HTMLTextAreaElement) {
    this.input = input;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    // Add support for Tab key to accept first suggestion
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.matches.length > 0 && this.dropdown) {
        e.preventDefault();
        this.applyShortcut(this.matches[this.selectedIndex].command);
      }
    });
    
    document.addEventListener('click', (e) => {
      if (e.target !== this.input && this.dropdown && !this.dropdown.contains(e.target as Node)) {
        this.hideDropdown();
      }
    });
  }

  private async handleInput(): Promise<void> {
    const text = this.input.value;
    const cursorPos = this.input.selectionStart;
    
    // Find the word at the cursor position
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);
    
    // Find the start of the current word
    const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
    const currentWord = beforeCursor.substring(lastSpaceIndex + 1);

    if (currentWord.startsWith('/')) {
      try {
        // Get both default shortcuts and custom prompts
        const [settings, { customPrompts = {} }] = await Promise.all([
          getSettings(),
          new Promise<{ customPrompts?: Record<string, string> }>(resolve => {
            chrome.storage.sync.get({ customPrompts: {} }, resolve);
          })
        ]);

        // Combine default shortcuts and custom prompts
        const allShortcuts = {
          ...settings.shortcuts,
          ...customPrompts
        };

        // If just '/', show all shortcuts, otherwise filter by match
        this.matches = currentWord.length === 1 
          ? Object.entries(allShortcuts)
              .map(([command, description]) => ({ command, description }))
              .sort((a, b) => a.command.localeCompare(b.command))
          : Object.entries(allShortcuts)
              .filter(([command]) => command.toLowerCase().startsWith(currentWord.toLowerCase()))
              .map(([command, description]) => ({ command, description }))
              .sort((a, b) => a.command.localeCompare(b.command));

        if (this.matches.length > 0) {
          this.selectedIndex = 0; // Reset selection to first item
          this.showDropdown();
        } else {
          this.hideDropdown();
        }
      } catch (error) {
        console.error('Error loading shortcuts:', error);
        this.hideDropdown();
      }
    } else {
      this.hideDropdown();
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (!this.dropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.matches.length - 1);
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;

      case 'Enter':
        if (this.matches.length > 0) {
          e.preventDefault();
          this.applyShortcut(this.matches[this.selectedIndex].command);
        }
        break;

      case 'Escape':
        this.hideDropdown();
        break;
    }
  }

  private showDropdown(): void {
    if (!this.dropdown) {
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'shortcut-autocomplete';
      // Find the input section to append the dropdown there
      const inputSection = this.input.closest('.ai-input-section');
      if (inputSection) {
        inputSection.appendChild(this.dropdown);
      } else {
        this.input.parentElement?.appendChild(this.dropdown);
      }
    }

    this.dropdown.innerHTML = this.matches
      .map((match, index) => `
        <div class="autocomplete-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
          <span class="command">${match.command}</span>
          <span class="shortcut">${match.description}</span>
        </div>
      `)
      .join('');

    this.dropdown.querySelectorAll('.autocomplete-item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index') || '0');
        this.applyShortcut(this.matches[index].command);
      });
    });
  }

  private hideDropdown(): void {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    this.matches = [];
    this.selectedIndex = 0;
  }

  private updateSelection(): void {
    if (!this.dropdown) return;

    this.dropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
  }

  private applyShortcut(command: string): void {
    // Replace the last word with the full command
    const words = this.input.value.split(' ');
    const lastWordIndex = words.length - 1;
    
    // Find the position of the current word
    const beforeCursor = this.input.value.substring(0, this.input.selectionStart);
    const afterCursor = this.input.value.substring(this.input.selectionStart);
    
    // Find the start of the current word
    const lastSpaceIndex = beforeCursor.lastIndexOf(' ');
    const currentWord = beforeCursor.substring(lastSpaceIndex + 1);
    
    if (currentWord.startsWith('/')) {
      // Replace just the command part
      const newValue = beforeCursor.substring(0, lastSpaceIndex + 1) + command + ' ' + afterCursor;
      this.input.value = newValue;
      
      // Set cursor position after the command
      const newCursorPos = lastSpaceIndex + 1 + command.length + 1;
      this.input.setSelectionRange(newCursorPos, newCursorPos);
    } else {
      // Fallback to word replacement
      words[lastWordIndex] = command;
      this.input.value = words.join(' ') + ' ';
      
      // Move cursor to end
      this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    }
    
    this.hideDropdown();
    this.input.focus();

    // Handle special commands
    switch (command) {
      case '/clear':
        document.querySelector('.ai-clear-chat-history')?.dispatchEvent(new Event('click'));
        this.input.value = '';
        break;
      case '/screenshot':
        document.getElementById('ai-screenshot-btn')?.click();
        this.input.value = '';
        break;
      // Add more command handlers as needed
    }
  }
} 