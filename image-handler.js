function handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const base64Image = e.target.result;
                
                // Check if we're in screenshot mode using the slider
                const activeOption = document.querySelector('.slider-option.active');
                const mode = activeOption ? activeOption.dataset.mode : 'page';
                const dropZone = document.getElementById('drop-zone');
                
                if (mode === 'screenshot' && dropZone) {
                    dropZone.setAttribute('data-content', base64Image);
                    dropZone.innerHTML = `
                        <div class="image-preview">
                            <img src="${base64Image}" alt="Pasted image">
                            <button class="remove-image" aria-label="Remove image">×</button>
                        </div>
                    `;
                    
                    // Add remove button handler
                    const removeBtn = dropZone.querySelector('.remove-image');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', () => {
                            dropZone.innerHTML = '<p>Take a screenshot or drag and drop an image here</p>';
                            dropZone.removeAttribute('data-content');
                        });
                    }
                }
            };
            
            reader.readAsDataURL(blob);
            break;
        }
    }
}

document.addEventListener('paste', handlePaste); 