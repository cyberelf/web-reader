/// <reference types="chrome"/>

type ContextMode = 'page' | 'selection' | 'screenshot' | 'youtube';

let currentMode: ContextMode = 'page';
let currentScreenshot: string | null = null;
let lastSelection: string = '';
let youtubeSubtitles: string = '';
let contentPreviewElement: HTMLElement | null = null;

interface SubtitleSegment {
  utf8: string;
  tOffsetMs?: number;
  acAsrConf?: number;
}

interface SubtitleEvent {
  tStartMs: number;
  dDurationMs: number;
  wWinId?: number;
  segs?: SubtitleSegment[];
}

interface SubtitleResponse {
  wireMagic: string;
  events: SubtitleEvent[];
}

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
        container.innerHTML = `
          <div id="drop-zone">
            <p>Take a screenshot or drag and drop an image here</p>
          </div>
        `;
        currentScreenshot = null;
      }
    });
  }
}

function isYouTubePage(): boolean {
  return window.location.hostname === 'www.youtube.com' && window.location.pathname.includes('/watch');
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchYouTubeSubtitles(): Promise<void> {
  if (!isYouTubePage()) return;

  try {
    console.log('Starting YouTube subtitles fetch...');
    // Get YouTube player and subtitle button
    const player = document.querySelector('.html5-video-player');
    const subtitleButton = document.querySelector('.ytp-subtitles-button') as HTMLButtonElement;
    const video = document.querySelector('video');
    
    if (!player || !subtitleButton || !video) {
      console.error('Missing elements:', {
        player: !!player,
        subtitleButton: !!subtitleButton,
        video: !!video
      });
      youtubeSubtitles = 'YouTube player elements not found';
      return;
    }

    // Create a promise to capture the subtitle request
    const subtitleRequestPromise = new Promise<string>((resolve, reject) => {
      console.log('Setting up performance observer...');
      
      // Create a PerformanceObserver to watch for subtitle requests
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          const url = (entry as PerformanceResourceTiming).name;
          console.log('Observed request:', url);
          
          if (url.includes('youtube.com/api/timedtext')) {
            console.log('Found subtitle request:', url);
            observer.disconnect();
            
            // Fetch the subtitles
            fetch(url)
              .then(response => response.text())
              .then(text => {
                console.log('Subtitle response received, length:', text.length);
                resolve(text);
              })
              .catch(error => {
                console.error('Error fetching subtitles:', error);
                reject(error);
              });
          }
        }
      });

      // Start observing network requests
      observer.observe({ entryTypes: ['resource'] });

      // Clean up observer after timeout
      setTimeout(() => {
        observer.disconnect();
      }, 5000);
    });

    // Enable subtitles if they're not already enabled
    if (subtitleButton.getAttribute('aria-pressed') === 'false') {
      console.log('Enabling subtitles...');
      subtitleButton.click();
      // Add a small delay after clicking
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Subtitles enabled, button state:', subtitleButton.getAttribute('aria-pressed'));
    } else {
      console.log('Subtitles already enabled');
      // Toggle off and on to trigger request
      console.log('Toggling subtitles to trigger request...');
      subtitleButton.click(); // off
      await new Promise(resolve => setTimeout(resolve, 100));
      subtitleButton.click(); // on
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for the subtitle request with a timeout
    console.log('Waiting for subtitle request...');
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        console.error('Subtitle request timed out after 5 seconds');
        reject(new Error('Subtitle request timeout'));
      }, 5000);
    });

    // Wait for either the subtitle request or timeout
    const subtitlesText = await Promise.race([subtitleRequestPromise, timeoutPromise]);
    console.log('Received subtitle text, parsing JSON...');

    // Parse the JSON response
    try {
      const subtitlesJson = JSON.parse(subtitlesText) as SubtitleResponse;
      console.log('Found events:', subtitlesJson.events?.length);
      
      // Extract text from events
      const subtitlesContent = subtitlesJson.events
        ?.filter((event: SubtitleEvent) => event.segs && event.segs.length > 0)
        ?.map((event: SubtitleEvent) => event.segs!
          .map((seg: SubtitleSegment) => seg.utf8 || '')
          .join('')
        )
        .filter((text: string | undefined): text is string => typeof text === 'string' && text.length > 0)
        .join(' ');

      console.log('Final subtitles length:', subtitlesContent?.length);
      youtubeSubtitles = subtitlesContent || 'No subtitles content found';

    } catch (error) {
      console.error('Failed to parse subtitles JSON:', error);
      youtubeSubtitles = 'Failed to parse subtitles';
    }

  } catch (error) {
    console.error('Failed to fetch YouTube subtitles:', error);
    youtubeSubtitles = 'Failed to load subtitles';
  }
}

function clearPreview(): void {
  if (contentPreviewElement) {
    contentPreviewElement.textContent = 'No text selected. Select some text on the page to analyze it.';
  }
  lastSelection = '';
}

function updatePreview(text: string): void {
  if (contentPreviewElement) {
    lastSelection = text;
    contentPreviewElement.textContent = text.length > 50 
      ? text.substring(0, 50) + '...'
      : text;
  }
}

function handleSelectionChange(): void {
  if (currentMode !== 'selection') return;

  const selection = window.getSelection();
  if (!selection) {
    clearPreview();
    return;
  }

  // Ignore selections within the sidebar
  const sidebar = document.getElementById('ai-page-reader-sidebar');
  if (sidebar?.contains(selection.anchorNode)) {
    return;
  }

  // Only clear if the selection is actually empty
  if (selection.isCollapsed && !lastSelection) {
    clearPreview();
    return;
  }

  // Get the selected text
  const selectedText = selection.toString().trim();
  
  // Only update if there's actual text selected or if we're clearing an existing selection
  if (selectedText) {
    updatePreview(selectedText);
  } else if (!selectedText && lastSelection) {
    clearPreview();
  }
}

function setupEventListeners(contentPreview: HTMLElement): void {
  contentPreviewElement = contentPreview;
  document.addEventListener('selectionchange', handleSelectionChange);
}

function createDownloadButton(preview: HTMLElement): HTMLButtonElement {
  let downloadButton = preview.querySelector('.download-subtitles') as HTMLButtonElement;
  if (!downloadButton) {
    downloadButton = document.createElement('button');
    downloadButton.className = 'download-subtitles';
    downloadButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`;
    downloadButton.title = 'Download Subtitles';
    
    downloadButton.addEventListener('click', () => {
      if (youtubeSubtitles && youtubeSubtitles !== 'No subtitles content found') {
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || 'youtube_subtitles';
        downloadText(youtubeSubtitles, `${videoTitle}.txt`);
      }
    });
  }
  return downloadButton;
}

async function updateYouTubeUI(preview: HTMLElement): Promise<void> {
  const downloadButton = createDownloadButton(preview);

  if (!isYouTubePage()) {
    preview.textContent = 'This mode only works on YouTube video pages';
    downloadButton.style.display = 'none';
    return;
  }

  if (!youtubeSubtitles) {
    preview.textContent = 'Loading YouTube subtitles...';
    downloadButton.style.display = 'none';
    await fetchYouTubeSubtitles();
  }

  if (youtubeSubtitles && youtubeSubtitles !== 'No subtitles content found' && youtubeSubtitles !== 'Failed to load subtitles') {
    preview.innerHTML = `<div class="subtitles-preview">${youtubeSubtitles.substring(0, 200)}...</div>`;
    preview.appendChild(downloadButton);
    downloadButton.style.display = 'flex';
  } else {
    preview.textContent = youtubeSubtitles || 'No subtitles available';
    downloadButton.style.display = 'none';
  }
}

async function updateModeUI(mode: ContextMode, screenshotBtn: HTMLElement, dropZone: HTMLElement, preview: HTMLElement): Promise<void> {
  screenshotBtn.classList.toggle('hidden', mode !== 'screenshot');
  dropZone.classList.toggle('hidden', mode !== 'screenshot');
  
  if (mode === 'screenshot') {
    if (!currentScreenshot) {
      preview.innerHTML = '';
      dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
      preview.appendChild(dropZone);
    } else {
      displayImage(currentScreenshot, preview);
    }
  } else if (mode === 'page') {
    const pageContent = document.body.innerText.trim();
    preview.textContent = pageContent.length > 50 
      ? pageContent.substring(0, 50) + '... (Full page will be analyzed)'
      : pageContent;
  } else if (mode === 'selection') {
    preview.textContent = lastSelection
      ? lastSelection.length > 50 
        ? lastSelection.substring(0, 50) + '...'
        : lastSelection
      : 'No text selected. Select some text on the page to analyze it.';
  } else if (mode === 'youtube') {
    await updateYouTubeUI(preview);
  }
}

export function setupContextModes(): void {
  const sliderContainer = document.querySelector('.ai-slider-container');
  const sliderHighlight = document.querySelector('.ai-slider-highlight');
  const dropZone = document.getElementById('ai-drop-zone');
  const contentPreview = document.getElementById('ai-content-preview');
  const screenshotBtn = document.getElementById('ai-screenshot-btn');
  const fileInput = document.getElementById('ai-file-input') as HTMLInputElement;
  const toggleButton = document.getElementById('ai-page-reader-toggle');
  const sidebar = document.getElementById('ai-page-reader-sidebar');

  if (!sliderContainer || !sliderHighlight || !dropZone || !contentPreview || !screenshotBtn || !fileInput) {
    console.error('Required elements not found, retrying in 100ms');
    setupContextModes(); // Retry setup
    return;
  }

  // Set up event listeners
  setupEventListeners(contentPreview);

  function updateHighlight(index: number, highlight: Element): void {
    highlight.setAttribute('style', `transform: translateX(${index * 100}%)`);
  }

  // Set up mode switching
  const options = sliderContainer.querySelectorAll('.ai-slider-option');
  options.forEach((option, index) => {
    option.addEventListener('click', () => {
      const mode = option.getAttribute('data-mode') as ContextMode;
      if (!mode) return;

      currentMode = mode;
      if (mode !== 'screenshot') {
        currentScreenshot = null;
      }
      updateHighlight(index, sliderHighlight);
      updateModeUI(mode, screenshotBtn, dropZone, contentPreview).catch(error => {
        console.error('Failed to update mode UI:', error);
        contentPreview.textContent = 'Failed to update content';
      });
    });
  });

  // Initialize with page content
  updateModeUI('page', screenshotBtn, dropZone, contentPreview);

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
}

function setupImageDrop(dropZone: HTMLElement, preview: HTMLElement): void {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Handle drag enter/leave
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', handleDrop, false);

  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight(e: Event): void {
    dropZone.classList.add('drag-over');
  }

  function unhighlight(e: Event): void {
    dropZone.classList.remove('drag-over');
  }

  function handleDrop(e: DragEvent): void {
    const dt = e.dataTransfer;
    if (!dt) return;

    const files = dt.files;
    handleFiles(files);
  }

  function handleFiles(files: FileList): void {
    if (files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      console.error('Please drop an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        currentScreenshot = reader.result;
        displayImage(reader.result, preview);
      }
    };
    reader.onerror = () => {
      console.error('Error reading file');
    };
    reader.readAsDataURL(file);
  }

  // Handle click to upload
  dropZone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      if (input.files) {
        handleFiles(input.files);
      }
      document.body.removeChild(input);
    });

    input.click();
  });
}

export function getPageContent(): string {
  switch (currentMode) {
    case 'page':
      return document.body.innerText;
    case 'selection':
      return lastSelection || window.getSelection()?.toString() || '';
    case 'screenshot':
      return currentScreenshot || '';
    case 'youtube':
      return youtubeSubtitles || 'No YouTube subtitles available';
    default:
      return '';
  }
} 