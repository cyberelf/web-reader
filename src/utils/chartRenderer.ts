// Lightweight chart renderer for basic diagrams
// Supports simplified versions of mermaid syntax

interface Node {
  id: string;
  text: string;
  shape: 'rect' | 'circle' | 'diamond' | 'rounded';
  x: number;
  y: number;
  level?: number;
  parent?: string;
}

interface Edge {
  from: string;
  to: string;
  text?: string;
}

interface DiagramData {
  nodes: Node[];
  edges: Edge[];
  type: 'graph' | 'flowchart' | 'sequence' | 'pie' | 'mindmap' | 'unsupported';
}

// Parse simple mermaid syntax
function parseMermaidCode(code: string): DiagramData {
  const lines = code.trim().split('\n').map(line => line.trim()).filter(line => line);
  const firstLine = lines[0].toLowerCase();
  
  const result: DiagramData = {
    nodes: [],
    edges: [],
    type: 'unsupported'
  };

  // Detect diagram type
  if (firstLine.includes('graph') || firstLine.includes('flowchart')) {
    result.type = 'flowchart';
    return parseFlowchart(lines.slice(1));
  } else if (firstLine.includes('pie')) {
    result.type = 'pie';
    return parsePieChart(lines.slice(1));
  } else if (firstLine.includes('mindmap')) {
    result.type = 'mindmap';
    return parseMindmap(lines.slice(1));
  }

  return result;
}

// Parse flowchart syntax
function parseFlowchart(lines: string[]): DiagramData {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];

  // First pass: collect all node definitions
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Parse node definitions with labels: A[Label], A{Decision}, A((Circle)), A(rounded_square)
    const nodeDefRegex = /(\w+)(\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\)|\(([^)]+)\))/g;
    let nodeMatch;
    
    while ((nodeMatch = nodeDefRegex.exec(trimmed)) !== null) {
      const [, id, , rectLabel, diamondLabel, circleLabel, roundedSquareLabel] = nodeMatch;
      const text = rectLabel || diamondLabel || circleLabel || roundedSquareLabel || id;
      const shape = rectLabel ? 'rect' : (diamondLabel ? 'diamond' : (circleLabel ? 'circle' : 'rect'));
      
      if (!nodes.has(id)) {
        nodes.set(id, { id, text, shape, x: 0, y: 0 });
      }
    }
  });

  // Second pass: collect connections and create missing nodes
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Parse arrows: A --> B, A -->|label| B, etc.
    const arrowRegex = /(\w+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\))?\s*-->\s*(?:\|([^|]+)\|)?\s*(\w+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\))?/g;
    let arrowMatch;
    
    while ((arrowMatch = arrowRegex.exec(trimmed)) !== null) {
      const [, fromId, fromRect, fromDiamond, fromCircle, edgeLabel, toId, toRect, toDiamond, toCircle] = arrowMatch;
      
      // Create from node if it doesn't exist
      if (!nodes.has(fromId)) {
        const fromText = fromRect || fromDiamond || fromCircle || fromId;
        const fromShape = fromRect ? 'rect' : (fromDiamond ? 'diamond' : (fromCircle ? 'circle' : 'rect'));
        nodes.set(fromId, { id: fromId, text: fromText, shape: fromShape, x: 0, y: 0 });
      }
      
      // Create to node if it doesn't exist
      if (!nodes.has(toId)) {
        const toText = toRect || toDiamond || toCircle || toId;
        const toShape = toRect ? 'rect' : (toDiamond ? 'diamond' : (toCircle ? 'circle' : 'rect'));
        nodes.set(toId, { id: toId, text: toText, shape: toShape, x: 0, y: 0 });
      }
      
      // Add edge
      const edge: Edge = { from: fromId, to: toId };
      if (edgeLabel) edge.text = edgeLabel;
      edges.push(edge);
    }
  });

  return {
    nodes: Array.from(nodes.values()),
    edges,
    type: 'flowchart'
  };
}

// Parse mindmap syntax
function parseMindmap(lines: string[]): DiagramData {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map<string, Node>();
  
  // Root node
  if (lines.length > 0) {
    const rootText = lines[0].trim();
    const rootNode: Node = {
      id: 'root',
      text: rootText,
      shape: 'rounded',
      x: 0,
      y: 0,
      level: 0
    };
    nodes.push(rootNode);
    nodeMap.set('root', rootNode);
  }

  // Parse children with indentation - track parent hierarchy properly
  let nodeCounter = 1;
  const parentStack: Array<{ id: string; level: number }> = [{ id: 'root', level: 0 }];
  
  lines.slice(1).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const indentLevel = line.length - line.trimStart().length;
    const level = Math.floor(indentLevel / 2) + 1; // 2 spaces = 1 level
    
    const nodeId = `node_${nodeCounter++}`;
    const node: Node = {
      id: nodeId,
      text: trimmed,
      shape: 'rounded',
      x: 0,
      y: 0,
      level
    };
    
    nodes.push(node);
    nodeMap.set(nodeId, node);
    
    // Pop from stack until we find the correct parent level
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop();
    }
    
    // Current parent is the top of the stack
    const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : 'root';
    node.parent = parentId;
    edges.push({ from: parentId, to: nodeId });
    
    // Add this node to the stack as a potential parent
    parentStack.push({ id: nodeId, level });
  });

  return {
    nodes,
    edges,
    type: 'mindmap'
  };
}

// Parse pie chart syntax
function parsePieChart(lines: string[]): DiagramData {
  const nodes: Node[] = [];
  const data: Array<{ label: string; value: number }> = [];

  lines.forEach(line => {
    const match = line.match(/"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const [, label, valueStr] = match;
      const value = parseFloat(valueStr);
      data.push({ label, value });
    }
  });

  return {
    nodes,
    edges: [],
    type: 'pie'
  };
}

// Auto-layout nodes for flowchart
function layoutFlowchartNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Simple auto-layout: arrange in levels based on connections
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  // Find root nodes (no incoming edges)
  const hasIncoming = new Set(edges.map(e => e.to));
  const roots = nodes.filter(n => !hasIncoming.has(n.id));

  // BFS to assign levels
  const queue = roots.map(n => ({ id: n.id, level: 0 }));
  roots.forEach(n => levels.set(n.id, 0));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const outgoing = edges.filter(e => e.from === id);
    outgoing.forEach(edge => {
      if (!levels.has(edge.to) || levels.get(edge.to)! < level + 1) {
        levels.set(edge.to, level + 1);
        queue.push({ id: edge.to, level: level + 1 });
      }
    });
  }

  // Position nodes
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(nodeId);
  });

  const nodeWidth = 160;
  const nodeHeight = 80; // Increased to match rendering function
  const levelHeight = 170; // Increased to accommodate taller nodes
  const nodeSpacing = 120; // Slightly increased spacing

  return nodes.map(node => {
    const level = levels.get(node.id) || 0;
    const nodesAtLevel = levelGroups.get(level) || [node.id];
    const indexAtLevel = nodesAtLevel.indexOf(node.id);
    
    // Calculate proper spacing to prevent overlap
    const totalNodes = nodesAtLevel.length;
    const totalSpacing = (totalNodes - 1) * nodeSpacing;
    const totalWidth = totalNodes * nodeWidth + totalSpacing;
    const startX = -totalWidth / 2;
    
    return {
      ...node,
      x: startX + indexAtLevel * (nodeWidth + nodeSpacing) + nodeWidth / 2,
      y: level * levelHeight + 60
    };
  });
}

// Layout mindmap nodes in vertical tree structure
function layoutMindmapNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const nodeWidth = 120;
  const nodeHeight = 35;
  const levelWidth = 250;
  const verticalSpacing = 70;

  // Group nodes by level
  const levelGroups = new Map<number, Node[]>();
  nodes.forEach(node => {
    const level = node.level || 0;
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(node);
  });

  // Position root at center
  const rootNode = nodes.find(n => n.id === 'root');
  if (rootNode) {
    rootNode.x = 0;
    rootNode.y = 0;
  }

  // Position other levels with proper hierarchy support
  levelGroups.forEach((levelNodes, level) => {
    if (level === 0) return; // Skip root
    
    const x = level * levelWidth;
    
    // Group nodes by their parent for better vertical distribution
    const nodesByParent = new Map<string, Node[]>();
    levelNodes.forEach(node => {
      const parentId = node.parent || 'root';
      if (!nodesByParent.has(parentId)) nodesByParent.set(parentId, []);
      nodesByParent.get(parentId)!.push(node);
    });
    
    let currentY = 0;
    nodesByParent.forEach((siblings, parentId) => {
      const parentNode = nodes.find(n => n.id === parentId);
      const parentY = parentNode ? parentNode.y : 0;
      
      // Center siblings around parent's Y position
      const totalSiblingsHeight = siblings.length * verticalSpacing;
      const startY = parentY - totalSiblingsHeight / 2 + verticalSpacing / 2;
      
      siblings.forEach((node, index) => {
        node.x = x;
        node.y = startY + index * verticalSpacing;
      });
      
      currentY = Math.max(currentY, startY + totalSiblingsHeight);
    });
  });

  return nodes;
}

// Render flowchart as SVG
function renderFlowchartSVG(data: DiagramData): string {
  if (data.nodes.length === 0) {
    return '<svg viewBox="0 0 300 100" class="chart-svg"><text x="150" y="50" text-anchor="middle" class="chart-text">Empty flowchart</text></svg>';
  }

  const positionedNodes = layoutFlowchartNodes(data.nodes, data.edges);
  
  // Calculate bounds with padding - increased height for multi-line text
  const nodeWidth = 160;
  const nodeHeight = 80; // Increased to accommodate 3 lines of text
  const padding = 50;
  
  const minX = Math.min(...positionedNodes.map(n => n.x)) - nodeWidth / 2 - padding;
  const maxX = Math.max(...positionedNodes.map(n => n.x)) + nodeWidth / 2 + padding;
  const minY = Math.min(...positionedNodes.map(n => n.y)) - nodeHeight / 2 - padding;
  const maxY = Math.max(...positionedNodes.map(n => n.y)) + nodeHeight / 2 + padding;
  
  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<svg viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" class="chart-svg">`;
  
  // Add styles
  svg += `<defs>
    <style>
      .chart-node { 
        fill: var(--chart-node-bg, #f8f9fa); 
        stroke: var(--chart-node-border, #4a90e2); 
        stroke-width: 2; 
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      .chart-node-text { 
        fill: var(--chart-text-color, #2c3e50); 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        font-size: 16px; 
        font-weight: 500;
        text-anchor: middle; 
        dominant-baseline: middle; 
      }
      .chart-edge { 
        stroke: var(--chart-edge-color, #4a90e2); 
        stroke-width: 2; 
        fill: none; 
        marker-end: url(#arrowhead); 
      }
      .chart-edge-text { 
        fill: var(--chart-text-color, #2c3e50); 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        font-size: 14px; 
        text-anchor: middle; 
        background: white;
      }
    </style>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="var(--chart-edge-color, #4a90e2)" />
    </marker>
  </defs>`;

  // Render edges first (so they appear behind nodes)
  data.edges.forEach(edge => {
    const fromNode = positionedNodes.find(n => n.id === edge.from);
    const toNode = positionedNodes.find(n => n.id === edge.to);
    
    if (fromNode && toNode) {
      // Calculate edge connection points at box boundaries
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        const unitX = dx / length;
        const unitY = dy / length;
        
        // Connection points at box edges
        const fromX = fromNode.x + unitX * (nodeWidth / 2);
        const fromY = fromNode.y + unitY * (nodeHeight / 2);
        const toX = toNode.x - unitX * (nodeWidth / 2);
        const toY = toNode.y - unitY * (nodeHeight / 2);
        
        svg += `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" class="chart-edge" />`;
        
        if (edge.text) {
          const midX = (fromX + toX) / 2;
          const midY = (fromY + toY) / 2;
          const textBg = edge.text.length * 6 + 8;
          svg += `<rect x="${midX - textBg/2}" y="${midY - 10}" width="${textBg}" height="20" fill="white" stroke="none" rx="4" />`;
          svg += `<text x="${midX}" y="${midY}" class="chart-edge-text">${edge.text}</text>`;
        }
      }
    }
  });

  // Render nodes
  positionedNodes.forEach(node => {
    const x = node.x;
    const y = node.y;
    
    if (node.shape === 'circle') {
      svg += `<circle cx="${x}" cy="${y}" r="30" class="chart-node" />`;
    } else if (node.shape === 'diamond') {
      svg += `<polygon points="${x},${y-25} ${x+35},${y} ${x},${y+25} ${x-35},${y}" class="chart-node" />`;
    } else {
      // Rectangle (default)
      const rx = node.shape === 'rounded' ? '8' : '4';
      svg += `<rect x="${x - nodeWidth/2}" y="${y - nodeHeight/2}" width="${nodeWidth}" height="${nodeHeight}" rx="${rx}" class="chart-node" />`;
    }
    
    // Enhanced text wrapping with better support for Chinese characters
    const text = node.text;
    const maxCharsPerLine = 14; // Reduced for larger font size
    const lineHeight = 18; // Increased line height for 16px font
    
    // Function to measure text width (approximate)
    function getTextWidth(text: string): number {
      // Chinese chars are roughly 1.5x wider than ASCII
      let width = 0;
      for (let char of text) {
        width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
      }
      return width;
    }
    
    // Smart text wrapping
    function wrapText(text: string, maxWidth: number): string[] {
      const lines: string[] = [];
      let currentLine = '';
      
      // Split by spaces first, then by characters if needed
      const parts = text.split(/(\s+|(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff]))/);
      
      for (const part of parts) {
        if (!part.trim()) continue;
        
        const testLine = currentLine + part;
        if (getTextWidth(testLine) <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine.trim());
            currentLine = part;
          } else {
            // Handle very long single words/characters
            if (getTextWidth(part) > maxWidth) {
              const truncated = part.slice(0, Math.floor(maxWidth * 0.8)) + '...';
              lines.push(truncated);
              currentLine = '';
            } else {
              currentLine = part;
            }
          }
        }
      }
      
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      
      return lines;
    }
    
    const wrappedLines = wrapText(text, maxCharsPerLine);
    const maxLines = 3; // Allow up to 3 lines
    const displayLines = wrappedLines.slice(0, maxLines);
    
    // Add ellipsis if text was truncated
    if (wrappedLines.length > maxLines) {
      const lastLine = displayLines[maxLines - 1];
      displayLines[maxLines - 1] = lastLine.slice(0, -3) + '...';
    }
    
    // Render text lines
    if (displayLines.length === 1) {
      svg += `<text x="${x}" y="${y}" class="chart-node-text">${displayLines[0]}</text>`;
    } else {
      const startY = y - (displayLines.length - 1) * lineHeight / 2;
      displayLines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        svg += `<text x="${x}" y="${lineY}" class="chart-node-text">${line}</text>`;
      });
    }
  });

  svg += '</svg>';
  return svg;
}

// Render mindmap as SVG
function renderMindmapSVG(data: DiagramData): string {
  if (data.nodes.length === 0) {
    return '<svg viewBox="0 0 300 100" class="chart-svg"><text x="150" y="50" text-anchor="middle" class="chart-text">Empty mindmap</text></svg>';
  }

  const positionedNodes = layoutMindmapNodes(data.nodes, data.edges);
  
  // Calculate bounds
  const padding = 60;
  const minX = Math.min(...positionedNodes.map(n => n.x)) - 100 - padding;
  const maxX = Math.max(...positionedNodes.map(n => n.x)) + 100 + padding;
  const minY = Math.min(...positionedNodes.map(n => n.y)) - 30 - padding;
  const maxY = Math.max(...positionedNodes.map(n => n.y)) + 30 + padding;
  
  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<svg viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" class="chart-svg">`;
  
  // Add mindmap-specific styles
  svg += `<defs>
    <style>
      .mindmap-root { 
        fill: var(--chart-root-bg, #e74c3c); 
        stroke: var(--chart-root-border, #c0392b); 
        stroke-width: 3; 
      }
      .mindmap-branch { 
        fill: var(--chart-branch-bg, #3498db); 
        stroke: var(--chart-branch-border, #2980b9); 
        stroke-width: 2; 
      }
      .mindmap-leaf { 
        fill: var(--chart-leaf-bg, #2ecc71); 
        stroke: var(--chart-leaf-border, #27ae60); 
        stroke-width: 2; 
      }
      .mindmap-text { 
        fill: white; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        font-size: 15px; 
        font-weight: 600;
        text-anchor: middle; 
        dominant-baseline: middle; 
      }
      .mindmap-connection { 
        stroke: var(--chart-edge-color, #7f8c8d); 
        stroke-width: 3; 
        fill: none; 
        stroke-linecap: round;
      }
    </style>
  </defs>`;

  // Render connections first - connect to box edges like in the reference image
  data.edges.forEach(edge => {
    const fromNode = positionedNodes.find(n => n.id === edge.from);
    const toNode = positionedNodes.find(n => n.id === edge.to);
    
    if (fromNode && toNode) {
      const nodeWidth = 120;
      const nodeHeight = 30;
      
      // Calculate connection points at box edges
      let fromX, fromY, toX, toY;
      
      if (fromNode.x < toNode.x) {
        // From left to right
        fromX = fromNode.x + nodeWidth / 2;  // Right edge of from node
        toX = toNode.x - nodeWidth / 2;      // Left edge of to node
      } else {
        // From right to left
        fromX = fromNode.x - nodeWidth / 2;  // Left edge of from node
        toX = toNode.x + nodeWidth / 2;      // Right edge of to node
      }
      
      fromY = fromNode.y;
      toY = toNode.y;
      
      // Create smooth curved connection like in the reference image
      const controlPointOffset = Math.abs(toX - fromX) * 0.5;
      const cp1X = fromX + (fromX < toX ? controlPointOffset : -controlPointOffset);
      const cp1Y = fromY;
      const cp2X = toX + (fromX < toX ? -controlPointOffset : controlPointOffset);
      const cp2Y = toY;
      
      svg += `<path d="M ${fromX} ${fromY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${toY}" class="mindmap-connection" />`;
    }
  });

  // Render nodes with improved text wrapping
  positionedNodes.forEach(node => {
    const x = node.x;
    const y = node.y;
    
    // Enhanced text wrapping for mindmap nodes
    const text = node.text;
    const maxCharsPerLine = node.level === 0 ? 16 : 14; // Root can be wider, adjusted for larger font
    const lineHeight = 16; // Increased line height for 15px font
    
    // Function to measure text width (same as flowchart)
    function getTextWidth(text: string): number {
      let width = 0;
      for (let char of text) {
        width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
      }
      return width;
    }
    
    // Smart text wrapping (same as flowchart)
    function wrapText(text: string, maxWidth: number): string[] {
      const lines: string[] = [];
      let currentLine = '';
      
      const parts = text.split(/(\s+|(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff]))/);
      
      for (const part of parts) {
        if (!part.trim()) continue;
        
        const testLine = currentLine + part;
        if (getTextWidth(testLine) <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine.trim());
            currentLine = part;
          } else {
            if (getTextWidth(part) > maxWidth) {
              const truncated = part.slice(0, Math.floor(maxWidth * 0.8)) + '...';
              lines.push(truncated);
              currentLine = '';
            } else {
              currentLine = part;
            }
          }
        }
      }
      
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      
      return lines;
    }
    
    const wrappedLines = wrapText(text, maxCharsPerLine);
    const maxLines = 2; // Mindmap nodes should be more compact
    const displayLines = wrappedLines.slice(0, maxLines);
    
    // Add ellipsis if text was truncated
    if (wrappedLines.length > maxLines) {
      const lastLine = displayLines[maxLines - 1];
      displayLines[maxLines - 1] = lastLine.slice(0, -3) + '...';
    }
    
    // Calculate node dimensions based on text
    const longestLine = displayLines.reduce((max, line) => 
      getTextWidth(line) > getTextWidth(max) ? line : max, displayLines[0] || '');
    const textWidth = Math.max(60, getTextWidth(longestLine) * 8.5); // Increased multiplier for larger font
    const width = textWidth + 20;
    const height = Math.max(35, displayLines.length * lineHeight + 16);
    
    // Determine node style based on level
    let nodeClass = 'mindmap-leaf';
    if (node.level === 0) nodeClass = 'mindmap-root';
    else if (node.level === 1) nodeClass = 'mindmap-branch';
    
    // Rounded rectangle
    svg += `<rect x="${x - width/2}" y="${y - height/2}" width="${width}" height="${height}" rx="17" class="${nodeClass}" />`;
    
    // Render text lines
    if (displayLines.length === 1) {
      svg += `<text x="${x}" y="${y}" class="mindmap-text">${displayLines[0]}</text>`;
    } else {
      const startY = y - (displayLines.length - 1) * lineHeight / 2;
      displayLines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        svg += `<text x="${x}" y="${lineY}" class="mindmap-text">${line}</text>`;
      });
    }
  });

  svg += '</svg>';
  return svg;
}

// Render pie chart as SVG (improved)
function renderPieChartSVG(data: DiagramData, code: string): string {
  const lines = code.split('\n').slice(1); // Skip first line
  const pieData: Array<{ label: string; value: number }> = [];

  lines.forEach(line => {
    const match = line.match(/"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const [, label, valueStr] = match;
      const value = parseFloat(valueStr);
      pieData.push({ label, value });
    }
  });

  if (pieData.length === 0) {
    return '<svg viewBox="0 0 300 100" class="chart-svg"><text x="150" y="50" text-anchor="middle" class="chart-text">No pie data</text></svg>';
  }

  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
  
  let svg = '<svg viewBox="0 0 500 350" width="500" height="350" class="chart-svg">';
  svg += `<defs>
    <style>
      .pie-text { 
        fill: var(--chart-text-color, #2c3e50); 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        font-size: 16px; 
        font-weight: 500;
      }
      .pie-slice { 
        stroke: var(--chart-bg, #fff); 
        stroke-width: 2; 
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      .pie-slice:hover {
        opacity: 0.8;
        transform: scale(1.02);
        transform-origin: center;
      }
    </style>
  </defs>`;

  const centerX = 180;
  const centerY = 175;
  const radius = 100;
  let startAngle = 0;

  // Draw pie slices
  pieData.forEach((item, index) => {
    const percentage = item.value / total;
    const endAngle = startAngle + (percentage * 2 * Math.PI);
    
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);
    
    const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    const color = colors[index % colors.length];
    svg += `<path d="${pathData}" fill="${color}" class="pie-slice" />`;
    
    startAngle = endAngle;
  });

  // Add improved legend
  let legendY = 40;
  pieData.forEach((item, index) => {
    const color = colors[index % colors.length];
    const percentage = ((item.value / total) * 100).toFixed(1);
    
    svg += `<rect x="320" y="${legendY - 10}" width="16" height="16" rx="2" fill="${color}" />`;
    svg += `<text x="345" y="${legendY}" class="pie-text">${item.label}</text>`;
    svg += `<text x="345" y="${legendY + 15}" class="pie-text" style="font-size: 11px; opacity: 0.7;">${percentage}% (${item.value})</text>`;
    legendY += 45;
  });

  svg += '</svg>';
  return svg;
}




// Chart type icons mapping
const CHART_ICONS: Record<string, string> = {
  'flowchart': '📊',
  'mindmap': '🗺️',
  'pie': '🥧'
};

// Create chart container with header and resize button
function createChartContainer(svg: string, diagramId: string, chartType: string): string {
  const icon = CHART_ICONS[chartType.toLowerCase()] || '📊';
  
  return `<div class="chart-container" data-diagram-id="${diagramId}" data-fit-mode="fit">
    <div class="chart-header">
      <span class="chart-type-label">${icon} ${chartType}</span>
      <button class="chart-resize-toggle" title="Switch to original size" data-diagram-id="${diagramId}">⛶</button>
    </div>
    <div class="chart-content">${svg}</div>
  </div>`;
}

// Main render function
export function renderChart(code: string, diagramId: string): string {
  try {
    const data = parseMermaidCode(code);
    
    if (data.type === 'flowchart') {
      const svg = renderFlowchartSVG(data);
      return createChartContainer(svg, diagramId, 'Flowchart');
    } else if (data.type === 'mindmap') {
      const svg = renderMindmapSVG(data);
      return createChartContainer(svg, diagramId, 'Mindmap');
    } else if (data.type === 'pie') {
      const svg = renderPieChartSVG(data, code);
      return createChartContainer(svg, diagramId, 'Pie Chart');
    } else {
      // Unsupported diagram type
      return createChartFallback(code, diagramId, 'Diagram type not supported by lightweight renderer');
    }
  } catch (error) {
    console.warn('Chart rendering error:', error);
    return createChartFallback(code, diagramId, error instanceof Error ? error.message : 'Unknown error');
  }
}

// Fallback display for unsupported or failed charts
function createChartFallback(code: string, diagramId: string, errorMessage?: string): string {
  const lines = code.split('\n');
  const diagramType = lines[0]?.trim() || 'diagram';
  
  let diagramName = 'Diagram';
  if (diagramType.includes('graph') || diagramType.includes('flowchart')) {
    diagramName = 'Flowchart';
  } else if (diagramType.includes('sequence')) {
    diagramName = 'Sequence Diagram (not supported)';
  } else if (diagramType.includes('class')) {
    diagramName = 'Class Diagram (not supported)';
  } else if (diagramType.includes('state')) {
    diagramName = 'State Diagram (not supported)';
  } else if (diagramType.includes('gantt')) {
    diagramName = 'Gantt Chart (not supported)';
  } else if (diagramType.includes('pie')) {
    diagramName = 'Pie Chart';
  } else if (diagramType.includes('mindmap')) {
    diagramName = 'Mindmap';
  }

  const fallbackNote = errorMessage 
    ? `Chart rendering failed: ${errorMessage}`
    : 'Chart type not supported';

  return `<div class="chart-container chart-fallback" data-diagram-id="${diagramId}">
    <div class="chart-fallback-header">
      <span class="chart-diagram-type">📊 ${diagramName}</span>
      <span class="chart-fallback-note">${fallbackNote}</span>
    </div>
    <details class="chart-source">
      <summary>View diagram source</summary>
      <pre><code class="language-mermaid">${code}</code></pre>
    </details>
  </div>`;
} 