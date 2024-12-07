// Load modules dynamically
async function loadModules() {
    const { createSidebar } = await import(chrome.runtime.getURL('src/components/ui/sidebar.js'));
    createSidebar();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadModules);
} else {
    loadModules();
} 