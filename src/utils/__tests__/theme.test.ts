import { applyTheme } from '../theme';

describe('Theme Utility', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Setup DOM elements
    container = document.createElement('div');
    container.innerHTML = `
      <div id="ai-page-reader-sidebar" class="light"></div>
      <button id="ai-theme-toggle" class="light"></button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('applyTheme', () => {
    it('should apply light theme', () => {
      applyTheme('light');

      expect(document.getElementById('ai-page-reader-sidebar')?.classList.contains('light')).toBe(true);
      expect(document.getElementById('ai-theme-toggle')?.classList.contains('light')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should apply dark theme', () => {
      applyTheme('dark');

      expect(document.getElementById('ai-page-reader-sidebar')?.classList.contains('dark')).toBe(true);
      expect(document.getElementById('ai-theme-toggle')?.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should remove previous theme class when switching themes', () => {
      const sidebar = document.getElementById('ai-page-reader-sidebar');
      const toggle = document.getElementById('ai-theme-toggle');

      // Start with light theme
      sidebar?.classList.add('light');
      toggle?.classList.add('light');

      // Switch to dark theme
      applyTheme('dark');

      expect(sidebar?.classList.contains('light')).toBe(false);
      expect(toggle?.classList.contains('light')).toBe(false);
      expect(sidebar?.classList.contains('dark')).toBe(true);
      expect(toggle?.classList.contains('dark')).toBe(true);
    });

    it('should handle missing elements gracefully', () => {
      document.body.innerHTML = ''; // Remove all elements

      expect(() => applyTheme('light')).not.toThrow();
    });
  });
}); 