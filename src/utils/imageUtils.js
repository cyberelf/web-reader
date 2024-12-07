// Image handling utilities
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function svgToPng(svgText) {
    const svgData = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
    const img = new Image();
    img.width = 800;
    img.height = 600;
    
    return new Promise((resolve, reject) => {
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            try {
                const pngData = canvas.toDataURL('image/png');
                resolve(pngData);
            } catch (error) {
                reject(new Error('Failed to convert to PNG'));
            }
        };
        
        img.onerror = () => {
            reject(new Error('Failed to load SVG'));
        };
        
        img.src = svgData;
    });
}

function formatImageData(base64Data) {
    if (base64Data.startsWith('data:image/')) {
        return base64Data;
    }
    
    let imageType = 'png';
    
    if (base64Data.startsWith('/9j/')) {
        imageType = 'jpeg';
    } else if (base64Data.startsWith('R0lGOD')) {
        imageType = 'gif';
    } else if (base64Data.startsWith('UklGR')) {
        imageType = 'webp';
    } else if (base64Data.includes('<svg') || base64Data.startsWith('PHN2Zz')) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => {
                reject(new Error('Failed to convert SVG to PNG'));
            };
            img.src = base64Data.startsWith('data:') ? base64Data : `data:image/svg+xml;base64,${base64Data}`;
        });
    }
    
    return `data:image/${imageType};base64,${base64Data.replace(/^data:.+;base64,/, '')}`;
}

export { fileToBase64, svgToPng, formatImageData }; 