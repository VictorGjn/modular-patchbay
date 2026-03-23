/**
 * Entry Point Resolver
 *
 * From a natural language query, find entry points into the context graph.
 * Three strategies: symbol match, filename match, semantic match (fallback).
 */

import type { ContextGraph, EntryPoint } from './types.js';

/**
 * Resolve entry points from a query against the graph.
 */
export function resolveEntryPoints(
  query: string,
  graph: ContextGraph,
): EntryPoint[] {
  const entries: EntryPoint[] = [];
  const seenFiles = new Set<string>();

  // ── 1. Exact symbol match ─────────────────────────────────────────────────
  // Query mentions a function, class, heading, or term name
  for (const [symbolName, files] of graph.symbolIndex) {
    if (symbolName.length < 3) continue;

    // Check if the symbol name appears in the query (word boundary)
    const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(query)) {
      for (const file of files) {
        if (!seenFiles.has(file.id)) {
          entries.push({
            fileId: file.id,
            symbolName,
            confidence: 1.0,
            reason: 'Direct mention',
          });
          seenFiles.add(file.id);
        }
      }
    }
  }

  // ── 2. Filename match ─────────────────────────────────────────────────────
  // Query mentions a filename (normalized, without extension)
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  for (const [id, node] of graph.nodes) {
    if (seenFiles.has(id)) continue;

    const fileName = node.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
    if (fileName.length <= 3) continue;

    // Convert camelCase/PascalCase to space-separated for matching
    const fileWords = fileName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .toLowerCase();

    // Check if file words appear in query
    if (normalizedQuery.includes(fileWords) ||
        normalizedQuery.includes(fileName.toLowerCase())) {
      entries.push({
        fileId: id,
        confidence: 0.8,
        reason: 'Filename match',
      });
      seenFiles.add(id);
    }
  }

  // ── 3. Path-segment match ─────────────────────────────────────────────────
  // "payment module" matches src/payment/index.ts
  for (const [id, node] of graph.nodes) {
    if (seenFiles.has(id)) continue;

    const pathSegments = node.path.split('/').map(s => s.toLowerCase());
    for (const segment of pathSegments) {
      if (segment.length <= 3) continue;
      if (normalizedQuery.includes(segment)) {
        entries.push({
          fileId: id,
          confidence: 0.6,
          reason: 'Filename match',
        });
        seenFiles.add(id);
        break;
      }
    }
  }

  return entries.sort((a, b) => b.confidence - a.confidence);
}
