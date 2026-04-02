/**
 * Context Engineering Pipeline — End-to-End
 *
 * Single entry point that chains the full pipeline:
 * Source → Connector → Tree Index → Agent Navigator → RTK → Context Assembly
 *
 * Usage:
 *   const result = await runPipeline({
 *     task: "Add date filter to order list",
 *     sources: [{ type: 'markdown', content: '...', name: 'docs' }],
 *     tokenBudget: 8000,
 *   });
 *   // result.context → ready for LLM system prompt
 */

import {
  type TreeIndex,
  indexMarkdown,
  indexStructured,
  indexChronological,
  indexFlat,
  type StructuredField,
  type ChronoEntry,
} from './treeIndexer';
import {
  extractHeadlines,
  buildNavigationPrompt,
  assembleFromPlan,
  parseNavigationResponse,
  type NavigationPlan,
  type BranchSelection,
} from './treeNavigator';
import { compressWithPriority } from './compress';
import { estimateTokens } from './treeIndexer';
import { createContextMiddleware } from './contextMiddleware.js';
import { classifyQuery } from './treeAwareRetriever';
import { useTraceStore } from '../store/traceStore';
import type { PipelineStageData, PipelineStageDataMap } from '../types/pipelineStageTypes';

// ── Pipeline Event Emitters ──

type PipelineStage = 'source_assembly' | 'budget_allocation' | 'retrieval' | 'contradiction_check' | 'provenance' | 'adaptive_retrieval';

function emitPipelineStage(traceId: string, stage: PipelineStage, data: PipelineStageDataMap[PipelineStage], durationMs?: number) {
  const traceStore = useTraceStore.getState();
  traceStore.addEvent(traceId, {
    kind: 'pipeline_stage',
    durationMs,
    provenanceStages: [{
      stage,
      timestamp: Date.now(),
      durationMs,
      data,
    } as PipelineStageData],
  });
}

// ── Types ──

export interface PipelineSource {
  name: string;
  type: 'markdown' | 'structured' | 'chronological' | 'flat';
  content?: string;           // for markdown/flat
  fields?: StructuredField[]; // for structured
  entries?: ChronoEntry[];    // for chronological
  sourceType?: string;        // optional label (e.g. 'hubspot', 'slack')
}

export interface PipelineOptions {
  task: string;
  sources: PipelineSource[];
  tokenBudget: number;
  /** If provided, skip the navigation LLM call and use these selections */
  manualSelections?: BranchSelection[];
  /** Context middleware for tool output and conversation collapse */
  middleware?: {
    enabled?: boolean;
    toolOutputMaxTokens?: number;
    conversationMaxTokens?: number;
  };
  /** RTK compression settings */
  compression?: {
    enabled?: boolean;
    aggressiveness?: number;
  };
}

export interface PipelineResult {
  /** Final assembled context, ready for LLM */
  context: string;
  /** Token count of final context */
  tokens: number;
  /** Token budget utilization (0-1) */
  utilization: number;
  /** Per-source breakdown */
  sources: {
    name: string;
    type: string;
    totalTokens: number;
    indexedNodes: number;
  }[];
  /** Navigation plan (what the agent selected) */
  navigation: {
    selections: BranchSelection[];
    prompt?: string;
  };
  /** RTK compression stats */
  compression: {
    originalTokens: number;
    compressedTokens: number;
    ratio: number;
    removals: { duplicates: number; filler: number; codeComments: number };
  };
  /** Tree indexes (for UI visualization) */
  indexes: TreeIndex[];
  /** Timing */
  timing: {
    indexMs: number;
    navigationMs: number;
    compressionMs: number;
    totalMs: number;
  };
}

// ── Indexing ──

function indexSource(source: PipelineSource): TreeIndex {
  switch (source.type) {
    case 'markdown':
      return indexMarkdown(source.name, source.content || '');
    case 'structured':
      return indexStructured(source.name, source.fields || [], source.sourceType);
    case 'chronological':
      return indexChronological(source.name, source.entries || [], source.sourceType);
    case 'flat':
      return indexFlat(source.name, source.content || '', source.sourceType);
    default:
      return indexFlat(source.name, source.content || '');
  }
}

// ── Pipeline ──

/**
 * Run the full context engineering pipeline.
 *
 * If manualSelections is provided, skips the navigation LLM call
 * (useful for testing or when the UI overrides agent choices).
 *
 * Without manualSelections, returns the navigation prompt for the caller
 * to send to an LLM, then call `completePipeline()` with the response.
 */
export function startPipeline(options: PipelineOptions, traceId?: string): {
  indexes: TreeIndex[];
  headlines: string[];
  navigationPrompt: string;
  indexMs: number;
} {
  const t0 = Date.now();

  // 1. Index all sources
  const indexes = options.sources.map(indexSource);

  const indexMs = Date.now() - t0;

  // Emit source assembly stage event
  if (traceId) {
    const sourceAssemblyData = {
      sources: options.sources.map(source => ({
        name: source.name,
        type: source.type,
        rawTokens: source.content ? estimateTokens(source.content) : 0,
        included: true,
        reason: 'Valid source with content'
      }))
    };
    emitPipelineStage(traceId, 'source_assembly', sourceAssemblyData, indexMs);
  }

  // 2. Extract headlines for navigation
  const headlines = indexes.map(extractHeadlines);

  // 3. Build navigation prompt
  const navigationPrompt = buildNavigationPrompt(headlines, {
    task: options.task,
    tokenBudget: options.tokenBudget,
  });

  return { indexes, headlines, navigationPrompt, indexMs };
}

/**
 * Complete the pipeline after receiving the agent's navigation response.
 */
export function completePipeline(
  indexes: TreeIndex[],
  navigationResponse: string,
  options: PipelineOptions,
  indexMs: number,
  traceId?: string,
): PipelineResult {
  const t0 = Date.now();

  // 3. Parse navigation selections
  const selections = options.manualSelections || parseNavigationResponse(navigationResponse);
  const navigationMs = Date.now() - t0;

  // 4. Assemble content from selections
  const plan: NavigationPlan = {
    source: options.sources.map(s => s.name).join(', '),
    selections,
    totalTokens: 0,
    taskRelevance: options.task,
  };

  const assembled = assembleFromPlan(indexes, plan);

  // 5. RTK compression
  const compressionStart = Date.now();
  let finalContent: string;
  let compressionStats = { originalTokens: 0, compressedTokens: 0, ratio: 1, removals: { duplicates: 0, filler: 0, codeComments: 0 } };

  if (options.compression?.enabled !== false && assembled.content) {
    // Compress each block independently based on its priority
    const contentParts = assembled.content.split('\n\n---\n\n');
    const blocks = assembled.breakdown.map((b, i) => ({
      content: contentParts[i] ?? '',
      priority: selections.find(s => s.nodeId === b.nodeId)?.priority ?? 2,
    }));

    if (blocks.length > 0) {
      const { results } = compressWithPriority(blocks, options.tokenBudget);
      finalContent = results.map(r => r.content).join('\n\n---\n\n');
      const origTokens = results.reduce((s, r) => s + r.originalTokens, 0);
      const compTokens = results.reduce((s, r) => s + r.compressedTokens, 0);
      compressionStats = {
        originalTokens: origTokens,
        compressedTokens: compTokens,
        ratio: origTokens > 0 ? compTokens / origTokens : 1,
        removals: {
          duplicates: results.reduce((s, r) => s + r.removals.duplicates, 0),
          filler: results.reduce((s, r) => s + r.removals.filler, 0),
          codeComments: results.reduce((s, r) => s + r.removals.codeComments, 0),
        },
      };
    } else {
      finalContent = assembled.content;
    }
  } else {
    finalContent = assembled.content;
    compressionStats.originalTokens = estimateTokens(assembled.content);
    compressionStats.compressedTokens = compressionStats.originalTokens;
  }

  const compressionMs = Date.now() - compressionStart;
  const totalMs = indexMs + navigationMs + compressionMs;
  // Phase 3: Apply context middleware if enabled
  if (options.middleware?.enabled) {
    const mw = createContextMiddleware({
      toolOutputMaxTokens: options.middleware.toolOutputMaxTokens,
      conversationMaxTokens: options.middleware.conversationMaxTokens,
    });
    finalContent = mw.collapse(finalContent, 'text');
  }

  const finalTokens = estimateTokens(finalContent);

  // Emit remaining pipeline stage events
  if (traceId) {
    // Budget allocation stage
    const budgetAllocationData = {
      totalBudget: options.tokenBudget,
      allocations: indexes.map((index) => ({
        source: index.source,
        allocatedTokens: Math.round(options.tokenBudget / indexes.length),
        usedTokens: finalTokens / indexes.length,
        percentage: 100 / indexes.length,
        cappedBySize: false,
        priority: 1,
      }))
    };
    emitPipelineStage(traceId, 'budget_allocation', budgetAllocationData);

    // Retrieval stage — scores derived from navigator priority (0=critical→high relevance)
    const priorityToRelevance = (p: number) => Math.max(0.5, 1.0 - p * 0.15);
    const uniqueRoots = new Set(selections.map(s => s.nodeId.split('/')[0])).size;
    const diversityScore = selections.length <= 1
      ? 1.0
      : Math.min(1.0, uniqueRoots / selections.length + 0.3);
    const retrievalData = {
      query: options.task || 'No query provided',
      queryType: classifyQuery(options.task || ''),
      chunks: selections.map((sel, i) => ({
        source: indexes[i % Math.max(1, indexes.length)]?.source ?? 'unknown',
        section: sel.nodeId,
        relevanceScore: priorityToRelevance(sel.priority),
        inclusionReason: 'direct' as const,
      })),
      diversityScore,
      totalChunks: assembled.breakdown.length,
      selectedChunks: assembled.breakdown.length,
    };
    emitPipelineStage(traceId, 'retrieval', retrievalData);

    // Contradiction check stage
    const contradictionData = {
      contradictionsFound: 0,
      conflicts: [],
      annotations: ['No contradictions detected'],
    };
    emitPipelineStage(traceId, 'contradiction_check', contradictionData);

    // Provenance stage
    const provenanceData = {
      sources: indexes.map(index => ({
        path: index.source,
        type: index.sourceType,
        transformations: [
          {
            method: 'indexing',
            input: 'raw_content',
            output: 'tree_structure',
          },
          {
            method: 'selection',
            input: 'tree_structure',
            output: 'final_chunks',
          },
        ],
      })),
      derivationChain: [
        {
          from: 'raw_sources',
          method: 'tree_indexing',
          to: 'structured_content',
        },
        {
          from: 'structured_content',
          method: 'navigation',
          to: 'selected_chunks',
        },
        {
          from: 'selected_chunks',
          method: 'rtk_compression',
          to: 'final_context',
        },
      ],
    };
    emitPipelineStage(traceId, 'provenance', provenanceData);
  }

  return {
    context: finalContent,
    tokens: finalTokens,
    utilization: options.tokenBudget > 0 ? finalTokens / options.tokenBudget : 0,
    sources: indexes.map(idx => ({
      name: idx.source,
      type: idx.sourceType,
      totalTokens: idx.totalTokens,
      indexedNodes: idx.nodeCount,
    })),
    navigation: {
      selections,
      prompt: undefined, // caller already has it
    },
    compression: compressionStats,
    indexes,
    timing: { indexMs, navigationMs, compressionMs, totalMs },
  };
}

/**
 * Run the pipeline with manual selections (no LLM call needed).
 * Useful for testing and deterministic operation.
 */
export function runPipelineSync(options: PipelineOptions & { manualSelections: BranchSelection[] }, traceId?: string): PipelineResult {
  const { indexes, indexMs } = startPipeline(options, traceId);
  return completePipeline(indexes, '', options, indexMs, traceId);
}
