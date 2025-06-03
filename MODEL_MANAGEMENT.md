# Model Management System

This document describes the new comprehensive model management system implemented in the web-reader extension.

## Overview

The new model management system provides:
- **Multi-provider support**: OpenAI, DeepSeek, Google Gemini, and custom OpenAI-compatible providers
- **Automatic model syncing**: Fetch available models directly from provider APIs
- **Manual model management**: Add and remove custom models for each provider
- **Provider-specific configuration**: Separate API keys and settings for each provider
- **Seamless migration**: Automatically migrates from the old settings system

## Features

### 1. Provider Management

#### Supported Providers
- **OpenAI**: Full support with automatic model discovery
- **DeepSeek**: Support for DeepSeek Chat and Coder models
- **Google Gemini**: Support for Gemini 1.5 Pro, Flash, and Flash 8B models
- **Custom OpenAI Compatible**: Support for any OpenAI-compatible API

#### Provider Configuration
Each provider has its own configuration:
- API Key (securely stored)
- API URL (predefined for built-in providers, configurable for custom)
- Connection status indicator
- Model list specific to that provider

### 2. Model Discovery and Syncing

#### Automatic Model Syncing
- **OpenAI**: Fetches models from `/models` endpoint
- **DeepSeek**: Uses predefined model list (API doesn't provide models endpoint)
- **Gemini**: Uses predefined model list with vision capabilities
- **Custom Providers**: Attempts to fetch from OpenAI-compatible `/models` endpoint

#### Manual Model Addition
- Add custom models to any provider
- Specify model ID and display name
- Models are marked as "manual" and can be deleted
- Auto-synced models cannot be manually deleted

### 3. Model Selection and Usage

#### Model Selection
- Dropdown shows models grouped by provider
- Only shows models from configured providers
- Indicates vision capabilities
- Remembers last selected model

#### Model Information
- Display name and model ID
- Provider information
- Vision capability indicator
- Manual vs auto-synced badge

## User Interface

### Model Tab (Main Interface)

#### Provider Selection
```
┌─ Provider: [OpenAI ▼] ─────────────────┐
│                                        │
│ ┌─ API Configuration ─────────────────┐ │
│ │ API Key: [••••••••••••••] [👁]      │ │
│ │ API URL: https://api.openai.com/v1  │ │
│ │ Status: ● Connected                 │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

#### Model Management
```
┌─ Available Models ──────────────────────┐
│ [🔄 Sync Models] [➕ Add Model]         │
│                                         │
│ ┌─ Model List ─────────────────────────┐ │
│ │ ✓ GPT-4O                    [AUTO] │ │
│ │   gpt-4o                    [VISION]│ │
│ │                             [✓][🗑] │ │
│ │                                     │ │
│ │ ○ GPT-4O Mini               [AUTO] │ │
│ │   gpt-4o-mini               [VISION]│ │
│ │                             [✓][🗑] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Selected Model: [GPT-4O (gpt-4o) ▼]    │
└─────────────────────────────────────────┘
```

### Provider-Specific Configurations

#### OpenAI
- API Key: Your OpenAI API key (sk-...)
- API URL: https://api.openai.com/v1 (read-only)
- Models: Automatically synced from OpenAI API

#### DeepSeek
- API Key: Your DeepSeek API key (sk-...)
- API URL: https://api.deepseek.com/v1 (read-only)
- Models: DeepSeek Chat, DeepSeek Coder

#### Google Gemini
- API Key: Your Google AI API key (AIza...)
- API URL: https://generativelanguage.googleapis.com/v1beta (read-only)
- Models: Gemini 1.5 Pro, Flash, Flash 8B (all with vision)

#### Custom OpenAI Compatible
- API Key: Your custom provider API key
- API URL: Your custom API endpoint (configurable)
- Provider Name: Custom name for identification
- Models: Fetched from `/models` endpoint or manually added

## Usage Guide

### Setting Up a Provider

1. **Select Provider**: Choose from the dropdown in the Model tab
2. **Enter API Key**: Paste your API key for the selected provider
3. **Configure URL** (Custom only): Enter your custom API endpoint
4. **Sync Models**: Click "Sync Models" to fetch available models
5. **Select Model**: Choose your preferred model from the dropdown

### Adding Custom Models

1. **Click "Add Model"**: Opens the manual model form
2. **Enter Model ID**: The exact model identifier (e.g., "gpt-4-custom")
3. **Enter Display Name**: Human-readable name (e.g., "GPT-4 Custom")
4. **Save**: Model is added to the current provider

### Switching Between Providers

1. **Change Provider**: Select different provider from dropdown
2. **Configure**: Enter API key if not already configured
3. **Sync/Select**: Sync models and select preferred model
4. **Use**: The extension will automatically use the selected provider and model

## Migration from Old System

The new system automatically migrates from the old settings:

### What Gets Migrated
- **API Key**: Moved to appropriate provider based on URL
- **API URL**: Used to detect provider and configure accordingly
- **Selected Model**: Preserved if available in new system
- **Custom Models**: Converted to manual models for detected provider

### Migration Process
1. **Automatic Detection**: System detects provider from old API URL
2. **Key Migration**: API key moved to detected provider
3. **Model Migration**: Custom models added as manual models
4. **Cleanup**: Old settings are preserved until manual cleanup

### Post-Migration Steps
1. **Verify Configuration**: Check that provider is correctly configured
2. **Sync Models**: Refresh model list from provider
3. **Update Selection**: Choose preferred model if needed
4. **Test**: Verify that chat functionality works correctly

## API Integration

### Model Manager Class

```typescript
import { modelManager } from './utils/modelManager';

// Initialize (call once)
await modelManager.initialize();

// Get current configuration
const config = modelManager.getCurrentConfig();
// Returns: { apiKey: string, apiUrl: string, model: string } | null

// Get all available models
const models = modelManager.getAllModels();

// Get models for specific provider
const openaiModels = modelManager.getModels('openai');

// Add manual model
modelManager.addManualModel('openai', {
  id: 'gpt-4-custom',
  name: 'GPT-4 Custom'
});

// Sync models from API
const result = await modelManager.syncModels('openai');
if (result.success) {
  console.log('Models synced:', result.models);
} else {
  console.error('Sync failed:', result.error);
}
```

### Usage in Components

```typescript
// In message handler
const config = modelManager.getCurrentConfig();
if (config) {
  const apiClient = createAPIClient(config.apiKey, config.apiUrl);
  // Use apiClient for requests
}

// In UI components
const selectedModel = modelManager.getSelectedModel();
const allModels = modelManager.getAllModels();
// Populate dropdowns, show current selection
```

## Storage Structure

### New Storage Format
```json
{
  "modelManagerData": {
    "providers": {
      "openai": {
        "id": "openai",
        "name": "OpenAI",
        "apiKey": "sk-...",
        "apiUrl": "https://api.openai.com/v1",
        "isCustom": false,
        "isConfigured": true
      }
    },
    "models": {
      "openai": [
        {
          "id": "gpt-4o",
          "name": "GPT-4O",
          "provider": "openai",
          "isManual": false,
          "isVision": true
        }
      ]
    },
    "selectedModel": "gpt-4o",
    "selectedProvider": "openai"
  }
}
```

### Legacy Storage (Migrated)
```json
{
  "settings": {
    "apiKey": "sk-...",
    "apiUrl": "https://api.openai.com/v1",
    "model": "gpt-4o"
  },
  "customModels": ["custom-model-1", "custom-model-2"]
}
```

## Error Handling

### Provider Configuration Errors
- **Missing API Key**: Clear error message with setup instructions
- **Invalid API Key**: Authentication error with key validation
- **Network Issues**: Retry logic with exponential backoff
- **Rate Limits**: Automatic rate limiting with user feedback

### Model Sync Errors
- **API Unavailable**: Fallback to default models
- **Invalid Response**: Error display with retry option
- **Timeout**: Network timeout handling
- **Permission Issues**: Clear error messages

### Fallback Behavior
- **No Configured Providers**: Shows setup instructions
- **No Available Models**: Falls back to default model list
- **Sync Failures**: Uses cached models or defaults
- **Invalid Selection**: Auto-selects first available model

## Security Considerations

### API Key Storage
- **Encrypted Storage**: API keys stored in Chrome's secure storage
- **No Transmission**: Keys never sent to third parties
- **Local Only**: All processing happens locally in extension
- **Secure Display**: Keys masked in UI with toggle option

### Provider Isolation
- **Separate Configurations**: Each provider has isolated settings
- **Independent Storage**: Provider data stored separately
- **No Cross-Contamination**: Provider failures don't affect others
- **Secure Defaults**: Safe default configurations

## Troubleshooting

### Common Issues

#### "No models available"
1. Check provider configuration
2. Verify API key is correct
3. Try syncing models manually
4. Check network connectivity

#### "Provider not configured"
1. Select provider from dropdown
2. Enter valid API key
3. Save configuration
4. Sync models

#### "Model sync failed"
1. Check API key validity
2. Verify network connection
3. Check provider status
4. Try again after a few minutes

#### Migration issues
1. Check old settings are present
2. Manually configure providers if needed
3. Re-sync models after migration
4. Contact support if issues persist

### Debug Information

Enable debug logging:
```javascript
// In browser console
localStorage.setItem('modelManagerDebug', 'true');
```

Check storage:
```javascript
// View current configuration
chrome.storage.sync.get(['modelManagerData'], console.log);

// View legacy settings
chrome.storage.sync.get(['settings', 'customModels'], console.log);
```

## Future Enhancements

### Planned Features
- **Model Performance Metrics**: Track usage and performance
- **Cost Tracking**: Monitor API usage and costs
- **Model Recommendations**: Suggest optimal models for tasks
- **Batch Operations**: Bulk model management operations
- **Export/Import**: Configuration backup and restore
- **Advanced Filtering**: Filter models by capabilities
- **Model Comparison**: Side-by-side model comparisons

### Provider Additions
- **Anthropic Claude**: Support for Claude models
- **Local Models**: Ollama and other local LLM support
- **Azure OpenAI**: Microsoft Azure OpenAI Service
- **Cohere**: Cohere API integration
- **Hugging Face**: Hugging Face Inference API

### UI Improvements
- **Provider Status Dashboard**: Real-time provider health
- **Model Usage Analytics**: Usage patterns and statistics
- **Quick Setup Wizard**: Guided provider configuration
- **Bulk Model Import**: Import models from configuration files
- **Advanced Search**: Search and filter models
- **Favorites**: Mark frequently used models

 