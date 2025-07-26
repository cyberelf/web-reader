import { marked } from "marked";
import DOMPurify from "dompurify";
import { renderChart } from "./chartRenderer";

// DOMPurify configuration for chart rendering
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
    "img",
    "div",
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "text",
    "tspan",
    "defs",
    "marker",
    "foreignObject",
    "details",
    "summary",
    "span",
    "style",
    "polygon",
    "button",
  ],
  ALLOWED_ATTR: [
    "href",
    "src",
    "alt",
    "title",
    "target",
    "class",
    "id",
    "data-diagram-id",
    "onclick",
    "data-fit-mode",
    "style",
    "width",
    "height",
    "viewBox",
    "xmlns",
    "x",
    "y",
    "dx",
    "dy",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "opacity",
    "d",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x1",
    "y1",
    "x2",
    "y2",
    "text-anchor",
    "dominant-baseline",
    "font-family",
    "font-size",
    "font-weight",
    "transform",
    "marker-end",
    "marker-start",
    "refX",
    "refY",
    "markerWidth",
    "markerHeight",
    "orient",
    "markerUnits",
    "patternUnits",
    "gradientUnits",
    "gradientTransform",
    "points",
  ],
  ALLOW_DATA_ATTR: true,
};

export function configureMarked(): void {
  marked.setOptions({
    breaks: true,
    gfm: true,
    async: false,
  });
}

// Function to render chart diagrams
function renderChartDiagrams(html: string): string {
  // Find all code blocks with mermaid language
  const mermaidRegex =
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
  let result = html;
  let match;
  let diagramId = 0;

  while ((match = mermaidRegex.exec(html)) !== null) {
    const mermaidCode = match[1].trim();
    const uniqueId = `chart-diagram-${Date.now()}-${diagramId++}`;

    // Use lightweight chart renderer
    const chartContainer = renderChart(mermaidCode, uniqueId);
    result = result.replace(match[0], chartContainer);
  }

  return result;
}

export async function renderMarkdown(text: string): Promise<string> {
  try {
    // Explicitly type the marked.parse result
    const html: string = marked.parse(text, { async: false }) as string;

    // Process chart diagrams
    const htmlWithCharts = renderChartDiagrams(html);

    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(htmlWithCharts, SANITIZE_CONFIG);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to plain text if markdown parsing fails
    return DOMPurify.sanitize(text);
  }
}

// Synchronous version - now handles charts too
export function renderMarkdownSync(text: string): string {
  try {
    // Explicitly type the marked.parse result
    const html: string = marked.parse(text, { async: false }) as string;

    // Process chart diagrams (now works synchronously)
    const htmlWithCharts = renderChartDiagrams(html);

    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(htmlWithCharts, SANITIZE_CONFIG);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to plain text if markdown parsing fails
    return DOMPurify.sanitize(text);
  }
}
