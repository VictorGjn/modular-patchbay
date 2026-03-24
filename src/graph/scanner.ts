/**
 * File Scanner — Builds FileNodes with symbols and content hash
 *
 * Incremental: only re-processes files whose contentHash changed.
 * Orchestrates relation extraction across all file types.
 */

import type { FileNode, FileLanguage, SymbolDef, Relation, ScanResult, UpdateResult } from './types.js';
import { GraphDB } from './db.js';
import { extractCodeRelations } from './extractors/code.js';
import { extractMarkdownRelations, extractMarkdownSymbols } from './extractors/markdown.js';
import { extractYamlRelations } from './extractors/yaml.js';
import { extractCrossTypeRelations } from './extractors/cross-type.js';
import { estimateTokens } from '../services/treeIndexer.js';

// ── Language Detection ────────────────────────────────────────────────────────

const LANGUAGE_MAP: Record<string, FileLanguage> = {
  ts: 'typescript', tsx: 'typescript', js: 'typescript', jsx: 'typescript',
  py: 'python',
  md: 'markdown', mdx: 'markdown',
  yml: 'yaml', yaml: 'yaml',
  json: 'json',
};

const IGNORE_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.cache\//,
  /coverage\//,
  /\.DS_Store/,
  /package-lock\.json/,
  /yarn\.lock/,
  /pnpm-lock\.yaml/,
];

export function detectLanguage(filePath: string): FileLanguage {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_MAP[ext] ?? 'unknown';
}

export function shouldIndex(filePath: string): boolean {
  if (IGNORE_PATTERNS.some(p => p.test(filePath))) return false;
  const lang = detectLanguage(filePath);
  return lang !== 'unknown';
}

// ── Content Hash ──────────────────────────────────────────────────────────────

/**
 * Simple hash for change detection. Uses DJB2 for speed.
 */
export function hashContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}

// ── File ID ───────────────────────────────────────────────────────────────────

export function fileId(path: string): string {
  // Deterministic ID from path
  return hashContent(path);
}

// ── Symbol Extraction ─────────────────────────────────────────────────────────

// Code symbol patterns (simplified from existing codeIndexer)
const TS_EXPORT_SYM = /^export\s+(?:default\s+)?(?:async\s+)?(?:declare\s+)?(?:(?:abstract\s+)?class|interface|type|enum|function|(?:const|let|var))\s+(\w+)/gm;
const PY_DEF_SYM = /^(?:class|(?:async\s+)?def)\s+(\w+)/gm;

function extractCodeSymbols(content: string, language: FileLanguage): SymbolDef[] {
  const symbols: SymbolDef[] = [];
  // const _lines = content.split('\n');

  if (language === 'typescript') {
    TS_EXPORT_SYM.lastIndex = 0;
    let match;
    while ((match = TS_EXPORT_SYM.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const name = match[1];
      const line = match[0];
      let kind: SymbolDef['kind'] = 'const';
      if (/class\b/.test(line)) kind = 'class';
      else if (/interface\b/.test(line)) kind = 'interface';
      else if (/type\b/.test(line)) kind = 'type';
      else if (/enum\b/.test(line)) kind = 'enum';
      else if (/function\b/.test(line)) kind = 'function';

      symbols.push({
        name,
        kind,
        lineStart: lineNum,
        lineEnd: lineNum, // Simplified — would need block end detection
        isExported: true,
        tokens: estimateTokens(line),
      });
    }

    // Also find non-exported top-level declarations for internal reference
    const NON_EXPORT = /^(?:(?:abstract\s+)?class|interface|type|enum|function|(?:const|let|var))\s+(\w+)/gm;
    NON_EXPORT.lastIndex = 0;
    while ((match = NON_EXPORT.exec(content)) !== null) {
      const name = match[1];
      if (symbols.some(s => s.name === name)) continue;
      const lineNum = content.substring(0, match.index).split('\n').length;
      symbols.push({
        name,
        kind: 'function',
        lineStart: lineNum,
        lineEnd: lineNum,
        isExported: false,
        tokens: estimateTokens(match[0]),
      });
    }
  } else if (language === 'python') {
    PY_DEF_SYM.lastIndex = 0;
    let match;
    while ((match = PY_DEF_SYM.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const name = match[1];
      const isClass = match[0].startsWith('class');
      symbols.push({
        name,
        kind: isClass ? 'class' : 'function',
        lineStart: lineNum,
        lineEnd: lineNum,
        isExported: !name.startsWith('_'),
        tokens: estimateTokens(match[0]),
      });
    }
  }

  return symbols;
}

// ── Build FileNode ────────────────────────────────────────────────────────────

export function buildFileNode(
  path: string,
  content: string,
  lastModified: number = Date.now(),
): FileNode {
  const language = detectLanguage(path);
  const id = fileId(path);

  let symbols: SymbolDef[];
  if (language === 'markdown') {
    symbols = extractMarkdownSymbols(content).map(s => ({
      ...s,
      tokens: estimateTokens(s.name),
    }));
  } else {
    symbols = extractCodeSymbols(content, language);
  }

  return {
    id,
    path,
    language,
    lastModified,
    contentHash: hashContent(content),
    tokens: estimateTokens(content),
    symbols,
  };
}

// ── Full Scan ─────────────────────────────────────────────────────────────────

/**
 * Scan all files from a list of {path, content, mtime} entries.
 * This is the main entry point — the caller reads the filesystem.
 */
export function fullScan(
  files: Array<{ path: string; content: string; mtime?: number }>,
  db: GraphDB,
): ScanResult {
  const start = Date.now();
  db.clear();

  // Phase 1: Build all FileNodes
  const nodes: FileNode[] = [];
  for (const f of files) {
    if (!shouldIndex(f.path)) continue;
    const node = buildFileNode(f.path, f.content, f.mtime ?? Date.now());
    db.upsertNode(node);
    nodes.push(node);
  }

  // Phase 2: Extract relations (needs all nodes indexed first)
  let totalRelations = 0;
  const allNodes = db.getAllNodes();
  const contentMap = new Map(files.map(f => [fileId(f.path), f.content]));

  for (const node of allNodes) {
    const content = contentMap.get(node.id) ?? '';
    let rels: Relation[] = [];

    if (node.language === 'typescript' || node.language === 'python') {
      rels = extractCodeRelations(node, allNodes, content);
    } else if (node.language === 'markdown') {
      rels = extractMarkdownRelations(node, allNodes, content);
    } else if (node.language === 'yaml' || node.language === 'json') {
      rels = extractYamlRelations(node, allNodes, content);
    }

    const crossRels = extractCrossTypeRelations(node, allNodes, content);
    db.addRelations([...rels, ...crossRels]);
    totalRelations += rels.length + crossRels.length;
  }

  const stats = db.getStats();
  return {
    totalFiles: stats.nodes,
    totalSymbols: stats.symbols,
    totalRelations: stats.relations,
    filesUpdated: stats.nodes,
    relationsAdded: totalRelations,
    relationsRemoved: 0,
    staleFilesTriggered: 0,
    durationMs: Date.now() - start,
  };
}

/**
 * Incremental update: process only changed files.
 */
export function updateFiles(
  changedFiles: Array<{ path: string; content: string; mtime?: number }>,
  db: GraphDB,
): UpdateResult {
  const start = Date.now();
  let filesUpdated = 0;
  let relationsAdded = 0;
  let relationsRemoved = 0;
  let staleFilesTriggered = 0;

  for (const f of changedFiles) {
    if (!shouldIndex(f.path)) continue;

    const id = fileId(f.path);
    const existing = db.getNode(id);
    const newHash = hashContent(f.content);

    // Skip if unchanged
    if (existing && existing.contentHash === newHash) continue;

    // Remove old relations from this file
    if (existing) {
      relationsRemoved += db.removeRelationsForSource(id);
    }

    // Rebuild node
    const node = buildFileNode(f.path, f.content, f.mtime ?? Date.now());
    db.upsertNode(node);
    filesUpdated++;

    // Re-extract relations
    const allNodes = db.getAllNodes();
    let rels: Relation[] = [];
    if (node.language === 'typescript' || node.language === 'python') {
      rels = extractCodeRelations(node, allNodes, f.content);
    } else if (node.language === 'markdown') {
      rels = extractMarkdownRelations(node, allNodes, f.content);
    } else if (node.language === 'yaml' || node.language === 'json') {
      rels = extractYamlRelations(node, allNodes, f.content);
    }

    const crossRels = extractCrossTypeRelations(node, allNodes, f.content);
    db.addRelations([...rels, ...crossRels]);
    relationsAdded += rels.length + crossRels.length;
  }

  return {
    filesUpdated,
    relationsAdded,
    relationsRemoved,
    staleFilesTriggered,
    durationMs: Date.now() - start,
  };
}
