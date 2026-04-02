/**
 * Context Graph — Public API
 *
 * Unified interface: scan → query → pack.
 */

export { GraphDB } from './db.js';
export { fullScan, updateFiles, buildFileNode, shouldIndex, fileId, hashContent } from './scanner.js';
export { resolveEntryPoints } from './resolver.js';
export {
  buildIdentity,
  buildEmbeddingCache,
  resolveSemanticEntryPoints,
  resolveHybridEntryPoints,
  serializeCache,
  deserializeCache,
  type EmbeddingCache,
  type HybridEntryPoint,
} from './embeddingResolver.js';
export { traverseGraph, traverseForTask } from './traverser.js';
export { packContext } from './packer.js';
export { extractCodeRelations } from './extractors/code.js';
export { extractMarkdownRelations, extractMarkdownSymbols, collectDefinedTerms } from './extractors/markdown.js';
export { extractYamlRelations } from './extractors/yaml.js';
export { extractCrossTypeRelations } from './extractors/cross-type.js';
export { detectTaskType, TRAVERSAL_PRESETS } from './types.js';
export type {
  FileNode, FileLanguage, SymbolDef, SymbolKind,
  Relation, RelationKind,
  ContextGraph,
  TraversalConfig, TraversalResult, TraversalFile,
  EntryPoint,
  PackedContext, PackedItem,
  UpdateResult, ScanResult,
  TaskType,
  HybridEntryPoint as HybridEntryPointType,
  EmbeddingCacheData,
} from './types.js';

import { GraphDB } from './db.js';
import { fullScan, updateFiles } from './scanner.js';
import { resolveEntryPoints } from './resolver.js';
import {
  buildEmbeddingCache,
  resolveHybridEntryPoints,
  serializeCache,
  deserializeCache,
  type EmbeddingCache,
} from './embeddingResolver.js';
import { traverseForTask } from './traverser.js';
import { packContext } from './packer.js';
import type { PackedContext, ScanResult, UpdateResult, TaskType } from './types.js';

/**
 * High-level: scan files → build graph → query → get packed context.
 */
export class ContextGraphEngine {
  private db = new GraphDB();
  private rootPath = '';
  private embeddingCache: EmbeddingCache | null = null;

  /**
   * Full scan from a list of files.
   */
  scan(
    rootPath: string,
    files: Array<{ path: string; content: string; mtime?: number }>,
  ): ScanResult {
    this.rootPath = rootPath;
    return fullScan(files, this.db);
  }

  /**
   * Incremental update for changed files.
   */
  update(
    changedFiles: Array<{ path: string; content: string; mtime?: number }>,
  ): UpdateResult {
    return updateFiles(changedFiles, this.db);
  }

  /**
   * Query: natural language → packed context.
   */
  query(
    query: string,
    tokenBudget: number = 100000,
    taskType?: TaskType,
  ): PackedContext {
    const graph = this.db.toContextGraph(this.rootPath);
    const entryPoints = resolveEntryPoints(query, graph);
    const traversal = traverseForTask(query, entryPoints, graph, taskType);
    return packContext(traversal, tokenBudget);
  }

  /**
   * Build or refresh embedding cache. Call after scan() or update().
   * Only re-embeds files whose content hash changed.
   */
  async buildEmbeddings(apiKey: string): Promise<void> {
    const graph = this.db.toContextGraph(this.rootPath);
    this.embeddingCache = await buildEmbeddingCache(graph, this.embeddingCache, apiKey);
  }

  /**
   * Load a previously saved embedding cache.
   */
  loadEmbeddingCache(json: string): void {
    this.embeddingCache = deserializeCache(json);
  }

  /**
   * Serialize embedding cache for persistence.
   */
  saveEmbeddingCache(): string | null {
    return this.embeddingCache ? serializeCache(this.embeddingCache) : null;
  }

  /**
   * Hybrid query: semantic + lexical entry points → graph traversal → packed context.
   * Falls back to lexical-only if no embedding cache available.
   */
  async queryHybrid(
    query: string,
    apiKey: string,
    tokenBudget: number = 100000,
    taskType?: TaskType,
  ): Promise<PackedContext> {
    const graph = this.db.toContextGraph(this.rootPath);

    let entryPoints;
    if (this.embeddingCache) {
      entryPoints = await resolveHybridEntryPoints(query, graph, this.embeddingCache, apiKey);
    } else {
      entryPoints = resolveEntryPoints(query, graph);
    }

    const traversal = traverseForTask(query, entryPoints, graph, taskType);
    return packContext(traversal, tokenBudget);
  }

  /**
   * Get graph stats.
   */
  getStats() {
    return this.db.getStats();
  }

  /**
   * Get the full graph for visualization.
   */
  getGraph() {
    return this.db.toContextGraph(this.rootPath);
  }

  /**
   * Get DB instance for direct access.
   */
  getDB() {
    return this.db;
  }
}
