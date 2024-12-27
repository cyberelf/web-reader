// Global type definitions for the extension

// Message types for communication between components
export interface MessageRequest {
  action: 'takeScreenshot' | 'fetchImage' | 'analyzeContent' | 'updateSettings';
  url?: string;
  content?: string;
  settings?: ExtensionSettings;
}

export interface FetchImageResponse {
  data?: string;
  error?: string;
}

export interface ExtensionSettings {
  apiKey: string;
  model: string;
  theme: 'light' | 'dark';
  customEndpoint?: string;
}

// API Response types
export interface AIResponse {
  text: string;
  error?: string;
}

// UI State types
export interface UIState {
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  sidebarVisible: boolean;
} 