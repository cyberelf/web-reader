/// <reference types="chrome"/>

import {
  createAPIClient,
  detectProvider,
  OPENAI_PROVIDER,
  DEEPSEEK_PROVIDER,
  GEMINI_PROVIDER,
} from "./apiClient";
import { saveSecureData, loadSecureData } from "./storage";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  isManual: boolean;
  isVision?: boolean;
  description?: string;
  contextLength?: number;
  pricing?: {
    input: number;
    output: number;
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey?: string;
  apiUrl: string;
  isCustom: boolean;
  isConfigured: boolean;
}

export interface ModelManagerData {
  providers: Record<string, ProviderConfig>;
  models: Record<string, ModelInfo[]>;
  selectedModel?: string;
  selectedProvider?: string;
}

// Default provider configurations
const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1",
    isCustom: false,
    isConfigured: false,
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    apiUrl: "https://api.deepseek.com/v1",
    isCustom: false,
    isConfigured: false,
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta",
    isCustom: false,
    isConfigured: false,
  },
};

// Default models for each provider
const DEFAULT_MODELS: Record<string, ModelInfo[]> = {
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4O",
      provider: "openai",
      isManual: false,
      isVision: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4O Mini",
      provider: "openai",
      isManual: false,
      isVision: true,
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      provider: "openai",
      isManual: false,
      isVision: true,
    },
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      provider: "openai",
      isManual: false,
    },
  ],
  deepseek: [
    {
      id: "deepseek-chat",
      name: "DeepSeek V3",
      provider: "deepseek",
      isManual: false,
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek R1",
      provider: "deepseek",
      isManual: false,
    },
  ],
  gemini: [
    {
      id: "gemini-2.5-pro-preview-05-06",
      name: "Gemini 2.5 Pro Preview",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
    {
      id: "gemini-2.5-flash-preview-05-20",
      name: "Gemini 2.5 Flash Preview",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
    {
      id: "gemini-2.0-flash-exp",
      name: "Gemini 2.0 Flash (Experimental)",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
    {
      id: "gemini-1.5-flash-8b",
      name: "Gemini 1.5 Flash 8B",
      provider: "gemini",
      isManual: false,
      isVision: true,
    },
  ],
};

export class ModelManager {
  private data: ModelManagerData;
  private storageKey = "modelManagerData";
  private modelsStorageKey = "modelManagerModels";

  constructor() {
    this.data = {
      providers: { ...DEFAULT_PROVIDERS },
      models: { ...DEFAULT_MODELS },
      selectedProvider: "openai",
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log("Initializing model manager...");

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Model manager initialization timeout")),
          10000,
        );
      });

      const initPromise = Promise.all([this.loadData(), this.loadApiKeys()]);

      await Promise.race([initPromise, timeoutPromise]);
      console.log("Model manager initialized successfully");
    } catch (error) {
      console.error("Model manager initialization failed:", error);
      // Continue with default configuration instead of throwing
      this.data = {
        providers: { ...DEFAULT_PROVIDERS },
        models: { ...DEFAULT_MODELS },
        selectedProvider: "openai",
      };
    }
  }

  private async loadData(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Storage loading timeout"));
      }, 5000);

      try {
        // Load main data and models separately
        chrome.storage.sync.get(
          [this.storageKey, this.modelsStorageKey],
          (result) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              console.warn("Storage loading error:", chrome.runtime.lastError);
              resolve(); // Continue with defaults
              return;
            }

            // Load main data (providers, selections, etc.)
            if (result[this.storageKey]) {
              const savedData = result[this.storageKey];

              this.data = {
                ...this.data,
                ...savedData,
              };
            }

            // Load models separately
            if (result[this.modelsStorageKey]) {
              const savedModels = result[this.modelsStorageKey];
              this.data.models = savedModels;
            } else {
              this.data.models = { ...DEFAULT_MODELS };
            }

            // Fix existing models that might not have isManual property set correctly
            this.fixExistingModels();

            resolve();
          },
        );
      } catch (error) {
        clearTimeout(timeout);
        console.warn("Error during storage loading:", error);
        resolve(); // Continue with defaults
      }
    });
  }

  private async loadApiKeys(): Promise<void> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("API keys loading timeout")), 3000);
      });

      const loadPromise = (async () => {
        const apiKeysData = await loadSecureData("provider_api_keys");
        const apiKeys: Record<string, string> = apiKeysData
          ? JSON.parse(apiKeysData)
          : {};

        // Update provider configurations with API keys from secure storage
        Object.entries(apiKeys).forEach(([providerId, apiKey]) => {
          if (this.data.providers[providerId]) {
            this.data.providers[providerId].apiKey = apiKey;
            this.data.providers[providerId].isConfigured = !!apiKey;
          }
        });
      })();

      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.warn(
        "Failed to load API keys from secure storage, continuing with defaults:",
        error,
      );
      // Continue without API keys - user can configure them later
    }
  }

  private fixExistingModels(): void {
    // Fix models that might not have isManual property set correctly
    let needsSave = false;

    Object.keys(this.data.models).forEach((providerId) => {
      this.data.models[providerId] = this.data.models[providerId].map(
        (model) => {
          // If model doesn't have isManual property, determine it based on whether it's in DEFAULT_MODELS
          if (model.isManual === undefined) {
            needsSave = true;
            const defaultModels = DEFAULT_MODELS[providerId] || [];
            const isDefaultModel = defaultModels.some(
              (defaultModel) => defaultModel.id === model.id,
            );
            return {
              ...model,
              isManual: !isDefaultModel,
            };
          }
          return model;
        },
      );
    });

    // Save the data if we made any changes
    if (needsSave) {
      this.saveData();
    }
  }

  private async saveData(): Promise<void> {
    try {
      // Prepare optimized data structures (exclude API keys from sync storage)
      const providersWithoutApiKeys: Record<string, ProviderConfig> = {};
      Object.entries(this.data.providers).forEach(([id, provider]) => {
        const { apiKey, ...providerWithoutApiKey } = provider;
        providersWithoutApiKeys[id] = {
          ...providerWithoutApiKey,
          isConfigured: !!apiKey, // Keep the configured status
        };
      });

      const mainData = {
        providers: providersWithoutApiKeys,
        selectedModel: this.data.selectedModel,
        selectedProvider: this.data.selectedProvider,
      };

      // Optimize models data by removing unnecessary fields for storage
      const optimizedModels: Record<string, ModelInfo[]> = {};
      Object.keys(this.data.models).forEach((providerId) => {
        optimizedModels[providerId] = this.data.models[providerId].map(
          (model) => ({
            id: model.id,
            name: model.name,
            provider: model.provider,
            isManual: model.isManual,
            isVision: model.isVision,
            // Remove description and contextLength to save space
          }),
        );
      });

      // Save main data and models separately
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          chrome.storage.sync.set({ [this.storageKey]: mainData }, () => {
            if (chrome.runtime.lastError) {
              console.error(
                "Failed to save main data:",
                chrome.runtime.lastError,
              );
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        }),
        new Promise<void>((resolve, reject) => {
          chrome.storage.sync.set(
            { [this.modelsStorageKey]: optimizedModels },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Failed to save models data:",
                  chrome.runtime.lastError,
                );
                // If models data is still too large, try chunking
                if (
                  chrome.runtime.lastError.message?.includes(
                    "QUOTA_BYTES_PER_ITEM",
                  )
                ) {
                  this.saveEssentialModelsOnly().then(resolve).catch(reject);
                } else {
                  reject(chrome.runtime.lastError);
                }
              } else {
                resolve();
              }
            },
          );
        }),
      ]);
    } catch (error) {
      console.error("Failed to save data:", error);
      throw error;
    }
  }

  private async saveEssentialModelsOnly(): Promise<void> {
    // Save only essential models (manual models + a few default models per provider)
    const essentialModels: Record<string, ModelInfo[]> = {};

    Object.keys(this.data.models).forEach((providerId) => {
      const models = this.data.models[providerId];
      const manualModels = models.filter((m) => m.isManual);
      const defaultModels = models.filter((m) => !m.isManual).slice(0, 3); // Keep only first 3 default models

      essentialModels[providerId] = [...manualModels, ...defaultModels].map(
        (model) => ({
          id: model.id,
          name: model.name,
          provider: model.provider,
          isManual: model.isManual,
          isVision: model.isVision,
        }),
      );
    });

    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(
        { [this.modelsStorageKey]: essentialModels },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to save essential models:",
              chrome.runtime.lastError,
            );
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        },
      );
    });
  }

  // Provider management
  getProviders(): ProviderConfig[] {
    return Object.values(this.data.providers);
  }

  getProvider(id: string): ProviderConfig | undefined {
    return this.data.providers[id];
  }

  async updateProviderConfig(
    providerId: string,
    config: Partial<ProviderConfig>,
  ): Promise<void> {
    if (this.data.providers[providerId]) {
      // Handle API key separately - save to secure storage
      if (config.apiKey !== undefined) {
        await this.updateApiKey(providerId, config.apiKey);
      }

      // Update provider config (excluding API key)
      const { apiKey, ...configWithoutApiKey } = config;
      this.data.providers[providerId] = {
        ...this.data.providers[providerId],
        ...configWithoutApiKey,
        isConfigured: !!(
          config.apiKey || this.data.providers[providerId].apiKey
        ),
      };
      this.saveData();
    }
  }

  private async updateApiKey(
    providerId: string,
    apiKey: string,
  ): Promise<void> {
    try {
      const apiKeysData = await loadSecureData("provider_api_keys");
      const apiKeys: Record<string, string> = apiKeysData
        ? JSON.parse(apiKeysData)
        : {};

      if (apiKey && apiKey.trim()) {
        apiKeys[providerId] = apiKey;
        this.data.providers[providerId].apiKey = apiKey;
      } else {
        delete apiKeys[providerId];
        delete this.data.providers[providerId].apiKey;
      }

      await saveSecureData("provider_api_keys", JSON.stringify(apiKeys));
    } catch (error) {
      console.error("Failed to update API key in secure storage:", error);
      throw error;
    }
  }

  addCustomProvider(config: Omit<ProviderConfig, "id" | "isCustom">): string {
    const id = `custom_${Date.now()}`;
    this.data.providers[id] = {
      ...config,
      id,
      isCustom: true,
      isConfigured: !!config.apiKey,
    };
    this.data.models[id] = [];
    this.saveData();
    return id;
  }

  removeProvider(providerId: string): void {
    if (this.data.providers[providerId]?.isCustom) {
      delete this.data.providers[providerId];
      delete this.data.models[providerId];
      if (this.data.selectedProvider === providerId) {
        this.data.selectedProvider = "openai";
      }
      this.saveData();
    }
  }

  // Model management
  getModels(providerId: string): ModelInfo[] {
    return this.data.models[providerId] || [];
  }

  getAllModels(): ModelInfo[] {
    return Object.values(this.data.models).flat();
  }

  addManualModel(
    providerId: string,
    model: Omit<ModelInfo, "provider" | "isManual">,
  ): void {
    if (!this.data.models[providerId]) {
      this.data.models[providerId] = [];
    }

    const newModel: ModelInfo = {
      ...model,
      provider: providerId,
      isManual: true,
    };

    // Check if model already exists
    const existingIndex = this.data.models[providerId].findIndex(
      (m) => m.id === model.id,
    );
    if (existingIndex >= 0) {
      this.data.models[providerId][existingIndex] = newModel;
    } else {
      this.data.models[providerId].push(newModel);
    }

    this.saveData();
  }

  removeModel(providerId: string, modelId: string): void {
    if (this.data.models[providerId]) {
      const modelIndex = this.data.models[providerId].findIndex(
        (m) => m.id === modelId,
      );

      if (modelIndex >= 0) {
        const model = this.data.models[providerId][modelIndex];

        // Only allow removal of manual models
        if (model.isManual) {
          this.data.models[providerId].splice(modelIndex, 1);

          // If this was the selected model, clear selection
          if (this.data.selectedModel === modelId) {
            this.data.selectedModel = undefined;
          }

          this.saveData();
        } else {
          throw new Error(
            "Cannot delete auto-synced models. Only manually added models can be deleted.",
          );
        }
      } else {
        throw new Error("Model not found");
      }
    } else {
      throw new Error("Provider not found");
    }
  }

  // Model syncing
  async syncModels(
    providerId: string,
  ): Promise<{ success: boolean; error?: string; models?: ModelInfo[] }> {
    const provider = this.data.providers[providerId];
    if (!provider || !provider.apiKey) {
      return { success: false, error: "Provider not configured" };
    }

    try {
      const models = await this.fetchModelsFromAPI(provider);

      // Keep manual models, replace auto models
      const manualModels =
        this.data.models[providerId]?.filter((m) => m.isManual) || [];

      const newModelList = [...models, ...manualModels];

      this.data.models[providerId] = newModelList;

      await this.saveData();
      return { success: true, models: this.data.models[providerId] };
    } catch (error) {
      console.error("Failed to sync models:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async fetchModelsFromAPI(
    provider: ProviderConfig,
  ): Promise<ModelInfo[]> {
    // Fetch models from actual API endpoints when available

    switch (provider.id) {
      case "openai":
        return this.fetchOpenAIModels(provider);
      case "deepseek":
        return DEFAULT_MODELS.deepseek.map((m) => ({ ...m, isManual: false }));
      case "gemini":
        return this.fetchGeminiModels(provider);
      default:
        // For custom providers, try to fetch from OpenAI-compatible endpoint
        return this.fetchOpenAICompatibleModels(provider);
    }
  }

  private async fetchOpenAIModels(
    provider: ProviderConfig,
  ): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${provider.apiUrl}/models`, {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models: ModelInfo[] = data.data
        .filter(
          (model: any) => model.id.includes("gpt") || model.id.includes("text"),
        )
        .map((model: any) => ({
          id: model.id,
          name: this.formatModelName(model.id),
          provider: provider.id,
          isManual: false,
          isVision: model.id.includes("vision") || model.id.includes("gpt-4"),
        }));

      return models;
    } catch (error) {
      console.warn("Failed to fetch OpenAI models, using defaults:", error);
      return DEFAULT_MODELS.openai.map((m) => ({ ...m, isManual: false }));
    }
  }

  private async fetchGeminiModels(
    provider: ProviderConfig,
  ): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${provider.apiUrl}/models?pageSize=50`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models: ModelInfo[] = data.models
        .filter((model: any) => {
          // Filter for models that support generateContent
          // Filter for gemini-2.5 and gemma3 as there are too many models
          return (
            model.supportedGenerationMethods &&
            model.name &&
            (model.name.includes("gemini-2.5") ||
              model.name.toLowerCase().includes("gemma3")) &&
            model.supportedGenerationMethods.includes("generateContent")
          );
        })
        .map((model: any) => ({
          id: model.name.split("/").pop(),
          name: model.displayName || this.formatModelName(model.baseModelId),
          provider: provider.id,
          isManual: false,
          isVision: true, // Most Gemini models support vision
          description: model.description,
          contextLength: model.inputTokenLimit,
        }));

      return models.length > 0
        ? models
        : DEFAULT_MODELS.gemini.map((m) => ({ ...m, isManual: false }));
    } catch (error) {
      console.warn("Failed to fetch Gemini models, using defaults:", error);
      return DEFAULT_MODELS.gemini.map((m) => ({ ...m, isManual: false }));
    }
  }

  private async fetchOpenAICompatibleModels(
    provider: ProviderConfig,
  ): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${provider.apiUrl}/models`, {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models: ModelInfo[] = data.data.map((model: any) => ({
        id: model.id,
        name: this.formatModelName(model.id),
        provider: provider.id,
        isManual: false,
      }));

      return models;
    } catch (error) {
      console.warn("Failed to fetch models from custom provider:", error);
      return [];
    }
  }

  private formatModelName(modelId: string): string {
    // Convert model IDs to readable names
    const nameMap: Record<string, string> = {
      "gpt-4o": "GPT-4O",
      "gpt-4o-mini": "GPT-4O Mini",
      "gpt-4-turbo": "GPT-4 Turbo",
      "gpt-4": "GPT-4",
      "gpt-3.5-turbo": "GPT-3.5 Turbo",
      "deepseek-chat": "DeepSeek Chat",
      "deepseek-coder": "DeepSeek Coder",
      "gemini-2.5-pro-preview-05-06": "Gemini 2.5 Pro Preview",
      "gemini-2.5-flash-preview-05-20": "Gemini 2.5 Flash Preview",
      "gemini-2.0-flash-exp": "Gemini 2.0 Flash (Experimental)",
      "gemini-2.0-flash": "Gemini 2.0 Flash",
      "gemini-1.5-pro": "Gemini 1.5 Pro",
      "gemini-1.5-flash": "Gemini 1.5 Flash",
      "gemini-1.5-flash-8b": "Gemini 1.5 Flash 8B",
    };

    return (
      nameMap[modelId] ||
      modelId
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
  }

  // Selection management
  getSelectedModel(): string | undefined {
    return this.data.selectedModel;
  }

  async setSelectedModel(modelId: string): Promise<void> {
    this.data.selectedModel = modelId;
    await this.saveData();
  }

  getSelectedProvider(): string | undefined {
    return this.data.selectedProvider;
  }

  async setSelectedProvider(providerId: string): Promise<void> {
    this.data.selectedProvider = providerId;
    await this.saveData();
  }

  // Get current configuration for API client
  getCurrentConfig(): {
    apiKey?: string;
    apiUrl: string;
    model?: string;
  } | null {
    const selectedModel = this.getSelectedModel();
    if (!selectedModel) return null;

    const model = this.getAllModels().find((m) => m.id === selectedModel);
    if (!model) return null;

    const provider = this.getProvider(model.provider);
    if (!provider || !provider.apiKey) return null;

    return {
      apiKey: provider.apiKey,
      apiUrl: provider.apiUrl,
      model: selectedModel,
    };
  }

  // Cleanup old storage
  async cleanupOldStorage(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.remove(
        ["settings", "customModels", this.storageKey, this.modelsStorageKey],
        resolve,
      );
    });
  }
}

// Global instance
export const modelManager = new ModelManager();
