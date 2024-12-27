/// <reference types="chrome"/>

import { createSidebar } from './components/ui/sidebar';

// Initialize when DOM is ready
function initialize(): void {
  createSidebar();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 