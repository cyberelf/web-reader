function applyTheme(theme) {
    const sidebar = document.getElementById('page-reader-sidebar');
    const toggle = document.getElementById('page-reader-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    
    // Apply theme classes
    const isOpen = sidebar.classList.contains('open');
    sidebar.className = `page-reader-sidebar theme-${theme}${isOpen ? ' open' : ''}`;
    toggle.className = `page-reader-toggle theme-${theme}`;
    themeToggle.className = `theme-toggle ${theme === 'dark' ? 'theme-dark' : ''}`;
    
    // Apply theme to modal
    const modal = document.getElementById('clear-confirm-modal');
    if (modal) {
        modal.className = `modal ${theme === 'dark' ? 'theme-dark' : ''}`;
    }
}

export { applyTheme }; 