/// <reference types="chrome"/>

import { t } from '../../utils/i18n';

type ContextMode = 'page' | 'selection' | 'screenshot' | 'video' | 'element';

let currentMode: ContextMode = 'page';
let currentScreenshot: string | null = null;
let lastSelection: string = '';
let videoSubtitles: string = '';
let contentPreviewElement: HTMLElement | null = null;
let isElementSelectionActive: boolean = false;
let selectedElement: HTMLElement | null = null;
let selectedElementText: string = '';

// Try to recover element selection from sessionStorage on initialization
try {
  const storedText = sessionStorage.getItem('ai-selected-element-text');
  if (storedText) {
    selectedElementText = storedText;
  }
} catch (error) {
  console.warn('Could not recover element selection from sessionStorage on init:', error);
}
let elementHighlight: HTMLElement | null = null;

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

// Bilibili subtitle interfaces - Updated based on actual API response
interface BilibiliSubtitleItem {
  from: number;
  to: number;
  sid: number;
  location: number;
  content: string;
  music: number;
}

interface BilibiliSubtitleData {
  font_size: number;
  font_color: string;
  background_alpha: number;
  background_color: string;
  Stroke: string;
  type: string;
  lang: string;
  version: string;
  body: BilibiliSubtitleItem[];
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

function isBilibiliPage(): boolean {
  return window.location.hostname === 'www.bilibili.com' && 
         (window.location.pathname.includes('/video/') || 
          window.location.pathname.includes('/medialist/play/'));
}

function isVideoPage(): boolean {
  return isYouTubePage() || isBilibiliPage();
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

function createElementHighlight(): HTMLElement {
  const highlight = document.createElement('div');
  highlight.id = 'ai-element-highlight';
  highlight.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid #007bff;
    background-color: rgba(0, 123, 255, 0.1);
    z-index: 999999;
    border-radius: 4px;
    transition: all 0.2s ease;
    box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
  `;
  document.body.appendChild(highlight);
  return highlight;
}

function highlightElement(element: HTMLElement): void {
  if (!elementHighlight) {
    elementHighlight = createElementHighlight();
  }
  
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  elementHighlight.style.top = (rect.top + scrollTop) + 'px';
  elementHighlight.style.left = (rect.left + scrollLeft) + 'px';
  elementHighlight.style.width = rect.width + 'px';
  elementHighlight.style.height = rect.height + 'px';
  elementHighlight.style.display = 'block';
}

function removeElementHighlight(): void {
  if (elementHighlight) {
    elementHighlight.style.display = 'none';
  }
}

function startElementSelection(): void {
  isElementSelectionActive = true;
  document.body.style.cursor = 'crosshair';
  
  // Add event listeners for element selection
  document.addEventListener('mouseover', handleElementHover, true);
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('keydown', handleElementSelectionKeydown, true);
  
  // Show instruction overlay
  showElementSelectionInstructions();
}

function stopElementSelection(): void {
  isElementSelectionActive = false;
  document.body.style.cursor = '';
  
  // Remove event listeners
  document.removeEventListener('mouseover', handleElementHover, true);
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('keydown', handleElementSelectionKeydown, true);
  
  removeElementHighlight();
  hideElementSelectionInstructions();
}

function handleElementHover(event: MouseEvent): void {
  if (!isElementSelectionActive) return;
  
  const target = event.target as HTMLElement;
  
  // Skip if it's our own UI elements
  if (target.closest('#ai-page-reader-sidebar') || 
      target.closest('#ai-page-reader-toggle') ||
      target.closest('#ai-element-highlight') ||
      target.closest('#ai-element-selection-instructions')) {
    return;
  }
  
  highlightElement(target);
}

function handleElementClick(event: MouseEvent): void {
  if (!isElementSelectionActive) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const target = event.target as HTMLElement;
  
  // Skip if it's our own UI elements
  if (target.closest('#ai-page-reader-sidebar') || 
      target.closest('#ai-page-reader-toggle') ||
      target.closest('#ai-element-highlight') ||
      target.closest('#ai-element-selection-instructions')) {
    return;
  }
  
  selectedElement = target;
  selectedElementText = extractElementText(target);
  
  // Store the element text and selection info in sessionStorage for persistence
  try {
    sessionStorage.setItem('ai-selected-element-text', selectedElementText);
    // Store element selector info to help re-find the element if needed
    const elementPath = getElementPath(target);
    sessionStorage.setItem('ai-selected-element-path', elementPath);
  } catch (error) {
    console.warn('Could not store element selection in sessionStorage:', error);
  }
  
  stopElementSelection();
  updateElementPreview();
}

function handleElementSelectionKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    stopElementSelection();
  }
}

function getElementPath(element: HTMLElement): string {
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break; // IDs are unique, so we can stop here
    } else if (current.className) {
      const classes = current.className.split(' ').filter(cls => cls.trim()).slice(0, 2); // Limit to first 2 classes
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    // Add nth-child if needed for specificity
    const siblings = Array.from(current.parentNode?.children || []);
    const sameTagSiblings = siblings.filter(sibling => sibling.tagName === current.tagName);
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;
    }
    
    path.unshift(selector);
    current = current.parentElement as HTMLElement;
  }
  
  return path.join(' > ');
}

function extractElementText(element: HTMLElement): string {
  // Get text content, but clean it up
  let text = element.innerText || element.textContent || '';
  
  // Remove extra whitespace and normalize
  text = text.replace(/\s+/g, ' ').trim();
  
  // If the element has very little text, try to get more context
  if (text.length < 10) {
    // Try to get text from child elements
    const children = element.querySelectorAll('*');
    const allText = Array.from(children)
      .map(child => child.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (allText.length > text.length) {
      text = allText;
    }
  }
  
  return text;
}

function updateElementPreview(): void {
  if (contentPreviewElement && selectedElementText) {
    const preview = selectedElementText.length > 100 
      ? selectedElementText.substring(0, 100) + '...'
      : selectedElementText;
    
    contentPreviewElement.innerHTML = `
      <div class="element-selection-preview">
        <div class="element-info">
          <strong>${t('sidebar.preview.selectedElement')}:</strong> ${selectedElement?.tagName.toLowerCase() || 'unknown'}
          ${selectedElement?.className ? `<span class="element-class">.${selectedElement.className.split(' ')[0]}</span>` : ''}
        </div>
        <div class="element-text">${preview}</div>
        <button class="reselect-element-btn">${t('sidebar.preview.reselectElement')}</button>
      </div>
    `;
    
    // Add event listener to reselect button
    const reselectBtn = contentPreviewElement.querySelector('.reselect-element-btn');
    reselectBtn?.addEventListener('click', () => {
      startElementSelection();
    });
  }
}

function showElementSelectionInstructions(): void {
  const instructions = document.createElement('div');
  instructions.id = 'ai-element-selection-instructions';
  instructions.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 20px;
    border-radius: 8px;
    z-index: 1000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;
  instructions.innerHTML = `
    <div>
      <strong>Element Selection Mode</strong><br>
      Hover over elements to highlight them<br>
      Click to select an element<br>
      Press <kbd>Escape</kbd> to cancel
    </div>
  `;
  document.body.appendChild(instructions);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    hideElementSelectionInstructions();
  }, 3000);
}

function hideElementSelectionInstructions(): void {
  const instructions = document.getElementById('ai-element-selection-instructions');
  if (instructions) {
    instructions.remove();
  }
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
      videoSubtitles = 'YouTube player elements not found';
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
      videoSubtitles = subtitlesContent || 'No subtitles content found';

    } catch (error) {
      console.error('Failed to parse subtitles JSON:', error);
      videoSubtitles = 'Failed to parse subtitles';
    }

  } catch (error) {
    console.error('Failed to fetch YouTube subtitles:', error);
    videoSubtitles = 'Failed to load subtitles';
  }
}

async function fetchBilibiliSubtitles(): Promise<void> {
  if (!isBilibiliPage()) return;

  try {
    console.log('Starting Bilibili subtitles fetch...');
    
    // Wait for page to be fully loaded
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(void 0);
      } else {
        window.addEventListener('load', () => resolve(void 0), { once: true });
      }
    });

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try multiple selectors for Bilibili video player
    const playerSelectors = [
      '.bpx-player-container',
      '.bilibili-player-video-wrap',
      '.bilibili-player',
      '.player-wrap',
      '.bpx-player'
    ];
    
    const videoSelectors = [
      'video',
      '.bpx-player-video video',
      '.bilibili-player-video video'
    ];

    let player: Element | null = null;
    let video: Element | null = null;

    // Try to find player with multiple selectors
    for (const selector of playerSelectors) {
      player = document.querySelector(selector);
      if (player) {
        console.log('Found player with selector:', selector);
        break;
      }
    }

    // Try to find video with multiple selectors
    for (const selector of videoSelectors) {
      video = document.querySelector(selector);
      if (video) {
        console.log('Found video with selector:', selector);
        break;
      }
    }
    
    if (!player || !video) {
      console.error('Missing Bilibili elements:', {
        player: !!player,
        video: !!video,
        url: window.location.href,
        readyState: document.readyState
      });
      
      // Try alternative detection method
      const hasVideoInUrl = window.location.pathname.includes('/video/');
      const hasPlayerElements = document.querySelector('video') !== null;
      
      if (hasVideoInUrl && hasPlayerElements) {
        console.log('Using fallback detection for Bilibili');
        // Continue with subtitle extraction using available elements
      } else {
        videoSubtitles = 'Bilibili player elements not found. Please ensure the video page is fully loaded.';
        return;
      }
    }

    // Set up request interception for manual subtitle activation
    console.log('🎯 Ready to capture Bilibili subtitle requests...');
    console.log('👆 Please manually click the subtitle button (CC/字幕) on the video player');

    // Create a promise to capture subtitle requests with multiple approaches
    const subtitleRequestPromise = new Promise<string>((resolve, reject) => {
      console.log('Setting up Bilibili subtitle observer...');
      
      // Check multiple URL patterns for subtitle requests
      const subtitleUrlPatterns = [
        'aisubtitle.hdslb.com',
        'i0.hdslb.com/bfs/subtitle',
        'hdslb.com/bfs/ai_subtitle',
        'bfs/ai_subtitle',
        'bfs/subtitle'
      ];
      
      // Enhanced logging for debugging
      console.log('🔍 Starting request monitoring for manual subtitle activation...');
      console.log('🎯 Will capture requests matching:', subtitleUrlPatterns);

      let requestCaptured = false;
      
      // Method 1: PerformanceObserver
      const observer = new PerformanceObserver((list) => {
        if (requestCaptured) return;
        
        const entries = list.getEntries();
        
        for (const entry of entries) {
          const url = (entry as PerformanceResourceTiming).name;
          
          const matchesPattern = subtitleUrlPatterns.some(pattern => 
            url.includes(pattern)
          );
          
          if (matchesPattern) {
            console.log('🎯 Subtitle request found:', url);
            requestCaptured = true;
            observer.disconnect();
            
            fetch(url, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': navigator.userAgent
              },
              credentials: 'omit'
            })
              .then(response => {
                console.log('📡 Response status:', response.status, response.statusText);
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
              })
              .then(text => {
                console.log('✅ Subtitle response received, length:', text.length);
                if (text.includes('字幕样式测试') || text.includes('字幕设置')) {
                  console.log('⚠️ Received placeholder subtitle response, continuing to monitor...');
                  requestCaptured = false; // Reset to continue monitoring
                  return;
                }
                resolve(text);
              })
              .catch(error => {
                console.error('❌ Error fetching subtitle response:', error);
                requestCaptured = false; // Reset to continue monitoring
              });
            return;
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });

      // Method 2: Fetch override
      const originalFetch = window.fetch;
      const fetchOverride = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        
        // Check if this is a subtitle request
        const isSubtitleRequest = subtitleUrlPatterns.some(pattern => url.includes(pattern));
        
        if (isSubtitleRequest && !requestCaptured) {
          console.log('🎯 Subtitle request intercepted via fetch:', url);
          requestCaptured = true;
          observer.disconnect();
          window.fetch = originalFetch; // Restore original fetch
          
          // Update UI to show we're processing
          const videoPreview = document.querySelector('.video-loading');
          if (videoPreview) {
            videoPreview.innerHTML = `
              <div class="video-loading">
                <p>Processing Bilibili subtitles...</p>
                <small>Subtitle request detected</small>
                <div class="loading-spinner"></div>
              </div>
            `;
          }
          
          // Let the original request proceed and capture its response
          try {
            const response = await originalFetch(input, init);
            const responseClone = response.clone();
            const text = await responseClone.text();
            console.log('✅ Fetch subtitle response intercepted, length:', text.length);
            
            // Check for placeholder content
            if (text.includes('字幕样式测试') || text.includes('字幕设置')) {
              console.log('⚠️ Received placeholder subtitle response via fetch, continuing to monitor...');
              requestCaptured = false; // Reset to continue monitoring
              window.fetch = fetchOverride; // Keep monitoring
              return response;
            }
            
            resolve(text);
            return response; // Return original response to not break the page
          } catch (error) {
            console.error('❌ Error intercepting fetch subtitle response:', error);
            requestCaptured = false; // Reset to continue monitoring
            window.fetch = fetchOverride; // Keep monitoring
            return originalFetch(input, init); // Fallback to original fetch
          }
        }
        
        return originalFetch(input, init);
      };
      
      window.fetch = fetchOverride;

      // Method 3: XMLHttpRequest interception
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(this: XMLHttpRequest & { _interceptUrl?: string }, method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
        this._interceptUrl = url.toString();
        return originalXHROpen.call(this, method, url, async, username, password);
      };
      
      XMLHttpRequest.prototype.send = function(this: XMLHttpRequest & { _interceptUrl?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
        if (this._interceptUrl && !requestCaptured) {
          const isSubtitleRequest = subtitleUrlPatterns.some(pattern => this._interceptUrl!.includes(pattern));
          
          if (isSubtitleRequest) {
            console.log('🎯 Bilibili subtitle request intercepted via XHR:', this._interceptUrl);
            requestCaptured = true;
            observer.disconnect();
            window.fetch = originalFetch;
            
            this.addEventListener('load', () => {
              if (this.status === 200) {
                console.log('✅ XHR subtitle response received, length:', this.responseText.length);
                
                // Check for placeholder content
                if (this.responseText.includes('字幕样式测试') || this.responseText.includes('字幕设置')) {
                  console.log('⚠️ Received placeholder subtitle response via XHR, continuing to monitor...');
                  requestCaptured = false; // Reset to continue monitoring
                  return;
                }
                
                resolve(this.responseText);
              } else {
                reject(new Error(`XHR failed with status ${this.status}`));
              }
            });
            
            this.addEventListener('error', () => {
              reject(new Error('XHR request failed'));
            });
          }
        }
        
        return originalXHRSend.call(this, body);
      };

      // Extended timeout for manual clicking - giving users 30 seconds
      setTimeout(() => {
        observer.disconnect();
        window.fetch = originalFetch; // Restore original fetch
        XMLHttpRequest.prototype.open = originalXHROpen; // Restore original XHR
        XMLHttpRequest.prototype.send = originalXHRSend;
        if (!requestCaptured) {
          reject(new Error('Bilibili subtitle request timeout - please try clicking the subtitle button again'));
        }
      }, 30000); // Extended to 30 seconds
    });

    // Wait for subtitle request or timeout
    try {
      const subtitlesText = await subtitleRequestPromise;
      console.log('Parsing Bilibili subtitle JSON...');

      const subtitlesJson = JSON.parse(subtitlesText) as BilibiliSubtitleData;
      
      if (subtitlesJson.body && Array.isArray(subtitlesJson.body)) {
        // Sort by timestamp for proper order
        const sortedSubtitles = subtitlesJson.body.sort((a, b) => a.from - b.from);
        
        const subtitlesContent = sortedSubtitles
          .map((item: BilibiliSubtitleItem) => item.content)
          .filter((content: string) => content && content.trim().length > 0)
          .join(' ');

        console.log('Final Bilibili subtitles length:', subtitlesContent.length);
        console.log('Subtitle language:', subtitlesJson.lang);
        console.log('Subtitle type:', subtitlesJson.type);
        
        if (subtitlesContent && subtitlesContent.length > 0) {
          videoSubtitles = subtitlesContent;
          console.log('✅ Bilibili subtitles successfully loaded, length:', subtitlesContent.length);
          
          // Refresh the UI immediately when subtitles are captured
          const preview = document.getElementById('ai-content-preview');
          if (preview && currentMode === 'video') {
            await updateVideoUI(preview);
          }
        } else {
          videoSubtitles = 'No subtitle content found in response';
        }
      } else {
        console.log('Unexpected JSON structure, trying alternative parsing...');
        // Try alternative JSON structure for different subtitle formats
        if (subtitlesJson && typeof subtitlesJson === 'object') {
          // Check if it's a different subtitle format
          const jsonString = JSON.stringify(subtitlesJson);
          if (jsonString.includes('content') && jsonString.length > 100) {
            // Try to extract any content fields from the JSON
            const contentMatches = jsonString.match(/"content":"([^"]+)"/g);
            if (contentMatches && contentMatches.length > 0) {
              const extractedContent = contentMatches
                .map(match => match.replace(/"content":"([^"]+)"/, '$1'))
                .join(' ');
              videoSubtitles = extractedContent || 'Partial subtitle content extracted';
              
              // Refresh the UI immediately when subtitles are captured
              const preview = document.getElementById('ai-content-preview');
              if (preview && currentMode === 'video' && extractedContent) {
                await updateVideoUI(preview);
              }
            } else {
              videoSubtitles = 'Subtitles found but content could not be extracted';
            }
          } else {
            videoSubtitles = 'No subtitle content found';
          }
        } else {
          videoSubtitles = 'Invalid subtitle response format';
        }
      }

    } catch (error) {
      console.error('Failed to fetch Bilibili subtitles via request interception:', error);
      
      // Only use request interception - no DOM extraction fallback
      const hasVideo = document.querySelector('video') !== null;
      if (hasVideo) {
        videoSubtitles = 'No subtitle requests captured. Please click the subtitle button (CC/字幕) on the video player to enable subtitles, then try again.';
      } else {
        videoSubtitles = 'No video found on this page.';
      }
    }

  } catch (error) {
    console.error('Failed to fetch Bilibili subtitles:', error);
    videoSubtitles = 'Failed to load subtitles. Please ensure the page is fully loaded and try again.';
  }
}

async function fetchVideoSubtitles(): Promise<void> {
  if (isYouTubePage()) {
    await fetchYouTubeSubtitles();
  } else if (isBilibiliPage()) {
    await fetchBilibiliSubtitles();
  } else {
    videoSubtitles = t('sidebar.preview.videoOnly');
  }
}

function clearPreview(): void {
  if (contentPreviewElement) {
    contentPreviewElement.textContent = t('sidebar.preview.noSelection');
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
  const selection = window.getSelection();
  if (!selection) {
    if (currentMode === 'selection') {
      clearPreview();
    }
    return;
  }

  // Ignore selections within the sidebar
  const sidebar = document.getElementById('ai-page-reader-sidebar');
  if (sidebar?.contains(selection.anchorNode)) {
    return;
  }

  // Get the selected text
  const selectedText = selection.toString().trim();
  
  // Always update lastSelection for any text selection
  if (selectedText) {
    lastSelection = selectedText;
    // Only update UI preview if in selection mode
    if (currentMode === 'selection') {
      updatePreview(selectedText);
    }
  } else if (!selectedText) {
    // Clear lastSelection when no text is selected
    lastSelection = '';
    // Only update UI preview if in selection mode
    if (currentMode === 'selection') {
      clearPreview();
    }
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
      if (videoSubtitles && videoSubtitles !== 'No subtitles content found') {
        let videoTitle = 'video_subtitles';
        
        if (isYouTubePage()) {
          videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || 'youtube_subtitles';
        } else if (isBilibiliPage()) {
          videoTitle = document.querySelector('.video-title, h1[title]')?.textContent?.trim() || 'bilibili_subtitles';
        }
        
        downloadText(videoSubtitles, `${videoTitle}.txt`);
      }
    });
  }
  return downloadButton;
}

async function updateVideoUI(preview: HTMLElement): Promise<void> {
  const downloadButton = createDownloadButton(preview);

  if (!isVideoPage()) {
    preview.innerHTML = `
      <div class="video-mode-message">
        <p>${t('sidebar.preview.videoOnly')}</p>
        <small>Supports YouTube and Bilibili videos</small>
      </div>
    `;
    downloadButton.style.display = 'none';
    return;
  }

  // Show loading state with video platform info
  if (!videoSubtitles) {
    const platform = isYouTubePage() ? 'YouTube' : isBilibiliPage() ? 'Bilibili' : 'Video';
    
    if (isBilibiliPage()) {
      // For Bilibili, show clear manual instruction
      preview.innerHTML = `
        <div class="video-loading">
          <p>Ready to capture ${platform} subtitles</p>
          <small>👆 Click the subtitle button (CC/字幕) on the video player, then wait</small>
          <div class="loading-spinner"></div>
        </div>
      `;
    } else {
      // For YouTube, show normal loading
      preview.innerHTML = `
        <div class="video-loading">
          <p>${t('sidebar.preview.loading')}</p>
          <small>Extracting ${platform} subtitles...</small>
          <div class="loading-spinner"></div>
        </div>
      `;
    }
    
    downloadButton.style.display = 'none';
    
    try {
      await fetchVideoSubtitles();
      // After fetching, update the UI again with the results
      await updateVideoUI(preview);
    } catch (error) {
      console.error('Error fetching video subtitles:', error);
      videoSubtitles = 'Failed to load subtitles. Please try refreshing the page.';
      // Update UI with error state
      await updateVideoUI(preview);
    }
    return; // Exit early since we're recursively calling updateVideoUI
  }

  // Handle different subtitle states
  if (videoSubtitles && 
      !videoSubtitles.includes('No subtitles content found') && 
      !videoSubtitles.includes('Failed to load subtitles') &&
      !videoSubtitles.includes('not found') &&
      videoSubtitles !== t('sidebar.preview.videoOnly') &&
      videoSubtitles.length > 10) {
    
    // Successfully loaded subtitles
    const platform = isYouTubePage() ? 'YouTube' : 'Bilibili';
    preview.innerHTML = `
      <div class="subtitles-preview">
        <div class="subtitle-header">
          <small>${platform} Subtitles (${videoSubtitles.length} chars)</small>
        </div>
        <div class="subtitle-content">${videoSubtitles.substring(0, 200)}${videoSubtitles.length > 200 ? '...' : ''}</div>
      </div>
    `;
    preview.appendChild(downloadButton);
    downloadButton.style.display = 'flex';
    
    console.log('✅ Subtitles loaded and UI updated with download button');
  } else {
    // Failed to load or no subtitles
    const platform = isYouTubePage() ? 'YouTube' : 'Bilibili';
    const refreshButton = `<button class="refresh-subtitles" onclick="this.parentElement.innerHTML='Loading...'; setTimeout(() => location.reload(), 500)">Refresh</button>`;
    
    preview.innerHTML = `
      <div class="video-error-message">
        <p>${videoSubtitles || t('sidebar.preview.noSubtitles')}</p>
        <small>For ${platform} videos, try:</small>
        <ul>
          <li>Enabling subtitles on the video</li>
          <li>Waiting for the page to fully load</li>
          <li>Refreshing the page</li>
        </ul>
        ${refreshButton}
      </div>
    `;
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
    // Get page content excluding the sidebar for preview
    const sidebar = document.getElementById('ai-page-reader-sidebar');
    let pageContent = '';
    
    if (sidebar) {
      // Temporarily hide the sidebar to exclude it from content extraction
      const originalDisplay = sidebar.style.display;
      sidebar.style.display = 'none';
      
      pageContent = document.body.innerText.trim();
      
      // Restore sidebar visibility
      sidebar.style.display = originalDisplay;
    } else {
      pageContent = document.body.innerText.trim();
    }
    
    preview.textContent = pageContent.length > 50 
      ? pageContent.substring(0, 50) + '... (Full page will be analyzed)'
      : pageContent;
  } else if (mode === 'selection') {
    preview.textContent = lastSelection
      ? lastSelection.length > 50 
        ? lastSelection.substring(0, 50) + '...'
        : lastSelection
      : t('sidebar.preview.noSelection');
  } else if (mode === 'element') {
    if (selectedElementText) {
      updateElementPreview();
    } else {
      preview.innerHTML = `
        <div class="element-selection-prompt">
          <p>${t('sidebar.preview.selectElement')}</p>
          <button class="start-element-selection-btn">${t('sidebar.preview.selectElement')}</button>
        </div>
      `;
      
      // Add event listener to start selection button
      const startBtn = preview.querySelector('.start-element-selection-btn');
      startBtn?.addEventListener('click', () => {
        startElementSelection();
      });
    }
  } else if (mode === 'video') {
    await updateVideoUI(preview);
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
      if (mode !== 'element') {
        // Clear element selection when switching away from element mode
        selectedElementText = '';
        selectedElement = null;
        try {
          sessionStorage.removeItem('ai-selected-element-text');
          sessionStorage.removeItem('ai-selected-element-path');
        } catch (error) {
          console.warn('Could not clear element selection from sessionStorage:', error);
        }
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

// Function to clear video subtitle cache for new pages
export function clearVideoSubtitles(): void {
  videoSubtitles = '';
  console.log('Video subtitles cache cleared for new page');
}

// Export function to force refresh video subtitles
export function refreshVideoSubtitles(): Promise<void> {
  videoSubtitles = '';
  return fetchVideoSubtitles();
}

export function getPageContent(): string {
  switch (currentMode) {
    case 'page':
      // Check if there's any selected text first, use that if available
      const currentSelection = window.getSelection()?.toString()?.trim();
      if (currentSelection) {
        return currentSelection;
      }
      
      // Get page content excluding the sidebar
      const sidebar = document.getElementById('ai-page-reader-sidebar');
      if (sidebar) {
        // Temporarily hide the sidebar to exclude it from content extraction
        const originalDisplay = sidebar.style.display;
        sidebar.style.display = 'none';
        
        const pageContent = document.body.innerText;
        
        // Restore sidebar visibility
        sidebar.style.display = originalDisplay;
        
        return pageContent;
      }
      return document.body.innerText;
    case 'selection':
      return lastSelection || window.getSelection()?.toString() || '';
    case 'screenshot':
      return currentScreenshot || '';
    case 'element':
      // First try the in-memory variable
      if (selectedElementText) {
        return selectedElementText;
      }
      
      // If empty, try to recover from sessionStorage
      try {
        const storedText = sessionStorage.getItem('ai-selected-element-text');
        if (storedText) {
          selectedElementText = storedText;
          return storedText;
        }
        
        // If no stored text, try to re-extract from stored element path
        const storedPath = sessionStorage.getItem('ai-selected-element-path');
        if (storedPath) {
          const element = document.querySelector(storedPath) as HTMLElement;
          if (element) {
            selectedElementText = extractElementText(element);
            selectedElement = element;
            sessionStorage.setItem('ai-selected-element-text', selectedElementText);
            return selectedElementText;
          }
        }
      } catch (error) {
        console.warn('Could not recover element selection from sessionStorage:', error);
      }
      
      return t('sidebar.preview.selectElement');
    case 'video':
      return videoSubtitles || t('sidebar.preview.noSubtitles');
    default:
      return '';
  }
} 