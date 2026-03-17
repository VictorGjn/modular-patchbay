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
import { executeChat } from './executionRouter';
import { postProcess } from './postProcessor';
import type { PipelineResult } from './pipeline';
import type { ToolCallResult } from './toolRunner';

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
  agentId?: string;
  sandboxRunId?: string;
  onChunk: (chunk: string) => void;
  onDone: (stats: PipelineChatStats) => void;
  onError: (err: Error) => void;
}

export interface PipelineChatStats {
  pipeline: PipelineResult | null;
  systemTokens: number;
  totalContextTokens: number;
  heatmap: import('./postProcessor').SourceHeatmapEntry[];
  frameworkSummary?: import('./sourceRouter').FrameworkSummary;
  toolCalls?: ToolCallResult[];
  toolTurns?: number;
  memory?: import('./postProcessor').MemoryStats;
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
    chunks: Array<{
      section: string;
      source: string;
      relevanceScore: number;
      inclusionReason: string;
      knowledgeType: string;
      tokens: number;
    }>;
  };
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
        ? await compressKnowledge(channels, regularChannels, residualKnowledgeBlock, { userMessage, navigationMode: options.navigationMode, providerId, model }, traceId)
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

    // 3b. Pre-recall: inject relevant memory facts into context
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

    // 3c. Rebuild system frame with provenance data
    if (provenance) {
      systemFrame = buildSystemFrame(provenance);
    }

    // 4. Assemble final system prompt
    //    Order: frame → orientation → knowledge_format → framework → memory → knowledge
    const orientationBlock = buildOrientationBlock(channels, useTreeIndexStore.getState().getIndex);
    const hasRepos = channels.some(ch => ch.enabled && ch.repoMeta);
    const systemPrompt = assemblePipelineContext({
      frame: systemFrame,
      orientationBlock,
      hasRepos,
      knowledgeFormatGuide: buildKnowledgeFormatGuide(),
      frameworkBlock,
      memoryBlock,
      knowledgeBlock,
    });
    const systemTokens = estimateTokens(systemPrompt);

    // 5. Build messages array
    const msgs = [
      { role: 'system' as const, content: systemPrompt },
      ...history.filter(m => m.content.trim() !== '').map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // 6. Execute: tool loop / text streaming / agent SDK
    const { fullResponse, toolCallResults, toolTurns } = await executeChat({
      providerId,
      model,
      messages: msgs,
      userMessage,
      systemPrompt,
      traceId,
      onChunk,
    });

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

    const totalContextTokens =
      systemTokens +
      history.reduce((s, m) => s + estimateTokens(m.content), 0) +
      estimateTokens(userMessage);

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
      pipeline: pipelineResult,
      systemTokens,
      totalContextTokens,
      heatmap,
      frameworkSummary,
      toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
      toolTurns: toolTurns > 0 ? toolTurns : undefined,
      memory: updatedMemoryStats,
      retrieval: retrievalStats,
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
