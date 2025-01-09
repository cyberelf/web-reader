import { marked } from 'marked';

export function configureMarked(): void {
  marked.setOptions({
    breaks: true,
    gfm: true,
    async: false
  });
}

export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
} 