/**
 * Code Indexer — TypeScript/Python Structure Extraction
 *
 * Parses source code using regex (no AST deps) into a TreeIndex
 * compatible with the depth filter pipeline.
 *
 * Depth mapping (via existing depthFilter.ts):
 *   Full (0):       Complete source code (root.text)
 *   Detail (1):     Signatures + docstrings (meta.firstParagraph on leaves)
 *   Summary (2):    Item signatures (meta.firstSentence)
 *   Headlines (3):  Section names + exports list (node titles, depth ≤ 2)
 *   Mention (4):    File purpose + primary exports (root only)
 */

import { type TreeNode, type TreeIndex, estimateTokens } from '../services/treeIndexer';

// ── Public Types ──────────────────────────────────────────────────────────────

export type CodeLanguage = 'typescript' | 'python' | 'unknown';

// ── Internal Types ────────────────────────────────────────────────────────────

interface CodeMember {
  name: string;
  signature: string;
  docstring: string;
  body: string;
}

interface CodeItem {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'type' | 'enum' | 'const';
  signature: string;
  docstring: string;
  body: string;
  lineStart: number;
  lineEnd: number;
  isExported: boolean;
  members: CodeMember[];
}

// ── Regex Patterns ────────────────────────────────────────────────────────────

const TS_EXPORT_RE =
  /^export\s+(?:default\s+)?(?:async\s+)?(?:declare\s+)?(?:(?:abstract\s+)?class|interface|type|enum|function|(?:const|let|var))\s+(\w+)/;

// #134: Also match non-exported top-level declarations
const TS_TOPLEVEL_RE =
  /^(?:async\s+)?(?:(?:abstract\s+)?class|interface|type|enum|function)\s+(\w+)/;

// #134: Match arrow function exports: export const foo = (...) => ...
const TS_ARROW_EXPORT_RE =
  /^export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/;
const TS_METHOD_RE =
  /^\s{2,}(?:(?:public|private|protected|static|async|override|abstract)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(/;
const PY_CLASS_RE = /^class\s+(\w+)/;
const PY_FUNC_RE = /^(?:async\s+)?def\s+(\w+)/;
const PY_METHOD_RE = /^    (?:async\s+)?def\s+(\w+)/;
const CTRL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'throw', 'get', 'set', 'delete',
]);

// ── ID Generator ──────────────────────────────────────────────────────────────

let _seq = 0;

// ── Node Factory ──────────────────────────────────────────────────────────────

function makeNode(
  title: string,
  depth: number,
  text: string,
  firstSentence: string,
  firstParagraph: string,
  lineStart?: number,
): TreeNode {
  return {
    nodeId: `c${_seq++}`,
    title,
    depth,
    text,
    tokens: estimateTokens(text),
    totalTokens: 0,
    children: [],
    meta: { firstSentence, firstParagraph, sourceType: 'code', lineStart },
  };
}

// ── Tree Utilities ────────────────────────────────────────────────────────────

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

// ── Language Detection ────────────────────────────────────────────────────────

export function detectLanguage(source: string): CodeLanguage {
  const ext = source.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'py') return 'python';
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return 'typescript';
  return 'unknown';
}

// ── JSDoc Extraction ──────────────────────────────────────────────────────────

function extractJsDoc(lines: string[], beforeLine: number): string {
  let i = beforeLine - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0 || !lines[i].trim().endsWith('*/')) return '';
  const docLines: string[] = [];
  while (i >= 0 && !lines[i].includes('/**')) { docLines.unshift(lines[i]); i--; }
  if (i >= 0) docLines.unshift(lines[i]);
  return docLines
    .map(l => l.replace(/^\s*\/\*\*\s?/, '').replace(/^\s*\*\s?/, '').replace(/\s*\*\/\s*$/, ''))
    .filter(l => l.trim() !== '')
    .join(' ')
    .trim();
}

// ── Block End Finders ─────────────────────────────────────────────────────────

function findBracedEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let started = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') depth--;
    }
    if (started && depth === 0) return i;
    if (!started && lines[i].trim().endsWith(';')) return i;
  }
  return Math.min(startLine + 10, lines.length - 1);
}

function findPyBlockEnd(lines: string[], startLine: number, baseIndent: number): number {
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.length - line.trimStart().length <= baseIndent) return i - 1;
  }
  return lines.length - 1;
}

// ── TypeScript Parser ─────────────────────────────────────────────────────────

function resolveKind(line: string): CodeItem['kind'] {
  if (/(?:abstract\s+)?class\b/.test(line)) return 'class';
  if (/\binterface\b/.test(line)) return 'interface';
  if (/\btype\b/.test(line)) return 'type';
  if (/\benum\b/.test(line)) return 'enum';
  if (/\bfunction\b/.test(line)) return 'function';
  return 'const';
}

function parseTsMethods(lines: string[], classStart: number, classEnd: number): CodeMember[] {
  const members: CodeMember[] = [];
  for (let i = classStart + 1; i < classEnd; i++) {
    const m = TS_METHOD_RE.exec(lines[i]);
    if (!m || CTRL_KEYWORDS.has(m[1])) continue;
    const doc = extractJsDoc(lines, i);
    const end = findBracedEnd(lines, i);
    const body = lines.slice(i, end + 1).join('\n');
    members.push({ name: m[1], signature: lines[i].trim(), docstring: doc, body });
    i = end;
  }
  return members;
}

function parseTsItemAt(lines: string[], i: number): CodeItem | null {
  // Try exported declaration first
  let m = TS_EXPORT_RE.exec(lines[i]);
  let isExported = !!m;
  // #134: Try arrow function export
  if (!m) { m = TS_ARROW_EXPORT_RE.exec(lines[i]); if (m) isExported = true; }
  // #134: Try non-exported top-level declaration
  if (!m) { m = TS_TOPLEVEL_RE.exec(lines[i]); isExported = false; }
  if (!m) return null;
  const kind = resolveKind(lines[i]);
  const name = m[1];
  const doc = extractJsDoc(lines, i);
  const lineEnd = findBracedEnd(lines, i);
  const body = lines.slice(i, lineEnd + 1).join('\n');
  const members = kind === 'class' ? parseTsMethods(lines, i, lineEnd) : [];
  return { name, kind, signature: lines[i].trim(), docstring: doc, body, lineStart: i, lineEnd, isExported, members };
}

function parseTsItems(lines: string[]): CodeItem[] {
  const items: CodeItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!TS_EXPORT_RE.test(lines[i]) && !TS_TOPLEVEL_RE.test(lines[i]) && !TS_ARROW_EXPORT_RE.test(lines[i])) continue;
    const item = parseTsItemAt(lines, i);
    if (!item) continue;
    items.push(item);
    i = item.lineEnd;
  }
  return items;
}

// ── Python Parser ─────────────────────────────────────────────────────────────

function extractPyDocstring(lines: string[], afterLine: number): string {
  let i = afterLine + 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return '';
  const t = lines[i].trim();
  const quote = t.startsWith('"""') ? '"""' : t.startsWith("'''") ? "'''" : null;
  if (!quote) return '';
  if (t.length > 6 && t.endsWith(quote)) return t.slice(3, -3).trim();
  const docLines = [t.slice(3)];
  i++;
  while (i < lines.length && !lines[i].includes(quote)) { docLines.push(lines[i].trim()); i++; }
  return docLines.join(' ').trim();
}

function parsePyMethods(lines: string[], classStart: number, classEnd: number): CodeMember[] {
  const members: CodeMember[] = [];
  for (let i = classStart + 1; i <= classEnd; i++) {
    const m = PY_METHOD_RE.exec(lines[i] ?? '');
    if (!m) continue;
    const doc = extractPyDocstring(lines, i);
    const end = findPyBlockEnd(lines, i, 4);
    const body = lines.slice(i, end + 1).join('\n');
    members.push({ name: m[1], signature: lines[i].trim(), docstring: doc, body });
    i = end;
  }
  return members;
}

function parsePyItemAt(lines: string[], i: number): CodeItem | null {
  const classM = PY_CLASS_RE.exec(lines[i]);
  const funcM = classM ? null : PY_FUNC_RE.exec(lines[i]);
  if (!classM && !funcM) return null;
  const kind: CodeItem['kind'] = classM ? 'class' : 'function';
  const name = classM?.[1] ?? funcM?.[1] ?? '';
  const lineEnd = findPyBlockEnd(lines, i, 0);
  const doc = extractPyDocstring(lines, i);
  const body = lines.slice(i, lineEnd + 1).join('\n');
  const members = kind === 'class' ? parsePyMethods(lines, i, lineEnd) : [];
  return { name, kind, signature: lines[i].trim(), docstring: doc, body, lineStart: i, lineEnd, isExported: true, members };
}

function parsePyItems(lines: string[]): CodeItem[] {
  const items: CodeItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!PY_CLASS_RE.test(lines[i]) && !PY_FUNC_RE.test(lines[i])) continue;
    const item = parsePyItemAt(lines, i);
    if (!item) continue;
    items.push(item);
    i = item.lineEnd;
  }
  return items;
}

// ── Import Parser ─────────────────────────────────────────────────────────────

function parseImports(lines: string[], lang: CodeLanguage): string[] {
  const re = lang === 'python' ? /^(?:import|from)\s+\S/ : /^import\s/;
  return lines.filter(l => re.test(l)).map(l => l.trim());
}

// ── Tree Builders ─────────────────────────────────────────────────────────────

function buildMemberNode(member: CodeMember, depth: number): TreeNode {
  const fp = member.docstring ? `${member.signature}\n${member.docstring}` : member.signature;
  return makeNode(member.name, depth, member.body, member.signature, fp);
}

function buildItemNode(item: CodeItem, depth: number): TreeNode {
  const fp = item.docstring ? `${item.signature}\n${item.docstring}` : item.signature;
  const node = makeNode(item.name, depth, item.body, item.signature, fp, item.lineStart);
  for (const m of item.members) node.children.push(buildMemberNode(m, depth + 1));
  return node;
}

function buildImportsNode(imports: string[], depth: number): TreeNode {
  const text = imports.join('\n');
  const sources = imports
    .map(l =>
      l.match(/from\s+['"]([^'"]+)['"]/)?.[1] ??
      l.match(/^from\s+(\S+)/)?.[1] ??
      l.match(/^import\s+(\S+)/)?.[1] ??
      ''
    )
    .filter(Boolean).slice(0, 5).join(', ');
  return makeNode('Imports & Dependencies', depth, text, `Imports: ${sources}`, text.slice(0, 500));
}

function buildSectionNode(title: string, items: CodeItem[], depth: number): TreeNode {
  const names = items.map(i => i.name).join(', ');
  const text = items.map(i => i.signature).join('\n');
  const node = makeNode(title, depth, text, `${title}: ${names}`, text.slice(0, 800));
  for (const item of items) node.children.push(buildItemNode(item, depth + 1));
  return node;
}

function buildTreeChildren(root: TreeNode, items: CodeItem[], imports: string[]): void {
  if (imports.length > 0) root.children.push(buildImportsNode(imports, 1));
  const types = items.filter(i => i.kind === 'interface' || i.kind === 'type' || i.kind === 'enum');
  const classes = items.filter(i => i.kind === 'class');
  const fns = items.filter(i => i.kind === 'function' || i.kind === 'const');
  if (types.length > 0) root.children.push(buildSectionNode('Types & Interfaces', types, 1));
  if (classes.length > 0) root.children.push(buildSectionNode('Classes', classes, 1));
  if (fns.length > 0) root.children.push(buildSectionNode('Functions & Exports', fns, 1));
}

function buildRootMeta(source: string, items: CodeItem[], lang: CodeLanguage): { fs: string; fp: string } {
  const names = items.map(i => i.name);
  const top = names.slice(0, 5).join(', ');
  const more = names.length > 5 ? ` (+${names.length - 5} more)` : '';
  return {
    fs: `${lang} module: ${top}${more}`,
    fp: `${source}\nExports: ${names.join(', ')}\n${items.length} top-level declarations`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Index a source code file into a TreeIndex for the context pipeline.
 *
 * @param source - File path (used as ID and for language detection)
 * @param content - Raw file content
 */
export function indexCodeFile(source: string, content: string): TreeIndex {
  const lang = detectLanguage(source);
  const lines = content.split('\n');
  const imports = parseImports(lines, lang);
  const items = lang === 'typescript' ? parseTsItems(lines)
    : lang === 'python' ? parsePyItems(lines)
    : [];
  const { fs, fp } = buildRootMeta(source, items, lang);
  const root = makeNode(source, 0, content, fs, fp);
  buildTreeChildren(root, items, imports);
  computeTotals(root);
  return { source, sourceType: 'code', root, totalTokens: root.totalTokens, nodeCount: countNodes(root), created: Date.now() };
}
