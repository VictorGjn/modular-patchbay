/**
 * Context Graph — Type Definitions
 * 
 * Universal dependency graph for code, markdown, YAML, and JSON files.
 * Tracks cross-file relations for query-driven context assembly.
 */

import type { TreeIndex } from '../services/treeIndexer.js';

// ── File Languages ────────────────────────────────────────────────────────────

export type FileLanguage = 'typescript' | 'python' | 'markdown' | 'yaml' | 'json' | 'unknown';

// ── Symbol Definitions ────────────────────────────────────────────────────────

export type SymbolKind =
  // Code
  | 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum'
  // Markdown
  | 'heading' | 'anchor' | 'definition' | 'link_target' | 'tag'
  // YAML/JSON
  | 'key' | 'schema'
  // Generic
  | 'export';

export interface SymbolDef {
  name: string;
  kind: SymbolKind;
  signature?: string;
  lineStart: number;
  lineEnd: number;
  isExported: boolean;
  treeNodeId?: string;
  docstring?: string;
  tokens?: number;
}

// ── File Nodes ────────────────────────────────────────────────────────────────

export interface FileNode {
  id: string;
  path: string;
  language: FileLanguage;
  lastModified: number;
  contentHash: string;
  tokens: number;
  treeIndex?: TreeIndex;
  symbols: SymbolDef[];
}

// ── Relations ─────────────────────────────────────────────────────────────────

export type RelationKind =
  // Code
  | 'imports' | 'calls' | 'extends' | 'implements' | 'uses_type'
  | 'tested_by' | 'tests'
  // Markdown
  | 'links_to' | 'references' | 'continues' | 'supersedes'
  | 'depends_on' | 'defined_in'
  // Cross-type
  | 'documents' | 'configured_by' | 'related';

export interface Relation {
  id?: number;
  sourceFile: string;
  sourceSymbol?: string;
  targetFile: string;
  targetSymbol?: string;
  kind: RelationKind;
  weight: number;
  metadata?: Record<string, string>;
}

// ── Context Graph ─────────────────────────────────────────────────────────────

export interface ContextGraph {
  nodes: Map<string, FileNode>;
  relations: Relation[];
  outgoing: Map<string, Relation[]>;
  incoming: Map<string, Relation[]>;
  symbolIndex: Map<string, FileNode[]>;
  rootPath: string;
  lastFullScan: number;
  version: number;
}

// ── Traversal ─────────────────────────────────────────────────────────────────

export interface TraversalConfig {
  maxDepth: number;
  maxFiles: number;
  tokenBudget: number;
  minWeight: number;
  followImports: boolean;
  followCallers: boolean;
  followTests: boolean;
  followDocs: boolean;
  followLinks: boolean;
  followReferences: boolean;
}

export interface TraversalResult {
  files: TraversalFile[];
  totalTokens: number;
  graphStats: {
    nodesTraversed: number;
    edgesFollowed: number;
    nodesIncluded: number;
    nodesPruned: number;
  };
}

export interface TraversalFile {
  node: FileNode;
  relevance: number;
  distance: number;
  reason: string;
  includeSymbols?: string[];
}

// ── Entry Points ──────────────────────────────────────────────────────────────

export interface EntryPoint {
  fileId: string;
  symbolName?: string;
  confidence: number;
  reason: 'Direct mention' | 'Filename match' | 'Semantic match';
}

/**
 * Entry point with both lexical and semantic confidence scores.
 * Produced by embeddingResolver.resolveHybridEntryPoints().
 */
export interface HybridEntryPoint extends EntryPoint {
  lexicalScore: number;
  semanticScore: number;
}

/**
 * Serializable embedding cache for the graph.
 */
export interface EmbeddingCacheData {
  model: string;
  dims: number;
  entries: Record<string, {
    fileId: string;
    contentHash: string;
    identity: string;
    embedding: number[];
  }>;
}

// ── Budget Packing ────────────────────────────────────────────────────────────

export interface PackedContext {
  items: PackedItem[];
  totalTokens: number;
  budgetUtilization: number;
}

export interface PackedItem {
  file: FileNode;
  content: string;
  depth: number;
  tokens: number;
  relevance: number;
}

// ── Update Results ────────────────────────────────────────────────────────────

export interface UpdateResult {
  filesUpdated: number;
  relationsAdded: number;
  relationsRemoved: number;
  staleFilesTriggered: number;
  durationMs: number;
}

export interface ScanResult extends UpdateResult {
  totalFiles: number;
  totalSymbols: number;
  totalRelations: number;
}

// ── Task Presets ──────────────────────────────────────────────────────────────

export type TaskType = 'fix' | 'review' | 'explain' | 'build' | 'document' | 'research';

export const TRAVERSAL_PRESETS: Record<TaskType, Partial<TraversalConfig>> = {
  fix: {
    maxDepth: 3, maxFiles: 15,
    followImports: true, followCallers: false, followTests: true,
    followDocs: false, followLinks: false, followReferences: false,
    minWeight: 0.4,
  },
  review: {
    maxDepth: 2, maxFiles: 25,
    followImports: true, followCallers: true, followTests: true,
    followDocs: true, followLinks: true, followReferences: false,
    minWeight: 0.3,
  },
  explain: {
    maxDepth: 4, maxFiles: 20,
    followImports: true, followCallers: false, followTests: false,
    followDocs: true, followLinks: true, followReferences: true,
    minWeight: 0.3,
  },
  build: {
    maxDepth: 2, maxFiles: 15,
    followImports: true, followCallers: false, followTests: false,
    followDocs: true, followLinks: false, followReferences: false,
    minWeight: 0.5,
  },
  document: {
    maxDepth: 3, maxFiles: 20,
    followImports: true, followCallers: true, followTests: true,
    followDocs: true, followLinks: true, followReferences: true,
    minWeight: 0.3,
  },
  research: {
    maxDepth: 4, maxFiles: 30,
    followImports: false, followCallers: false, followTests: false,
    followDocs: true, followLinks: true, followReferences: true,
    minWeight: 0.2,
  },
};

/**
 * Auto-detect task type from query keywords.
 */
export function detectTaskType(query: string): TaskType {
  const q = query.toLowerCase();
  if (/fix|bug|error|crash|broken|issue/.test(q)) return 'fix';
  if (/\bresearch\b|find|look.*up|what.*about/.test(q)) return 'research';
  if (/\breview\b|pr\b|pull request|diff|changes/.test(q)) return 'review';
  if (/explain|how does|what is|understand|walk.*through/.test(q)) return 'explain';
  if (/add|build|create|implement|feature|new/.test(q)) return 'build';
  if (/document|readme|write.*doc|api.*doc/.test(q)) return 'document';
  return 'explain';
}
