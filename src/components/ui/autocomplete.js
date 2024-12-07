import { loadCustomPrompts, PROMPT_SHORTCUTS } from '../chat/promptShortcuts.js';

async function setupShortcutAutocomplete() {
    await loadCustomPrompts();
    
    const questionInput = document.getElementById('question');
    const autocompleteList = document.createElement('div');
    autocompleteList.className = 'shortcut-autocomplete';
    autocompleteList.style.display = 'none';
    questionInput.parentNode.appendChild(autocompleteList);

    let selectedIndex = -1;
    let matches = [];

    function selectPrompt(command) {
        if (!command) return;
        
        const currentValue = questionInput.value;
        const lastSlashIndex = currentValue.lastIndexOf('/');
        const beforeSlash = lastSlashIndex >= 0 ? currentValue.substring(0, lastSlashIndex) : currentValue;
        const newValue = beforeSlash + command + ' ';
        
        questionInput.value = newValue;
        questionInput.setSelectionRange(newValue.length, newValue.length);
        autocompleteList.style.display = 'none';
        questionInput.focus();
    }

    function updateSelection() {
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Input handler for showing suggestions
    questionInput.addEventListener('input', (e) => {
        const input = e.target.value.toLowerCase();
        selectedIndex = -1;
        
        if (input.startsWith('/')) {
            matches = Object.keys(PROMPT_SHORTCUTS).filter(cmd => 
                cmd.toLowerCase().startsWith(input)
            );

            if (matches.length > 0) {
                autocompleteList.innerHTML = matches
                    .map((cmd, index) => `
                        <div class="autocomplete-item" data-index="${index}" data-command="${cmd}">
                            <span class="command">${cmd}</span>
                            <span class="shortcut">${index < 9 ? `Alt+${index + 1}` : ''}</span>
                        </div>
                    `)
                    .join('');
                autocompleteList.style.display = 'block';
            } else {
                autocompleteList.style.display = 'none';
            }
        } else {
            autocompleteList.style.display = 'none';
        }
    });

    // Keyboard navigation handler
    questionInput.addEventListener('keydown', (e) => {
        const isAutocompleteVisible = autocompleteList.style.display === 'block';
        
        if (!isAutocompleteVisible) return;

        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection();
                break;
                
            case 'Tab':
                e.preventDefault();
                if (matches.length > 0) {
                    selectPrompt(matches[selectedIndex >= 0 ? selectedIndex : 0]);
                }
                break;
                
            case 'Enter':
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    e.preventDefault();
                    selectPrompt(matches[selectedIndex]);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                autocompleteList.style.display = 'none';
                break;
        }
    });

    // Alt+number shortcuts handler
    document.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && !isNaN(e.key)) {
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index < matches.length && autocompleteList.style.display === 'block') {
                e.preventDefault();
                e.stopPropagation();
                selectPrompt(matches[index]);
                return false;
            }
        }
    }, true);

    // Click handler for suggestions
    autocompleteList.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            const command = item.querySelector('.command').textContent;
            selectPrompt(command);
        }
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-section')) {
            autocompleteList.style.display = 'none';
        }
    });
}

export { setupShortcutAutocomplete }; 