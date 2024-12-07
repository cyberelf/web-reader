import { fileToBase64, svgToPng } from '../../utils/imageUtils.js';

function setupScreenshotHandlers(dropZone, screenshotBtn) {
    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', handleDrop);

    // Screenshot button handler
    screenshotBtn.addEventListener('click', handleScreenshot);
}

async function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    dropZone.classList.remove('dragover');
    
    try {
        // Try to get image from files first
        if (e.dataTransfer.files.length > 0) {
            await handleFileUpload(e.dataTransfer.files[0], dropZone);
        } else {
            await handleUrlUpload(e, dropZone);
        }

        // Add remove button handler
        const removeBtn = dropZone.querySelector('.remove-image');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
                dropZone.removeAttribute('data-content');
            });
        }
    } catch (error) {
        console.error('Error processing dropped content:', error);
        dropZone.innerHTML = '<p>Error processing dropped content. Please try again.</p>';
    }
}

async function handleFileUpload(file, dropZone) {
    if (!file.type.startsWith('image/')) {
        dropZone.innerHTML = '<p>Please drop a valid image file (PNG, JPEG, GIF, WebP, SVG)</p>';
        return;
    }

    const base64 = await fileToBase64(file);
    
    if (file.type === 'image/svg+xml') {
        const svgText = await file.text();
        const pngData = await svgToPng(svgText);
        updateDropZone(dropZone, pngData, "Converted SVG");
    } else {
        updateDropZone(dropZone, base64, "Dropped image");
    }
}

async function handleUrlUpload(e, dropZone) {
    const html = e.dataTransfer.getData('text/html');
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    
    let imgSrc = '';
    if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        if (img) {
            imgSrc = img.src;
        }
    }
    
    if (!imgSrc && url && url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        imgSrc = url;
    }

    if (!imgSrc) {
        dropZone.innerHTML = '<p>Please drop an image or an image link</p>';
        return;
    }

    await handleImageUrl(imgSrc, dropZone);
}

async function handleImageUrl(imgSrc, dropZone) {
    if (imgSrc.toLowerCase().endsWith('.svg') || imgSrc.includes('image/svg')) {
        const response = await fetch(imgSrc);
        const svgText = await response.text();
        const pngData = await svgToPng(svgText);
        updateDropZone(dropZone, pngData, "Converted SVG");
    } else {
        const imageData = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'fetchImage', url: imgSrc },
                response => {
                    if (chrome.runtime.lastError || response.error) {
                        reject(new Error(response.error || 'Failed to fetch image'));
                    } else {
                        resolve(response.data);
                    }
                }
            );
        });
        updateDropZone(dropZone, imageData, "Dropped image");
    }
}

async function handleScreenshot() {
    const sidebar = document.getElementById('page-reader-sidebar');
    const dropZone = document.getElementById('drop-zone');

    try {
        sidebar.classList.remove('open');
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for sidebar animation
        
        const screenshot = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'takeScreenshot' }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (!response) {
                    reject(new Error('Failed to capture screenshot'));
                } else {
                    resolve(response);
                }
            });
        });
        
        sidebar.classList.add('open');
        
        if (screenshot) {
            updateDropZone(dropZone, screenshot, "Page screenshot");
        }
    } catch (error) {
        console.error('Screenshot failed:', error);
        dropZone.innerHTML = '<p>Failed to take screenshot. Please try again.</p>';
        sidebar.classList.add('open');
    }
}

function updateDropZone(dropZone, imageData, altText) {
    dropZone.setAttribute('data-content', imageData);
    dropZone.innerHTML = `
        <div class="image-preview">
            <img src="${imageData}" alt="${altText}">
            <button class="remove-image" aria-label="Remove image">×</button>
        </div>
    `;

    // Add remove button handler immediately after creating it
    const removeBtn = dropZone.querySelector('.remove-image');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
            dropZone.removeAttribute('data-content');
        });
    }
}

export { setupScreenshotHandlers }; 