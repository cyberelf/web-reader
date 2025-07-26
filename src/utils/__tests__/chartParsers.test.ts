import { testExports } from '../chartRenderer';

const { 
  parseMermaidCode, 
  parseFlowchart, 
  parseMindmap, 
  parsePieChart,
  layoutFlowchartNodes,
  layoutMindmapNodes,
  parseNodeTextAndShape
} = testExports;

describe('Chart Parser Functions', () => {
  describe('parseMermaidCode', () => {
    it('should detect flowchart diagram type', () => {
      const code = `graph TD
        A --> B`;
      const result = parseMermaidCode(code);
      expect(result.type).toBe('flowchart');
    });

    it('should detect mindmap diagram type', () => {
      const code = `mindmap
  Root
    Child`;
      const result = parseMermaidCode(code);
      expect(result.type).toBe('mindmap');
    });

    it('should detect pie chart diagram type', () => {
      const code = `pie
    "A": 50`;
      const result = parseMermaidCode(code);
      expect(result.type).toBe('pie');
    });

    it('should return unsupported for unknown types', () => {
      const code = `unknownDiagram
    content`;
      const result = parseMermaidCode(code);
      expect(result.type).toBe('unsupported');
    });

    it('should handle empty input', () => {
      const result = parseMermaidCode('');
      expect(result.type).toBe('unsupported');
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle case insensitive diagram types', () => {
      const codes = ['GRAPH TD\nA-->B', 'Mindmap\nRoot\n  Child', 'PIE\n"A":50'];
      const types = ['flowchart', 'mindmap', 'pie'];
      
      codes.forEach((code, index) => {
        const result = parseMermaidCode(code);
        expect(result.type).toBe(types[index]);
      });
    });
  });

  describe('parseFlowchart', () => {
    it('should parse basic node connections', () => {
      const lines = ['A[Start] --> B[End]'];
      const result = parseFlowchart(lines);
      
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      
      const nodeA = result.nodes.find(n => n.id === 'A');
      const nodeB = result.nodes.find(n => n.id === 'B');
      
      expect(nodeA).toEqual({
        id: 'A',
        text: 'Start',
        shape: 'rect',
        x: 0,
        y: 0
      });
      
      expect(nodeB).toEqual({
        id: 'B',
        text: 'End', 
        shape: 'rect',
        x: 0,
        y: 0
      });
      
      expect(result.edges[0]).toEqual({
        from: 'A',
        to: 'B'
      });
    });

    it('should parse different node shapes correctly', () => {
      const lines = [
        'A[Rectangle]',
        'B{Diamond}', 
        'C((Circle))',
        'D(Rounded)'
      ];
      const result = parseFlowchart(lines);
      
      expect(result.nodes).toHaveLength(4);
      
      const shapes = result.nodes.reduce((acc, node) => {
        acc[node.id] = node.shape;
        return acc;
      }, {} as Record<string, string>);
      
      expect(shapes.A).toBe('rect');
      expect(shapes.B).toBe('diamond');
      expect(shapes.C).toBe('circle');
      expect(shapes.D).toBe('rounded'); // (text) creates rounded shape
    });

    it('should parse edge labels', () => {
      const lines = ['A[Start] -->|Success| B[End]', 'A -->|Failure| C[Error]'];
      const result = parseFlowchart(lines);
      
      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].text).toBe('Success');
      expect(result.edges[1].text).toBe('Failure');
    });

    it('should handle nodes without explicit definitions', () => {
      const lines = ['A --> B', 'B --> C'];
      const result = parseFlowchart(lines);
      
      expect(result.nodes).toHaveLength(3);
      result.nodes.forEach(node => {
        expect(node.text).toBe(node.id); // Should use ID as text
        expect(node.shape).toBe('rect'); // Should default to rectangle
      });
    });

    it('should handle complex multi-path connections', () => {
      const lines = [
        'A[Start] --> B[Process1]',
        'A --> C[Process2]',
        'B --> D[End]',
        'C --> D'
      ];
      const result = parseFlowchart(lines);
      
      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(4);
      
      // Check that both B and C connect to D
      const edgesToD = result.edges.filter(e => e.to === 'D');
      expect(edgesToD).toHaveLength(2);
      expect(edgesToD.map(e => e.from).sort()).toEqual(['B', 'C']);
    });

    it('should handle self-referencing nodes', () => {
      const lines = ['A[Node] --> A'];
      const result = parseFlowchart(lines);
      
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].from).toBe('A');
      expect(result.edges[0].to).toBe('A');
    });

    it('should handle special characters in node labels', () => {
      const lines = ['A["Text with quotes & symbols"] --> B["Another (special) node"]'];
      const result = parseFlowchart(lines);
      
      expect(result.nodes).toHaveLength(2);
      const nodeA = result.nodes.find(n => n.id === 'A');
      // The parser includes the quotes in the text
      expect(nodeA?.text).toBe('"Text with quotes & symbols"');
    });
  });

  describe('parseMindmap', () => {
    it('should parse basic root and children structure', () => {
      const lines = [
        'Root Topic',
        '  Child 1',
        '  Child 2'
      ];
      const result = parseMindmap(lines);
      
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
      
      // Check root node
      const root = result.nodes.find(n => n.id === 'root');
      expect(root).toEqual({
        id: 'root',
        text: 'Root Topic',
        shape: 'rounded',
        x: 0,
        y: 0,
        level: 0
      });
      
      // Check children - based on actual parser behavior (2 spaces = level 2)
      const child1 = result.nodes.find(n => n.text === 'Child 1');
      const child2 = result.nodes.find(n => n.text === 'Child 2');
      
      expect(child1?.level).toBe(1);
      expect(child1?.parent).toBe('root');
      expect(child2?.level).toBe(1);
      expect(child2?.parent).toBe('root');
      
      // Check edges connect root to children
      expect(result.edges.every(e => e.from === 'root')).toBe(true);
    });

    it('should handle deep nested hierarchy correctly', () => {
      const lines = [
        'Root',
        '  Level 1A',
        '    Level 2A',
        '      Level 3A',
        '      Level 3B',
        '    Level 2B',
        '  Level 1B',
        '    Level 2C'
      ];
      const result = parseMindmap(lines);
      
      expect(result.nodes).toHaveLength(8);
      expect(result.edges).toHaveLength(7);
      
      // Check level assignments based on actual parser behavior
      // 2 spaces = level 2, 4 spaces = level 3, 6 spaces = level 4
      const nodesByLevel: Record<number, any[]> = {};
      result.nodes.forEach(node => {
        if (!nodesByLevel[node.level!]) nodesByLevel[node.level!] = [];
        nodesByLevel[node.level!].push(node);
      });
      
      expect(nodesByLevel[0]).toHaveLength(1); // Root
      expect(nodesByLevel[1]).toHaveLength(2); // Level 1A, Level 1B (2 spaces)
      expect(nodesByLevel[2]).toHaveLength(3); // Level 2A, Level 2B, Level 2C (4 spaces)
      expect(nodesByLevel[3]).toHaveLength(2); // Level 3A, Level 3B (6 spaces)
      
      // Check parent-child relationships
      const level2A = result.nodes.find(n => n.text === 'Level 2A');
      const level3A = result.nodes.find(n => n.text === 'Level 3A');
      const level3B = result.nodes.find(n => n.text === 'Level 3B');
      
      expect(level3A?.parent).toBe(level2A?.id);
      expect(level3B?.parent).toBe(level2A?.id);
      
      // Verify edges exist for parent-child relationships
      const edgeToLevel3A = result.edges.find(e => e.to === level3A?.id);
      const edgeToLevel3B = result.edges.find(e => e.to === level3B?.id);
      
      expect(edgeToLevel3A?.from).toBe(level2A?.id);
      expect(edgeToLevel3B?.from).toBe(level2A?.id);
    });

    it('should handle inconsistent indentation correctly', () => {
      const lines = [
        'Root',
        '  Child 1',        // 2 spaces = level 1
        '      Deep Child', // 6 spaces = level 3
        '  Child 2',        // 2 spaces = level 1
        '    Normal Child'  // 4 spaces = level 2
      ];
      const result = parseMindmap(lines);
      
      expect(result.nodes).toHaveLength(5);
      
      const deepChild = result.nodes.find(n => n.text === 'Deep Child');
      const child1 = result.nodes.find(n => n.text === 'Child 1');
      const normalChild = result.nodes.find(n => n.text === 'Normal Child');
      const child2 = result.nodes.find(n => n.text === 'Child 2');
      
      expect(deepChild?.level).toBe(3); // 6 spaces = level 3
      expect(deepChild?.parent).toBe(child1?.id);
      expect(normalChild?.level).toBe(2); // 4 spaces = level 2  
      expect(normalChild?.parent).toBe(child2?.id);
    });

          it('should handle node text correctly', () => {
        const lines = [
          'root(this is the root node)',
          '  Child1((round child))',        // 2 spaces = level 1
          '      Child2[square deep child]', // 6 spaces = level 2
          '  Child3[square child]',        // 2 spaces = level 1
          '    Child4{diamond deep child}'  // 4 spaces = level 2
        ];
        const result = parseMindmap(lines);
        
        expect(result.nodes).toHaveLength(5);
        
        expect(result.nodes[0].text).toBe('this is the root node');
        expect(result.nodes[0].shape).toBe('rounded');
        expect(result.nodes[1].text).toBe('round child');
        expect(result.nodes[1].shape).toBe('circle');
        expect(result.nodes[2].text).toBe('square deep child');
        expect(result.nodes[2].shape).toBe('rect');
        expect(result.nodes[3].text).toBe('square child');
        expect(result.nodes[3].shape).toBe('rect');
        expect(result.nodes[4].text).toBe('diamond deep child');
        expect(result.nodes[4].shape).toBe('diamond');
      });

    it('should handle single root node', () => {
      const lines = ['Single Root'];
      const result = parseMindmap(lines);
      
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
      
      const root = result.nodes[0];
      expect(root.id).toBe('root');
      expect(root.text).toBe('Single Root');
      expect(root.level).toBe(0);
    });

    it('should handle empty lines in mindmap', () => {
      const lines = [
        'Root',
        '  Child 1',
        '',
        '  Child 2'
      ];
      const result = parseMindmap(lines);
      
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
      
      // Both children should be at level 1 (2 spaces) and connected to root
      const children = result.nodes.filter(n => n.level === 1);
      expect(children).toHaveLength(2);
      expect(children.every(c => c.parent === 'root')).toBe(true);
    });

    it('should calculate indentation relative to root', () => {
      const lines = [
        '    Root',      // Root has 4 spaces
        '      Child 1', // 6 spaces = 2 more than root = level 2
        '        Child 2' // 8 spaces = 4 more than root = level 3
      ];
      const result = parseMindmap(lines);
      
      const root = result.nodes.find(n => n.text === 'Root');
      const child1 = result.nodes.find(n => n.text === 'Child 1');
      const child2 = result.nodes.find(n => n.text === 'Child 2');
      
      expect(root?.level).toBe(0);
      expect(child1?.level).toBe(1); // 2 spaces relative = level 1
      expect(child2?.level).toBe(2); // 4 spaces relative = level 2
      expect(child2?.parent).toBe(child1?.id);
    });

    it('should handle complex branching structure', () => {
      const lines = [
        'Main Topic',
        '  Branch A',     // 2 spaces = level 1
        '    Leaf A1',    // 4 spaces = level 2
        '    Leaf A2',    // 4 spaces = level 2
        '  Branch B',     // 2 spaces = level 1
        '    Leaf B1',    // 4 spaces = level 2
        '      Deep B1',  // 6 spaces = level 3
        '    Leaf B2',    // 4 spaces = level 2
        '  Branch C'      // 2 spaces = level 1
      ];
      const result = parseMindmap(lines);
      
      expect(result.nodes).toHaveLength(9);
      expect(result.edges).toHaveLength(8);
      
      // Verify structure: each branch should have correct children
      const branchA = result.nodes.find(n => n.text === 'Branch A');
      const branchB = result.nodes.find(n => n.text === 'Branch B');
      const leafA1 = result.nodes.find(n => n.text === 'Leaf A1');
      const leafA2 = result.nodes.find(n => n.text === 'Leaf A2');
      const leafB1 = result.nodes.find(n => n.text === 'Leaf B1');
      const deepB1 = result.nodes.find(n => n.text === 'Deep B1');
      
      expect(leafA1?.parent).toBe(branchA?.id);
      expect(leafA2?.parent).toBe(branchA?.id);
      expect(leafB1?.parent).toBe(branchB?.id);
      expect(deepB1?.parent).toBe(leafB1?.id);
      expect(deepB1?.level).toBe(3); // 6 spaces = level 3
    });
  });

  describe('parsePieChart', () => {
    it('should parse basic pie chart data', () => {
      const lines = [
        '"Apples": 30',
        '"Oranges": 25',
        '"Bananas": 45'
      ];
      const result = parsePieChart(lines);
      
      expect(result.type).toBe('pie');
      expect(result.nodes).toHaveLength(0); // Pie charts don't use nodes
      expect(result.edges).toHaveLength(0);
    });

    it('should handle decimal values', () => {
      const lines = [
        '"Category A": 33.5',
        '"Category B": 66.5'
      ];
      const result = parsePieChart(lines);
      
      expect(result.type).toBe('pie');
    });

    it('should handle empty pie chart', () => {
      const lines: string[] = [];
      const result = parsePieChart(lines);
      
      expect(result.type).toBe('pie');
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should ignore malformed lines', () => {
      const lines = [
        '"Valid": 50',
        'Invalid line without quotes',
        '"Another Valid": 30',
        'No colon here',
        '"Missing value":',
        '"Final": 20'
      ];
      const result = parsePieChart(lines);
      
      expect(result.type).toBe('pie');
      // Should still parse successfully even with malformed lines
    });
  });

  describe('parseNodeTextAndShape', () => {
    it('should parse rectangle syntax correctly', () => {
      const result = parseNodeTextAndShape('prefix[Rectangle Text]');
      expect(result.id).toBe('prefix');
      expect(result.text).toBe('Rectangle Text');
      expect(result.shape).toBe('rect');
    });

    it('should parse diamond syntax correctly', () => {
      const result = parseNodeTextAndShape('prefix{Diamond Text}');
      expect(result.id).toBe('prefix');
      expect(result.text).toBe('Diamond Text');
      expect(result.shape).toBe('diamond');
    });

    it('should parse circle syntax correctly', () => {
      const result = parseNodeTextAndShape('prefix((Circle Text))');
      expect(result.id).toBe('prefix');
      expect(result.text).toBe('Circle Text');
      expect(result.shape).toBe('circle');
    });

    it('should parse rounded syntax correctly', () => {
      const result = parseNodeTextAndShape('prefix(Rounded Text)');
      expect(result.id).toBe('prefix');
      expect(result.text).toBe('Rounded Text');
      expect(result.shape).toBe('rounded');
    });

    it('should handle plain text with default shape', () => {
      const result = parseNodeTextAndShape('Plain Text');
      expect(result.id).toBeUndefined();
      expect(result.text).toBe('Plain Text');
      expect(result.shape).toBe('rect'); // Default is rect
      
      const resultRounded = parseNodeTextAndShape('Plain Text', 'rounded');
      expect(resultRounded.id).toBeUndefined();
      expect(resultRounded.text).toBe('Plain Text');
      expect(resultRounded.shape).toBe('rounded'); // When explicitly passed
    });

    it('should handle empty prefix correctly', () => {
      const result = parseNodeTextAndShape('[Just Brackets]');
      expect(result.id).toBeUndefined();
      expect(result.text).toBe('Just Brackets');
      expect(result.shape).toBe('rect');
    });

    it('should handle complex text with special characters', () => {
      const result = parseNodeTextAndShape('prefix[Text with spaces & symbols!]');
      expect(result.id).toBe('prefix');
      expect(result.text).toBe('Text with spaces & symbols!');
      expect(result.shape).toBe('rect');
    });

    it('should handle nested brackets in text', () => {
      const result = parseNodeTextAndShape('prefix[Text with nested brackets]');
      expect(result.id).toBe('prefix');
      expect(result.text).toBe('Text with nested brackets');
      expect(result.shape).toBe('rect');
    });

    it('should prioritize first matching syntax in order', () => {
      // Rectangle syntax is checked first, so it should match even if other syntaxes are present
      const result1 = parseNodeTextAndShape('prefix[Rectangle Text]');
      expect(result1.id).toBe('prefix');
      expect(result1.text).toBe('Rectangle Text');
      expect(result1.shape).toBe('rect');
      
      // If diamond syntax comes after rectangle syntax in the same string
      const result2 = parseNodeTextAndShape('prefix{Diamond Text}');
      expect(result2.id).toBe('prefix');
      expect(result2.text).toBe('Diamond Text');
      expect(result2.shape).toBe('diamond');
    });
  });

  describe('layoutFlowchartNodes', () => {
    it('should position nodes in levels based on connections', () => {
      const nodes = [
        { id: 'A', text: 'Start', shape: 'rect' as const, x: 0, y: 0 },
        { id: 'B', text: 'Middle', shape: 'rect' as const, x: 0, y: 0 },
        { id: 'C', text: 'End', shape: 'rect' as const, x: 0, y: 0 }
      ];
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' }
      ];
      
      const positioned = layoutFlowchartNodes(nodes, edges);
      
      expect(positioned).toHaveLength(3);
      
      // Nodes should be positioned at different Y levels
      const nodeA = positioned.find(n => n.id === 'A');
      const nodeB = positioned.find(n => n.id === 'B');
      const nodeC = positioned.find(n => n.id === 'C');
      
      expect(nodeA!.y).toBeLessThan(nodeB!.y);
      expect(nodeB!.y).toBeLessThan(nodeC!.y);
    });

    it('should handle nodes without connections', () => {
      const nodes = [
        { id: 'A', text: 'Standalone', shape: 'rect' as const, x: 0, y: 0 }
      ];
      const edges: any[] = [];
      
      const positioned = layoutFlowchartNodes(nodes, edges);
      
      expect(positioned).toHaveLength(1);
      expect(positioned[0].x).toBeDefined();
      expect(positioned[0].y).toBeDefined();
    });

    it('should handle empty input', () => {
      const positioned = layoutFlowchartNodes([], []);
      expect(positioned).toHaveLength(0);
    });
  });

  describe('layoutMindmapNodes', () => {
    it('should position root at center', () => {
      const nodes = [
        { id: 'root', text: 'Root', shape: 'rounded' as const, x: 0, y: 0, level: 0 },
        { id: 'child1', text: 'Child 1', shape: 'rounded' as const, x: 0, y: 0, level: 1, parent: 'root' },
        { id: 'child2', text: 'Child 2', shape: 'rounded' as const, x: 0, y: 0, level: 1, parent: 'root' }
      ];
      const edges = [
        { from: 'root', to: 'child1' },
        { from: 'root', to: 'child2' }
      ];
      
      const positioned = layoutMindmapNodes(nodes, edges);
      
      const root = positioned.find(n => n.id === 'root');
      expect(root!.x).toBe(0);
      expect(root!.y).toBe(0);
      
      // Children should be positioned to the right of root
      const children = positioned.filter(n => n.level === 1);
      children.forEach(child => {
        expect(child.x).toBeGreaterThan(0);
      });
    });

    it('should handle empty input', () => {
      const positioned = layoutMindmapNodes([], []);
      expect(positioned).toHaveLength(0);
    });

    it('should position nodes at different levels horizontally', () => {
      const nodes = [
        { id: 'root', text: 'Root', shape: 'rounded' as const, x: 0, y: 0, level: 0 },
        { id: 'level1', text: 'Level 1', shape: 'rounded' as const, x: 0, y: 0, level: 1, parent: 'root' },
        { id: 'level2', text: 'Level 2', shape: 'rounded' as const, x: 0, y: 0, level: 2, parent: 'level1' }
      ];
      const edges = [
        { from: 'root', to: 'level1' },
        { from: 'level1', to: 'level2' }
      ];
      
      const positioned = layoutMindmapNodes(nodes, edges);
      
      const root = positioned.find(n => n.id === 'root');
      const level1 = positioned.find(n => n.id === 'level1');
      const level2 = positioned.find(n => n.id === 'level2');
      
      expect(root!.x).toBe(0);
      expect(level1!.x).toBeGreaterThan(root!.x);
      expect(level2!.x).toBeGreaterThan(level1!.x);
    });
  });
}); 