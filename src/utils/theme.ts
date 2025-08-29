export type Theme = "light" | "dark";

export function applyTheme(theme: Theme): void {
  // Set data-theme attribute on document element for CSS variables
  document.documentElement.setAttribute("data-theme", theme);

  // Update sidebar theme
  const sidebar = document.getElementById("ai-page-reader-sidebar");
  if (sidebar) {
    sidebar.classList.remove("wr-light", "wr-dark");
    sidebar.classList.add(`wr-${theme}`);
  }

  // Update theme toggle button state
  const themeToggle = document.getElementById("ai-theme-toggle");
  if (themeToggle) {
    themeToggle.classList.remove("wr-light", "wr-dark");
    themeToggle.classList.add(`wr-${theme}`);
  }

  // Update modal theme
  const modal = document.getElementById("ai-modal");
  if (modal) {
    modal.classList.remove("wr-light", "wr-dark");
    modal.classList.add(`wr-${theme}`);
  }

  // Charts now use CSS variables and update automatically
}
