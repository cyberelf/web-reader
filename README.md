# Page Reader Assistant

[![Created by LLM](https://img.shields.io/badge/Created%20by-LLM-blue.svg)](.)

A Chrome extension that allows you to ask questions about web page content, images, and screenshots using AI. Powered by OpenAI's GPT models.

## Features

- 🤖 Ask questions about any webpage content
- 📸 Take screenshots and ask questions about them
- 🖼️ Drag and drop images for visual analysis
- 🎥 Extract and analyze YouTube video subtitles
- 💬 Chat-like interface with message history
- 🌓 Light/Dark theme support
- ⌨️ Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- 🔄 Real-time streaming responses
- 📱 Responsive sidebar design
- 🎨 Support for various image formats (PNG, JPEG, GIF, WebP, SVG)
- 🔒 Type-safe codebase with TypeScript

## Installation

1. Download the latest release package (`web-reader.zip`) from the [Releases](https://github.com/cyberelf/web-reader/releases) page
2. Extract the zip file to a local directory
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extracted directory
6. Click the extension icon and set your OpenAI API key in the settings

## Usage

1. Click the "Ask AI" button on any webpage to open the sidebar
2. Choose your context mode:
   - Full Page: Ask about the entire page content
   - Selection: Ask about selected text
   - Screenshot/Image: Take a screenshot or drop an image to analyze
   - YouTube: Extract and analyze video subtitles (on YouTube pages)
3. Type your question and press Enter or click "Ask Question"
4. View the AI's response in real-time

## Development

### Setup
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the `dist` directory

The extension is built with TypeScript for enhanced type safety and better development experience.

### Project Structure
```
├── src/                    # TypeScript source files
│   ├── components/         # UI and feature components
│   │   ├── chat/          # Chat-related components
│   │   ├── context/       # Context handling (page, selection, screenshot, youtube)
│   │   └── ui/            # UI components
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   │   └── index.d.ts     # Global type definitions
│   ├── background.ts      # Service worker and request handling
│   ├── config.ts          # Configuration
│   ├── main.ts           # Content script entry
│   └── settings.ts        # Settings page logic
├── dist/                  # Compiled JavaScript (generated)
├── lib/                   # Third-party libraries
├── icons/                 # Extension icons
├── settings.html         # Settings page HTML
├── settings.css          # Settings styles
└── sidebar.css           # Sidebar styles
```

### Development Commands
- `npm install` - Install dependencies
- `npm run build` - Build TypeScript files
- `npm run watch` - Watch for changes and rebuild
- `npm run lint` - Run ESLint
- `npm test` - Run tests

### Configuration

- Set your OpenAI API key in the extension settings
- Choose between different GPT models
- Customize the theme (Light/Dark)
- API endpoint can be configured for self-hosted deployments

## Credits

- Built with assistance from Claude (Anthropic)
- Uses OpenAI's GPT models for AI capabilities
- Marked library for Markdown rendering
- Icons from various sources

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup
1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Make your changes in TypeScript files
4. Build and test: `npm run build`
5. Submit a pull request

## License

[MIT License](LICENSE)

## Acknowledgments

Special thanks to:
- OpenAI for their powerful API
- Claude (Anthropic) for development assistance and code improvements
- The Chrome Extensions community
- All contributors and users

## Support

For issues, questions, or suggestions:
1. Open an issue in this repository
2. Check existing issues for solutions
3. Provide detailed information about your problem

## Future Plans

- [x] TypeScript migration for improved type safety and developer experience
- [x] Support for more AI models (Implemented with model selector and GPT-4 Vision support)
- [x] Enhanced image analysis capabilities (Implemented with GPT-4 Vision API)
- [x] Custom styling options (Implemented with Light/Dark theme support)
- [ ] Export chat history
- [x] Keyboard shortcuts customization (Implemented with custom prompts and Alt+number shortcuts)
- [ ] Context-aware prompts based on page content
- [ ] Multi-language support
- [ ] Integration with other AI providers
- [x] YouTube subtitle support for video content analysis
- [ ] Browser extension sync across devices
- [ ] Advanced screenshot tools (annotations, region selection)
- [ ] Voice input/output support