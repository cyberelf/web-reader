// Storage utility functions
async function saveToStorage(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (error) {
        console.error('Storage save error:', error);
    }
}

async function loadFromStorage(key) {
    try {
        const result = await chrome.storage.local.get([key]);
        return result[key];
    } catch (error) {
        console.error('Storage load error:', error);
        return null;
    }
}

async function removeFromStorage(key) {
    try {
        await chrome.storage.local.remove(key);
    } catch (error) {
        console.error('Storage remove error:', error);
    }
}

export { saveToStorage, loadFromStorage, removeFromStorage }; 