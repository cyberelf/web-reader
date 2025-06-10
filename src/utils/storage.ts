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
    const result = await chrome.storage.local.get({ [key]: null });
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

// Secure storage functions for sensitive data like API keys
export async function saveSecureData(key: string, value: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [`secure_${key}`]: value });
  } catch (error) {
    console.error('Secure storage save error:', error);
  }
}

export async function loadSecureData(key: string): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get({ [`secure_${key}`]: null });
    return result[`secure_${key}`] as string;
  } catch (error) {
    console.error('Secure storage load error:', error);
    return null;
  }
}

export async function removeSecureData(key: string): Promise<void> {
  try {
    await chrome.storage.local.remove(`secure_${key}`);
  } catch (error) {
    console.error('Secure storage remove error:', error);
  }
}

// Chrome storage utilities with proper typing
export async function getChromeStorageLocal<T>(keys: string | string[] | Record<string, any>): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result as T);
    });
  });
}

export async function setChromeStorageLocal(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

export async function getChromeStorageSync<T>(keys: string | string[] | Record<string, any>): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => {
      resolve(result as T);
    });
  });
}

export async function setChromeStorageSync(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(items, resolve);
  });
} 