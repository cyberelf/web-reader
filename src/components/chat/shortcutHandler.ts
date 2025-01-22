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
    document.addEventListener('click', (e) => {
      if (e.target !== this.input && this.dropdown) {
        this.hideDropdown();
      }
    });
  }

  private async handleInput(): Promise<void> {
    const text = this.input.value;
    const lastWord = text.split(' ').pop() || '';

    if (lastWord.startsWith('/')) {
      // Get both default shortcuts and custom prompts
      const [settings, { customPrompts = {} }] = await Promise.all([
        getSettings(),
        new Promise<{ customPrompts?: Record<string, string> }>(resolve => {
          chrome.storage.sync.get(['customPrompts'], resolve);
        })
      ]);

      // Combine default shortcuts and custom prompts
      const allShortcuts = {
        ...settings.shortcuts,
        ...customPrompts
      };

      this.matches = Object.entries(allShortcuts)
        .filter(([command]) => command.startsWith(lastWord))
        .map(([command, description]) => ({ command, description }));

      if (this.matches.length > 0) {
        this.showDropdown();
      } else {
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
      this.input.parentElement?.appendChild(this.dropdown);
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
    words[words.length - 1] = command;
    this.input.value = words.join(' ');
    this.hideDropdown();

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