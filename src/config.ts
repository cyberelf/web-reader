export const MODELS = {
  GPT4: 'gpt-4',
  GPT4_TURBO: 'gpt-4-1106-preview',
  GPT3_5_TURBO: 'gpt-3.5-turbo',
  VISION: 'gpt-4-vision-preview'
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

export const MODEL_DISPLAY_NAMES: Record<ModelType, string> = {
  'gpt-4': 'GPT-4',
  'gpt-4-1106-preview': 'GPT-4 Turbo',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'gpt-4-vision-preview': 'GPT-4 Vision'
};

export const DEFAULT_MODEL: ModelType = MODELS.GPT3_5_TURBO; 