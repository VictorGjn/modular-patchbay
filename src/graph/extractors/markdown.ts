/**
 * Markdown Relation Extractor
 *
 * Extracts: links_to, references, supersedes, continues, defined_in, depends_on
 */

import type { FileNode, Relation } from '../types.js';

// ── Link Patterns ─────────────────────────────────────────────────────────────

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

// ── Supersedes / Continues Patterns ───────────────────────────────────────────

const SUPERSEDES_RE = /(?:superseded|replaced|deprecated|updated)\s+(?:by|in)\s*:?\s*\[?([^\]\n]+)\]?/gi;
const CONTINUES_RE = /(?:continued\s+from|part\s+\d+\s+of|follows\s+from)\s*:?\s*\[?([^\]\n]+)\]?/gi;

// ── Dependency Patterns ───────────────────────────────────────────────────────

const DEPENDS_RE = /(?:prerequisites?|depends?\s+on|requires?|see\s+also|before\s+reading)\s*:?\s*\[?([^\]\n]+)\]?/gi;

// ── Definition Patterns ───────────────────────────────────────────────────────

const BOLD_DEF_RE = /^\*\*([^*]+)\*\*\s*[:—–-]\s*(.+)$/gm;

/**
 * Resolve a relative markdown link to a file path.
 */
function resolveMarkdownLink(
  href: string,
  sourceDir: string,
): { path: string; anchor?: string } | null {
  // Skip external links, anchors-only, mailto, etc.
  if (/^(https?:|mailto:|#|data:)/.test(href)) return null;
  if (href.startsWith('/')) return null; // Absolute paths — skip

  const [pathPart, anchor] = href.split('#');
  if (!pathPart) return anchor ? { path: '', anchor } : null;

  const parts = sourceDir.split('/').filter(Boolean);
  for (const segment of pathPart.split('/')) {
    if (segment === '.') continue;
    if (segment === '..') { parts.pop(); continue; }
    parts.push(segment);
  }

  return { path: parts.join('/'), anchor };
}

/**
 * Find a FileNode by path (with fuzzy matching for extensions).
 */
function findNodeByPath(path: string, allNodes: FileNode[]): FileNode | undefined {
  // Exact match
  let match = allNodes.find(n => n.path === path);
  if (match) return match;

  // Try with .md extension
  if (!path.endsWith('.md')) {
    match = allNodes.find(n => n.path === path + '.md');
    if (match) return match;
  }

  // Try filename match (for wiki-links)
  const fileName = path.split('/').pop()?.toLowerCase() ?? '';
  return allNodes.find(n => {
    const nodeName = n.path.split('/').pop()?.toLowerCase() ?? '';
    return nodeName === fileName || nodeName === fileName + '.md';
  });
}

/**
 * Collect all defined terms across markdown files.
 * Returns: Map<term (lowercase), { file, originalTerm }>
 */
export function collectDefinedTerms(
  mdNodes: FileNode[],
): Map<string, { file: FileNode; term: string }> {
  const terms = new Map<string, { file: FileNode; term: string }>();

  for (const node of mdNodes) {
    if (node.language !== 'markdown') continue;

    // Headings become linkable terms
    for (const sym of node.symbols) {
      if (sym.kind === 'heading' && sym.name.length > 3) {
        terms.set(sym.name.toLowerCase(), { file: node, term: sym.name });
      }
      if (sym.kind === 'definition') {
        terms.set(sym.name.toLowerCase(), { file: node, term: sym.name });
      }
    }
  }

  return terms;
}

/**
 * Extract all relations from a markdown file.
 */
export function extractMarkdownRelations(
  file: FileNode,
  allNodes: FileNode[],
  content: string,
): Relation[] {
  if (file.language !== 'markdown') return [];

  const relations: Relation[] = [];
  const sourceDir = file.path.split('/').slice(0, -1).join('/');

  // ── Explicit links: [text](path.md) ─────────────────────────────────────

  MD_LINK_RE.lastIndex = 0;
  let match;
  while ((match = MD_LINK_RE.exec(content)) !== null) {
    const href = match[2];
    const resolved = resolveMarkdownLink(href, sourceDir);
    if (!resolved || !resolved.path) continue;

    const target = findNodeByPath(resolved.path, allNodes);
    if (target && target.id !== file.id) {
      relations.push({
        sourceFile: file.id,
        targetFile: target.id,
        targetSymbol: resolved.anchor,
        kind: 'links_to',
        weight: 1.0,
      });
    }
  }

  // ── Wiki links: [[page-name]] ────────────────────────────────────────────

  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(content)) !== null) {
    const linkName = match[1].trim();
    const target = findNodeByPath(linkName, allNodes);
    if (target && target.id !== file.id) {
      relations.push({
        sourceFile: file.id,
        targetFile: target.id,
        kind: 'links_to',
        weight: 1.0,
      });
    }
  }

  // ── Supersedes ───────────────────────────────────────────────────────────

  SUPERSEDES_RE.lastIndex = 0;
  while ((match = SUPERSEDES_RE.exec(content)) !== null) {
    const ref = match[1].trim().replace(/\[|\]/g, '');
    const target = findNodeByPath(ref, allNodes);
    if (target && target.id !== file.id) {
      relations.push({
        sourceFile: file.id,
        targetFile: target.id,
        kind: 'supersedes',
        weight: 0.9,
      });
    }
  }

  // ── Continues ────────────────────────────────────────────────────────────

  CONTINUES_RE.lastIndex = 0;
  while ((match = CONTINUES_RE.exec(content)) !== null) {
    const ref = match[1].trim().replace(/\[|\]/g, '');
    const target = findNodeByPath(ref, allNodes);
    if (target && target.id !== file.id) {
      relations.push({
        sourceFile: file.id,
        targetFile: target.id,
        kind: 'continues',
        weight: 0.8,
      });
    }
  }

  // ── Depends on / Prerequisites ───────────────────────────────────────────

  DEPENDS_RE.lastIndex = 0;
  while ((match = DEPENDS_RE.exec(content)) !== null) {
    const ref = match[1].trim().replace(/\[|\]/g, '');
    const target = findNodeByPath(ref, allNodes);
    if (target && target.id !== file.id) {
      relations.push({
        sourceFile: file.id,
        targetFile: target.id,
        kind: 'depends_on',
        weight: 0.8,
      });
    }
  }

  // ── Cross-document term references ───────────────────────────────────────

  const definedTerms = collectDefinedTerms(allNodes.filter(n => n.id !== file.id));

  for (const [termLower, { file: defFile, term }] of definedTerms) {
    // Only match multi-word terms (> 2 words) or long single words (> 8 chars)
    const wordCount = term.split(/\s+/).length;
    if (wordCount < 2 && term.length <= 8) continue;

    // Word-boundary match, case-insensitive
    const escaped = termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(content)) {
      // Don't duplicate if we already have a links_to for this file
      const alreadyLinked = relations.some(
        r => r.targetFile === defFile.id && (r.kind === 'links_to' || r.kind === 'references')
      );
      if (!alreadyLinked) {
        relations.push({
          sourceFile: file.id,
          targetFile: defFile.id,
          targetSymbol: term,
          kind: 'references',
          weight: 0.6,
        });
      }
    }
  }

  return relations;
}

/**
 * Extract markdown symbols (headings + defined terms) for FileNode.symbols.
 */
export function extractMarkdownSymbols(content: string): Array<{
  name: string;
  kind: 'heading' | 'definition';
  lineStart: number;
  lineEnd: number;
  isExported: boolean;
}> {
  const symbols: Array<{
    name: string;
    kind: 'heading' | 'definition';
    lineStart: number;
    lineEnd: number;
    isExported: boolean;
  }> = [];

  const lines = content.split('\n');

  // Headings
  for (let i = 0; i < lines.length; i++) {
    const hMatch = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
    if (hMatch) {
      symbols.push({
        name: hMatch[2].trim(),
        kind: 'heading',
        lineStart: i + 1,
        lineEnd: i + 1,
        isExported: true,
      });
    }
  }

  // Bold definitions: **Term**: definition
  BOLD_DEF_RE.lastIndex = 0;
  let defMatch;
  while ((defMatch = BOLD_DEF_RE.exec(content)) !== null) {
    const lineNum = content.substring(0, defMatch.index).split('\n').length;
    symbols.push({
      name: defMatch[1].trim(),
      kind: 'definition',
      lineStart: lineNum,
      lineEnd: lineNum,
      isExported: true,
    });
  }

  return symbols;
}
