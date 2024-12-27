let lastSelection = '';

export function setupSelectionHandler(): void {
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection) {
      lastSelection = selection.toString();
      updateContentPreview();
    }
  });
}

export function updateContentPreview(): void {
  const contentPreview = document.getElementById('content-preview');
  if (!contentPreview) return;

  const selection = window.getSelection();
  const text = selection ? selection.toString() : lastSelection;

  if (text) {
    contentPreview.textContent = text.length > 1000 
      ? text.substring(0, 1000) + '...'
      : text;
  } else {
    contentPreview.textContent = 'No text selected. Select some text on the page to analyze it.';
  }
} 