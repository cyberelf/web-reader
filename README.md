# Page Reader Assistant

[![Created by LLM](https://img.shields.io/badge/Created%20by-LLM-blue.svg)](.)

A Chrome extension that allows you to ask questions about web page content, images, and screenshots using AI. Powered by OpenAI's GPT models.

## Features

- 🤖 Ask questions about any webpage content
- 📸 Take screenshots and ask questions about them
- 🖼️ Drag and drop images for visual analysis
- 💬 Chat-like interface with message history
- 🌓 Light/Dark theme support
- ⌨️ Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- 🔄 Real-time streaming responses
- 📱 Responsive sidebar design
- 🎨 Support for various image formats (PNG, JPEG, GIF, WebP, SVG)

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Click the extension icon and set your OpenAI API key in the settings

## Usage

1. Click the "Ask AI" button on any webpage to open the sidebar
2. Choose your context mode:
   - Full Page: Ask about the entire page content
   - Screenshot/Image: Take a screenshot or drop an image to analyze
3. Type your question and press Enter or click "Ask Question"
4. View the AI's response in real-time

## Configuration

- Set your OpenAI API key in the extension settings
- Choose between different GPT models
- Customize the theme (Light/Dark)
- API endpoint can be configured for self-hosted deployments

## Development

The extension is built with vanilla JavaScript and CSS, requiring no build process.

Key files:
- `manifest.json`: Extension configuration
- `sidebar.js`: Main functionality
- `sidebar.css`: Styles
- `background.js`: Background service worker
- `settings.js`: Settings management

## Credits

- Built with assistance from Claude (Anthropic)
- Uses OpenAI's GPT models for AI capabilities
- Marked library for Markdown rendering
- Icons from various sources

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

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

- [ ] Support for more AI models
- [ ] Enhanced image analysis capabilities
- [ ] Custom styling options
- [ ] Export chat history
- [ ] Keyboard shortcuts customization