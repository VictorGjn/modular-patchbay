/**
 * Pipeline Chat — thin orchestrator that wires the context engineering pipeline into the chat flow.
 *
 * Replaces the old direct assembleContext() → LLM path with:
 *   ChannelConfig[] → PipelineSource[] → Tree Index → Agent Navigator → Compress → Assembly → LLM
 *
 * Each pipeline stage lives in its own module:
 *   systemFrameBuilder  — identity / instructions / constraints / workflow / tool guide
 *   sourceRouter        — file indexing, framework extraction
 *   knowledgePipeline   — content compression, agent navigation, knowledge block
 *   contextAssembler    — orientation block, system prompt assembly
 *   executionRouter     — tool loop / streaming / agent SDK dispatch
 *   postProcessor       — memory post-write, trace end, heatmap + stats
 */

import type { ChannelConfig, Connector } from '../store/knowledgeBase';
import { useConsoleStore } from '../store/consoleStore';
import { useProviderStore } from '../store/providerStore';
import { useTraceStore } from '../store/traceStore';
import { useVersionStore } from '../store/versionStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { useMemoryStore } from '../store/memoryStore';
import { estimateTokens } from './treeIndexer';
import { preRecall, clearScratchpad } from './memoryPipeline';
import { buildSystemFrame, buildKnowledgeFormatGuide } from './systemFrameBuilder';
import { routeSources } from './sourceRouter';
import { compressKnowledge } from './knowledgePipeline';
import { buildOrientationBlock, assemblePipelineContext } from './contextAssembler';
import { detectCacheStrategy, computeCacheMetrics } from './cacheAwareAssembler';
import { executeChat } from './executionRouter';
import { postProcess } from './postProcessor';
import type { PipelineResult } from './pipeline';
import type { ToolCallResult } from './toolRunner';
import { useLessonStore } from '../store/lessonStore';
import type { Lesson } from '../store/lessonStore';
import { computeActualCost } from './costEstimator';
import { runAdaptiveMiddleware } from './adaptiveMiddleware';
import { createContextMiddleware } from './contextMiddleware.js';

// Phase 3: Context middleware for tool output and conversation collapse
const contextMiddleware = createContextMiddleware();
export { contextMiddleware };

/**
 * Fire-and-forget cost record with one retry on failure.
 * Uses console.warn so failures are filterable in the console.
 */
function recordCost(agentId: string, body: object): void {
  const url = `/api/cost/${encodeURIComponent(agentId)}/record`;
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  fetch(url, init).catch((err) => {
    console.warn('[pipelineChat] Cost record failed, retrying:', err);
    setTimeout(() => fetch(url, init).catch((e) => console.warn('[pipelineChat] Cost record retry failed:', e)), 1000);
  });
}

/** FNV-1a 32-bit hash — fast, deterministic, no async needed */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

async function checkResponseCache(
  query: string, agentId: string, model: string, systemPromptHash: string, ttl: number,
): Promise<{ response: string; hitCount: number } | null> {
  try {
    const res = await fetch('/api/cache/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, agentId, model, systemPromptHash, ttl }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { hit: boolean; cached?: { response: string; hitCount: number } };
    return data.hit && data.cached ? data.cached : null;
  } catch { return null; }
}

async function storeResponseCache(
  query: string, response: string, agentId: string, model: string,
  systemPromptHash: string, ttl: number,
): Promise<void> {
  try {
    await fetch('/api/cache/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, response, agentId, model, systemPromptHash, ttl }),
    });
  } catch { /* fire-and-forget */ }
}

// ── Re-export types from sub-modules so external consumers keep working ──
export type { FrameworkSummary } from './sourceRouter';
export type { SourceHeatmapEntry, MemoryStats } from './postProcessor';

// ── Types ──

export interface PipelineChatOptions {
  userMessage: string;
  channels: ChannelConfig[];
  connectors?: Connector[];
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  agentMeta: { name: string; description: string; avatar?: string; tags?: string[] };
  providerId: string;
  model: string;
  navigationMode?: 'manual' | 'agent-driven' | 'tree-aware';
  /** Max tokens for knowledge context. Caps the retrieval budget. */
  tokenBudget?: number;
  agentId?: string;
  sandboxRunId?: string;
  onChunk: (chunk: string) => void;
  onDone: (stats: PipelineChatStats) => void;
  onError: (err: Error) => void;
}

export interface PipelineChatStats {
  traceId?: string;
  pipeline: PipelineResult | null;
  systemTokens: number;
  totalContextTokens: number;
  heatmap: import('./postProcessor').SourceHeatmapEntry[];
  frameworkSummary?: import('./sourceRouter').FrameworkSummary;
  toolCalls?: ToolCallResult[];
  toolTurns?: number;
  memory?: import('./postProcessor').MemoryStats;
  costUsd?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  retrieval?: {
    queryType: string;
    diversityScore: number;
    collapseWarning: boolean;
    totalChunks: number;
    selectedChunks: number;
    budgetUsed: number;
    budgetTotal: number;
    retrievalMs: number;
    embeddingMs: number;
    originalTokens?: number;
    chunks: Array<{
      section: string;
      source: string;
      relevanceScore: number;
      inclusionReason: string;
      knowledgeType: string;
      tokens: number;
    }>;
  };
  contextBlocks?: Array<{
    id: string;
    label: string;
    category: 'system' | 'knowledge' | 'memory' | 'lessons' | 'history' | 'tools';
    tokens: number;
    cached: boolean;
    depth?: number;
    compression?: number;
    preview?: string;
  }>;
  contextBudget?: number;
  cacheBoundaryTokens?: number;
}

// ── Provider/model resolution (shared by all tester surfaces) ──

export interface ResolvedProvider {
  providerId: string;
  model: string;
  error?: string;
}

/**
 * Resolve which provider and model to use for a test run.
 * Centralises the logic so ConversationTester and TestPanel behave identically.
 */
export function resolveProviderAndModel(): ResolvedProvider {
  const { selectedModel, agentConfig } = useConsoleStore.getState();
  const { providers } = useProviderStore.getState();

  // selectedModel may be "providerId::modelId" format from the dynamic selector
  const colonIdx = selectedModel.indexOf('::');
  const hasPrefix = colonIdx > 0;
  const targetProviderId = hasPrefix ? selectedModel.slice(0, colonIdx) : '';
  const targetModelId = hasPrefix ? selectedModel.slice(colonIdx + 2) : (selectedModel || agentConfig.model);

  // Find the provider — prefer the one from selectedModel prefix, fallback to selectedProviderId
  const { selectedProviderId } = useProviderStore.getState();
  const providerIdToUse = targetProviderId || selectedProviderId;
  const selected = providers.find((p) => p.id === providerIdToUse);
  const models = Array.isArray(selected?.models) ? selected.models : [];

  if (!selected || (selected.status !== 'connected' && selected.status !== 'configured') || models.length === 0) {
    return {
      providerId: '',
      model: '',
      error: 'No provider/model configured. Open Settings → Providers, connect one provider, refresh models, then retry.',
    };
  }

  // Check if target model exists in this provider's models
  const hasTarget = models.some((m) => m.id === targetModelId);
  return {
    providerId: selected.id,
    model: hasTarget ? targetModelId : models[0].id,
  };
}

// ── Main pipeline chat orchestrator ──

export async function runPipelineChat(options: PipelineChatOptions): Promise<void> {
  const {
    userMessage, channels, history, providerId, model,
    onChunk, onDone, onError,
  } = options;

  const traceStore = useTraceStore.getState();
  const versionStore = useVersionStore.getState();
  const agentVersion = versionStore.currentVersion || '0.0.0';
  const traceId = traceStore.startTrace(`chat-${Date.now()}`, agentVersion);

  try {
    // 1. Build the non-knowledge system frame (identity, instructions, constraints, workflow, tools)
    // Note: buildSystemFrame will be called again after provenance is available
    let systemFrame = buildSystemFrame();

    // 2. Route sources: index files + extract framework rules
    const activeChannels = channels.filter(ch => ch.enabled);
    const { frameworkBlock, frameworkSummary, regularChannels, residualKnowledgeBlock } =
      activeChannels.length > 0
        ? await routeSources(activeChannels, traceId)
        : { frameworkBlock: '', frameworkSummary: undefined, regularChannels: [], residualKnowledgeBlock: '' };

    // 3. Compress knowledge: pipeline + optional agent navigation
    let { knowledgeBlock, pipelineResult, provenance, retrievalResult } =
      activeChannels.length > 0
        ? await compressKnowledge(channels, regularChannels, residualKnowledgeBlock, { userMessage, navigationMode: options.navigationMode, providerId, model, tokenBudget: options.tokenBudget ?? undefined }, traceId)
        : { knowledgeBlock: '', pipelineResult: null, provenance: null, retrievalResult: undefined };

    // 3a. Append connector references (services like Notion, Slack, HubSpot)
    const activeConnectors = (options.connectors || []).filter(c => c.enabled && c.direction !== 'write');
    if (activeConnectors.length > 0) {
      const connectorLines = activeConnectors.map(c => {
        const scope = c.hint ? ` (scope: ${c.hint})` : '';
        return `- ${c.name} [${c.service}] — ${c.direction}${scope}`;
      });
      const connectorBlock = `<connectors>\nAvailable data connectors (use via MCP tools):\n${connectorLines.join('\n')}\n</connectors>`;
      knowledgeBlock = knowledgeBlock ? `${knowledgeBlock}\n\n${connectorBlock}` : connectorBlock;
    }

    // 3b. Inject active instincts into context (confidence >= 0.5, from server)
    let agentLessons: Lesson[] = [];
    let lessonsBlock = '';
    if (options.agentId) {
      try {
        const resp = await fetch(`/api/lessons/${encodeURIComponent(options.agentId)}/active`);
        if (resp.ok) {
          const data = await resp.json() as { instincts: Array<{ id: string; action: string; domain: string; confidence: number }> };
          if (data.instincts.length > 0) {
            // Group by domain and format with confidence levels
            const byDomain = new Map<string, typeof data.instincts>();
            for (const inst of data.instincts) {
              const list = byDomain.get(inst.domain) ?? [];
              list.push(inst);
              byDomain.set(inst.domain, list);
            }
            const lines: string[] = [];
            for (const [dom, items] of byDomain) {
              lines.push(`[${dom}]`);
              for (const inst of items) {
                const prefix = inst.confidence >= 0.7 ? 'ALWAYS' : 'Consider';
                lines.push(`  ${prefix}: ${inst.action}`);
              }
            }
            // Cap at ~500 tokens (≈2000 chars)
            const raw = lines.join('\n');
            const capped = raw.length > 2000 ? raw.slice(0, 2000) + '\n  ...' : raw;
            lessonsBlock = `<instincts>\n${capped}\n</instincts>`;
          }
        }
      } catch {
        // Fall back to local store on network error
        agentLessons = useLessonStore.getState().getActiveInstincts(options.agentId);
      }
    }
    // Fallback: use local store if server returned empty
    if (!lessonsBlock && options.agentId) {
      agentLessons = useLessonStore.getState().getActiveInstincts(options.agentId);
      if (agentLessons.length > 0) {
        const lines = agentLessons.map((l) => {
          const prefix = l.confidence >= 0.7 ? 'ALWAYS' : 'Consider';
          return `- [${l.domain}] ${prefix}: ${l.rule}`;
        });
        lessonsBlock = `<instincts>\n${lines.join('\n')}\n</instincts>`;
      }
    }

    // 3c. Pre-recall: inject relevant memory facts into context
    const memoryConfig = useMemoryStore.getState();
    let memoryBlock = '';
    let memoryStats: import('./postProcessor').MemoryStats | undefined;

    if (memoryConfig.longTerm.enabled) {
      if (memoryConfig.sandbox.isolation === 'reset_each_run') {
        clearScratchpad();
      }

      const recallResult = await preRecall({
        userMessage,
        agentId: options.agentId,
        traceId,
        sandboxRunId: options.sandboxRunId,
      });

      if (recallResult.contextBlock) {
        memoryBlock = recallResult.contextBlock;
      }

      memoryStats = {
        recalledFacts: recallResult.facts.length,
        writtenFacts: 0,
        recallMs: recallResult.durationMs,
        writeMs: 0,
        recallTokens: recallResult.tokenEstimate,
        domains: [...new Set(recallResult.facts.map(f => f.domain))],
      };
    }

    // 3d. Rebuild system frame with provenance data
    if (provenance) {
      systemFrame = buildSystemFrame(provenance);
    }

    // 4. Assemble final system prompt with cache-aware block ordering
    const orientationBlock = buildOrientationBlock(channels, useTreeIndexStore.getState().getIndex);
    const hasRepos = channels.some(ch => ch.enabled && ch.repoMeta);
    const currentProvider = useProviderStore.getState().providers.find(p => p.id === providerId);
    const providerType = currentProvider?.type ?? 'openai';
    const appliedInstinctCount = agentLessons.length + (lessonsBlock ? 1 : 0);
    if (lessonsBlock) {
      traceStore.addEvent(traceId, { kind: 'lesson_applied', memoryFactCount: appliedInstinctCount });
    }
    const systemPrompt = assemblePipelineContext({
      frame: systemFrame,
      orientationBlock,
      hasRepos,
      knowledgeFormatGuide: buildKnowledgeFormatGuide(),
      frameworkBlock,
      lessonsBlock: lessonsBlock || undefined,
      memoryBlock,
      knowledgeBlock,
      providerType,
    });
    const systemTokens = estimateTokens(systemPrompt);

    // Log cache metrics to trace
    const cacheStrategy = detectCacheStrategy(providerType);
    const cacheMetrics = computeCacheMetrics(systemPrompt, cacheStrategy);
    traceStore.addEvent(traceId, {
      kind: 'cache',
      cacheMetrics,
    });

    // 5. Build messages array
    const msgs = [
      { role: 'system' as const, content: systemPrompt },
      ...history.filter(m => m.content.trim() !== '').map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // 5a. Check response cache before LLM call
    const { responseCache } = useMemoryStore.getState();
    const systemPromptHash = fnv1a(systemPrompt);
    const effectiveAgentId = options.agentId ?? 'default';
    if (responseCache.enabled) {
      const cached = await checkResponseCache(userMessage, effectiveAgentId, model, systemPromptHash, responseCache.ttlSeconds);
      if (cached) {
        const savingsUsd = (cached.response.length / 4) * 0.000015;
        traceStore.addEvent(traceId, {
          kind: 'response_cache_hit',
          responseCacheHit: true,
          responseCacheSavingsUsd: savingsUsd,
          responseCacheAgentId: effectiveAgentId,
          responseCacheModel: model,
        });
        onChunk(cached.response);
        const { heatmap, memoryStats: updatedMemoryStats } = await postProcess({
          fullResponse: cached.response, userMessage, agentId: options.agentId,
          sandboxRunId: options.sandboxRunId, traceId, activeChannels, memoryStats,
        });
        onDone({ traceId, pipeline: pipelineResult, systemTokens, totalContextTokens: systemTokens, heatmap, frameworkSummary, memory: updatedMemoryStats });
        return;
      }
      traceStore.addEvent(traceId, {
        kind: 'response_cache_miss',
        responseCacheHit: false,
        responseCacheAgentId: effectiveAgentId,
        responseCacheModel: model,
      });
    }

    // 5b. F8: Check budget BEFORE running LLM — block if over limit
    try {
      const budgetAbort = new AbortController();
      const budgetTimeout = setTimeout(() => budgetAbort.abort(), 3000);
      const budgetRes = await fetch(`/api/cost/${encodeURIComponent(effectiveAgentId)}/budget`, { signal: budgetAbort.signal })
        .finally(() => clearTimeout(budgetTimeout));
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json() as { data?: { budgetLimit: number; totalSpent: number } };
        const bd = budgetData.data;
        if (bd && bd.budgetLimit > 0 && bd.totalSpent >= bd.budgetLimit) {
          onError(new Error('Budget exceeded. Increase your budget in the Review tab.'));
          traceStore.endTrace(traceId);
          return;
        }
      }
    } catch {
      // Budget check is best-effort — proceed if endpoint unavailable or timed out (3s)
      console.warn('[pipelineChat] Budget check timed out or failed — proceeding with run');
    }

    // 6. Execute: tool loop / text streaming / agent SDK
    // Smart Retrieval: if adaptive is enabled and agent has 5+ enabled channels, buffer first response
    const { adaptiveConfig } = useConsoleStore.getState();
    const enabledChannelCount = channels.filter(ch => ch.enabled).length;
    const useAdaptive = adaptiveConfig.enabled && enabledChannelCount >= 5 && retrievalResult && retrievalResult.chunks.length > 0;

    let finalSystemPrompt = systemPrompt;
    let finalMsgs = msgs;

    if (useAdaptive) {
      // Buffer first LLM call — don't stream to UI yet
      // F6: wrap in try/catch; fall through to normal streaming on failure
      let buffered = '';
      try {
        const { fullResponse: bufferedResponse } = await executeChat({
          providerId,
          model,
          messages: msgs,
          userMessage,
          systemPrompt,
          traceId,
          onChunk: (chunk) => { buffered += chunk; },
        });
        buffered = bufferedResponse || buffered;
      } catch (bufErr) {
        traceStore.addEvent(traceId, {
          kind: 'error',
          errorMessage: `Adaptive buffer failed, falling back to streaming: ${bufErr instanceof Error ? bufErr.message : String(bufErr)}`,
        });
        // Fall back to normal streaming — skip adaptive refinement
        const { fullResponse: fbResponse, toolCallResults: fbToolCalls, toolTurns: fbTurns } = await executeChat({
          providerId, model, messages: finalMsgs, userMessage, systemPrompt: finalSystemPrompt, traceId, onChunk,
        });
        if (responseCache.enabled && fbResponse) {
          void storeResponseCache(userMessage, fbResponse, effectiveAgentId, model, systemPromptHash, responseCache.ttlSeconds);
        }
        const { heatmap: fbHeatmap, memoryStats: fbMemStats } = await postProcess({
          fullResponse: fbResponse, userMessage, agentId: options.agentId, sandboxRunId: options.sandboxRunId, traceId, activeChannels, memoryStats,
        });
        void detectAndAddLesson(userMessage, history.filter(m => m.role === 'assistant').at(-1)?.content ?? '', providerId, model, options.agentId, traceId, lessonsBlock, agentLessons);
        const fbCtx = systemTokens + history.reduce((s, m) => s + estimateTokens(m.content), 0) + estimateTokens(userMessage);
        const fbOut = estimateTokens(fbResponse);
        const fbCost = computeActualCost(model, fbCtx, fbOut);
        recordCost(effectiveAgentId, { model, inputTokens: fbCtx, outputTokens: fbOut, costUsd: fbCost, cachedTokens: 0 });
        onDone({ traceId, pipeline: pipelineResult, systemTokens, totalContextTokens: fbCtx, heatmap: fbHeatmap, frameworkSummary,
          toolCalls: fbToolCalls.length > 0 ? fbToolCalls : undefined,
          toolTurns: fbTurns > 0 ? fbTurns : undefined, memory: fbMemStats, costUsd: fbCost, model, inputTokens: fbCtx, outputTokens: fbOut, cachedTokens: 0 });
        return;
      }

      // Delegate gap detection, chunk replacement, improved knowledge block, and system prompt
      // rebuild to the adaptive middleware. Returns null if no improvement was found.
      const adaptiveAbort = new AbortController();
      const middlewareResult = await runAdaptiveMiddleware({
        bufferedResponse: buffered,
        retrievalChunks: retrievalResult!.chunks,
        activeChannels,
        treeGetIndex: useTreeIndexStore.getState().getIndex,
        userMessage,
        adaptiveConfig,
        knowledgeBlock,
        traceId,
        signal: adaptiveAbort.signal,
        systemFrame,
        orientationBlock,
        channels,
        frameworkBlock,
        lessonsBlock: lessonsBlock || undefined,
        memoryBlock,
        providerType,
        history,
      });

      if (middlewareResult) {
        finalSystemPrompt = middlewareResult.finalSystemPrompt;
        finalMsgs = middlewareResult.finalMsgs;

        // Record first buffered call cost
        const bufferedOutputTokens = estimateTokens(buffered);
        const bufferedInputTokens = systemTokens + history.reduce((s, m) => s + estimateTokens(m.content), 0) + estimateTokens(userMessage);
        const bufferedCost = computeActualCost(model, bufferedInputTokens, bufferedOutputTokens);
        recordCost(effectiveAgentId, { model, inputTokens: bufferedInputTokens, outputTokens: bufferedOutputTokens, costUsd: bufferedCost, cachedTokens: 0 });

        // Second LLM call — stream to user with improved context
        const { fullResponse, toolCallResults, toolTurns } = await executeChat({
          providerId,
          model,
          messages: finalMsgs,
          userMessage,
          systemPrompt: finalSystemPrompt,
          traceId,
          onChunk,
        });

        // Continue to post-processing with second call's response
        if (responseCache.enabled && fullResponse) {
          void storeResponseCache(userMessage, fullResponse, effectiveAgentId, model, fnv1a(finalSystemPrompt), responseCache.ttlSeconds);
        }

        const { heatmap: heatmap2, memoryStats: updatedMemoryStats2 } = await postProcess({
          fullResponse, userMessage, agentId: options.agentId, sandboxRunId: options.sandboxRunId, traceId, activeChannels, memoryStats,
        });
        void detectAndAddLesson(userMessage, history.filter(m => m.role === 'assistant').at(-1)?.content ?? '', providerId, model, options.agentId, traceId, lessonsBlock, agentLessons);

        const totalCtxTokens2 = estimateTokens(finalSystemPrompt) + history.reduce((s, m) => s + estimateTokens(m.content), 0) + estimateTokens(userMessage);
        const outTokens2 = estimateTokens(fullResponse);
        const cost2 = computeActualCost(model, totalCtxTokens2, outTokens2);
        recordCost(effectiveAgentId, { model, inputTokens: totalCtxTokens2, outputTokens: outTokens2, costUsd: cost2, cachedTokens: 0 });

        onDone({
          traceId, pipeline: pipelineResult, systemTokens: estimateTokens(finalSystemPrompt),
          totalContextTokens: totalCtxTokens2, heatmap: heatmap2, frameworkSummary,
          toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
          toolTurns: toolTurns > 0 ? toolTurns : undefined,
          memory: updatedMemoryStats2,
          retrieval: retrievalResult ? {
            queryType: retrievalResult.queryType, diversityScore: retrievalResult.diversityScore,
            collapseWarning: retrievalResult.collapseWarning, totalChunks: retrievalResult.totalChunks,
            selectedChunks: retrievalResult.chunks.length, budgetUsed: retrievalResult.budgetUsed,
            budgetTotal: retrievalResult.budgetTotal, retrievalMs: retrievalResult.retrievalMs,
            embeddingMs: retrievalResult.embeddingMs,
            originalTokens: retrievalResult.chunks.reduce((s, c) => s + estimateTokens(c.content), 0),
            chunks: retrievalResult.chunks.map(chunk => ({
              section: chunk.section, source: chunk.source, relevanceScore: chunk.relevanceScore || 0,
              inclusionReason: chunk.inclusionReason || 'unknown', knowledgeType: chunk.knowledgeType,
              tokens: estimateTokens(chunk.content),
            })),
          } : undefined,
          costUsd: bufferedCost + cost2, model, inputTokens: totalCtxTokens2, outputTokens: outTokens2, cachedTokens: 0,
        });
        return;
      } else {
        // No improvement — flush buffered response to user
        onChunk(buffered);

        // Continue with post-processing using the buffered response
        if (responseCache.enabled && buffered) {
          void storeResponseCache(userMessage, buffered, effectiveAgentId, model, systemPromptHash, responseCache.ttlSeconds);
        }

        const { heatmap, memoryStats: updatedMemoryStats } = await postProcess({
          fullResponse: buffered, userMessage, agentId: options.agentId, sandboxRunId: options.sandboxRunId, traceId, activeChannels, memoryStats,
        });
        void detectAndAddLesson(userMessage, history.filter(m => m.role === 'assistant').at(-1)?.content ?? '', providerId, model, options.agentId, traceId, lessonsBlock, agentLessons);

        const totalCtxTokens = systemTokens + history.reduce((s, m) => s + estimateTokens(m.content), 0) + estimateTokens(userMessage);
        const outTokens = estimateTokens(buffered);
        const costUsd = computeActualCost(model, totalCtxTokens, outTokens);
        recordCost(effectiveAgentId, { model, inputTokens: totalCtxTokens, outputTokens: outTokens, costUsd, cachedTokens: 0 });

        const retrievalStats = retrievalResult ? {
          queryType: retrievalResult.queryType, diversityScore: retrievalResult.diversityScore,
          collapseWarning: retrievalResult.collapseWarning, totalChunks: retrievalResult.totalChunks,
          selectedChunks: retrievalResult.chunks.length, budgetUsed: retrievalResult.budgetUsed,
          budgetTotal: retrievalResult.budgetTotal, retrievalMs: retrievalResult.retrievalMs,
          embeddingMs: retrievalResult.embeddingMs,
          chunks: retrievalResult.chunks.map(chunk => ({
            section: chunk.section, source: chunk.source, relevanceScore: chunk.relevanceScore || 0,
            inclusionReason: chunk.inclusionReason || 'unknown', knowledgeType: chunk.knowledgeType,
            tokens: estimateTokens(chunk.content),
          })),
        } : undefined;

        onDone({ traceId, pipeline: pipelineResult, systemTokens, totalContextTokens: totalCtxTokens, heatmap, frameworkSummary, memory: updatedMemoryStats, retrieval: retrievalStats, costUsd, model, inputTokens: totalCtxTokens, outputTokens: outTokens, cachedTokens: 0 });
        return;
      }
    }

    const { fullResponse, toolCallResults, toolTurns } = await executeChat({
      providerId,
      model,
      messages: finalMsgs,
      userMessage,
      systemPrompt: finalSystemPrompt,
      traceId,
      onChunk,
    });

    // 6a. Store response in cache after successful LLM call
    if (responseCache.enabled && fullResponse) {
      void storeResponseCache(userMessage, fullResponse, effectiveAgentId, model, systemPromptHash, responseCache.ttlSeconds);
    }

    // 7–9. Post-process: memory write, end trace, heatmap + stats
    const { heatmap, memoryStats: updatedMemoryStats } = await postProcess({
      fullResponse,
      userMessage,
      agentId: options.agentId,
      sandboxRunId: options.sandboxRunId,
      traceId,
      activeChannels,
      memoryStats,
    });

    // 10. Detect corrections → extract lesson → add to pending
    // Also bump confidence of applied instincts if user did NOT correct
    const lastAssistant = history.filter(m => m.role === 'assistant').at(-1)?.content ?? '';
    void detectAndAddLesson(userMessage, lastAssistant, providerId, model, options.agentId, traceId, lessonsBlock, agentLessons);

    const totalContextTokens =
      systemTokens +
      history.reduce((s, m) => s + estimateTokens(m.content), 0) +
      estimateTokens(userMessage);

    // Cost tracking: estimate actual cost and record it
    const outputTokens = estimateTokens(fullResponse);
    const costUsd = computeActualCost(model, totalContextTokens, outputTokens);
    const effectiveAgentIdForCost = options.agentId ?? 'default';
    recordCost(effectiveAgentIdForCost, { model, inputTokens: totalContextTokens, outputTokens, costUsd, cachedTokens: 0 });

    const retrievalStats = retrievalResult ? {
      queryType: retrievalResult.queryType,
      diversityScore: retrievalResult.diversityScore,
      collapseWarning: retrievalResult.collapseWarning,
      totalChunks: retrievalResult.totalChunks,
      selectedChunks: retrievalResult.chunks.length,
      budgetUsed: retrievalResult.budgetUsed,
      budgetTotal: retrievalResult.budgetTotal,
      retrievalMs: retrievalResult.retrievalMs,
      embeddingMs: retrievalResult.embeddingMs,
      chunks: retrievalResult.chunks.map(chunk => ({
        section: chunk.section,
        source: chunk.source,
        relevanceScore: chunk.relevanceScore || 0,
        inclusionReason: chunk.inclusionReason || 'unknown',
        knowledgeType: chunk.knowledgeType,
        tokens: estimateTokens(chunk.content),
      })),
    } : undefined;

    onDone({
      traceId,
      pipeline: pipelineResult,
      systemTokens,
      totalContextTokens,
      heatmap,
      frameworkSummary,
      toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
      toolTurns: toolTurns > 0 ? toolTurns : undefined,
      memory: updatedMemoryStats,
      retrieval: retrievalStats,
      costUsd,
      model,
      inputTokens: totalContextTokens,
      outputTokens,
      cachedTokens: 0,
    });

  } catch (err) {
    traceStore.addEvent(traceId, {
      kind: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
    traceStore.endTrace(traceId);
    onError(err instanceof Error ? err : new Error('Unknown error'));
  }
}

async function detectAndAddLesson(
  userMessage: string,
  previousAssistant: string,
  providerId: string,
  model: string,
  agentId: string | undefined,
  traceId: string,
  appliedLessonsBlock: string,
  appliedLessons: Lesson[],
): Promise<void> {
  try {
    const res = await fetch('/api/lessons/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, previousAssistant, providerId, model, agentId }),
    });
    if (!res.ok) {
      // No correction detected — bump confidence of applied instincts
      if (appliedLessonsBlock && agentId) {
        void bumpAppliedInstincts(agentId, appliedLessons);
      }
      return;
    }
    const data = await res.json() as { lesson: import('../store/lessonStore').Lesson | null };
    if (!data.lesson) {
      // No correction — bump confidence
      if (appliedLessonsBlock && agentId) {
        void bumpAppliedInstincts(agentId, appliedLessons);
      }
      return;
    }
    const { rule, category, domain, confidence, agentId: lid, sourceUserMessage, sourcePreviousAssistant } = data.lesson;
    useLessonStore.getState().addLesson({ rule, category, domain, confidence, agentId: lid, sourceUserMessage, sourcePreviousAssistant });
    useTraceStore.getState().addEvent(traceId, { kind: 'lesson_proposed' });
    // Show AHA toast when a lesson is extracted
    showInstinctToast(rule);
  } catch {
    // Lesson extraction is best-effort — never surface errors
  }
}

async function bumpAppliedInstincts(agentId: string, localLessons: Lesson[]): Promise<void> {
  // Bump local store confidence
  const store = useLessonStore.getState();
  for (const l of localLessons) {
    store.bumpConfidence(l.id, 0.05);
  }
  // Also sync to server if we have active instincts from server
  try {
    const resp = await fetch(`/api/lessons/${encodeURIComponent(agentId)}/active`);
    if (!resp.ok) return;
    const data = await resp.json() as { instincts: Array<{ id: string; confidence: number }> };
    for (const inst of data.instincts) {
      const newConf = Math.min(1, inst.confidence + 0.05);
      void fetch(`/api/lessons/${inst.id}/confidence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: newConf }),
      });
    }
  } catch { /* best-effort */ }
}

function showInstinctToast(action: string): void {
  // Dispatch a custom event that the UI can listen to
  const event = new CustomEvent('instinct-learned', { detail: { action } });
  window.dispatchEvent(event);
}
