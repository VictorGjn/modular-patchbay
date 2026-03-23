/**
 * Context Graph — Public API
 *
 * Unified interface: scan → query → pack.
 */

export { GraphDB } from './db.js';
export { fullScan, updateFiles, buildFileNode, shouldIndex, fileId, hashContent } from './scanner.js';
export { resolveEntryPoints } from './resolver.js';
export { traverseGraph, traverseForTask } from './traverser.js';
export { packContext } from './packer.js';
export { extractCodeRelations } from './extractors/code.js';
export { extractMarkdownRelations, extractMarkdownSymbols, collectDefinedTerms } from './extractors/markdown.js';
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
} from './types.js';

import { GraphDB } from './db.js';
import { fullScan, updateFiles } from './scanner.js';
import { resolveEntryPoints } from './resolver.js';
import { traverseForTask } from './traverser.js';
import { packContext } from './packer.js';
import type { PackedContext, ScanResult, UpdateResult, TaskType } from './types.js';

/**
 * High-level: scan files → build graph → query → get packed context.
 */
export class ContextGraphEngine {
  private db = new GraphDB();
  private rootPath = '';

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
