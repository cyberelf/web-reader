function handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const base64Image = e.target.result;
                
                // If we're in screenshot mode, update the drop zone
                const contextMode = document.getElementById('context-mode');
                const dropZone = document.getElementById('drop-zone');
                
                if (contextMode.value === 'screenshot' && dropZone) {
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