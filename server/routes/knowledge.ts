import { Router } from 'express';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import type { ApiResponse, ProviderConfig } from '../types.js';
import { loadContent, listContent, deleteContent } from '../services/contentStore.js';
import { readConfig } from '../config.js';

const router = Router();

// ── Types ──

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
  tokenEstimate?: number;
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  extension: string;
  tokenEstimate: number;
  knowledgeType: string;
}

// ── Config ──

const CONFIG_DIR = join(homedir(), '.modular-studio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface KnowledgeConfig {
  allowedDirs?: string[];
}

function loadAllowedDirs(): string[] {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw) as KnowledgeConfig;
      if (Array.isArray(cfg.allowedDirs) && cfg.allowedDirs.length > 0) {
        return cfg.allowedDirs.map((d) => resolve(d));
      }
    }
  } catch {
    // ignore
  }
  return [resolve(homedir())];
}

// ── Security ──

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__']);
const SKIP_FILES = new Set(['.env', '.env.local', '.env.production']);
const MAX_DEPTH = 5;
const MAX_FILES = 1000;

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
  '.toml', '.py', '.rs', '.go', '.html', '.css', '.scss', '.sh', '.bash',
  '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.xml', '.svg', '.csv', '.sql',
  '.graphql', '.proto', '.env.example', '.gitignore', '.dockerignore',
  '.editorconfig', '.prettierrc', '.eslintrc', '.log', '.cfg', '.ini', '.conf',
]);

function isPathSafe(targetPath: string, allowedDirs: string[]): boolean {
  if (targetPath.includes('..')) return false;
  // SECURITY FIX: Reject null byte attacks
  if (targetPath.includes('\0')) return false;
  const resolved = resolve(targetPath).toLowerCase();
  return allowedDirs.some((dir) => resolved.startsWith(dir.toLowerCase()));
}

function isTextFile(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

// ── Classification ──

function classifyKnowledgeType(filePath: string): string {
  const p = filePath.toLowerCase();
  const name = basename(p);

  if (name.startsWith('readme') || name.startsWith('spec') || name.startsWith('design')) return 'framework';
  if (name.startsWith('changelog') || p.endsWith('.log')) return 'signal';

  const ext = extname(p);
  if (ext === '.md' && p.includes('docs')) return 'ground-truth';
  if (['.ts', '.tsx', '.py'].includes(ext)) return 'evidence';

  return 'evidence';
}

// ── Scanner ──

function scanDirectory(dirPath: string, basePath: string, depth: number, counter: { count: number }): FileNode[] {
  if (depth > MAX_DEPTH || counter.count >= MAX_FILES) return [];

  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (counter.count >= MAX_FILES) break;

    const fullPath = join(dirPath, entry.name);
    const relPath = relative(basePath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const children = scanDirectory(fullPath, basePath, depth + 1, counter);
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      counter.count++;
      const ext = extname(entry.name);
      try {
        const stat = statSync(fullPath);
        const node: FileNode = {
          name: entry.name,
          path: relPath,
          type: 'file',
          size: stat.size,
          extension: ext || undefined,
        };
        if (isTextFile(ext)) {
          node.tokenEstimate = Math.ceil(stat.size / 4);
        }
        nodes.push(node);
      } catch {
        // skip inaccessible files
      }
    }
  }

  return nodes;
}

// ── Routes ──

router.get('/scan', (req, res) => {
  const dir = req.query.dir as string | undefined;


  if (!dir) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required query parameter: dir' };
    res.status(400).json(resp);
    return;
  }

  const resolved = resolve(dir);
  const allowedDirs = loadAllowedDirs();

  if (!isPathSafe(resolved, allowedDirs)) {
    const resp: ApiResponse = { status: 'error', error: 'Directory not in allowlist' };
    res.status(403).json(resp);
    return;
  }

  if (!existsSync(resolved)) {
    const resp: ApiResponse = { status: 'error', error: 'Directory does not exist' };
    res.status(404).json(resp);
    return;
  }

  const counter = { count: 0 };
  const tree = scanDirectory(resolved, resolved, 0, counter);

  const resp: ApiResponse<FileNode[]> = { status: 'ok', data: tree };
  res.json(resp);
});

router.get('/read', (req, res) => {
  const filePath = req.query.path as string | undefined;

  if (!filePath) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required query parameter: path' };
    res.status(400).json(resp);
    return;
  }

  const resolved = resolve(filePath);
  const allowedDirs = loadAllowedDirs();

  if (!isPathSafe(resolved, allowedDirs)) {
    const resp: ApiResponse = { status: 'error', error: 'File not in allowlist' };
    res.status(403).json(resp);
    return;
  }

  if (!existsSync(resolved)) {
    const resp: ApiResponse = { status: 'error', error: 'File does not exist' };
    res.status(404).json(resp);
    return;
  }

  try {
    const stat = statSync(resolved);
    if (!stat.isFile()) {
      const resp: ApiResponse = { status: 'error', error: 'Path is not a file' };
      res.status(400).json(resp);
      return;
    }

    // Limit file size to 1MB
    if (stat.size > 1_048_576) {
      const resp: ApiResponse = { status: 'error', error: 'File too large (max 1MB)' };
      res.status(413).json(resp);
      return;
    }

    const ext = extname(resolved);
    const content = readFileSync(resolved, 'utf-8');
    const tokenEstimate = Math.ceil(stat.size / 4);
    const knowledgeType = classifyKnowledgeType(resolved);

    const data: FileContent = {
      path: resolved.replace(/\\/g, '/'),
      content,
      size: stat.size,
      extension: ext,
      tokenEstimate,
      knowledgeType,
    };

    const resp: ApiResponse<FileContent> = { status: 'ok', data };
    res.json(resp);
  } catch {
    const resp: ApiResponse = { status: 'error', error: 'Failed to read file' };
    res.status(500).json(resp);
  }
});

router.get('/allowed-dirs', (_req, res) => {
  const dirs = loadAllowedDirs();
  const resp: ApiResponse<string[]> = { status: 'ok', data: dirs };
  res.json(resp);
});

// ── Tree Index ──

interface TreeNode {
  nodeId: string;
  title: string;
  depth: number;
  text: string;
  tokens: number;
  totalTokens: number;
  children: TreeNode[];
  meta?: {
    lineStart: number;
    lineEnd: number;
    firstSentence: string;
    firstParagraph: string;
  };
}

interface TreeIndex {
  source: string;
  root: TreeNode;
  totalTokens: number;
  nodeCount: number;
  created: number;
}

function estimateTokens(text: string): number {
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

function serverIndexMarkdown(source: string, markdown: string): TreeIndex {
  const lines = markdown.split('\n');
  let nodeCounter = 0;

  const root: TreeNode = {
    nodeId: `n0-${nodeCounter++}`,
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
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  function flushText(lineEnd: number) {
    const text = currentText.join('\n').trim();
    const current = stack[stack.length - 1];
    current.text = text;
    current.tokens = estimateTokens(text);
    if (text) {
      current.meta = {
        lineStart: currentLineStart,
        lineEnd,
        firstSentence: extractFirstSentence(text),
        firstParagraph: extractFirstParagraph(text),
      };
    }
    currentText = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const match = headingRegex.exec(lines[i]);
    if (match) {
      flushText(i - 1);
      const level = match[1].length;
      const node: TreeNode = {
        nodeId: `n${level}-${nodeCounter++}`,
        title: match[2].trim(),
        depth: level,
        text: '',
        tokens: 0,
        totalTokens: 0,
        children: [],
        meta: { lineStart: i, lineEnd: i, firstSentence: '', firstParagraph: '' },
      };
      while (stack.length > 1 && stack[stack.length - 1].depth >= level) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      currentLineStart = i + 1;
    } else {
      currentText.push(lines[i]);
    }
  }
  flushText(lines.length - 1);

  function computeTotals(node: TreeNode): number {
    let total = node.tokens;
    for (const child of node.children) total += computeTotals(child);
    node.totalTokens = total;
    return total;
  }
  computeTotals(root);

  function countNodes(node: TreeNode): number {
    let c = 1;
    for (const child of node.children) c += countNodes(child);
    return c;
  }

  return { source, root, totalTokens: root.totalTokens, nodeCount: countNodes(root), created: Date.now() };
}

/** Apply depth filter and render to markdown */
function filterAndRender(root: TreeNode, depthLevel: number, tokenBudget?: number): { markdown: string; tokens: number } {
  const maxHeading = 2;

  function filterNode(node: TreeNode, dl: number): { title: string; depth: number; text: string; children: any[]; truncated: boolean } | null {
    if (dl === 4 && node.depth > 0) return null;
    if (dl === 3 && node.depth > maxHeading) return null;

    let text = '';
    let truncated = false;
    if (dl === 0) text = node.text;
    else if (dl === 1) {
      if (node.children.length === 0 && node.meta?.firstParagraph) {
        text = node.meta.firstParagraph;
        truncated = node.text.length > text.length;
      } else text = node.text;
    } else if (dl === 2) {
      text = node.meta?.firstSentence ?? '';
      truncated = node.text.length > text.length;
    }

    const children = node.children.map(c => filterNode(c, dl)).filter(Boolean);
    return { title: node.title, depth: node.depth, text, children: children as any[], truncated };
  }

  function render(n: any): string {
    const parts: string[] = [];
    if (n.depth > 0) parts.push(`${'#'.repeat(n.depth)} ${n.title}`);
    if (n.text) parts.push(n.text);
    for (const c of n.children) parts.push(render(c));
    return parts.join('\n\n');
  }

  function countTokens(n: any): number {
    let t = estimateTokens(n.text || '') + estimateTokens(n.title || '');
    for (const c of n.children) t += countTokens(c);
    return t;
  }

  let level = Math.max(0, Math.min(4, depthLevel));
  let filtered = filterNode(root, level);
  if (!filtered) filtered = { title: root.title, depth: 0, text: '', children: [], truncated: true };

  let tokens = countTokens(filtered);
  if (tokenBudget && tokens > tokenBudget) {
    for (let tryLevel = level + 1; tryLevel <= 4; tryLevel++) {
      filtered = filterNode(root, tryLevel) ?? filtered;
      tokens = countTokens(filtered);
      if (tokens <= tokenBudget) break;
    }
  }

  return { markdown: render(filtered).trim(), tokens };
}

/**
 * POST /api/knowledge/index
 * Body: { path: string }
 * Returns the tree index for a file.
 */
router.post('/index', (req, res) => {
  const filePath = (req.body as { path?: string })?.path;
  if (!filePath) {
    res.status(400).json({ status: 'error', error: 'Missing path' });
    return;
  }

  const resolved = resolve(filePath);
  const allowedDirs = loadAllowedDirs();
  if (!isPathSafe(resolved, allowedDirs)) {
    res.status(403).json({ status: 'error', error: 'File not in allowlist' });
    return;
  }
  if (!existsSync(resolved)) {
    res.status(404).json({ status: 'error', error: 'File not found' });
    return;
  }

  try {
    const stat = statSync(resolved);
    if (!stat.isFile() || stat.size > 1_048_576) {
      res.status(400).json({ status: 'error', error: 'Invalid file or too large' });
      return;
    }
    const content = readFileSync(resolved, 'utf-8');
    const index = serverIndexMarkdown(resolved.replace(/\\/g, '/'), content);
    res.json({ status: 'ok', data: index });
  } catch {
    res.status(500).json({ status: 'error', error: 'Failed to index file' });
  }
});

/**
 * POST /api/knowledge/filter
 * Body: { path: string, depth: number, tokenBudget?: number }
 * Returns filtered markdown content at the requested depth level.
 */
router.post('/filter', (req, res) => {
  const { path: filePath, depth, tokenBudget } = req.body as { path?: string; depth?: number; tokenBudget?: number };
  if (!filePath || depth === undefined) {
    res.status(400).json({ status: 'error', error: 'Missing path or depth' });
    return;
  }

  const resolved = resolve(filePath);
  const allowedDirs = loadAllowedDirs();
  if (!isPathSafe(resolved, allowedDirs)) {
    res.status(403).json({ status: 'error', error: 'File not in allowlist' });
    return;
  }
  if (!existsSync(resolved)) {
    res.status(404).json({ status: 'error', error: 'File not found' });
    return;
  }

  try {
    const content = readFileSync(resolved, 'utf-8');
    const index = serverIndexMarkdown(resolved.replace(/\\/g, '/'), content);
    const result = filterAndRender(index.root, depth, tokenBudget);
    res.json({ status: 'ok', data: { ...result, source: index.source, nodeCount: index.nodeCount, totalTokens: index.totalTokens } });
  } catch {
    res.status(500).json({ status: 'error', error: 'Failed to filter file' });
  }
});

// ── Content Store Routes ──

/**
 * GET /api/knowledge/content
 * Lists all stored content (sourceId + name + repoMeta only).
 */
router.get('/content', (_req, res) => {
  try {
    const items = listContent();
    res.json({ status: 'ok', data: items } satisfies ApiResponse);
  } catch {
    res.status(500).json({ status: 'error', error: 'Failed to list content' } satisfies ApiResponse);
  }
});

/**
 * GET /api/knowledge/content/:sourceId
 * Returns full stored content for a sourceId.
 */
router.get('/content/:sourceId', (req, res) => {
  const { sourceId } = req.params;
  try {
    const content = loadContent(sourceId);
    if (!content) {
      res.status(404).json({ status: 'error', error: 'Content not found' } satisfies ApiResponse);
      return;
    }
    res.json({ status: 'ok', data: content } satisfies ApiResponse);
  } catch {
    res.status(500).json({ status: 'error', error: 'Failed to load content' } satisfies ApiResponse);
  }
});

/**
 * DELETE /api/knowledge/content/:sourceId
 * Removes stored content for a sourceId.
 */
router.delete('/content/:sourceId', (req, res) => {
  const { sourceId } = req.params;
  try {
    const deleted = deleteContent(sourceId);
    if (!deleted) {
      res.status(404).json({ status: 'error', error: 'Content not found' } satisfies ApiResponse);
      return;
    }
    res.json({ status: 'ok', data: { deleted: true } } satisfies ApiResponse);
  } catch {
    res.status(500).json({ status: 'error', error: 'Failed to delete content' } satisfies ApiResponse);
  }
});

// ── Embedding endpoint (Ticket 3.1) ──

/**
 * POST /api/knowledge/embed
 * Body: { texts: string[], model?: string, providerId?: string }
 * Response: { embeddings: number[][] }
 *
 * Uses an OpenAI-compatible /v1/embeddings endpoint from a configured provider.
 */
router.post('/embed', async (req, res) => {
  const { texts, model, providerId } = req.body as {
    texts?: string[];
    model?: string;
    providerId?: string;
  };

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ status: 'error', error: 'Missing or empty texts array' } satisfies ApiResponse);
    return;
  }

  // Find an embedding-capable provider
  const config = readConfig();
  let provider: ProviderConfig | undefined;

  if (providerId) {
    provider = config.providers.find((p) => p.id === providerId);
  } else {
    // Prefer OpenAI-compatible providers (openai, openrouter, custom with baseUrl)
    provider = config.providers.find((p) =>
      p.type === 'openai' && p.apiKey,
    ) ?? config.providers.find((p) =>
      (p.type === 'openrouter' || p.type === 'custom') && p.apiKey && p.baseUrl,
    );
  }

  if (!provider || !provider.apiKey) {
    res.status(503).json({
      status: 'error',
      error: 'No embedding-capable provider configured',
    } satisfies ApiResponse);
    return;
  }

  // Build the base URL for the embedding endpoint
  const baseUrl = provider.baseUrl?.replace(/\/+$/, '') || 'https://api.openai.com/v1';
  const embeddingUrl = baseUrl.endsWith('/v1')
    ? `${baseUrl}/embeddings`
    : `${baseUrl}/v1/embeddings`;
  const embeddingModel = model || 'text-embedding-3-small';

  try {
    const response = await fetch(embeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: embeddingModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      res.status(response.status).json({
        status: 'error',
        error: `Embedding API error: ${response.status} — ${errorText}`,
      } satisfies ApiResponse);
      return;
    }

    const result = (await response.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };

    if (!result.data || !Array.isArray(result.data)) {
      res.status(502).json({
        status: 'error',
        error: 'Invalid response from embedding API',
      } satisfies ApiResponse);
      return;
    }

    // Sort by index to ensure order matches input
    const sorted = result.data.sort((a, b) => a.index - b.index);
    const embeddings = sorted.map((d) => d.embedding);

    res.json({ status: 'ok', embeddings } satisfies ApiResponse & { embeddings: number[][] });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: `Embedding request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    } satisfies ApiResponse);
  }
});

export default router;
