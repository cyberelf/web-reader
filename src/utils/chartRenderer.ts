// Lightweight chart renderer for basic diagrams
// Supports simplified versions of mermaid syntax

interface Node {
  id: string;
  text: string;
  shape: "rect" | "circle" | "diamond" | "rounded";
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
  type: "graph" | "flowchart" | "sequence" | "pie" | "mindmap" | "unsupported";
}

// Parse simple mermaid syntax
function parseMermaidCode(code: string): DiagramData {
  // Split lines but preserve whitespace for mindmaps
  const rawLines = code.trim().split("\n");
  const lines = rawLines.map((line) => line.trim()).filter((line) => line);

  const result: DiagramData = {
    nodes: [],
    edges: [],
    type: "unsupported",
  };

  // Handle empty input
  if (lines.length === 0) {
    return result;
  }

  const firstLine = lines[0].toLowerCase();

  // Detect diagram type
  if (firstLine.includes("graph") || firstLine.includes("flowchart")) {
    result.type = "flowchart";
    return parseFlowchart(lines.slice(1));
  } else if (firstLine.includes("pie")) {
    result.type = "pie";
    return parsePieChart(lines.slice(1));
  } else if (firstLine.includes("mindmap")) {
    result.type = "mindmap";
    // For mindmaps, we need to preserve whitespace to determine hierarchy
    const mindmapLines = rawLines.slice(1).filter((line) => line.trim());
    return parseMindmap(mindmapLines);
  }

  return result;
}

// Parse flowchart syntax
function parseFlowchart(lines: string[]): DiagramData {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];

  // First pass: collect all node definitions
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Parse node definitions with labels: A[Label], A{Decision}, A((Circle)), A(rounded_square)
    const nodeDefRegex =
      /(\w+)(\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\)|\(([^)]+)\))/g;
    let nodeMatch;

    while ((nodeMatch = nodeDefRegex.exec(trimmed)) !== null) {
      const [fullMatch, id] = nodeMatch;
      const parsed = parseNodeTextAndShape(fullMatch);
      const nodeId = parsed.id || id;
      const text = parsed.text;
      const shape = parsed.shape;

      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, { id: nodeId, text, shape, x: 0, y: 0 });
      }
    }
  });

  // Second pass: collect connections and create missing nodes
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Parse arrows: A --> B, A -->|label| B, etc.
    const arrowRegex =
      /(\w+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\))?\s*-->\s*(?:\|([^|]+)\|)?\s*(\w+)(?:\[([^\]]+)\]|\{([^}]+)\}|\(\(([^)]+)\)\))?/g;
    let arrowMatch;

    while ((arrowMatch = arrowRegex.exec(trimmed)) !== null) {
      const [
        ,
        fromIdBase,
        fromRect,
        fromDiamond,
        fromCircle,
        edgeLabel,
        toIdBase,
        toRect,
        toDiamond,
        toCircle,
      ] = arrowMatch;

      // Parse from node
      const fromNodeText =
        fromIdBase +
        (fromRect
          ? `[${fromRect}]`
          : fromDiamond
            ? `{${fromDiamond}}`
            : fromCircle
              ? `((${fromCircle}))`
              : "");
      const fromParsed = parseNodeTextAndShape(fromNodeText);
      const fromId = fromParsed.id || fromIdBase;

      // Parse to node
      const toNodeText =
        toIdBase +
        (toRect
          ? `[${toRect}]`
          : toDiamond
            ? `{${toDiamond}}`
            : toCircle
              ? `((${toCircle}))`
              : "");
      const toParsed = parseNodeTextAndShape(toNodeText);
      const toId = toParsed.id || toIdBase;

      // Create from node if it doesn't exist
      if (!nodes.has(fromId)) {
        nodes.set(fromId, {
          id: fromId,
          text: fromParsed.text,
          shape: fromParsed.shape,
          x: 0,
          y: 0,
        });
      }

      // Create to node if it doesn't exist
      if (!nodes.has(toId)) {
        nodes.set(toId, {
          id: toId,
          text: toParsed.text,
          shape: toParsed.shape,
          x: 0,
          y: 0,
        });
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
    type: "flowchart",
  };
}

// Helper function to parse node text and shape from mermaid syntax
function parseNodeTextAndShape(
  nodeText: string,
  defaultShape: "rect" | "rounded" = "rect",
): {
  id?: string;
  text: string;
  shape: "rect" | "circle" | "diamond" | "rounded";
} {
  // Check for different node shape syntaxes following mermaid specification

  // Rectangle: [text] or id[text]
  const rectMatch = nodeText.match(/^(.*?)\[([^\]]*)\]$/);
  if (rectMatch) {
    const prefix = rectMatch[1].trim();
    const text = rectMatch[2];
    return {
      id: prefix || undefined,
      text,
      shape: "rect",
    };
  }

  // Diamond: {text} or id{text}
  const diamondMatch = nodeText.match(/^(.*?)\{([^}]*)\}$/);
  if (diamondMatch) {
    const prefix = diamondMatch[1].trim();
    const text = diamondMatch[2];
    return {
      id: prefix || undefined,
      text,
      shape: "diamond",
    };
  }

  // Circle: ((text)) or id((text))
  const circleMatch = nodeText.match(/^(.*?)\(\(([^)]*)\)\)$/);
  if (circleMatch) {
    const prefix = circleMatch[1].trim();
    const text = circleMatch[2];
    return {
      id: prefix || undefined,
      text,
      shape: "circle",
    };
  }

  // Rounded: (text) or id(text) - but not ((text))
  const roundedMatch = nodeText.match(/^(.*?)\(([^)]*)\)$/);
  if (roundedMatch && !nodeText.includes("((")) {
    const prefix = roundedMatch[1].trim();
    const text = roundedMatch[2];
    return {
      id: prefix || undefined,
      text,
      shape: "rounded",
    };
  }

  // Default: use provided default shape (rect for flowcharts, rounded for mindmaps)
  return { text: nodeText, shape: defaultShape };
}

// Parse mindmap syntax
function parseMindmap(lines: string[]): DiagramData {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map<string, Node>();

  // Root node
  let rootSpacing = 0;
  if (lines.length > 0) {
    const rootText = lines[0].trim();
    const { text, shape } = parseNodeTextAndShape(rootText, "rounded");
    const rootNode: Node = {
      id: "root",
      text,
      shape,
      x: 0,
      y: 0,
      level: 0,
    };
    nodes.push(rootNode);
    nodeMap.set("root", rootNode);
    rootSpacing = lines[0].length - lines[0].trimStart().length;
  }

  // Parse children with indentation - track parent hierarchy properly
  let nodeCounter = 1;
  const parentStack: Array<{ id: string; level: number }> = [
    { id: "root", level: 0 },
  ];

  lines.slice(1).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const indentLevel = line.length - line.trimStart().length - rootSpacing;
    const level = Math.floor(indentLevel / 2); // 2 spaces = 1 level

    const nodeId = `node_${nodeCounter++}`;
    const { text, shape } = parseNodeTextAndShape(trimmed, "rounded");
    const node: Node = {
      id: nodeId,
      text,
      shape,
      x: 0,
      y: 0,
      level,
    };

    nodes.push(node);
    nodeMap.set(nodeId, node);

    // Pop from stack until we find the correct parent level
    while (
      parentStack.length > 0 &&
      parentStack[parentStack.length - 1].level >= level
    ) {
      parentStack.pop();
    }

    // Current parent is the top of the stack
    const parentId =
      parentStack.length > 0 ? parentStack[parentStack.length - 1].id : "root";
    node.parent = parentId;
    edges.push({ from: parentId, to: nodeId });

    // Add this node to the stack as a potential parent
    parentStack.push({ id: nodeId, level });
  });

  return {
    nodes,
    edges,
    type: "mindmap",
  };
}

// Parse pie chart syntax
function parsePieChart(lines: string[]): DiagramData {
  const nodes: Node[] = [];
  const data: Array<{ label: string; value: number }> = [];

  lines.forEach((line) => {
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
    type: "pie",
  };
}

// Calculate flowchart node dimensions based on text content
function calculateFlowchartNodeDimensions(text: string): {
  width: number;
  height: number;
} {
  const lineHeight = 18;

  // Adaptive width calculation for flowcharts
  function getOptimalWidthFlowchart(text: string): number {
    function getTextWidth(text: string): number {
      let width = 0;
      for (let char of text) {
        width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
      }
      return width;
    }

    const totalTextWidth = getTextWidth(text);
    let baseCharsPerLine = 14; // Base for flowcharts

    // If text is very long, increase width to avoid too many lines
    if (totalTextWidth > baseCharsPerLine * 4) {
      baseCharsPerLine = Math.min(baseCharsPerLine * 2, 24);
    } else if (totalTextWidth > baseCharsPerLine * 2) {
      baseCharsPerLine = Math.min(baseCharsPerLine * 1.5, 18);
    }

    return Math.floor(baseCharsPerLine);
  }

  const maxCharsPerLine = getOptimalWidthFlowchart(text);

  // Function to measure text width (same as mindmap)
  function getTextWidth(text: string): number {
    let width = 0;
    for (let char of text) {
      width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
    }
    return width;
  }

  // Smart text wrapping
  function wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = "";

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
            const truncated = part.slice(0, Math.floor(maxWidth * 0.8)) + "...";
            lines.push(truncated);
            currentLine = "";
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
  const displayLines = wrappedLines; // Use all wrapped lines, no truncation

  // Calculate dimensions (dynamic width and height for flowcharts)
  const longestLine = displayLines.reduce(
    (max, line) => (getTextWidth(line) > getTextWidth(max) ? line : max),
    displayLines[0] || "",
  );
  const textWidth = Math.max(120, getTextWidth(longestLine) * 9); // Dynamic width based on content
  const width = textWidth + 40; // Add padding
  const height = Math.max(80, displayLines.length * lineHeight + 16);

  return { width, height };
}

// Auto-layout nodes for flowchart
function layoutFlowchartNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Calculate actual dimensions for all nodes
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  nodes.forEach((node) => {
    const dimensions = calculateFlowchartNodeDimensions(node.text);
    nodeDimensions.set(node.id, dimensions);
  });

  // Simple auto-layout: arrange in levels based on connections
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  // Find root nodes (no incoming edges)
  const hasIncoming = new Set(edges.map((e) => e.to));
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));

  // BFS to assign levels
  const queue = roots.map((n) => ({ id: n.id, level: 0 }));
  roots.forEach((n) => levels.set(n.id, 0));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const outgoing = edges.filter((e) => e.from === id);
    outgoing.forEach((edge) => {
      if (!levels.has(edge.to) || levels.get(edge.to)! < level + 1) {
        levels.set(edge.to, level + 1);
        queue.push({ id: edge.to, level: level + 1 });
      }
    });
  }

  // Position nodes with dynamic spacing based on actual node sizes
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(nodeId);
  });

  const minNodeSpacing = 40; // Minimum spacing between nodes
  const baseHeight = 80;

  // Calculate level heights based on tallest node in each level
  const levelHeights = new Map<number, number>();
  levelGroups.forEach((nodeIds, level) => {
    const maxHeight = Math.max(
      ...nodeIds.map((id) => nodeDimensions.get(id)?.height || baseHeight),
    );
    levelHeights.set(level, maxHeight);
  });

  return nodes.map((node) => {
    const level = levels.get(node.id) || 0;
    const nodesAtLevel = levelGroups.get(level) || [node.id];
    const indexAtLevel = nodesAtLevel.indexOf(node.id);

    // Calculate total width needed for this level with proper spacing
    const totalNodes = nodesAtLevel.length;
    let totalWidth = 0;
    for (let i = 0; i < totalNodes; i++) {
      const nodeId = nodesAtLevel[i];
      const nodeWidth = nodeDimensions.get(nodeId)?.width || 160;
      totalWidth += nodeWidth;
      if (i < totalNodes - 1) {
        totalWidth += minNodeSpacing;
      }
    }

    // Calculate Y position based on accumulated level heights
    let y = 60; // Base offset
    for (let i = 0; i < level; i++) {
      const levelHeight = levelHeights.get(i) || baseHeight;
      y += levelHeight + 40; // Add spacing between levels
    }

    // Calculate X position - distribute nodes evenly with proper spacing
    const startX = -totalWidth / 2;
    let currentX = startX;

    // Position nodes sequentially to find X coordinate
    for (let i = 0; i < indexAtLevel; i++) {
      const nodeId = nodesAtLevel[i];
      const nodeWidth = nodeDimensions.get(nodeId)?.width || 160;
      currentX += nodeWidth + minNodeSpacing;
    }

    // Current node position
    const nodeWidth = nodeDimensions.get(node.id)?.width || 160;
    const x = currentX + nodeWidth / 2;

    return {
      ...node,
      x,
      y,
    };
  });
}

// Calculate actual node dimensions based on text content (same logic as rendering)
function calculateNodeDimensions(
  text: string,
  level: number,
): { width: number; height: number } {
  const lineHeight = 18; // Increased line height for better spacing

  // Function to measure text width
  function getTextWidth(text: string): number {
    let width = 0;
    for (let char of text) {
      width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
    }
    return width;
  }

  // Adaptive text wrapping - increase width for longer content
  function getOptimalDimensions(text: string): {
    maxCharsPerLine: number;
    expectedLines: number;
  } {
    const totalTextWidth = getTextWidth(text);

    // Start with base character limits
    let baseCharsPerLine = level === 0 ? 12 : 10;

    // If text is very long, increase width to avoid too many lines
    if (totalTextWidth > baseCharsPerLine * 4) {
      // For very long text, increase width significantly
      baseCharsPerLine = Math.min(baseCharsPerLine * 2, 20);
    } else if (totalTextWidth > baseCharsPerLine * 2) {
      // For moderately long text, increase width moderately
      baseCharsPerLine = Math.min(baseCharsPerLine * 1.5, 16);
    }

    const expectedLines = Math.ceil(totalTextWidth / baseCharsPerLine);
    return { maxCharsPerLine: Math.floor(baseCharsPerLine), expectedLines };
  }

  const { maxCharsPerLine } = getOptimalDimensions(text);

  // Smart text wrapping (same as rendering)
  function wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = "";

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
            // Instead of truncating, break at word boundary if possible
            const words = part.split("");
            let partialWord = "";
            for (const char of words) {
              if (getTextWidth(partialWord + char) <= maxWidth) {
                partialWord += char;
              } else {
                if (partialWord) {
                  lines.push(partialWord);
                  partialWord = char;
                } else {
                  // Single character that's too wide - just add it
                  lines.push(char);
                  partialWord = "";
                }
              }
            }
            if (partialWord) {
              currentLine = partialWord;
            }
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
  const displayLines = wrappedLines; // Use all wrapped lines, no truncation

  // Calculate dimensions with adaptive width - improved for mixed languages
  const longestLine = displayLines.reduce(
    (max, line) => (getTextWidth(line) > getTextWidth(max) ? line : max),
    displayLines[0] || "",
  );
  
  // More conservative width calculation for mixed language content
  const longestLineWidth = getTextWidth(longestLine);
  let multiplier = 8; // Base multiplier, reduced from 9
  
  // Adjust multiplier based on content characteristics
  if (longestLineWidth > 20) {
    // For longer content, use smaller multiplier to prevent excessive width
    multiplier = Math.max(6, 8 - Math.floor(longestLineWidth / 15));
  }
  
  const textWidth = Math.max(80, longestLineWidth * multiplier);
  // Cap the maximum width to prevent one node from being too wide
  const cappedTextWidth = Math.min(textWidth, 280); // Max width cap for mindmaps
  const width = cappedTextWidth + 40; // Increased padding from 20 to 40
  const height = Math.max(40, displayLines.length * lineHeight + 24); // Increased padding from 16 to 24

  return { width, height };
}


// Layout mindmap nodes with integrated two-stage algorithm
function layoutMindmapNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Helper function to get node height
  function getNodeHeight(node: Node): number {
    const dimensions = calculateNodeDimensions(node.text, node.level || 0);
    return dimensions.height;
  }

  // Calculate actual dimensions for all nodes
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  nodes.forEach((node) => {
    const dimensions = calculateNodeDimensions(node.text, node.level || 0);
    nodeDimensions.set(node.id, dimensions);
  });

  // Normalize widths within each level (make all nodes in same level use the widest width)
  const maxWidthsByLevel = new Map<number, number>();
  nodes.forEach((node) => {
    const level = node.level || 0;
    const dimensions = nodeDimensions.get(node.id)!;
    const currentMax = maxWidthsByLevel.get(level) || 0;
    maxWidthsByLevel.set(level, Math.max(currentMax, dimensions.width));
  });

  // Update node dimensions to use normalized widths
  nodes.forEach((node) => {
    const level = node.level || 0;
    const maxWidth = maxWidthsByLevel.get(level)!;
    const dimensions = nodeDimensions.get(node.id)!;
    nodeDimensions.set(node.id, { width: maxWidth, height: dimensions.height });
  });

  const maxLevel = Math.max(...nodes.map(n => n.level || 0));

  // Calculate adaptive X positions based on actual node widths
  const levelXPositions = new Map<number, number>();
  levelXPositions.set(0, 0); // Root at center
  
  // Calculate cumulative X positions based on actual node widths
  for (let level = 1; level <= maxLevel; level++) {
    const prevLevel = level - 1;
    const prevX = levelXPositions.get(prevLevel) || 0;
    const prevLevelWidth = maxWidthsByLevel.get(prevLevel) || 140; // Default root width
    const currentLevelWidth = maxWidthsByLevel.get(level) || 200;
    
    // Calculate spacing: half of previous level width + gap + half of current level width
    const minGap = 40; // Minimum gap between levels
    const spacing = prevLevelWidth / 2 + minGap + currentLevelWidth / 2;
    
    levelXPositions.set(level, prevX + spacing);
  }

  // STAGE 1: Forward pass (root to leaves, top to bottom)
  for (let level = 0; level <= maxLevel; level++) {
    const nodesAtLevel = nodes.filter(n => (n.level || 0) === level);
    const x = levelXPositions.get(level) || 0;

    if (level === 0) {
      // Root node at center
      nodesAtLevel.forEach(node => {
        node.x = 0;
        node.y = 0;
      });
    } else {
      // Set X position first
      nodesAtLevel.forEach(node => {
        node.x = x;
      });

      // Group nodes by their parent
      const nodesByParent = new Array<{
        parentId: string;
        siblings: Node[];
      }>();

      nodesAtLevel.forEach(node => {
        const parentId = node.parent || "root";
        const parentIndex = nodesByParent.findIndex(p => p.parentId === parentId);
        if (parentIndex === -1) {
          nodesByParent.push({ parentId, siblings: [node] });
        } else {
          nodesByParent[parentIndex].siblings.push(node);
        }
      });

      // Position each sibling group centered around their parent
      nodesByParent.forEach(({ parentId, siblings }) => {
        const parent = nodes.find(n => n.id === parentId);
        const parentY = parent ? parent.y : 0;

        // Calculate total height needed for all siblings
        const totalHeight = siblings.reduce((sum, node, index) => {
          const nodeHeight = getNodeHeight(node);
          return sum + nodeHeight + (index > 0 ? 20 : 0); // 20px gap between siblings
        }, 0);

        // Position siblings as a group centered on parent
        let currentY = parentY - totalHeight / 2;
        siblings.forEach(sibling => {
          const siblingHeight = getNodeHeight(sibling);
          sibling.y = currentY + siblingHeight / 2; // Center of node
          currentY += siblingHeight + 20; // Move to next sibling position
        });
      });

      // Now resolve overlaps between different parent groups at this level
      // Process groups by their topmost node to avoid conflicts
      for (let i = 1; i < nodesByParent.length; i++) {
        const prevGroup = nodesByParent[i - 1];
        const currentGroup = nodesByParent[i];

        // Find bottom of previous group and top of current group
        const prevGroupBottom = Math.max(...prevGroup.siblings.map(n => {
          const height = getNodeHeight(n);
          return n.y + height / 2;
        }));

        const currentGroupTop = Math.min(...currentGroup.siblings.map(n => {
          const height = getNodeHeight(n);
          return n.y - height / 2;
        }));

        // Check if groups overlap
        const minGap = 20; // Minimum gap between groups
        if (currentGroupTop < prevGroupBottom + minGap) {
          const moveDistance = (prevGroupBottom + minGap) - currentGroupTop;
          
          // Move entire current group down
          currentGroup.siblings.forEach(node => {
            node.y += moveDistance;
          });

          // Also move all subsequent groups
          for (let j = i + 1; j < nodesByParent.length; j++) {
            nodesByParent[j].siblings.forEach(node => {
              node.y += moveDistance;
            });
          }
        }
      }
    }
  }

  // STAGE 2: Backward pass (leaves to root, bottom up)
  for (let level = maxLevel - 1; level >= 0; level--) {
    const nodesAtParentLevel = nodes.filter(n => (n.level || 0) === level).sort((a, b) => b.y - a.y);

    let lastMoved = -1;
    let lastMovedSpace = 1000;

    for (let i = 0; i < nodesAtParentLevel.length; i++) {
      const parent = nodesAtParentLevel[i];
      // Find all children of this parent
      const children = nodes.filter(n => n.parent === parent.id);
      if (children.length === 0) continue;

      // Calculate center of children
      const childrenYPositions = children.map(c => c.y);
      const minY = Math.min(...childrenYPositions);
      const maxY = Math.max(...childrenYPositions);
      const centerY = (minY + maxY) / 2;

      const currentY = parent.y;
      const neededMovement = centerY - currentY;

      if (neededMovement > 5) { // Only move down significantly
        // Calculate how much space we need
        const targetY = centerY;
        const spaceNeeded = Math.max(0, targetY - currentY);

        // Determine how many nodes to move: from current node to lastMoved+1
        // The nodesAtParentLevel is sorted by y descending, so index is the current node
        // Move nodes from index to lastMoved+1 (inclusive)
        const moveEnd = i;
        const moveStart = lastMoved + 1;
        const nodesToMove = nodesAtParentLevel.slice(moveStart, moveEnd + 1);

        // Move by the minimum of spaceNeeded and lastMovedSpace
        const moveBy = Math.min(spaceNeeded, lastMovedSpace);

        if (moveBy > 0 && nodesToMove.length > 0) {
          nodesToMove.forEach(node => {
            node.y += moveBy;
          });
          parent.y = targetY;
          lastMoved = i;
          lastMovedSpace = moveBy;
        } else {
          lastMovedSpace = 0;
        }
      } else {
        lastMovedSpace = 0;
      }
    }
  }

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

  const minX =
    Math.min(...positionedNodes.map((n) => n.x)) - nodeWidth / 2 - padding;
  const maxX =
    Math.max(...positionedNodes.map((n) => n.x)) + nodeWidth / 2 + padding;
  const minY =
    Math.min(...positionedNodes.map((n) => n.y)) - nodeHeight / 2 - padding;
  const maxY =
    Math.max(...positionedNodes.map((n) => n.y)) + nodeHeight / 2 + padding;

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
  data.edges.forEach((edge) => {
    const fromNode = positionedNodes.find((n) => n.id === edge.from);
    const toNode = positionedNodes.find((n) => n.id === edge.to);

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
          svg += `<rect x="${midX - textBg / 2}" y="${midY - 10}" width="${textBg}" height="20" fill="white" stroke="none" rx="4" />`;
          svg += `<text x="${midX}" y="${midY}" class="chart-edge-text">${edge.text}</text>`;
        }
      }
    }
  });

  // Render nodes
  positionedNodes.forEach((node) => {
    const x = node.x;
    const y = node.y;

    // Calculate actual dimensions for this node (same as layout algorithm)
    const nodeDimensions = calculateFlowchartNodeDimensions(node.text);
    const actualWidth = nodeDimensions.width;
    const actualHeight = nodeDimensions.height;

    if (node.shape === "circle") {
      svg += `<circle cx="${x}" cy="${y}" r="30" class="chart-node" />`;
    } else if (node.shape === "diamond") {
      svg += `<polygon points="${x},${y - 25} ${x + 35},${y} ${x},${y + 25} ${x - 35},${y}" class="chart-node" />`;
    } else {
      // Rectangle (default) - use calculated dimensions
      const rx = node.shape === "rounded" ? "8" : "4";
      svg += `<rect x="${x - actualWidth / 2}" y="${y - actualHeight / 2}" width="${actualWidth}" height="${actualHeight}" rx="${rx}" class="chart-node" />`;
    }

    // Enhanced text wrapping with better support for Chinese characters
    const text = node.text;
    const lineHeight = 18; // Increased line height for 16px font

    // Adaptive width calculation for flowcharts
    function getOptimalWidthFlowchart(text: string): number {
      function getTextWidth(text: string): number {
        let width = 0;
        for (let char of text) {
          width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
        }
        return width;
      }

      const totalTextWidth = getTextWidth(text);
      let baseCharsPerLine = 14; // Base for flowcharts

      // If text is very long, increase width to avoid too many lines
      if (totalTextWidth > baseCharsPerLine * 4) {
        baseCharsPerLine = Math.min(baseCharsPerLine * 2, 24);
      } else if (totalTextWidth > baseCharsPerLine * 2) {
        baseCharsPerLine = Math.min(baseCharsPerLine * 1.5, 18);
      }

      return Math.floor(baseCharsPerLine);
    }

    const maxCharsPerLine = getOptimalWidthFlowchart(text);

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
      let currentLine = "";

      // Split by spaces first, then by characters if needed
      const parts = text.split(
        /(\s+|(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff]))/,
      );

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
              const truncated =
                part.slice(0, Math.floor(maxWidth * 0.8)) + "...";
              lines.push(truncated);
              currentLine = "";
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
    const displayLines = wrappedLines; // Use all wrapped lines, no truncation

    // Render text lines
    if (displayLines.length === 1) {
      svg += `<text x="${x}" y="${y}" class="chart-node-text">${displayLines[0]}</text>`;
    } else {
      const startY = y - ((displayLines.length - 1) * lineHeight) / 2;
      displayLines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        svg += `<text x="${x}" y="${lineY}" class="chart-node-text">${line}</text>`;
      });
    }
  });

  svg += "</svg>";
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
  const minX = Math.min(...positionedNodes.map((n) => n.x)) - 100 - padding;
  const maxX = Math.max(...positionedNodes.map((n) => n.x)) + 100 + padding;
  const minY = Math.min(...positionedNodes.map((n) => n.y)) - 30 - padding;
  const maxY = Math.max(...positionedNodes.map((n) => n.y)) + 30 + padding;

  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<svg viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" class="chart-svg">`;

  // Add mindmap-specific styles
  svg += `<defs>
    <style>
      .mindmap-root { 
        fill: var(--chart-root-bg, #4a90e2); 
        stroke: none;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      .mindmap-branch { 
        fill: var(--chart-branch-bg, #5cb85c); 
        stroke: none;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      .mindmap-leaf { 
        fill: var(--chart-leaf-bg, #f0ad4e); 
        stroke: none;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      .mindmap-text { 
        fill: white; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        font-size: 14px; 
        font-weight: 600;
        text-anchor: middle; 
        dominant-baseline: middle; 
      }
      .mindmap-connection { 
        stroke: var(--chart-edge-color, #6c757d); 
        stroke-width: 2; 
        fill: none; 
        stroke-linecap: round;
        opacity: 0.7;
      }
    </style>
  </defs>`;

  // Pre-calculate node dimensions for all nodes to use in both connections and rendering
  const nodeDimensionsMap = new Map<
    string,
    { width: number; height: number }
  >();
  positionedNodes.forEach((node) => {
    const dimensions = calculateNodeDimensions(node.text, node.level || 0);
    nodeDimensionsMap.set(node.id, dimensions);
  });

  // Normalize widths within each level with smart capping for mixed language content
  const maxWidthsByLevel = new Map<number, number>();
  positionedNodes.forEach((node) => {
    const level = node.level || 0;
    const dimensions = nodeDimensionsMap.get(node.id)!;
    const currentMax = maxWidthsByLevel.get(level) || 0;
    maxWidthsByLevel.set(level, Math.max(currentMax, dimensions.width));
  });

  // Apply smart width normalization with reasonable limits
  positionedNodes.forEach((node) => {
    const level = node.level || 0;
    const levelMaxWidth = maxWidthsByLevel.get(level)!;
    const dimensions = nodeDimensionsMap.get(node.id)!;
    
    // Calculate reasonable width for this level
    // If the max width is excessive, use a more reasonable width based on content distribution
    const nodesAtLevel = positionedNodes.filter(n => (n.level || 0) === level);
    const widthsAtLevel = nodesAtLevel.map(n => nodeDimensionsMap.get(n.id)!.width);
    const averageWidth = widthsAtLevel.reduce((sum, w) => sum + w, 0) / widthsAtLevel.length;
    
    // Use the max width, but cap it if it's too far from the average (indicates an outlier)
    let normalizedWidth = levelMaxWidth;
    if (levelMaxWidth > averageWidth * 1.8) {
      // If max width is more than 80% larger than average, use a compromise
      normalizedWidth = Math.min(levelMaxWidth, averageWidth * 1.5);
    }
    
    nodeDimensionsMap.set(node.id, {
      width: normalizedWidth,
      height: dimensions.height,
    });
  });

  // Render connections first - connect to box edges using actual node dimensions
  data.edges.forEach((edge) => {
    const fromNode = positionedNodes.find((n) => n.id === edge.from);
    const toNode = positionedNodes.find((n) => n.id === edge.to);

    if (fromNode && toNode) {
      // Get pre-calculated node dimensions
      const fromNodeDimensions = nodeDimensionsMap.get(fromNode.id)!;
      const toNodeDimensions = nodeDimensionsMap.get(toNode.id)!;

      // Calculate connection points at box edges using actual dimensions
      let fromX, fromY, toX, toY;

      if (fromNode.x < toNode.x) {
        // From left to right
        fromX = fromNode.x + fromNodeDimensions.width / 2; // Right edge of from node
        toX = toNode.x - toNodeDimensions.width / 2; // Left edge of to node
      } else {
        // From right to left
        fromX = fromNode.x - fromNodeDimensions.width / 2; // Left edge of from node
        toX = toNode.x + toNodeDimensions.width / 2; // Right edge of to node
      }

      fromY = fromNode.y;
      toY = toNode.y;

      // Create smooth curved connection like in the reference image
      const controlPointOffset = Math.abs(toX - fromX) * 0.5;
      const cp1X =
        fromX + (fromX < toX ? controlPointOffset : -controlPointOffset);
      const cp1Y = fromY;
      const cp2X =
        toX + (fromX < toX ? -controlPointOffset : controlPointOffset);
      const cp2Y = toY;

      svg += `<path d="M ${fromX} ${fromY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${toY}" class="mindmap-connection" />`;
    }
  });

  // Render nodes with improved text wrapping
  positionedNodes.forEach((node) => {
    const x = node.x;
    const y = node.y;

    // Enhanced text wrapping for mindmap nodes
    const text = node.text;
    const lineHeight = 18; // Increased line height for better spacing

    // Adaptive width calculation (same as dimension calculation)
    function getOptimalWidth(text: string, level: number): number {
      function getTextWidth(text: string): number {
        let width = 0;
        for (let char of text) {
          width += /[\u4e00-\u9fff]/.test(char) ? 1.5 : 1;
        }
        return width;
      }

      const totalTextWidth = getTextWidth(text);
      let baseCharsPerLine = level === 0 ? 12 : 10;

      // If text is very long, increase width to avoid too many lines
      if (totalTextWidth > baseCharsPerLine * 4) {
        baseCharsPerLine = Math.min(baseCharsPerLine * 2, 20);
      } else if (totalTextWidth > baseCharsPerLine * 2) {
        baseCharsPerLine = Math.min(baseCharsPerLine * 1.5, 16);
      }

      return Math.floor(baseCharsPerLine);
    }

    const maxCharsPerLine = getOptimalWidth(text, node.level || 0);

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
      let currentLine = "";

      const parts = text.split(
        /(\s+|(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff]))/,
      );

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
              const truncated =
                part.slice(0, Math.floor(maxWidth * 0.8)) + "...";
              lines.push(truncated);
              currentLine = "";
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
    const displayLines = wrappedLines; // Use all wrapped lines, no truncation

    // Use pre-calculated node dimensions for consistent sizing
    const nodeDimensions = nodeDimensionsMap.get(node.id)!;
    const width = nodeDimensions.width;
    const height = nodeDimensions.height;

    // Determine node style based on level
    let nodeClass = "mindmap-leaf";
    if (node.level === 0) nodeClass = "mindmap-root";
    else if (node.level === 1) nodeClass = "mindmap-branch";

    // Rounded rectangle
    svg += `<rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" rx="17" class="${nodeClass}" />`;

    // Render text lines
    if (displayLines.length === 1) {
      svg += `<text x="${x}" y="${y}" class="mindmap-text">${displayLines[0]}</text>`;
    } else {
      const startY = y - ((displayLines.length - 1) * lineHeight) / 2;
      displayLines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        svg += `<text x="${x}" y="${lineY}" class="mindmap-text">${line}</text>`;
      });
    }
  });

  svg += "</svg>";
  return svg;
}

// Render pie chart as SVG (improved)
function renderPieChartSVG(data: DiagramData, code: string): string {
  const lines = code.split("\n").slice(1); // Skip first line
  const pieData: Array<{ label: string; value: number }> = [];

  lines.forEach((line) => {
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
  const colors = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
    "#34495e",
    "#e67e22",
  ];

  let svg =
    '<svg viewBox="0 0 500 350" width="500" height="350" class="chart-svg">';
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
    const endAngle = startAngle + percentage * 2 * Math.PI;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

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

  svg += "</svg>";
  return svg;
}

// Create chart container with header and enlarge button
function createChartContainer(
  svg: string,
  diagramId: string,
  chartType: string,
): string {
  return `<div class="chart-container" data-diagram-id="${diagramId}" data-fit-mode="fit">
    <div class="chart-header">
      <span class="chart-type-label">${chartType}</span>
      <button class="chart-enlarge-toggle" title="Open chart in new tab" data-diagram-id="${diagramId}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 17L17 7M17 7H7M17 7V17"/>
        </svg>
      </button>
    </div>
    <div class="chart-content">${svg}</div>
  </div>`;
}

// Test exports - exported for testing purposes
export const testExports = {
  parseMermaidCode,
  parseFlowchart,
  parseMindmap,
  parsePieChart,
  layoutFlowchartNodes,
  layoutMindmapNodes,
  parseNodeTextAndShape,
  calculateNodeDimensions,
  calculateFlowchartNodeDimensions,
};

// Main render function
export function renderChart(code: string, diagramId: string): string {
  try {
    const data = parseMermaidCode(code);

    if (data.type === "flowchart") {
      const svg = renderFlowchartSVG(data);
      return createChartContainer(svg, diagramId, "Flowchart");
    } else if (data.type === "mindmap") {
      const svg = renderMindmapSVG(data);
      return createChartContainer(svg, diagramId, "Mindmap");
    } else if (data.type === "pie") {
      const svg = renderPieChartSVG(data, code);
      return createChartContainer(svg, diagramId, "Pie Chart");
    } else {
      // Unsupported diagram type
      return createChartFallback(
        code,
        diagramId,
        "Diagram type not supported by lightweight renderer",
      );
    }
  } catch (error) {
    console.warn("Chart rendering error:", error);
    return createChartFallback(
      code,
      diagramId,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

// Fallback display for unsupported or failed charts
function createChartFallback(
  code: string,
  diagramId: string,
  errorMessage?: string,
): string {
  const lines = code.split("\n");
  const diagramType = lines[0]?.trim() || "diagram";

  let diagramName = "Diagram";
  if (diagramType.includes("graph") || diagramType.includes("flowchart")) {
    diagramName = "Flowchart";
  } else if (diagramType.includes("sequence")) {
    diagramName = "Sequence Diagram (not supported)";
  } else if (diagramType.includes("class")) {
    diagramName = "Class Diagram (not supported)";
  } else if (diagramType.includes("state")) {
    diagramName = "State Diagram (not supported)";
  } else if (diagramType.includes("gantt")) {
    diagramName = "Gantt Chart (not supported)";
  } else if (diagramType.includes("pie")) {
    diagramName = "Pie Chart";
  } else if (diagramType.includes("mindmap")) {
    diagramName = "Mindmap";
  }

  const fallbackNote = errorMessage
    ? `Chart rendering failed: ${errorMessage}`
    : "Chart type not supported";

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
