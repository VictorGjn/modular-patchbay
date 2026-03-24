/**
 * Cross-Type Relation Extractor
 *
 * Extracts: documents
 * Bridges markdown docs ↔ code files based on directory co-location and
 * explicit backtick mentions.
 */

import type { FileNode, Relation } from '../types.js';

// ── Patterns ──────────────────────────────────────────────────────────────────

// Backtick-quoted token that looks like a filename (has an extension)
const BACKTICK_FILE_RE = /`([^`\n\r\s][^`\n\r]*?\.(?:ts|tsx|js|jsx|py|md|json|yaml|yml))`/g;

// File extensions that represent actual source/config files (not common words)
const CODE_EXT_RE = /\.(?:ts|tsx|js|jsx|py)$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function dirOf(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

function baseNameOf(path: string): string {
  return path.split('/').pop() ?? '';
}

// ── Main Extractor ────────────────────────────────────────────────────────────

/**
 * Extract cross-type relations from any file.
 *
 * Rule 1: README.md → 'documents' all code files in the same directory (weight 0.7)
 * Rule 2: Backtick `filename.ext` mentions → 'documents' the referenced file (weight 0.6)
 */
export function extractCrossTypeRelations(
  node: FileNode,
  allNodes: FileNode[],
  content: string,
): Relation[] {
  const relations: Relation[] = [];
  const nodeDir = dirOf(node.path);
  const seen = new Set<string>();

  function addDocs(targetId: string, weight: number) {
    const key = `${node.id}→${targetId}:documents`;
    if (seen.has(key)) return;
    seen.add(key);
    relations.push({ sourceFile: node.id, targetFile: targetId, kind: 'documents', weight });
  }

  // ── Rule 1: README documents sibling code files ───────────────────────────

  const fileName = baseNameOf(node.path).toLowerCase();
  if (fileName === 'readme.md') {
    for (const other of allNodes) {
      if (other.id === node.id) continue;
      if (dirOf(other.path) !== nodeDir) continue;
      if (!CODE_EXT_RE.test(other.path)) continue;
      addDocs(other.id, 0.7);
    }
  }

  // ── Rule 2: Backtick-quoted filename mentions ─────────────────────────────

  BACKTICK_FILE_RE.lastIndex = 0;
  let match;
  while ((match = BACKTICK_FILE_RE.exec(content)) !== null) {
    const raw = match[1].trim();
    if (!raw || /\s/.test(raw)) continue; // skip if contains spaces

    // Match against known nodes: by exact path, path suffix, or basename
    const target = allNodes.find(n =>
      n.id !== node.id && (
        n.path === raw ||
        n.path.endsWith('/' + raw) ||
        baseNameOf(n.path) === raw
      )
    );
    if (!target) continue;
    addDocs(target.id, 0.6);
  }

  return relations;
}
