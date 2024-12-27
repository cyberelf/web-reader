declare const marked: {
  setOptions: (options: {
    breaks: boolean;
    gfm: boolean;
    highlight?: (code: string, lang: string) => string;
  }) => void;
  parse: (markdown: string) => string;
};

export function configureMarked(): void {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code: string, lang: string): string => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    }
  });
}

export function renderMarkdown(text: string): string {
  return marked.parse(text);
} 