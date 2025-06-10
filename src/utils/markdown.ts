import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function configureMarked(): void {
  marked.setOptions({
    breaks: true,
    gfm: true,
    async: false
  });
}

export function renderMarkdown(text: string): string {
  try {
    // Explicitly type the marked.parse result
    const html: string = marked.parse(text, { async: false }) as string;
    
    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target'],
      ALLOW_DATA_ATTR: false
    });
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // Fallback to plain text if markdown parsing fails
    return DOMPurify.sanitize(text);
  }
} 