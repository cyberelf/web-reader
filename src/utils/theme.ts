export type Theme = 'light' | 'dark';

export function applyTheme(theme: Theme): void {
  // Set theme attribute on root element
  document.documentElement.setAttribute('data-theme', theme);
  
  // Update sidebar theme
  const sidebar = document.getElementById('page-reader-sidebar');
  const toggle = document.getElementById('page-reader-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  
  if (sidebar) {
    const isOpen = sidebar.classList.contains('open');
    sidebar.className = `page-reader-sidebar theme-${theme}${isOpen ? ' open' : ''}`;
  }
  
  if (toggle) {
    toggle.className = `page-reader-toggle theme-${theme}`;
  }
  
  if (themeToggle) {
    themeToggle.className = `theme-toggle ${theme === 'dark' ? 'theme-dark' : ''}`;
  }
  
  // Apply theme to modal
  const modal = document.getElementById('clear-confirm-modal');
  if (modal) {
    modal.className = `modal ${theme === 'dark' ? 'theme-dark' : ''}`;
  }
} 