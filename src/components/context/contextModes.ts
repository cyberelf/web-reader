/// <reference types="chrome"/>

type ContextMode = 'page' | 'selection' | 'screenshot';

let currentMode: ContextMode = 'page';
let currentScreenshot: string | null = null;

export function setupContextModes(): void {
  const sliderContainer = document.querySelector('.slider-container');
  const sliderHighlight = document.querySelector('.slider-highlight');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const dropZone = document.getElementById('drop-zone');
  const contentPreview = document.getElementById('content-preview');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;

  if (!sliderContainer || !sliderHighlight || !screenshotBtn || !dropZone || !contentPreview || !fileInput) {
    console.error('Required elements not found');
    return;
  }

  // Set up mode switching
  const options = sliderContainer.querySelectorAll('.slider-option');
  options.forEach((option, index) => {
    option.addEventListener('click', () => {
      const mode = option.getAttribute('data-mode') as ContextMode;
      if (!mode) return;

      currentMode = mode;
      currentScreenshot = null; // Reset screenshot when changing modes
      updateHighlight(index, sliderHighlight);
      updateModeUI(mode, screenshotBtn, dropZone, contentPreview);
    });
  });

  // Set up screenshot button
  screenshotBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'takeScreenshot' });
      if (response) {
        currentScreenshot = response;
        displayImage(response, contentPreview);
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  });

  // Set up drag and drop
  setupDragAndDrop(dropZone, contentPreview, fileInput);
}

function updateHighlight(index: number, highlight: Element): void {
  const width = 100;
  highlight.setAttribute('style', `transform: translateX(${width * index}%)`);
}

function updateModeUI(
  mode: ContextMode,
  screenshotBtn: HTMLElement,
  dropZone: HTMLElement,
  contentPreview: HTMLElement
): void {
  screenshotBtn.classList.toggle('hidden', mode !== 'screenshot');
  dropZone.classList.toggle('hidden', mode !== 'screenshot');
  contentPreview.classList.toggle('hidden', mode === 'screenshot' && !currentScreenshot);
}

function setupDragAndDrop(
  dropZone: HTMLElement,
  contentPreview: HTMLElement,
  fileInput: HTMLInputElement
): void {
  const preventDefault = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle drag and drop events
  dropZone.addEventListener('dragenter', preventDefault);
  dropZone.addEventListener('dragover', preventDefault);
  dropZone.addEventListener('dragleave', preventDefault);
  dropZone.addEventListener('drop', async (e: DragEvent) => {
    preventDefault(e);
    const files = e.dataTransfer?.files;
    if (files?.[0]) {
      await handleImageFile(files[0], contentPreview);
    }
  });

  // Handle file input
  fileInput.addEventListener('change', async () => {
    const files = fileInput.files;
    if (files?.[0]) {
      await handleImageFile(files[0], contentPreview);
    }
  });

  // Handle click to upload
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
}

async function handleImageFile(file: File, contentPreview: HTMLElement): Promise<void> {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    if (dataUrl) {
      currentScreenshot = dataUrl;
      displayImage(dataUrl, contentPreview);
    }
  };
  reader.readAsDataURL(file);
}

function displayImage(dataUrl: string, contentPreview: HTMLElement): void {
  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.maxWidth = '100%';
  contentPreview.innerHTML = '';
  contentPreview.appendChild(img);
  contentPreview.classList.remove('hidden');
}

export function getPageContent(): string {
  switch (currentMode) {
    case 'page':
      return document.body.innerText;
    case 'selection': {
      const selection = window.getSelection();
      return selection ? selection.toString() : '';
    }
    case 'screenshot':
      return currentScreenshot || '';
    default:
      return '';
  }
} 