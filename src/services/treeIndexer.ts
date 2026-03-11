/**
 * Tree Indexer — Source-Agnostic Document Indexing
 *
 * Converts ANY structured content into a PageIndex-compatible tree.
 * The tree is the universal intermediate representation for the
 * context engineering pipeline:
 *
 *   Source (any) → Connector (normalize) → TreeIndex → DepthFilter → Context Assembly
 *
 * Connectors:
 *   - markdown: heading-based hierarchy (built-in)
 *   - structured: pre-structured data (API responses, CRM records, meeting notes)
 *   - flat: unstructured text (wraps in single root node)
 *
 * Future connectors (external):
 *   - Notion pages (block hierarchy)
 *   - HubSpot records (field groups)
 *   - Slack threads (chronological)
 *   - Granola transcripts (timestamped sections)
 *   - PDF via PageIndex API
 */

export interface TreeNode {
  nodeId: string;
  title: string;
  depth: number;        // 0 = root, 1+ = nested levels
  text: string;         // content at this node (excluding children)
  tokens: number;       // estimated tokens for this node's text
  totalTokens: number;  // tokens including all descendants
  children: TreeNode[];
  meta?: {
    lineStart?: number;
    lineEnd?: number;
    firstSentence: string;
    firstParagraph: string;
    sourceType?: string;   // 'markdown' | 'notion' | 'hubspot' | 'slack' | 'granola' | 'api' | etc.
    sourceId?: string;     // original ID in source system (Notion block ID, HubSpot record ID, etc.)
    timestamp?: number;    // for chronological sources (Slack, Granola)
    fieldGroup?: string;   // for structured sources (HubSpot: 'deal_info', 'contacts', etc.)
  };
}

export interface TreeIndex {
  source: string;       // identifier (file path, URL, record ID)
  sourceType: string;   // connector type that produced this
  root: TreeNode;
  totalTokens: number;
  nodeCount: number;
  created: number;
}

/** Rough token estimate: ~4 chars per token for English text */
/**
 * Estimate token count from text.
 * Uses word-boundary split (~1.3 tokens per word for English)
 * with adjustment for code blocks (~0.4 tokens per char).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Code blocks are denser (more tokens per char)
  const codeBlockMatch = text.match(/```[\s\S]*?```/g);
  const codeChars = codeBlockMatch ? codeBlockMatch.reduce((s, b) => s + b.length, 0) : 0;
  const proseChars = text.length - codeChars;
  // Prose: ~4 chars/token. Code: ~2.5 chars/token.
  return Math.ceil(proseChars / 4 + codeChars / 2.5);
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

function computeTotals(node: TreeNode): number {
  let total = node.tokens;
  for (const child of node.children) total += computeTotals(child);
  node.totalTokens = total;
  return total;
}

function countNodes(node: TreeNode): number {
  let c = 1;
  for (const child of node.children) c += countNodes(child);
  return c;
}

// ── Markdown Connector ──

/**
 * Parse markdown into a tree of heading-based nodes.
 * Most common connector — works for any .md, README, docs, AGENTS.md, etc.
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
        sourceType: 'markdown',
      };
    }
    currentText = [];
  }

  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = headingRegex.exec(line);

    if (match) {
      flushText(i - 1);
      const level = match[1].length;
      const title = match[2].trim();

      const node: TreeNode = {
        nodeId: genNodeId(level, nodeCounter++),
        title,
        depth: level,
        text: '',
        tokens: 0,
        totalTokens: 0,
        children: [],
        meta: { lineStart: i, lineEnd: i, firstSentence: '', firstParagraph: '', sourceType: 'markdown' },
      };

      while (stack.length > 1 && stack[stack.length - 1].depth >= level) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      currentLineStart = i + 1;
    } else {
      currentText.push(line);
    }
  }

  flushText(lines.length - 1);
  computeTotals(root);

  return {
    source,
    sourceType: 'markdown',
    root,
    totalTokens: root.totalTokens,
    nodeCount: countNodes(root),
    created: Date.now(),
  };
}

// ── Structured Data Connector ──

export interface StructuredField {
  key: string;
  label: string;
  value: string;
  group?: string;   // optional grouping (e.g. 'deal_info', 'contacts', 'timeline')
}

/**
 * Index structured data (CRM records, API responses, etc.) into a tree.
 * Groups fields by their `group` property, creating a 2-level tree.
 *
 * Works for: HubSpot deals/contacts, Notion databases, any key-value data.
 */
export function indexStructured(source: string, fields: StructuredField[], sourceType = 'structured'): TreeIndex {
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

  // Group fields
  const groups = new Map<string, StructuredField[]>();
  for (const f of fields) {
    const g = f.group || 'default';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  }

  for (const [groupName, groupFields] of groups) {
    const text = groupFields.map(f => `${f.label}: ${f.value}`).join('\n');
    const groupNode: TreeNode = {
      nodeId: genNodeId(1, nodeCounter++),
      title: groupName === 'default' ? source : groupName,
      depth: 1,
      text,
      tokens: estimateTokens(text),
      totalTokens: 0,
      children: [],
      meta: {
        firstSentence: groupFields[0] ? `${groupFields[0].label}: ${groupFields[0].value}` : '',
        firstParagraph: text.slice(0, 1000),
        sourceType,
        fieldGroup: groupName,
      },
    };
    root.children.push(groupNode);
  }

  computeTotals(root);

  return {
    source,
    sourceType,
    root,
    totalTokens: root.totalTokens,
    nodeCount: countNodes(root),
    created: Date.now(),
  };
}

// ── Chronological Connector ──

export interface ChronoEntry {
  timestamp: number;
  speaker?: string;
  text: string;
}

/**
 * Index chronological data (chat threads, meeting transcripts) into a tree.
 * Groups entries into time-based segments.
 *
 * Works for: Slack threads, Granola transcripts, chat logs.
 */
export function indexChronological(
  source: string,
  entries: ChronoEntry[],
  sourceType = 'chronological',
  segmentMinutes = 10,
): TreeIndex {
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

  if (entries.length === 0) {
    computeTotals(root);
    return { source, sourceType, root, totalTokens: 0, nodeCount: 1, created: Date.now() };
  }

  // Segment by time gaps
  const segmentMs = segmentMinutes * 60 * 1000;
  let currentSegment: ChronoEntry[] = [entries[0]];
  const segments: ChronoEntry[][] = [];

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].timestamp - entries[i - 1].timestamp > segmentMs) {
      segments.push(currentSegment);
      currentSegment = [];
    }
    currentSegment.push(entries[i]);
  }
  segments.push(currentSegment);

  for (const seg of segments) {
    const start = new Date(seg[0].timestamp);
    const title = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const text = seg.map(e => e.speaker ? `${e.speaker}: ${e.text}` : e.text).join('\n');

    const segNode: TreeNode = {
      nodeId: genNodeId(1, nodeCounter++),
      title,
      depth: 1,
      text,
      tokens: estimateTokens(text),
      totalTokens: 0,
      children: [],
      meta: {
        firstSentence: seg[0].text.slice(0, 200),
        firstParagraph: text.slice(0, 1000),
        sourceType,
        timestamp: seg[0].timestamp,
      },
    };
    root.children.push(segNode);
  }

  computeTotals(root);

  return {
    source,
    sourceType,
    root,
    totalTokens: root.totalTokens,
    nodeCount: countNodes(root),
    created: Date.now(),
  };
}

// ── Flat Text Connector ──

/**
 * Wrap unstructured text in a single root node.
 * Fallback for any source without inherent structure.
 */
export function indexFlat(source: string, text: string, sourceType = 'flat'): TreeIndex {
  const root: TreeNode = {
    nodeId: 'n0-0',
    title: source,
    depth: 0,
    text: text.trim(),
    tokens: estimateTokens(text),
    totalTokens: estimateTokens(text),
    children: [],
    meta: {
      firstSentence: extractFirstSentence(text),
      firstParagraph: extractFirstParagraph(text),
      sourceType,
    },
  };

  return {
    source,
    sourceType,
    root,
    totalTokens: root.totalTokens,
    nodeCount: 1,
    created: Date.now(),
  };
}
