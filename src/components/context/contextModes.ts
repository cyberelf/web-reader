/// <reference types="chrome"/>

type ContextMode = 'page' | 'selection' | 'screenshot';

let currentMode: ContextMode = 'page';
let currentScreenshot: string | null = null;

function displayImage(src: string, container: HTMLElement | null): void {
  if (!container) return;

  container.innerHTML = `
    <div class="image-preview">
      <img src="${src}" style="max-width: 100%; height: auto;">
      <button class="clear-image" aria-label="Clear image">×</button>
    </div>
  `;

  const clearButton = container.querySelector('.clear-image');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (container) {
        container.innerHTML = '';
        currentScreenshot = null;
      }
    });
  }
}

export function setupContextModes(): void {
  // Wait for a small delay to ensure elements are ready
  setTimeout(() => {
    const sliderContainer = document.querySelector('.slider-container');
    const sliderHighlight = document.querySelector('.slider-highlight');
    const screenshotBtn = document.getElementById('screenshot-btn');
    const dropZone = document.getElementById('drop-zone');
    const contentPreview = document.getElementById('content-preview');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const toggleButton = document.getElementById('page-reader-toggle');
    const sidebar = document.getElementById('page-reader-sidebar');

    if (!sliderContainer || !sliderHighlight || !screenshotBtn || !dropZone || !contentPreview || !fileInput) {
      console.error('Required elements not found, retrying in 100ms');
      setupContextModes(); // Retry setup
      return;
    }

    function updateHighlight(index: number, highlight: Element): void {
      highlight.setAttribute('style', `transform: translateX(${index * 100}%)`);
    }

    function updateModeUI(mode: ContextMode, screenshotBtn: HTMLElement, dropZone: HTMLElement, preview: HTMLElement): void {
      screenshotBtn.classList.toggle('hidden', mode !== 'screenshot');
      dropZone.classList.toggle('hidden', mode !== 'screenshot');
      if (mode !== 'screenshot') {
        preview.textContent = mode === 'page' 
          ? 'Full page content will be analyzed'
          : mode === 'selection'
          ? 'Select text on the page to analyze'
          : '';
      }
    }

    // Set up mode switching
    const options = sliderContainer.querySelectorAll('.slider-option');
    options.forEach((option, index) => {
      option.addEventListener('click', () => {
        const mode = option.getAttribute('data-mode') as ContextMode;
        if (!mode) return;

        currentMode = mode;
        if (mode !== 'screenshot') {
          currentScreenshot = null;
          if (contentPreview) {
            contentPreview.innerHTML = '';
          }
        }
        updateHighlight(index, sliderHighlight);
        updateModeUI(mode, screenshotBtn, dropZone, contentPreview);
      });
    });

    // Set up screenshot button
    screenshotBtn.addEventListener('click', async () => {
      try {
        // Hide UI elements before taking screenshot
        if (toggleButton) toggleButton.style.visibility = 'hidden';
        if (sidebar) sidebar.style.visibility = 'hidden';

        // Wait a bit for UI to hide
        await new Promise(resolve => setTimeout(resolve, 100));

        const response = await chrome.runtime.sendMessage({ action: 'takeScreenshot' });
        
        // Show UI elements again
        if (toggleButton) toggleButton.style.visibility = 'visible';
        if (sidebar) sidebar.style.visibility = 'visible';

        if (response) {
          currentScreenshot = response;
          displayImage(response, contentPreview);
        }
      } catch (error) {
        console.error('Failed to take screenshot:', error);
        // Ensure UI is visible even if screenshot fails
        if (toggleButton) toggleButton.style.visibility = 'visible';
        if (sidebar) sidebar.style.visibility = 'visible';
      }
    });

    // Set up drag and drop for images
    setupImageDrop(dropZone, contentPreview);
  }, 50); // Small delay to ensure DOM is ready
}

function setupImageDrop(dropZone: HTMLElement, preview: HTMLElement): void {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          currentScreenshot = reader.result;
          displayImage(reader.result, preview);
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

export function getPageContent(): string {
  switch (currentMode) {
    case 'page':
      return document.body.innerText;
    case 'selection':
      return window.getSelection()?.toString() || '';
    case 'screenshot':
      return currentScreenshot || '';
    default:
      return '';
  }
} 