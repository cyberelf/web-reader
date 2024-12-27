/// <reference types="chrome"/>

export async function saveToStorage<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error('Storage save error:', error);
  }
}

export async function loadFromStorage<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key] as T;
  } catch (error) {
    console.error('Storage load error:', error);
    return null;
  }
}

export async function removeFromStorage(key: string): Promise<void> {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error('Storage remove error:', error);
  }
} 