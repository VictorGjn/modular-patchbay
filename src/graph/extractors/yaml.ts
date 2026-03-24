/**
 * YAML / JSON Relation Extractor
 *
 * Extracts: configured_by
 * Scans config files for path-like string values that reference known source files.
 */

import type { FileNode, Relation } from '../types.js';

// ── Path Detection Patterns ───────────────────────────────────────────────────

// Quoted string values ending in code/doc extensions
const QUOTED_PATH_RE = /["']([^"'\n\r]+\.(?:ts|tsx|js|jsx|py|md))["']/g;

// Unquoted YAML values: `key: ./src/foo.ts`
const YAML_UNQUOTED_PATH_RE = /:\s+([^\s'"{\[,\n\r]+\.(?:ts|tsx|js|jsx|py|md))(?:\s*$|\s*#)/gm;

// JSON Schema self-reference: "$schema": "./path/to/schema.json"
const JSON_SCHEMA_KEY_RE = /['"]\$schema['"]\s*:\s*["']([^"']+\.json)["']/g;

// ── Path Normalization ────────────────────────────────────────────────────────

/**
 * Normalize a raw path reference from config content to a repo-relative path.
 * Resolves relative segments (./ and ../) against the config file's directory.
 */
function normalizePath(raw: string, configDir: string): string {
  let ref = raw.trim();
  if (ref.startsWith('./')) ref = ref.slice(2);

  if (ref.startsWith('../')) {
    const parts = configDir.split('/').filter(Boolean);
    for (const seg of ref.split('/')) {
      if (seg === '.') continue;
      if (seg === '..') { parts.pop(); continue; }
      parts.push(seg);
    }
    return parts.join('/');
  }

  return ref;
}

function findNodeByNormalizedPath(normalized: string, allNodes: FileNode[]): FileNode | undefined {
  return allNodes.find(n => n.path === normalized || n.path.endsWith('/' + normalized));
}

// ── Main Extractor ────────────────────────────────────────────────────────────

/**
 * Extract relations from a YAML or JSON config file.
 *
 * Creates 'configured_by' relations from the referenced code file TO the config.
 * Weight: 0.8 for explicit path references, 0.6 for inferred ($schema).
 */
export function extractYamlRelations(
  node: FileNode,
  allNodes: FileNode[],
  content: string,
): Relation[] {
  if (node.language !== 'yaml' && node.language !== 'json') return [];

  const relations: Relation[] = [];
  const configDir = node.path.split('/').slice(0, -1).join('/');
  const seen = new Set<string>();

  // ── Explicit path references ──────────────────────────────────────────────

  const pathPatterns = [QUOTED_PATH_RE, YAML_UNQUOTED_PATH_RE];
  for (const re of pathPatterns) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const normalized = normalizePath(raw, configDir);
      const target = findNodeByNormalizedPath(normalized, allNodes);
      if (!target || target.id === node.id) continue;

      // Relation: referenced code file is configured_by this config file
      const key = `${target.id}→${node.id}:configured_by`;
      if (seen.has(key)) continue;
      seen.add(key);
      relations.push({
        sourceFile: target.id,
        targetFile: node.id,
        kind: 'configured_by',
        weight: 0.8,
      });
    }
  }

  // ── JSON Schema cross-references ($schema key) ────────────────────────────

  JSON_SCHEMA_KEY_RE.lastIndex = 0;
  let schemaMatch;
  while ((schemaMatch = JSON_SCHEMA_KEY_RE.exec(content)) !== null) {
    const raw = schemaMatch[1];
    if (!raw) continue;
    const normalized = normalizePath(raw, configDir);
    const target = findNodeByNormalizedPath(normalized, allNodes);
    if (!target || target.id === node.id) continue;

    // Relation: this config is configured_by (validated against) the schema
    const key = `${node.id}→${target.id}:configured_by`;
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push({
      sourceFile: node.id,
      targetFile: target.id,
      kind: 'configured_by',
      weight: 0.6,
    });
  }

  return relations;
}
