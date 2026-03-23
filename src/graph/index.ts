/**
 * Context Graph — Public API
 *
 * Unified interface: scan → query → pack.
 */

export { GraphDB } from './db';
export { fullScan, updateFiles, buildFileNode, shouldIndex, fileId, hashContent } from './scanner';
export { resolveEntryPoints } from './resolver';
export { traverseGraph, traverseForTask } from './traverser';
export { packContext } from './packer';
export { extractCodeRelations } from './extractors/code';
export { extractMarkdownRelations, extractMarkdownSymbols, collectDefinedTerms } from './extractors/markdown';
export { detectTaskType, TRAVERSAL_PRESETS } from './types';
export type {
  FileNode, FileLanguage, SymbolDef, SymbolKind,
  Relation, RelationKind,
  ContextGraph,
  TraversalConfig, TraversalResult, TraversalFile,
  EntryPoint,
  PackedContext, PackedItem,
  UpdateResult, ScanResult,
  TaskType,
} from './types';

import { GraphDB } from './db';
import { fullScan, updateFiles } from './scanner';
import { resolveEntryPoints } from './resolver';
import { traverseForTask } from './traverser';
import { packContext } from './packer';
import type { PackedContext, ScanResult, UpdateResult, TaskType } from './types';

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
