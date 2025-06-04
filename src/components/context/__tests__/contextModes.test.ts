/// <reference types="jest" />

// Mock chrome API before imports
const mockChrome = {
  runtime: {
    sendMessage: jest.fn().mockImplementation((message) => {
      if (message.action === 'takeScreenshot') {
        return Promise.resolve('data:image/png;base64,test');
      }
    }),
  },
};

(globalThis as any).chrome = mockChrome;

import { setupContextModes, getPageContent } from '../contextModes';

describe('Context Modes', () => {
  let container: HTMLDivElement;
  let contentPreview: HTMLDivElement;
  let screenshotBtn: HTMLButtonElement;
  let options: NodeListOf<Element>;
  let highlight: HTMLElement;
  let toggleButton: HTMLButtonElement;
  let sidebar: HTMLDivElement;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Setup DOM elements
    container = document.createElement('div');
    container.innerHTML = `
      <div class="ai-slider-container">
        <div class="ai-slider-option" data-mode="page">Full Page</div>
        <div class="ai-slider-option" data-mode="selection">Selection</div>
        <div class="ai-slider-option" data-mode="element">Element</div>
        <div class="ai-slider-option" data-mode="screenshot">Screenshot</div>
        <div class="ai-slider-option" data-mode="youtube">YouTube</div>
        <div class="ai-slider-highlight"></div>
      </div>
      <button id="ai-screenshot-btn">Take Screenshot</button>
      <div id="ai-drop-zone">Drop zone</div>
      <div id="ai-content-preview"></div>
      <input type="file" id="ai-file-input" />
    `;
    document.body.appendChild(container);

    // Get elements
    contentPreview = document.getElementById('ai-content-preview') as HTMLDivElement;
    screenshotBtn = document.getElementById('ai-screenshot-btn') as HTMLButtonElement;
    options = document.querySelectorAll('.ai-slider-option');
    highlight = document.querySelector('.ai-slider-highlight') as HTMLElement;

    // Add toggle button and sidebar
    toggleButton = document.createElement('button');
    toggleButton.id = 'page-reader-toggle';
    document.body.appendChild(toggleButton);

    sidebar = document.createElement('div');
    sidebar.id = 'page-reader-sidebar';
    document.body.appendChild(sidebar);

    // Reset Chrome runtime mock
    (chrome.runtime.sendMessage as jest.Mock).mockClear();

    // Mock document.body.innerText
    Object.defineProperty(document.body, 'innerText', {
      value: 'Page content',
      writable: true
    });

    // Mock window.getSelection
    window.getSelection = jest.fn().mockReturnValue({
      toString: () => 'Selected text'
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('setupContextModes', () => {
    it('should set up mode switching', () => {
      setupContextModes();
      jest.advanceTimersByTime(100);

      // Click selection mode
      options[1].dispatchEvent(new Event('click'));
      expect(highlight.style.transform).toBe('translateX(100%)');
      expect(screenshotBtn.classList.contains('hidden')).toBe(true);

      // Click element mode
      options[2].dispatchEvent(new Event('click'));
      expect(highlight.style.transform).toBe('translateX(200%)');
      expect(screenshotBtn.classList.contains('hidden')).toBe(true);

      // Click screenshot mode
      options[3].dispatchEvent(new Event('click'));
      expect(highlight.style.transform).toBe('translateX(300%)');
      expect(screenshotBtn.classList.contains('hidden')).toBe(false);
    });

    it('should handle screenshot button click', async () => {
      setupContextModes();
      jest.advanceTimersByTime(100);

      // Switch to screenshot mode first
      options[3].dispatchEvent(new Event('click'));

      // Take screenshot
      const screenshotPromise = new Promise<void>((resolve) => {
        const originalOnClick = screenshotBtn.onclick;
        screenshotBtn.onclick = async (e) => {
          if (originalOnClick) {
            await (originalOnClick as any)(e);
          }
          resolve();
        };
      });

      screenshotBtn.click();
      jest.advanceTimersByTime(100); // Wait for UI hide
      await screenshotPromise;
      jest.advanceTimersByTime(100); // Wait for UI show

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'takeScreenshot' });
      const img = contentPreview.querySelector('img');
      expect(img?.src).toBe('data:image/png;base64,test');
    }, 10000); // Increase timeout for this test
  });

  describe('getPageContent', () => {
    beforeEach(() => {
      setupContextModes();
      jest.advanceTimersByTime(100);
    });

    it('should return page content in page mode', () => {
      options[0].dispatchEvent(new Event('click')); // Switch to page mode
      expect(getPageContent()).toBe('Page content');
    });

    it('should return selected text in selection mode', () => {
      options[1].dispatchEvent(new Event('click')); // Switch to selection mode
      expect(getPageContent()).toBe('Selected text');
    });

    it('should return element text in element mode', () => {
      options[2].dispatchEvent(new Event('click')); // Switch to element mode
      expect(getPageContent()).toBe('No element selected');
    });

    it('should return screenshot data in screenshot mode', async () => {
      options[3].dispatchEvent(new Event('click')); // Switch to screenshot mode

      // Take screenshot
      const screenshotPromise = new Promise<void>((resolve) => {
        const originalOnClick = screenshotBtn.onclick;
        screenshotBtn.onclick = async (e) => {
          if (originalOnClick) {
            await (originalOnClick as any)(e);
          }
          resolve();
        };
      });

      screenshotBtn.click();
      jest.advanceTimersByTime(100); // Wait for UI hide
      await screenshotPromise;
      jest.advanceTimersByTime(100); // Wait for UI show

      expect(getPageContent()).toBe('data:image/png;base64,test');
    }, 10000); // Increase timeout for this test
  });
}); 