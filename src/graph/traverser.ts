/**
 * Graph Traverser — BFS with priority queue
 *
 * From entry points, walk the graph collecting files with decaying relevance.
 * Respects token budget and traversal config (follow imports, callers, etc.)
 */

import type {
  ContextGraph, EntryPoint, TraversalConfig, TraversalResult,
  TraversalFile, Relation, RelationKind,
} from './types.js';
import { TRAVERSAL_PRESETS, detectTaskType, type TaskType } from './types.js';

const DECAY_FACTOR = 0.7;

const DEFAULT_CONFIG: TraversalConfig = {
  maxDepth: 3,
  maxFiles: 20,
  tokenBudget: 100000,
  minWeight: 0.3,
  followImports: true,
  followCallers: false,
  followTests: false,
  followDocs: true,
  followLinks: true,
  followReferences: true,
};

/**
 * Check if a relation kind should be followed based on config.
 */
function shouldFollowRelation(kind: RelationKind, config: TraversalConfig): boolean {
  switch (kind) {
    case 'imports':
    case 'extends':
    case 'implements':
    case 'uses_type':
      return config.followImports;
    case 'calls':
      return config.followImports; // calls follow same setting as imports
    case 'tested_by':
    case 'tests':
      return config.followTests;
    case 'documents':
      return config.followDocs;
    case 'links_to':
    case 'continues':
    case 'supersedes':
    case 'depends_on':
    case 'defined_in':
      return config.followLinks;
    case 'references':
      return config.followReferences;
    case 'configured_by':
      return config.followImports;
    case 'related':
      return config.followReferences;
    default:
      return false;
  }
}

interface QueueItem {
  fileId: string;
  relevance: number;
  distance: number;
  reason: string;
}

/**
 * Traverse the graph from entry points.
 */
export function traverseGraph(
  entryPoints: EntryPoint[],
  graph: ContextGraph,
  config: Partial<TraversalConfig> = {},
): TraversalResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const visited = new Map<string, QueueItem>(); // fileId → best item
  const queue: QueueItem[] = [];

  let nodesTraversed = 0;
  let edgesFollowed = 0;
  let nodesPruned = 0;

  // Seed with entry points
  for (const ep of entryPoints) {
    const item: QueueItem = {
      fileId: ep.fileId,
      relevance: ep.confidence,
      distance: 0,
      reason: `Entry point: ${ep.reason}${ep.symbolName ? ` (${ep.symbolName})` : ''}`,
    };
    queue.push(item);
    visited.set(ep.fileId, item);
  }

  // BFS with priority (process highest relevance first)
  while (queue.length > 0) {
    // Sort by relevance descending (priority queue)
    queue.sort((a, b) => b.relevance - a.relevance);
    const current = queue.shift()!;

    if (current.distance >= cfg.maxDepth) continue;
    nodesTraversed++;

    // Get outgoing relations
    const outgoing = graph.outgoing.get(current.fileId) ?? [];
    // Also check incoming for reverse traversal (callers)
    const incoming = cfg.followCallers
      ? (graph.incoming.get(current.fileId) ?? [])
      : [];

    const allEdges: Array<{ rel: Relation; targetId: string; reason: string }> = [];

    for (const rel of outgoing) {
      if (shouldFollowRelation(rel.kind, cfg) && rel.weight >= cfg.minWeight) {
        allEdges.push({
          rel,
          targetId: rel.targetFile,
          reason: `${rel.kind} from ${graph.nodes.get(current.fileId)?.path ?? current.fileId}`,
        });
      }
    }

    for (const rel of incoming) {
      // Reverse: incoming relation means this file is TARGET, we follow to SOURCE
      const reverseKinds: RelationKind[] = ['calls', 'imports', 'extends', 'implements'];
      if (reverseKinds.includes(rel.kind) && rel.weight >= cfg.minWeight) {
        allEdges.push({
          rel,
          targetId: rel.sourceFile,
          reason: `called/imported by ${graph.nodes.get(rel.sourceFile)?.path ?? rel.sourceFile}`,
        });
      }
    }

    for (const { rel, targetId, reason } of allEdges) {
      edgesFollowed++;

      const newRelevance = current.relevance * rel.weight * DECAY_FACTOR;
      if (newRelevance < cfg.minWeight) {
        nodesPruned++;
        continue;
      }

      const existing = visited.get(targetId);
      if (existing && existing.relevance >= newRelevance) continue;

      const item: QueueItem = {
        fileId: targetId,
        relevance: newRelevance,
        distance: current.distance + 1,
        reason,
      };

      visited.set(targetId, item);
      queue.push(item);
    }
  }

  // Build result: sort by relevance, cap at maxFiles, respect token budget
  const allFiles: TraversalFile[] = [];
  let totalTokens = 0;

  const sorted = Array.from(visited.values())
    .sort((a, b) => b.relevance - a.relevance);

  for (const item of sorted) {
    if (allFiles.length >= cfg.maxFiles) {
      nodesPruned++;
      continue;
    }

    const node = graph.nodes.get(item.fileId);
    if (!node) continue;

    if (totalTokens + node.tokens > cfg.tokenBudget) {
      // Still include at reduced depth if possible
      if (totalTokens + 100 <= cfg.tokenBudget) {
        allFiles.push({
          node,
          relevance: item.relevance,
          distance: item.distance,
          reason: item.reason,
        });
        totalTokens += 100; // Approximate headline-only cost
      } else {
        nodesPruned++;
      }
      continue;
    }

    allFiles.push({
      node,
      relevance: item.relevance,
      distance: item.distance,
      reason: item.reason,
    });
    totalTokens += node.tokens;
  }

  return {
    files: allFiles,
    totalTokens,
    graphStats: {
      nodesTraversed,
      edgesFollowed,
      nodesIncluded: allFiles.length,
      nodesPruned,
    },
  };
}

/**
 * Convenience: auto-detect task type and traverse with preset.
 */
export function traverseForTask(
  query: string,
  entryPoints: EntryPoint[],
  graph: ContextGraph,
  taskType?: TaskType,
): TraversalResult {
  const task = taskType ?? detectTaskType(query);
  const preset = TRAVERSAL_PRESETS[task];
  return traverseGraph(entryPoints, graph, preset);
}
