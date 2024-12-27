import { setupContextModes, getPageContent } from '../contextModes';

describe('Context Modes', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Setup DOM elements
    container = document.createElement('div');
    container.innerHTML = `
      <div class="slider-container">
        <div class="slider-option" data-mode="page">Full Page</div>
        <div class="slider-option" data-mode="selection">Selection</div>
        <div class="slider-option" data-mode="screenshot">Screenshot</div>
        <div class="slider-highlight"></div>
      </div>
      <button id="screenshot-btn">Take Screenshot</button>
      <div id="drop-zone">Drop zone</div>
      <div id="content-preview"></div>
      <input type="file" id="file-input" />
    `;
    document.body.appendChild(container);

    // Reset Chrome runtime mock
    (chrome.runtime.sendMessage as jest.Mock).mockReset();

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
  });

  describe('setupContextModes', () => {
    it('should set up mode switching', () => {
      setupContextModes();

      const options = document.querySelectorAll('.slider-option');
      const highlight = document.querySelector('.slider-highlight') as HTMLElement;
      const screenshotBtn = document.getElementById('screenshot-btn') as HTMLElement;
      const dropZone = document.getElementById('drop-zone') as HTMLElement;

      // Click selection mode
      options[1].dispatchEvent(new Event('click'));
      expect(highlight.style.transform).toBe('translateX(100%)');
      expect(screenshotBtn.classList.contains('hidden')).toBe(true);
      expect(dropZone.classList.contains('hidden')).toBe(true);

      // Click screenshot mode
      options[2].dispatchEvent(new Event('click'));
      expect(highlight.style.transform).toBe('translateX(200%)');
      expect(screenshotBtn.classList.contains('hidden')).toBe(false);
      expect(dropZone.classList.contains('hidden')).toBe(false);
    });

    it('should handle screenshot button click', async () => {
      const mockScreenshot = 'data:image/png;base64,test';
      (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
        if (message.action === 'takeScreenshot') {
          return Promise.resolve(mockScreenshot);
        }
      });

      setupContextModes();

      const screenshotBtn = document.getElementById('screenshot-btn') as HTMLElement;
      const contentPreview = document.getElementById('content-preview') as HTMLElement;

      await screenshotBtn.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'takeScreenshot' });
      expect(contentPreview.querySelector('img')?.src).toBe(mockScreenshot);
    });

    it('should handle drag and drop', () => {
      setupContextModes();

      const dropZone = document.getElementById('drop-zone') as HTMLElement;
      const contentPreview = document.getElementById('content-preview') as HTMLElement;

      // Mock file drop
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new Event('drop') as any;
      dropEvent.dataTransfer = dataTransfer;
      dropEvent.preventDefault = jest.fn();
      dropEvent.stopPropagation = jest.fn();

      dropZone.dispatchEvent(dropEvent);

      // Check if FileReader was used (can't fully test due to FileReader being read-only)
      expect(contentPreview.classList.contains('hidden')).toBe(false);
    });
  });

  describe('getPageContent', () => {
    beforeEach(() => {
      setupContextModes();
    });

    it('should return page content in page mode', () => {
      const options = document.querySelectorAll('.slider-option');
      options[0].dispatchEvent(new Event('click')); // Switch to page mode
      expect(getPageContent()).toBe('Page content');
    });

    it('should return selected text in selection mode', () => {
      const options = document.querySelectorAll('.slider-option');
      options[1].dispatchEvent(new Event('click')); // Switch to selection mode
      expect(getPageContent()).toBe('Selected text');
    });

    it('should return screenshot data in screenshot mode', async () => {
      const options = document.querySelectorAll('.slider-option');
      options[2].dispatchEvent(new Event('click')); // Switch to screenshot mode
      expect(getPageContent()).toBe('');

      // Simulate taking a screenshot
      const mockScreenshot = 'data:image/png;base64,test';
      (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
        if (message.action === 'takeScreenshot') {
          return Promise.resolve(mockScreenshot);
        }
      });

      const screenshotBtn = document.getElementById('screenshot-btn') as HTMLElement;
      await screenshotBtn.click();

      expect(getPageContent()).toBe(mockScreenshot);
    });
  });
}); 