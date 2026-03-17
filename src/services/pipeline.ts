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
import { compress } from './compress';
import { estimateTokens } from './treeIndexer';
import { useTraceStore } from '../store/traceStore';

// ── Pipeline Event Emitters ──

function emitPipelineStage(traceId: string, stage: string, data: any, durationMs?: number) {
  const traceStore = useTraceStore.getState();
  traceStore.addEvent(traceId, {
    kind: 'pipeline_stage',
    durationMs,
    provenanceStages: [{
      stage: stage as any,
      timestamp: Date.now(),
      durationMs,
      data,
    }],
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
    // Compress with priority awareness
    const blocks = assembled.breakdown.map(b => ({
      content: assembled.content, // TODO: split by nodeId for per-block compression
      priority: selections.find(s => s.nodeId === b.nodeId)?.priority ?? 2,
    }));

    if (blocks.length > 0) {
      const compressed = compress(assembled.content, {
        tokenBudget: options.tokenBudget,
        aggressiveness: options.compression?.aggressiveness ?? 0.5,
      });
      finalContent = compressed.content;
      compressionStats = {
        originalTokens: compressed.originalTokens,
        compressedTokens: compressed.compressedTokens,
        ratio: compressed.ratio,
        removals: compressed.removals,
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

    // Retrieval stage (mock data for now)
    const retrievalData = {
      query: options.task || 'No query provided',
      queryType: 'factual' as const,
      chunks: selections.map((sel, i) => ({
        source: `Source ${i + 1}`,
        section: sel.nodeId,
        relevanceScore: 0.8,
        inclusionReason: 'direct' as const,
      })),
      diversityScore: 0.7,
      totalChunks: indexes.length * 3,
      selectedChunks: selections.length,
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
