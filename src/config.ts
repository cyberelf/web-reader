export const MODELS = {
  GPT4O: "gpt-4o",
  GPT4O_MINI: "gpt-4o-mini",
  DeepSeek: "deepseek-chat",
  VISION: "gpt-4-vision-preview",
  GEMINI_PRO: "gemini-1.5-pro",
  GEMINI_FLASH: "gemini-1.5-flash",
  GEMINI_FLASH_8B: "gemini-1.5-flash-8b",
} as const;

export type ModelType = (typeof MODELS)[keyof typeof MODELS] | string;

export type ModelDisplayType = (typeof MODELS)[keyof typeof MODELS];

export const MODEL_DISPLAY_NAMES: Record<ModelDisplayType, string> = {
  "gpt-4o": "GPT-4O",
  "gpt-4o-mini": "GPT-4O Mini",
  "deepseek-chat": "DeepSeek Chat",
  "gpt-4-vision-preview": "GPT-4 Vision",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
  "gemini-1.5-flash": "Gemini 1.5 Flash",
  "gemini-1.5-flash-8b": "Gemini 1.5 Flash 8B",
};

export const DEFAULT_MODEL: ModelType = MODELS.GPT4O_MINI;
