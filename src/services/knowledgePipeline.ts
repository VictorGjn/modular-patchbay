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
import { indexMarkdown } from './treeIndexer';
import { renderFilteredMarkdown, applyDepthFilter } from '../utils/depthFilter';
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
  buildCritiquePrompt,
  parseCritiqueResponse,
  buildHyDEPrompt,
  shouldUseHyDE,
  type BranchSelection,
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

// ── Re-navigation for gaps ──

async function reNavigateForGaps(
  gaps: string[],
  pipelineStartIndexes: any[],
  existingSelections: BranchSelection[],
  options: { providerId: string; model: string; totalBudget: number },
  traceId: string,
): Promise<BranchSelection[]> {
  const traceStore = useTraceStore.getState();
  const navStart = Date.now();

  try {
    // Build combined gap query
    const gapQuery = gaps.join('. ');

    // Budget for gaps: 20% of total budget
    const gapBudget = Math.floor(options.totalBudget * 0.2);

    // Get already-selected nodeIds to filter out
    const existingNodeIds = new Set(existingSelections.map(s => s.nodeId));

    // Build navigation prompt for gaps
    const headlines = pipelineStartIndexes.map(extractHeadlines);
    const navPrompt = buildNavigationPrompt(headlines, {
      task: gapQuery,
      tokenBudget: gapBudget
    });

    const navigationResponse = await callLlmForNavigation(navPrompt, options.providerId, options.model);
    const gapSelections = parseNavigationResponse(navigationResponse);

    // Filter out already-selected nodes
    const newSelections = gapSelections.filter(sel => !existingNodeIds.has(sel.nodeId));

    traceStore.addEvent(traceId, {
      kind: 'llm_call',
      model: options.model,
      durationMs: Date.now() - navStart,
      toolResult: `Gap navigation selected ${newSelections.length} new branches for ${gaps.length} gaps`,
    });

    return newSelections;
  } catch (err) {
    traceStore.addEvent(traceId, {
      kind: 'error',
      errorMessage: `Gap navigation failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      durationMs: Date.now() - navStart,
    });
    return [];
  }
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
        // ── HyDE Navigation ──
        // Use hypothetical document embeddings for complex queries
        let navigationQuery = userMessage;
        if (shouldUseHyDE(userMessage)) {
          try {
            const hydePrompt = buildHyDEPrompt(userMessage);
            const hydeResponse = await callLlmForNavigation(hydePrompt, providerId, model);
            if (hydeResponse.length > 20) {
              navigationQuery = hydeResponse;
              traceStore.addEvent(traceId, {
                kind: 'llm_call',
                model,
                durationMs: Date.now() - navStart,
                toolResult: `HyDE generated ${hydeResponse.length} chars for navigation`,
              });
            }
          } catch (hydeErr) {
            // HyDE failure is silent - use original query
            traceStore.addEvent(traceId, {
              kind: 'error',
              errorMessage: `HyDE failed: ${hydeErr instanceof Error ? hydeErr.message : 'Unknown'} — using original query`,
              durationMs: 0,
            });
          }
        }

        const headlines = pipelineStart.indexes.map(extractHeadlines);
        const navPrompt = buildNavigationPrompt(headlines, { task: navigationQuery, tokenBudget: totalBudget });
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

    // ── Corrective Re-Navigation ──
    // Run AFTER initial pipeline completion but BEFORE final knowledge block assignment
    const agentSelections = parseNavigationResponse(navigationResponse);
    if (useAgentNav && agentSelections.length > 0 && pipelineResult.context.trim()) {
      try {
        // Ask LLM to critique the assembled context and identify gaps
        const critiquePrompt = buildCritiquePrompt(userMessage, pipelineResult.context);
        const critiqueResponse = await callLlmForNavigation(critiquePrompt, providerId, model);
        const gaps = parseCritiqueResponse(critiqueResponse);

        if (gaps.length > 0) {
          // Re-navigate to fill gaps
          const gapSelections = await reNavigateForGaps(
            gaps,
            pipelineStart.indexes,
            agentSelections,
            { providerId, model, totalBudget },
            traceId
          );

          if (gapSelections.length > 0) {
            // Merge new selections with existing and re-run pipeline
            const allSelections = [...agentSelections, ...gapSelections];
            const combinedNavigationResponse = JSON.stringify(allSelections);

            pipelineResult = completePipeline(
              pipelineStart.indexes,
              combinedNavigationResponse,
              {
                task: userMessage,
                sources: sourcesWithContent,
                tokenBudget: totalBudget,
                manualSelections: undefined,
                compression: { enabled: true, aggressiveness: 0.5 },
              },
              pipelineStart.indexMs,
            );

            traceStore.addEvent(traceId, {
              kind: 'retrieval',
              sourceName: 'pipeline:re-navigation',
              resultCount: gapSelections.length,
              durationMs: 0, // Already tracked in reNavigateForGaps
            });
          }
        }
      } catch (err) {
        // Re-navigation failure is silent - just trace it
        traceStore.addEvent(traceId, {
          kind: 'error',
          errorMessage: `Corrective re-navigation failed: ${err instanceof Error ? err.message : 'Unknown'}`,
          durationMs: 0,
        });
      }
    }

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
