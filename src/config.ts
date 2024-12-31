export const MODELS = {
  GPT4O: 'gpt-4o',
  GPT4O_MINI: 'gpt-4o-mini',
  VISION: 'gpt-4-vision-preview'
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

export const MODEL_DISPLAY_NAMES: Record<ModelType, string> = {
  'gpt-4o': 'GPT-4O',
  'gpt-4o-mini': 'GPT-4O Mini',
  'gpt-4-vision-preview': 'GPT-4 Vision'
};

export const DEFAULT_MODEL: ModelType = MODELS.GPT4O_MINI; 