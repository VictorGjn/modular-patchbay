/**
 * Code Relation Extractor — TypeScript / Python
 *
 * Extracts: imports, calls, extends, implements, uses_type, tested_by, tests
 * Regex-based (no Tree-sitter) — matches existing codeIndexer philosophy.
 */

import type { FileNode, Relation, RelationKind, SymbolDef } from '../types.js';

// ── Import Patterns ───────────────────────────────────────────────────────────

const TS_IMPORT_RE = /import\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
const TS_REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const TS_DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const PY_FROM_IMPORT_RE = /^from\s+([\w.]+)\s+import\b/gm;
const PY_IMPORT_RE = /^import\s+([\w.]+)/gm;

// ── Inheritance Patterns ──────────────────────────────────────────────────────

const TS_EXTENDS_RE = /class\s+\w+(?:<[^>]*>)?\s+extends\s+(\w+)/g;
const TS_IMPLEMENTS_RE = /class\s+\w+(?:<[^>]*>)?\s+(?:extends\s+\w+(?:<[^>]*>)?\s+)?implements\s+([\w,\s]+)/g;
const PY_CLASS_INHERIT_RE = /class\s+\w+\(([^)]+)\)/g;

// ── Test Detection ────────────────────────────────────────────────────────────

const TEST_FILE_PATTERNS = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /__tests__\//,
  /test_[\w]+\.py$/,
  /[\w]+_test\.py$/,
];

const TEST_CONTENT_MARKERS = /\b(describe|it|test|expect|assert|def test_|class Test)\b/;

const COMMON_IDENTIFIERS = new Set([
  'get', 'set', 'map', 'filter', 'reduce', 'find', 'forEach', 'push', 'pop',
  'shift', 'unshift', 'slice', 'splice', 'concat', 'join', 'split', 'trim',
  'toString', 'valueOf', 'hasOwnProperty', 'keys', 'values', 'entries',
  'then', 'catch', 'finally', 'resolve', 'reject', 'log', 'error', 'warn',
  'next', 'done', 'run', 'start', 'stop', 'open', 'close', 'read', 'write',
  'init', 'reset', 'clear', 'update', 'delete', 'create', 'remove', 'add',
  'length', 'size', 'name', 'type', 'value', 'data', 'result', 'status',
  'self', 'cls', 'super', 'this', 'print', 'len', 'range', 'str', 'int',
]);

/**
 * Resolve a relative import path to match against known file paths.
 * Normalizes: './utils/helper' → 'utils/helper'
 */
function normalizeImportPath(importPath: string, sourceDir: string): string {
  if (importPath.startsWith('.')) {
    const parts = sourceDir.split('/');
    for (const segment of importPath.split('/')) {
      if (segment === '.') continue;
      if (segment === '..') { parts.pop(); continue; }
      parts.push(segment);
    }
    return parts.join('/');
  }
  return importPath;
}

/**
 * Try to match an import path to a FileNode.
 */
function resolveImportTarget(
  importPath: string,
  sourceFile: FileNode,
  allNodes: FileNode[],
): FileNode | undefined {
  const sourceDir = sourceFile.path.split('/').slice(0, -1).join('/');
  const normalized = normalizeImportPath(importPath, sourceDir);

  // Try exact match, then with extensions
  const candidates = [
    normalized,
    normalized + '.ts', normalized + '.tsx',
    normalized + '.js', normalized + '.jsx',
    normalized + '.py',
    normalized + '/index.ts', normalized + '/index.js',
    normalized + '/index.tsx',
  ];

  for (const candidate of candidates) {
    const match = allNodes.find(n =>
      n.path === candidate || n.path.endsWith('/' + candidate)
    );
    if (match) return match;
  }

  return undefined;
}

/**
 * Extract all relations from a code file.
 */
export function extractCodeRelations(
  file: FileNode,
  allNodes: FileNode[],
  content: string,
): Relation[] {
  const relations: Relation[] = [];

  if (file.language !== 'typescript' && file.language !== 'python') {
    return relations;
  }

  // ── Imports ────────────────────────────────────────────────────────────────

  const importPatterns = file.language === 'typescript'
    ? [TS_IMPORT_RE, TS_REQUIRE_RE, TS_DYNAMIC_IMPORT_RE]
    : [PY_FROM_IMPORT_RE, PY_IMPORT_RE];

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;
      // Skip node_modules / external packages
      if (!importPath.startsWith('.') && !importPath.startsWith('/') && file.language === 'typescript') continue;

      const target = resolveImportTarget(importPath, file, allNodes);
      if (target && target.id !== file.id) {
        const isDynamic = pattern === TS_DYNAMIC_IMPORT_RE;
        relations.push({
          sourceFile: file.id,
          targetFile: target.id,
          kind: 'imports',
          weight: isDynamic ? 0.7 : 1.0,
        });
      }
    }
  }

  // ── Extends / Implements ───────────────────────────────────────────────────

  const inheritancePatterns: Array<{ re: RegExp; kind: RelationKind }> =
    file.language === 'typescript'
      ? [
          { re: TS_EXTENDS_RE, kind: 'extends' },
          { re: TS_IMPLEMENTS_RE, kind: 'implements' },
        ]
      : [{ re: PY_CLASS_INHERIT_RE, kind: 'extends' }];

  for (const { re, kind } of inheritancePatterns) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const name of names) {
        if (name === 'object' || name === 'Object') continue;
        const targetFiles = allNodes.filter(n =>
          n.id !== file.id &&
          n.symbols.some(s => s.name === name && s.isExported)
        );
        for (const target of targetFiles) {
          relations.push({
            sourceFile: file.id,
            sourceSymbol: undefined,
            targetFile: target.id,
            targetSymbol: name,
            kind,
            weight: 0.9,
          });
        }
      }
    }
  }

  // ── Calls ──────────────────────────────────────────────────────────────────

  // Build index of all exported symbols across all files (excluding this file)
  const exportedSymbols = new Map<string, Array<{ file: FileNode; symbol: SymbolDef }>>();
  for (const node of allNodes) {
    if (node.id === file.id) continue;
    for (const sym of node.symbols) {
      if (!sym.isExported) continue;
      if (sym.kind !== 'function' && sym.kind !== 'const' && sym.kind !== 'class') continue;
      const arr = exportedSymbols.get(sym.name) ?? [];
      arr.push({ file: node, symbol: sym });
      exportedSymbols.set(sym.name, arr);
    }
  }

  // Scan for function calls: identifier followed by (
  const CALL_RE = /\b(\w+)\s*\(/g;
  CALL_RE.lastIndex = 0;
  let callMatch;
  const seenCalls = new Set<string>();

  while ((callMatch = CALL_RE.exec(content)) !== null) {
    const name = callMatch[1];
    if (!name || COMMON_IDENTIFIERS.has(name)) continue;
    if (name.length < 3) continue;
    if (/^[A-Z_]+$/.test(name)) continue; // ALL_CAPS constants
    if (/^(if|for|while|switch|catch|return|new|throw|typeof|instanceof|void|delete|await|async)$/.test(name)) continue;

    const targets = exportedSymbols.get(name);
    if (!targets) continue;

    for (const { file: targetFile } of targets) {
      const key = `${file.id}→${targetFile.id}:${name}`;
      if (seenCalls.has(key)) continue;
      seenCalls.add(key);

      // Only count if we actually import from that file
      const hasImport = relations.some(
        r => r.sourceFile === file.id && r.targetFile === targetFile.id && r.kind === 'imports'
      );

      relations.push({
        sourceFile: file.id,
        targetFile: targetFile.id,
        sourceSymbol: undefined,
        targetSymbol: name,
        kind: 'calls',
        weight: hasImport ? 0.9 : 0.5,
      });
    }
  }

  // ── Test Relations ─────────────────────────────────────────────────────────

  const isTestFile = TEST_FILE_PATTERNS.some(p => p.test(file.path)) ||
                     TEST_CONTENT_MARKERS.test(content);

  if (isTestFile) {
    // Find source files this test imports
    for (const rel of relations) {
      if (rel.kind === 'imports') {
        const target = allNodes.find(n => n.id === rel.targetFile);
        if (target && !TEST_FILE_PATTERNS.some(p => p.test(target.path))) {
          relations.push({
            sourceFile: file.id,
            targetFile: target.id,
            kind: 'tests',
            weight: 1.0,
          });
          relations.push({
            sourceFile: target.id,
            targetFile: file.id,
            kind: 'tested_by',
            weight: 1.0,
          });
        }
      }
    }

    // Also match by filename convention: payment.test.ts → payment.ts
    const baseName = file.path
      .replace(/\.test\.[tj]sx?$/, '')
      .replace(/\.spec\.[tj]sx?$/, '')
      .replace(/__tests__\//, '');

    for (const node of allNodes) {
      if (node.id === file.id) continue;
      const nodeName = node.path.replace(/\.[^.]+$/, '');
      if (nodeName === baseName || node.path === baseName + '.ts' || node.path === baseName + '.tsx') {
        if (!relations.some(r => r.sourceFile === file.id && r.targetFile === node.id && r.kind === 'tests')) {
          relations.push({
            sourceFile: file.id, targetFile: node.id, kind: 'tests', weight: 0.8,
          });
          relations.push({
            sourceFile: node.id, targetFile: file.id, kind: 'tested_by', weight: 0.8,
          });
        }
      }
    }
  }

  return relations;
}
