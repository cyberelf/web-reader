import { updateContentPreview } from './selection.js';
import { setupScreenshotHandlers } from './screenshot.js';

function setupContextModes() {
    const sliderContainer = document.querySelector('.slider-container');
    const sliderHighlight = document.querySelector('.slider-highlight');
    const sliderOptions = document.querySelectorAll('.slider-option');
    const dropZone = document.getElementById('drop-zone');
    const contentPreview = document.getElementById('content-preview');
    const screenshotBtn = document.getElementById('screenshot-btn');

    // Initialize the slider position
    const initializeSlider = () => {
        const activeOption = document.querySelector('.slider-option.active') || sliderOptions[0];
        const optionRect = activeOption.getBoundingClientRect();
        
        sliderHighlight.style.width = `${optionRect.width}px`;
        sliderHighlight.style.transform = `translateX(${activeOption.offsetLeft}px)`;
    };

    // Set initial active state
    sliderOptions[0].classList.add('active');
    initializeSlider();

    // Handle option clicks
    sliderOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            
            // Update active state
            sliderOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            // Move highlight
            sliderHighlight.style.width = `${option.offsetWidth}px`;
            sliderHighlight.style.transform = `translateX(${option.offsetLeft}px)`;

            // Update UI based on mode
            if (mode === 'screenshot') {
                contentPreview.style.display = 'none';
                dropZone.style.display = 'block';
                screenshotBtn.classList.add('visible');
            } else {
                contentPreview.style.display = 'block';
                dropZone.style.display = 'none';
                screenshotBtn.classList.remove('visible');
                updateContentPreview();
            }
        });
    });

    // Setup screenshot handlers
    setupScreenshotHandlers(dropZone, screenshotBtn);
}

function getPageContent() {
    const activeOption = document.querySelector('.slider-option.active');
    const mode = activeOption ? activeOption.dataset.mode : 'page';
    let content = '';

    switch (mode) {
        case 'page':
            const bodyClone = document.body.cloneNode(true);
            const scripts = bodyClone.getElementsByTagName('script');
            const styles = bodyClone.getElementsByTagName('style');
            while (scripts.length > 0) scripts[0].remove();
            while (styles.length > 0) styles[0].remove();
            content = bodyClone.innerText;
            break;
        case 'selection':
            const selection = window.getSelection();
            content = selection.toString().trim();
            if (!content) {
                content = document.getElementById('content-preview').getAttribute('data-selection') || '';
            }
            break;
        case 'screenshot':
            content = document.getElementById('drop-zone').getAttribute('data-content') || '';
            break;
    }
    
    return content;
}

export { setupContextModes, getPageContent }; 