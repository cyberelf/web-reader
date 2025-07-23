export type Language = 'en' | 'zh';

export interface Translations {
  common: {
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    loading: string;
    error: string;
    success: string;
    clear: string;
    close: string;
  };
      sidebar: {
      title: string;
      askPlaceholder: string;
      askButton: string;
      clearHistory: string;
      clearHistoryConfirm: string;
      clearHistoryMessage: string;
      includeChatHistory: string;
    modes: {
      page: string;
      selection: string;
      element: string;
      screenshot: string;
      video: string;
    };
    preview: {
      noSelection: string;
      loading: string;
      noSubtitles: string;
      failedSubtitles: string;
      videoOnly: string;
      selectElement: string;
      selectedElement: string;
      reselectElement: string;
      dropImage: string;
    };
  };
  settings: {
    title: string;
    language: string;
    showIcon: string;
    provider: string;
    model: string;
    prompts: string;
    settings: string;
    stats: string;
    apiKey: string;
    apiUrl: string;
    saveSettings: string;
    saved: string;
    addCustomPrompt: string;
    totalTokens: string;
    totalRequests: string;
    avgTokens: string;
    clearStats: string;
    clearStatsConfirm: string;
    clearStatsMessage: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      clear: 'Clear',
      close: 'Close',
    },
    sidebar: {
      title: 'Page Reader Assistant',
      askPlaceholder: 'What would you like to know about this page?',
      askButton: 'Ask Question',
      clearHistory: 'Clear Chat History',
      clearHistoryConfirm: 'Clear History',
      clearHistoryMessage: 'Are you sure you want to clear the chat history for this page?',
      includeChatHistory: 'Include chat history',
      modes: {
        page: 'Page',
        selection: 'Selection',
        element: 'Element',
        screenshot: 'Screenshot',
        video: 'Video',
      },
      preview: {
        noSelection: 'No text selected. Select some text on the page to analyze it.',
        loading: 'Loading...',
        noSubtitles: 'No subtitles available',
        failedSubtitles: 'Failed to load subtitles',
        videoOnly: 'This mode only works on video pages (YouTube, Bilibili)',
        selectElement: 'Click the button below to select an element on the page',
        selectedElement: 'Selected Element',
        reselectElement: 'Select Different Element',
        dropImage: 'Take a screenshot or drag and drop an image here',
      },
    },
    settings: {
      title: 'Web Reader Settings',
      language: 'Language',
      showIcon: 'Show Icon',
      provider: 'Provider',
      model: 'Model',
      prompts: 'Prompts',
      settings: 'Settings',
      stats: 'Stats',
      apiKey: 'API Key',
      apiUrl: 'API URL',
      saveSettings: 'Save Settings',
      saved: 'Saved!',
      addCustomPrompt: 'Add Custom Prompt',
      totalTokens: 'Total Tokens',
      totalRequests: 'Total Requests',
      avgTokens: 'Average Tokens/Request',
      clearStats: 'Clear Usage Stats',
      clearStatsConfirm: 'Clear Statistics',
      clearStatsMessage: 'Are you sure you want to clear all usage statistics? This action cannot be undone.',
    },
  },
  zh: {
    common: {
      save: '保存',
      cancel: '取消',
      confirm: '确认',
      delete: '删除',
      loading: '加载中...',
      error: '错误',
      success: '成功',
      clear: '清空',
      close: '关闭',
    },
    sidebar: {
      title: '页面阅读助手',
      askPlaceholder: '你想了解这个页面的什么内容？',
      askButton: '提问',
      clearHistory: '清空聊天记录',
      clearHistoryConfirm: '清空记录',
      clearHistoryMessage: '确定要清空此页面的聊天记录吗？',
      includeChatHistory: '包含聊天记录',
      modes: {
        page: '页面',
        selection: '选择',
        element: '元素',
        screenshot: '截图',
        video: '视频',
      },
      preview: {
        noSelection: '未选择文本。请在页面上选择一些文本进行分析。',
        loading: '加载中...',
        noSubtitles: '无字幕可用',
        failedSubtitles: '字幕加载失败',
        videoOnly: '此模式仅适用于视频页面（YouTube、Bilibili）',
        selectElement: '点击下方按钮选择页面元素',
        selectedElement: '已选元素',
        reselectElement: '选择不同元素',
        dropImage: '截图或拖拽图片到此处',
      },
    },
    settings: {
      title: '网页阅读器设置',
      language: '语言',
      showIcon: '显示图标',
      provider: '提供商',
      model: '模型',
      prompts: '提示词',    
      settings: '设置',
      stats: '统计',
      apiKey: 'API 密钥',
      apiUrl: 'API 地址',
      saveSettings: '保存设置',
      saved: '已保存！',
      addCustomPrompt: '添加自定义提示词',
      totalTokens: '总Token数',
      totalRequests: '总请求数',
      avgTokens: '平均Token/请求',
      clearStats: '清空使用统计',
      clearStatsConfirm: '清空统计',
      clearStatsMessage: '确定要清空所有使用统计吗？此操作无法撤销。',
    },
  },
};

let currentLanguage: Language = 'en';

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  // Save to storage
  chrome.storage.sync.set({ language: lang });
}

export function t(key: string): string {
  const keys = key.split('.');
  let value: any = translations[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if key not found
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Return key if not found in fallback
        }
      }
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

export async function initializeLanguage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['language'], (result) => {
      if (result.language) {
        currentLanguage = result.language;
      } else {
        // Detect browser language
        const browserLang = navigator.language.toLowerCase();
        currentLanguage = browserLang.startsWith('zh') ? 'zh' : 'en';
        setLanguage(currentLanguage);
      }
      resolve();
    });
  });
} 