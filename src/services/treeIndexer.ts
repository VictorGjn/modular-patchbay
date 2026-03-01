/**
 * Markdown Tree Indexer
 *
 * Parses markdown into a PageIndex-compatible tree structure.
 * Headings become tree nodes; text between headings becomes node content.
 * Each node tracks token count for budget-aware depth filtering.
 */

export interface TreeNode {
  nodeId: string;
  title: string;
  depth: number;        // heading level: 0 = root/document, 1 = h1, 2 = h2, etc.
  text: string;         // raw text content under this heading (excluding children)
  tokens: number;       // estimated token count for this node's text
  totalTokens: number;  // tokens including all descendants
  children: TreeNode[];
  meta?: {
    lineStart: number;
    lineEnd: number;
    firstSentence: string;
    firstParagraph: string;
  };
}

export interface TreeIndex {
  source: string;       // file path or identifier
  root: TreeNode;
  totalTokens: number;
  nodeCount: number;
  created: number;
}

/** Rough token estimate: ~4 chars per token for English text */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function extractFirstSentence(text: string): string {
  const match = text.match(/^[^\n]*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.split('\n')[0].slice(0, 200);
}

function extractFirstParagraph(text: string): string {
  const para = text.split(/\n\s*\n/)[0];
  return para ? para.trim().slice(0, 1000) : '';
}

function genNodeId(depth: number, index: number): string {
  return `n${depth}-${index}`;
}

/**
 * Parse markdown string into a tree of heading-based nodes.
 */
export function indexMarkdown(source: string, markdown: string): TreeIndex {
  const lines = markdown.split('\n');
  let nodeCounter = 0;

  const root: TreeNode = {
    nodeId: genNodeId(0, nodeCounter++),
    title: source,
    depth: 0,
    text: '',
    tokens: 0,
    totalTokens: 0,
    children: [],
  };

  // Stack tracks the current ancestry path
  const stack: TreeNode[] = [root];
  let currentText: string[] = [];
  let currentLineStart = 0;

  function flushText(lineEnd: number) {
    const text = currentText.join('\n').trim();
    const current = stack[stack.length - 1];
    current.text = text;
    current.tokens = estimateTokens(text);
    if (current.meta) {
      current.meta.lineEnd = lineEnd;
      current.meta.firstSentence = extractFirstSentence(text);
      current.meta.firstParagraph = extractFirstParagraph(text);
    } else if (text) {
      current.meta = {
        lineStart: currentLineStart,
        lineEnd,
        firstSentence: extractFirstSentence(text),
        firstParagraph: extractFirstParagraph(text),
      };
    }
    currentText = [];
  }

  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = headingRegex.exec(line);

    if (match) {
      // Flush accumulated text to current node
      flushText(i - 1);

      const level = match[1].length; // 1-6
      const title = match[2].trim();

      const node: TreeNode = {
        nodeId: genNodeId(level, nodeCounter++),
        title,
        depth: level,
        text: '',
        tokens: 0,
        totalTokens: 0,
        children: [],
        meta: { lineStart: i, lineEnd: i, firstSentence: '', firstParagraph: '' },
      };

      // Pop stack until we find a parent with lower depth
      while (stack.length > 1 && stack[stack.length - 1].depth >= level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(node);
      stack.push(node);
      currentLineStart = i + 1;
    } else {
      currentText.push(line);
    }
  }

  // Flush remaining text
  flushText(lines.length - 1);

  // Calculate totalTokens bottom-up
  function computeTotals(node: TreeNode): number {
    let total = node.tokens;
    for (const child of node.children) {
      total += computeTotals(child);
    }
    node.totalTokens = total;
    return total;
  }

  computeTotals(root);

  // Count nodes
  function countNodes(node: TreeNode): number {
    let c = 1;
    for (const child of node.children) c += countNodes(child);
    return c;
  }

  return {
    source,
    root,
    totalTokens: root.totalTokens,
    nodeCount: countNodes(root),
    created: Date.now(),
  };
}
