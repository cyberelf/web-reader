export type Theme = 'light' | 'dark';

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  
  // Update sidebar theme
  const sidebar = document.getElementById('page-reader-sidebar');
  if (sidebar) {
    sidebar.classList.remove('light', 'dark');
    sidebar.classList.add(theme);
  }
  
  // Update theme toggle button state
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.classList.remove('light', 'dark');
    themeToggle.classList.add(theme);
  }

  // Update modal theme
  const modal = document.getElementById('ai-modal');
  if (modal) {
    modal.classList.remove('light', 'dark');
    modal.classList.add(theme);
  }
} 