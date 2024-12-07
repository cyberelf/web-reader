// Markdown parsing utilities
function parseMarkdown(content) {
    try {
        // Ensure code blocks and inline code are properly formatted
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `\n\`\`\`${lang || ''}\n${code.trim()}\n\`\`\`\n`;
        });
        return marked.parse(content, { async: false });
    } catch (e) {
        console.error('Error parsing markdown:', e);
        return content;
    }
}

// Configure marked options
function configureMarked() {
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
    });
}

export { parseMarkdown, configureMarked }; 