# Gemini Provider Setup Guide

This guide explains how to set up and use Google's Gemini models with the web-reader extension.

## Getting Started

### 1. Get a Google AI API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure the Extension

1. Open the web-reader extension settings
2. Set the API URL to: `https://generativelanguage.googleapis.com/v1beta`
3. Paste your Google AI API key
4. Select a Gemini model:
   - `gemini-1.5-pro` - Most capable model
   - `gemini-1.5-flash` - Faster, optimized for speed
   - `gemini-1.5-flash-8b` - Lightweight, cost-effective

## Supported Features

### ✅ Text Generation
- Full conversational AI capabilities
- System instructions support
- Streaming responses

### ✅ Vision Analysis
- Image understanding and analysis
- Multi-modal conversations
- Screenshot analysis

### ✅ Rate Limiting
- Automatic rate limit management
- Free tier: 15 requests/minute, 50K tokens/day
- Paid tier: 360 requests/minute, 4M tokens/day

## Model Comparison

| Model | Speed | Capability | Cost | Best For |
|-------|-------|------------|------|----------|
| gemini-1.5-pro | Slower | Highest | Higher | Complex reasoning, analysis |
| gemini-1.5-flash | Fast | High | Medium | General use, quick responses |
| gemini-1.5-flash-8b | Fastest | Good | Lowest | Simple tasks, high volume |

## API Differences

The extension automatically handles the differences between OpenAI and Gemini APIs:

### Request Format Conversion
- **System messages**: Converted to user messages with "System instruction:" prefix
- **Assistant role**: Mapped to "model" role in Gemini
- **Images**: Converted from URLs to inline base64 data

### Response Format
- **Content**: Extracted from `candidates[0].content.parts[0].text`
- **Usage stats**: Mapped from `usageMetadata` to standard format
- **Streaming**: Handles Gemini's SSE format

## Rate Limits

### Free Tier
- 15 requests per minute
- 1,500 requests per day
- 32,000 tokens per minute
- 50,000 tokens per day

### Paid Tier
- 360 requests per minute
- 50,000 requests per day
- 4,000,000 tokens per minute
- 4,000,000 tokens per day

## Example Usage

### Basic Text Generation
```javascript
// The extension handles this automatically when you:
// 1. Set API URL to Google's endpoint
// 2. Select a Gemini model
// 3. Ask any question

// Behind the scenes, this OpenAI-format request:
{
  "model": "gemini-1.5-pro",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Explain quantum computing"}
  ]
}

// Gets converted to Gemini format:
{
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "System instruction: You are a helpful assistant"}]
    },
    {
      "role": "user", 
      "parts": [{"text": "Explain quantum computing"}]
    }
  ],
  "generationConfig": {
    "maxOutputTokens": 4000,
    "temperature": 0.7
  }
}
```

### Image Analysis
```javascript
// When you upload an image or take a screenshot:
{
  "model": "gemini-1.5-pro",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "What's in this image?"},
      {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
    ]
  }]
}

// Converts to:
{
  "contents": [{
    "role": "user",
    "parts": [
      {"text": "What's in this image?"},
      {
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "base64-image-data"
        }
      }
    ]
  }]
}
```

## Troubleshooting

### Common Issues

1. **"API key not valid"**
   - Verify your API key is correct
   - Ensure you're using the Google AI API key, not a different Google service key

2. **"Model not found"**
   - Check that you're using a valid Gemini model name
   - Ensure the model is available in your region

3. **Rate limit errors**
   - The extension will automatically handle rate limits
   - Consider upgrading to paid tier for higher limits

4. **Image analysis not working**
   - Ensure you're using `gemini-1.5-pro` or `gemini-1.5-flash` (vision-capable models)
   - Check that images are in supported formats (JPEG, PNG, WebP, HEIC, HEIF)

### Getting Help

- Check the browser console for detailed error messages
- Verify your API key has the necessary permissions
- Ensure you're within your quota limits

## Cost Optimization

### Tips for Reducing Costs
1. Use `gemini-1.5-flash-8b` for simple tasks
2. Keep conversations concise
3. Use appropriate `max_tokens` settings
4. Monitor your usage in Google AI Studio

### Free Tier Optimization
- Limit requests to stay within daily quotas
- Use the extension's built-in rate limiting
- Consider caching responses for repeated queries

## Security Notes

- API keys are stored locally in the browser extension
- No data is sent to third parties
- All communication is directly with Google's API
- Consider using environment-specific API keys for development vs production 