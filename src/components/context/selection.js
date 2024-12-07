import { getPageContent } from './contextModes.js';

function updateContentPreview() {
    const content = getPageContent();
    const preview = document.getElementById('content-preview');
    if (content) {
        preview.textContent = content.length > 200 
            ? `${content.substring(0, 200)}...` 
            : content;
    } else {
        const activeOption = document.querySelector('.slider-option.active');
        if (activeOption && activeOption.dataset.mode === 'selection') {
            preview.textContent = 'No text selected. Please select some text on the page.';
        } else {
            preview.textContent = 'No content available';
        }
    }
}

function setupSelectionHandler() {
    document.addEventListener('selectionchange', () => {
        const activeOption = document.querySelector('.slider-option.active');
        if (activeOption && activeOption.dataset.mode === 'selection') {
            const selection = window.getSelection();
            const sidebar = document.getElementById('page-reader-sidebar');
            
            // Check if the selection is within the sidebar
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                if (sidebar.contains(container)) {
                    return; // Ignore selections within the sidebar
                }
            }
            
            const selectedText = selection.toString().trim();
            if (selectedText) {
                const contentPreview = document.getElementById('content-preview');
                contentPreview.setAttribute('data-selection', selectedText);
                updateContentPreview();
            }
        }
    });
}

export { updateContentPreview, setupSelectionHandler }; 