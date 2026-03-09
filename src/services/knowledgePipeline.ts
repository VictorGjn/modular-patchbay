/**
 * Knowledge Pipeline — runs the content compression pipeline on regular (non-framework) channels.
 *
 * Steps 2c (build pipeline sources) and 2d (compress + optional agent navigation) from the original pipeline.
 * Also owns the LLM navigation helper and the metadata-only fallback.
 */

import type { ChannelConfig } from '../store/knowledgeBase';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { useTraceStore } from '../store/traceStore';
import { indexMarkdown, estimateTokens } from './treeIndexer';
import { renderFilteredMarkdown, applyDepthFilter } from '../utils/depthFilter';
import { allocateBudgets, DEPTH_MULTIPLIERS, type BudgetSource } from './budgetAllocator';
import {
  startPipeline,
  completePipeline,
  type PipelineSource,
  type PipelineResult,
} from './pipeline';
import {
  extractHeadlines,
  buildNavigationPrompt,
  parseNavigationResponse,
} from './treeNavigator';
import { API_BASE } from '../config';

export interface KnowledgeResult {
  knowledgeBlock: string;
  pipelineResult: PipelineResult | null;
}

interface KnowledgePipelineOptions {
  userMessage: string;
  navigationMode?: 'manual' | 'agent-driven';
  providerId: string;
  model: string;
}

// ── Metadata-only fallback ──

function buildKnowledgeFallback(channels: ChannelConfig[]): string {
  const active = channels.filter(ch => ch.enabled);
  if (active.length === 0) return '';

  const grouped: Record<string, ChannelConfig[]> = {};
  const typeOrder = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
  for (const ch of active) {
    if (!grouped[ch.knowledgeType]) grouped[ch.knowledgeType] = [];
    grouped[ch.knowledgeType].push(ch);
  }

  const knowledgeLines: string[] = [];
  for (const type of typeOrder) {
    const group = grouped[type];
    if (!group?.length) continue;
    const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
    const sourceBlocks = group.map(ch => {
      const depth = DEPTH_LEVELS[ch.depth];
      return `- ${ch.name} (${depth.label}, ~${Math.round(ch.baseTokens * depth.pct).toLocaleString()} tokens) [${ch.path}]`;
    });
    knowledgeLines.push(`[${kt.label.toUpperCase()}] ${kt.instruction}\n${sourceBlocks.join('\n')}`);
  }

  return `<knowledge>\n${knowledgeLines.join('\n\n')}\n</knowledge>`;
}

// ── Non-streaming LLM call for navigation ──

async function callLlmForNavigation(prompt: string, providerId: string, model: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId, model,
      messages: [
        { role: 'system', content: 'You are a context navigation agent. Respond with ONLY a JSON array, no markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`Navigation LLM call failed: ${resp.status}`);

  // Backend always streams SSE — collect chunks
  const text = await resp.text();
  const chunks = text.split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice(6))
    .filter(data => data !== '[DONE]');

  let content = '';
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    } catch { /* skip */ }
  }
  return content;
}

// ── Main compression function ──

/**
 * Run the content pipeline on regular (non-framework) channels.
 * Returns the compressed knowledge block and pipeline result.
 *
 * Priority: pipeline content > residualKnowledgeBlock > metadata fallback.
 * If the pipeline runs and produces content, residualKnowledgeBlock is discarded
 * (preserving the original behaviour).
 */
export async function compressKnowledge(
  channels: ChannelConfig[],
  regularChannels: ChannelConfig[],
  residualKnowledgeBlock: string,
  options: KnowledgePipelineOptions,
  traceId: string,
): Promise<KnowledgeResult> {
  const treeStore = useTreeIndexStore.getState();
  const traceStore = useTraceStore.getState();
  const { userMessage, navigationMode, providerId, model } = options;
  const activeChannels = channels.filter(ch => ch.enabled);

  let knowledgeBlock = residualKnowledgeBlock;
  let pipelineResult: PipelineResult | null = null;

  // 2c. Build pipeline sources from indexed content (regular channels only)
  //     Supports three paths: inline content, file-backed tree index, metadata-only fallback
  const sourcesWithContent: PipelineSource[] = [];
  for (const ch of regularChannels) {
    if (ch.content) {
      // Inline content path — index the markdown in-memory, then apply depth filter
      const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
      const treeIndex = indexMarkdown(virtualPath, ch.content);
      const filtered = applyDepthFilter(treeIndex, ch.depth);
      const content = renderFilteredMarkdown(filtered.filtered);
      if (content.trim()) {
        sourcesWithContent.push({
          name: ch.name,
          type: 'markdown',
          content,
          sourceType: ch.knowledgeType,
        });
      }
    } else if (ch.path) {
      // File-backed path — use treeIndexStore as before
      const treeIndex = treeStore.getIndex(ch.path);
      if (treeIndex) {
        const filtered = applyDepthFilter(treeIndex, ch.depth);
        const content = renderFilteredMarkdown(filtered.filtered);
        if (content.trim()) {
          sourcesWithContent.push({
            name: ch.name,
            type: 'markdown',
            content,
            sourceType: ch.knowledgeType,
          });
        }
      }
    }
    // else: metadata-only fallback — no content to add, handled by buildKnowledgeFallback
  }

  // 2d. Run pipeline if we have indexed content
  if (sourcesWithContent.length > 0) {
    const totalBudget = activeChannels.reduce((sum, ch) => sum + ch.baseTokens, 0);

    // Budget allocation - create BudgetSource[] from sourcesWithContent
    const depthByName = new Map<string, number>();
    for (const ch of regularChannels) {
      depthByName.set(ch.name, ch.depth);
    }

    const budgetSources: BudgetSource[] = sourcesWithContent.map(source => ({
      name: source.name,
      knowledgeType: source.sourceType as any, // PipelineSource.sourceType maps to KnowledgeType
      rawTokens: estimateTokens(source.content || ''),
      depthMultiplier: DEPTH_MULTIPLIERS[depthByName.get(source.name) ?? 2] ?? 1.0,
    }));

    const budgetAllocations = allocateBudgets(budgetSources, totalBudget);
    const budgetMap = new Map<string, number>();
    for (const allocation of budgetAllocations) {
      budgetMap.set(allocation.name, allocation.allocatedTokens);
    }

    // Truncate source content to budget caps (cap * 4 chars per token)
    for (const source of sourcesWithContent) {
      const budgetCap = budgetMap.get(source.name) ?? totalBudget;
      const maxChars = budgetCap * 4;
      if (source.content && source.content.length > maxChars) {
        source.content = source.content.slice(0, maxChars);
      }
    }

    const useAgentNav = navigationMode === 'agent-driven';

    const pipelineStart = startPipeline({
      task: userMessage,
      sources: sourcesWithContent,
      tokenBudget: totalBudget,
    });

    traceStore.addEvent(traceId, {
      kind: 'retrieval',
      sourceName: 'pipeline:index',
      query: userMessage,
      resultCount: pipelineStart.indexes.length,
      durationMs: pipelineStart.indexMs,
    });

    let navigationResponse = '';
    let manualSelections = activeChannels
      .filter(ch => (ch.path && treeStore.getIndex(ch.path) != null) || ch.content)
      .map(ch => ({
        nodeId: ch.name,
        depth: ch.depth,
        priority: ch.knowledgeType === 'ground-truth' ? 0 : ch.knowledgeType === 'signal' ? 1 : 2,
      }));

    // Agent-driven navigation: LLM decides which branches at which depth
    if (useAgentNav && pipelineStart.indexes.length > 0) {
      const navStart = Date.now();
      try {
        const headlines = pipelineStart.indexes.map(extractHeadlines);
        const navPrompt = buildNavigationPrompt(headlines, { task: userMessage, tokenBudget: totalBudget });
        navigationResponse = await callLlmForNavigation(navPrompt, providerId, model);
        const agentSelections = parseNavigationResponse(navigationResponse);
        if (agentSelections.length > 0) manualSelections = agentSelections;

        traceStore.addEvent(traceId, {
          kind: 'llm_call',
          model,
          durationMs: Date.now() - navStart,
          toolResult: `Agent selected ${agentSelections.length} branches`,
        });
      } catch (navErr) {
        traceStore.addEvent(traceId, {
          kind: 'error',
          errorMessage: `Navigation failed: ${navErr instanceof Error ? navErr.message : 'Unknown'} — using manual depths`,
          durationMs: Date.now() - navStart,
        });
      }
    }

    pipelineResult = completePipeline(
      pipelineStart.indexes,
      navigationResponse,
      {
        task: userMessage,
        sources: sourcesWithContent,
        tokenBudget: totalBudget,
        manualSelections: navigationResponse ? undefined : manualSelections,
        compression: { enabled: true, aggressiveness: 0.5 },
      },
      pipelineStart.indexMs,
    );

    traceStore.addEvent(traceId, {
      kind: 'retrieval',
      sourceName: 'pipeline:compress',
      resultCount: pipelineResult.sources.length,
      durationMs: pipelineResult.timing.compressionMs,
    });

    if (pipelineResult.context.trim()) {
      const sourceAnnotations = pipelineResult.sources
        .map(s => `${s.name} (${s.type}, ${s.totalTokens} tokens, ${s.indexedNodes} nodes)`)
        .join(', ');
      // Pipeline content takes priority — residual is discarded (original behaviour)
      knowledgeBlock = `<knowledge sources="${sourceAnnotations}">\n${pipelineResult.context}\n</knowledge>`;
    }
  }

  // Fallback to metadata references if pipeline produced nothing
  if (!knowledgeBlock) {
    knowledgeBlock = buildKnowledgeFallback(channels);
  }

  return { knowledgeBlock, pipelineResult };
}
