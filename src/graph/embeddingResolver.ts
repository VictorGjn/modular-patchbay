/**
 * Embedding Resolver — Semantic entry point resolution for context graph.
 *
 * Drop-in replacement for modular-patchbay's lexical resolver.
 * Adds embedding-based resolution that bridges the vocabulary gap:
 * "how does authentication work?" finds auth files even if no path/symbol
 * contains "auth".
 *
 * Architecture:
 *   1. Build compact identity per FileNode (path + exports + headings + firstSentence)
 *   2. Embed via OpenAI text-embedding-3-small (512 dims, cheap)
 *   3. At query time: embed query → cosine sim → entry points
 *   4. Merge with lexical resolver scores for hybrid resolution
 *
 * Integration point: replaces or wraps resolveEntryPoints() in graph/resolver.ts
 */

import type { ContextGraph, EntryPoint, FileNode } from './types.js';

// ── Config ──

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMS = 512;
const EMBED_BATCH_SIZE = 100;

// Hybrid weights
const SEMANTIC_WEIGHT = 0.6;
const LEXICAL_WEIGHT = 0.4;

// ── Types ──

export interface EmbeddingCache {
  entries: Map<string, EmbeddingEntry>;
  model: string;
  dims: number;
}

interface EmbeddingEntry {
  fileId: string;
  contentHash: string;
  identity: string;
  embedding: number[];
}

export interface HybridEntryPoint extends EntryPoint {
  lexicalScore: number;
  semanticScore: number;
}

// ── Identity builder ──

/**
 * Build a compact semantic identity for a file.
 * ~50-200 tokens. Captures what the file IS, not its full content.
 */
export function buildIdentity(node: FileNode): string {
  const parts: string[] = [];

  parts.push(`File: ${node.path}`);
  parts.push(`Language: ${node.language}`);

  // Exported symbols
  const exported = node.symbols
    .filter(s => s.isExported)
    .slice(0, 20);
  if (exported.length > 0) {
    parts.push(`Exports: ${exported.map(s => `${s.kind} ${s.name}`).join(', ')}`);
  }

  // Docstrings from exported symbols (rich semantic signal)
  const withDocs = exported.filter(s => s.docstring);
  if (withDocs.length > 0) {
    parts.push(`Docs: ${withDocs.map(s => s.docstring).join('. ')}`);
  }

  // Tree headings + first sentence
  if (node.treeIndex) {
    const headings = collectHeadings(node.treeIndex.root, 3);
    if (headings.length > 0) {
      parts.push(`Sections: ${headings.join(', ')}`);
    }
    // First sentence from tree root is the file's purpose
    const root = node.treeIndex.root;
    if (root.firstSentence) {
      parts.push(`Purpose: ${root.firstSentence}`);
    }
  }

  return parts.join('\n');
}

function collectHeadings(node: { title: string; children: any[]; depth: number }, maxDepth: number): string[] {
  const headings: string[] = [];
  if (node.depth > 0 && node.depth <= maxDepth && node.title) {
    headings.push(node.title);
  }
  for (const child of node.children ?? []) {
    headings.push(...collectHeadings(child, maxDepth));
  }
  return headings;
}

// ── Embedding API ──

/**
 * Embed texts via OpenAI API. Requires OPENAI_API_KEY in env or passed.
 */
export async function embedTexts(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);

    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: batch,
        dimensions: EMBED_DIMS,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Embedding API error: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json();
    const batchEmbeddings = data.data.map((item: any) => item.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

async function embedSingle(text: string, apiKey: string): Promise<number[]> {
  const [embedding] = await embedTexts([text], apiKey);
  return embedding;
}

// ── Vector math ──

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

// ── Cache management ──

/**
 * Build or update embedding cache for all nodes in the graph.
 * Only recomputes when contentHash changes.
 */
export async function buildEmbeddingCache(
  graph: ContextGraph,
  existingCache: EmbeddingCache | null,
  apiKey: string,
): Promise<EmbeddingCache> {
  const cache: EmbeddingCache = {
    entries: new Map(existingCache?.entries ?? []),
    model: EMBED_MODEL,
    dims: EMBED_DIMS,
  };

  // Find nodes needing (re)embedding
  const toEmbed: { fileId: string; identity: string }[] = [];

  for (const [id, node] of graph.nodes) {
    const existing = cache.entries.get(id);
    if (existing && existing.contentHash === node.contentHash) {
      continue; // still fresh
    }

    const identity = buildIdentity(node);
    toEmbed.push({ fileId: id, identity });

    // Pre-populate entry (embedding added after API call)
    cache.entries.set(id, {
      fileId: id,
      contentHash: node.contentHash,
      identity,
      embedding: [],
    });
  }

  // Remove stale entries
  for (const id of cache.entries.keys()) {
    if (!graph.nodes.has(id)) {
      cache.entries.delete(id);
    }
  }

  if (toEmbed.length === 0) {
    return cache;
  }

  // Batch embed
  const identities = toEmbed.map(e => e.identity);
  const embeddings = await embedTexts(identities, apiKey);

  for (let i = 0; i < toEmbed.length; i++) {
    const entry = cache.entries.get(toEmbed[i].fileId)!;
    entry.embedding = embeddings[i];
  }

  return cache;
}

// ── Resolve ──

/**
 * Resolve entry points using embedding similarity only.
 */
export async function resolveSemanticEntryPoints(
  query: string,
  cache: EmbeddingCache,
  apiKey: string,
  topK = 10,
  minScore = 0.15,
): Promise<EntryPoint[]> {
  const queryEmbedding = await embedSingle(query, apiKey);

  const results: EntryPoint[] = [];

  for (const [fileId, entry] of cache.entries) {
    if (!entry.embedding || entry.embedding.length === 0) continue;

    const sim = cosineSimilarity(queryEmbedding, entry.embedding);
    if (sim >= minScore) {
      results.push({
        fileId,
        confidence: sim,
        reason: 'Semantic match',
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, topK);
}

/**
 * Hybrid resolution: merge lexical + semantic scores.
 *
 * This is the main entry point. Drop-in replacement for resolveEntryPoints().
 */
export async function resolveHybridEntryPoints(
  query: string,
  graph: ContextGraph,
  cache: EmbeddingCache,
  apiKey: string,
  options: {
    topK?: number;
    semanticWeight?: number;
    minScore?: number;
  } = {},
): Promise<HybridEntryPoint[]> {
  const {
    topK = 15,
    semanticWeight = SEMANTIC_WEIGHT,
    minScore = 0.1,
  } = options;
  const lexicalWeight = 1 - semanticWeight;

  // Import lexical resolver (existing)
  // In production this would be a direct import
  const { resolveEntryPoints } = await import('./resolver.js');

  // Get lexical scores
  const lexicalResults = resolveEntryPoints(query, graph);
  const lexicalScores = new Map<string, number>();
  for (const ep of lexicalResults) {
    lexicalScores.set(ep.fileId, ep.confidence);
  }

  // Get semantic scores
  const queryEmbedding = await embedSingle(query, apiKey);
  const semanticScores = new Map<string, number>();
  for (const [fileId, entry] of cache.entries) {
    if (entry.embedding?.length > 0) {
      semanticScores.set(fileId, cosineSimilarity(queryEmbedding, entry.embedding));
    }
  }

  // Merge
  const allFileIds = new Set([...lexicalScores.keys(), ...semanticScores.keys()]);
  const results: HybridEntryPoint[] = [];

  for (const fileId of allFileIds) {
    const lex = lexicalScores.get(fileId) ?? 0;
    const sem = semanticScores.get(fileId) ?? 0;
    const combined = lex * lexicalWeight + sem * semanticWeight;

    if (combined < minScore) continue;

    // Determine reason
    let reason: EntryPoint['reason'];
    if (lex > 0 && sem > 0) reason = 'Direct mention'; // boosted by both
    else if (sem > 0) reason = 'Semantic match';        // the gap we're fixing
    else reason = 'Filename match';

    results.push({
      fileId,
      confidence: combined,
      reason,
      lexicalScore: lex,
      semanticScore: sem,
    });
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, topK);
}

// ── Serialization ──

export function serializeCache(cache: EmbeddingCache): string {
  const obj = {
    model: cache.model,
    dims: cache.dims,
    entries: Object.fromEntries(
      Array.from(cache.entries.entries()).map(([k, v]) => [k, v])
    ),
  };
  return JSON.stringify(obj);
}

export function deserializeCache(json: string): EmbeddingCache {
  const obj = JSON.parse(json);
  return {
    model: obj.model,
    dims: obj.dims,
    entries: new Map(Object.entries(obj.entries) as [string, EmbeddingEntry][]),
  };
}
