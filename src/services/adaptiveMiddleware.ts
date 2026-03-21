/**
 * Adaptive Retrieval Middleware — isolates the adaptive gap-detection and context-refinement
 * logic from the main pipeline orchestrator (pipelineChat.ts).
 *
 * Runs after the first buffered LLM call:
 *   1. Builds IndexedSource list from active channels.
 *   2. Runs gap detection via runAdaptiveRetrieval (hedging score → chunk replacement).
 *   3. Emits the adaptive_retrieval pipeline stage to the trace.
 *   4. If improved, formats the new knowledge block and rebuilds the system prompt + messages.
 *
 * Returns the improved state for the second LLM call, or null if no improvement was found.
 */

import type { ChannelConfig } from '../store/knowledgeBase';
import type { AdaptiveConfig, AdaptiveResult, AdaptiveCycle } from './adaptiveRetrieval';
import type { AdaptiveRetrievalData } from '../types/pipelineStageTypes';
import { runAdaptiveRetrieval, type IndexedSource } from './adaptiveRetrieval';
import { estimateTokens } from './treeIndexer';
import { useTraceStore } from '../store/traceStore';
import { assemblePipelineContext } from './contextAssembler';
import { buildKnowledgeFormatGuide } from './systemFrameBuilder';

export interface AdaptiveMiddlewareInput {
  /** The buffered first-pass LLM response to score for hedging. */
  bufferedResponse: string;
  /** Chunks from the initial smart retrieval pass. */
  retrievalChunks: import('./treeAwareRetriever').ChunkMetadata[];
  /** All enabled channels — used to build the indexed source list. */
  activeChannels: ChannelConfig[];
  /** Lookup for pre-built tree indexes (from treeIndexStore.getIndex). */
  treeGetIndex: (path: string) => import('./treeIndexer').TreeIndex | undefined;
  /** Original user message — used as the re-retrieval anchor query. */
  userMessage: string;
  /** Adaptive retrieval configuration. */
  adaptiveConfig: AdaptiveConfig;
  /** Current knowledge block (used to estimate token budget). */
  knowledgeBlock: string;
  /** Trace ID for emitting the pipeline stage event. */
  traceId: string;
  /** Abort signal passed down from the caller. */
  signal: AbortSignal;
  // ── System prompt rebuild context ──
  systemFrame: string;
  orientationBlock: string;
  channels: ChannelConfig[];
  frameworkBlock: string;
  lessonsBlock?: string;
  memoryBlock: string;
  providerType: string;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export interface AdaptiveMiddlewareResult {
  /** The rebuilt knowledge block with improved chunks. */
  improvedKnowledgeBlock: string;
  /** Rebuilt system prompt incorporating the improved knowledge block. */
  finalSystemPrompt: string;
  /** Rebuilt messages array for the second LLM call. */
  finalMsgs: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  /** Full adaptive retrieval result (cycles, scores, chunks). */
  adaptiveResult: AdaptiveResult;
  /** Stage data emitted to the trace. */
  stageData: AdaptiveRetrievalData;
  /** Wall-clock duration of the adaptive retrieval step. */
  durationMs: number;
  /** First (and typically only) refinement cycle. */
  lastCycle: AdaptiveCycle;
  /** Cost of the first buffered LLM call — caller records this. */
  bufferedInputTokens: number;
  /** Output token estimate of the buffered call. */
  bufferedOutputTokens: number;
}

/**
 * Run the adaptive retrieval middleware step.
 *
 * @param input - All inputs required for gap detection and context refinement.
 * @returns Improved prompt context for the second LLM call, or null if no improvement was found.
 */
export async function runAdaptiveMiddleware(
  input: AdaptiveMiddlewareInput,
): Promise<AdaptiveMiddlewareResult | null> {
  const {
    bufferedResponse, retrievalChunks, activeChannels, treeGetIndex,
    userMessage, adaptiveConfig, knowledgeBlock, traceId, signal,
    systemFrame, orientationBlock, channels, frameworkBlock,
    lessonsBlock, memoryBlock, providerType, history,
  } = input;

  // 1. Build IndexedSource list from active channels
  const adaptiveIndexedSources: IndexedSource[] = [];
  for (const ch of activeChannels) {
    if (ch.content) {
      const { indexMarkdown } = await import('./treeIndexer');
      const virtualPath = `content://${ch.sourceId}`;
      adaptiveIndexedSources.push({ treeIndex: indexMarkdown(virtualPath, ch.content), knowledgeType: ch.knowledgeType });
    } else if (ch.path) {
      const treeIndex = treeGetIndex(ch.path);
      if (treeIndex) adaptiveIndexedSources.push({ treeIndex, knowledgeType: ch.knowledgeType });
    }
  }

  // 2. Run adaptive retrieval (hedging detection + chunk replacement)
  const adaptiveStart = Date.now();
  const adaptiveResult = await runAdaptiveRetrieval(
    bufferedResponse,
    retrievalChunks,
    adaptiveIndexedSources,
    userMessage,
    adaptiveConfig,
    estimateTokens(knowledgeBlock),
    signal,
  );
  const durationMs = Date.now() - adaptiveStart;

  // 3. Emit adaptive_retrieval pipeline stage to trace
  const lastCycle = adaptiveResult.cycles[0];
  const stageData: AdaptiveRetrievalData = {
    enabled: true,
    hedgingScore: adaptiveResult.hedgingScore,
    threshold: adaptiveConfig.gapThreshold,
    cycleCount: adaptiveResult.cycles.length,
    droppedChunks: lastCycle?.droppedChunks ?? [],
    addedChunks: lastCycle?.addedChunks ?? [],
    avgRelevanceBefore: lastCycle?.avgRelevanceBefore ?? 0,
    avgRelevanceAfter: lastCycle?.avgRelevanceAfter ?? 0,
    tokenBudget: estimateTokens(knowledgeBlock),
    durationMs,
    aborted: adaptiveResult.aborted,
    abortReason: adaptiveResult.abortReason,
  };
  useTraceStore.getState().addEvent(traceId, {
    kind: 'pipeline_stage',
    durationMs,
    provenanceStages: [{
      stage: 'adaptive_retrieval',
      timestamp: Date.now(),
      durationMs,
      data: stageData,
    }],
  });

  // 4. Return null if no improvement — caller flushes buffered response to user
  if (!adaptiveResult.improved || !lastCycle || lastCycle.addedChunks.length === 0) {
    return null;
  }

  // 5. Build improved knowledge block from replacement chunks
  const improvedChunks = adaptiveResult.chunks;
  const formattedImproved = improvedChunks.map(chunk =>
    `<chunk source="${chunk.source}" section="${chunk.section}" type="${chunk.knowledgeType}" depth="${chunk.depth}" method="adaptive">\n${chunk.content}\n</chunk>`
  );
  const sourceAnnotations = improvedChunks
    .map(c => c.source)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
  const improvedKnowledgeBlock = `<knowledge sources="${sourceAnnotations}" method="adaptive-tree-aware" metadata="Adaptive retrieval: ${lastCycle.addedChunks.length} chunks replaced">\n${formattedImproved.join('\n\n')}\n</knowledge>`;

  // 6. Rebuild system prompt with improved knowledge block
  const finalSystemPrompt = assemblePipelineContext({
    frame: systemFrame,
    orientationBlock,
    hasRepos: channels.some(ch => ch.enabled && ch.repoMeta),
    knowledgeFormatGuide: buildKnowledgeFormatGuide(),
    frameworkBlock,
    lessonsBlock: lessonsBlock || undefined,
    memoryBlock,
    knowledgeBlock: improvedKnowledgeBlock,
    providerType,
  });
  const finalMsgs = [
    { role: 'system' as const, content: finalSystemPrompt },
    ...history.filter(m => m.content.trim() !== '').map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // 7. Dispatch AHA toast so the UI shows the refinement notification
  window.dispatchEvent(new CustomEvent('smart-retrieval-refined', {
    detail: {
      found: lastCycle.addedChunks.map(c => c.source).join(', '),
      replaced: lastCycle.droppedChunks.length.toString(),
      relevance: lastCycle.avgRelevanceAfter.toFixed(2),
    },
  }));

  return {
    improvedKnowledgeBlock,
    finalSystemPrompt,
    finalMsgs,
    adaptiveResult,
    stageData,
    durationMs,
    lastCycle,
    bufferedInputTokens: 0, // caller computes from its context size
    bufferedOutputTokens: estimateTokens(bufferedResponse),
  };
}
