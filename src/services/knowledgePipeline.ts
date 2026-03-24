/**
 * Knowledge Pipeline — runs the content compression pipeline on regular (non-framework) channels.
 *
 * Steps 2c (build pipeline sources) and 2d (compress + optional agent navigation) from the original pipeline.
 * Also owns the LLM navigation helper and the metadata-only fallback.
 */

import type { ChannelConfig, KnowledgeType } from '../store/knowledgeBase';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, depthPctToFraction } from '../store/knowledgeBase';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { useTraceStore } from '../store/traceStore';
import { indexMarkdown, estimateTokens, type TreeNode, type TreeIndex } from './treeIndexer';
import { renderFilteredMarkdown, applyDepthFilter } from '../utils/depthFilter';
import { allocateBudgets, DEPTH_MULTIPLIERS, type BudgetSource } from './budgetAllocator';
import {
  startPipeline,
  completePipeline,
  type PipelineSource,
  type PipelineResult,
} from './pipeline';
import {
  findContrastingChunks,
  shouldActivateContrastiveRetrieval,
  type ChunkWithMetadata,
} from './contrastiveRetrieval';
import {
  treeAwareRetrieve,
} from './treeAwareRetriever';
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
import { 
  buildProvenanceSummary, 
  createProvenanceAwareChunks, 
  resolveConflicts 
} from './provenanceService';
import type { ProvenanceSummary } from '../types/provenance';
import type { PipelineStageData, PipelineStageDataMap } from '../types/pipelineStageTypes';

// ── Pipeline Event Emitters ──

type PipelineStage = 'source_assembly' | 'budget_allocation' | 'retrieval' | 'contradiction_check' | 'provenance';

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

export interface KnowledgeResult {
  knowledgeBlock: string;
  pipelineResult: PipelineResult | null;
  provenance: ProvenanceSummary | null;
  retrievalResult?: import('./treeAwareRetriever').RetrievalResult;
}

// ── Provenance metadata helpers ──

/**
 * Wrap content with provenance tags
 */
function wrapWithProvenance(
  content: string,
  source: string,
  section: string,
  type: KnowledgeType,
  depth: string,
  method: string,
): string {
  return `<chunk source="${source}" section="${section}" type="${type}" depth="${depth}" method="${method}">\n${content}\n</chunk>`;
}

/**
 * Extract chunks from pipeline result and add provenance metadata
 */
function extractChunksWithProvenance(
  pipelineResult: PipelineResult,
  sourceChannels: ChannelConfig[],
): ChunkWithMetadata[] {
  const chunks: ChunkWithMetadata[] = [];

  if (!pipelineResult.context) return chunks;

  const sourceMap = new Map<string, ChannelConfig>();
  for (const ch of sourceChannels) {
    sourceMap.set(ch.name, ch);
    if (ch.path) sourceMap.set(ch.path, ch);
  }

  // Split context into sections by markdown headings
  const sections = splitByHeadings(pipelineResult.context);

  for (const section of sections) {
    // Try to match section to a source channel
    let channel: ChannelConfig | undefined;
    for (const sourceInfo of pipelineResult.sources) {
      if (section.content.length > 0 && sourceMap.has(sourceInfo.name)) {
        channel = sourceMap.get(sourceInfo.name);
        break;
      }
    }

    const depth = channel ? DEPTH_LEVELS[channel.depth]?.label ?? 'full' : 'full';

    chunks.push({
      content: section.content,
      source: channel?.path || channel?.name || 'unknown',
      section: section.heading || 'main',
      type: (channel?.knowledgeType || 'signal') as KnowledgeType,
      depth,
      method: 'tree-index-pipeline',
      node: {} as TreeNode,
    });
  }

  return chunks;
}

function splitByHeadings(text: string): Array<{ heading: string; content: string }> {
  const lines = text.split('\n');
  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content) sections.push({ heading: currentHeading, content });
      }
      currentHeading = headingMatch[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content) sections.push({ heading: currentHeading, content });
  }

  return sections;
}

/**
 * Apply contrastive retrieval and format knowledge block with provenance
 */
function enhanceWithContrastiveRetrieval(
  pipelineResult: PipelineResult,
  sourceChannels: ChannelConfig[],
  userMessage: string,
): { knowledgeBlock: string; provenance: ProvenanceSummary } {
  // Build provenance summary
  const provenance = buildProvenanceSummary(pipelineResult, sourceChannels);

  // Check if contrastive retrieval should be activated
  if (!shouldActivateContrastiveRetrieval(userMessage)) {
    // Just add provenance tags to the regular context
    const sourceAnnotations = pipelineResult.sources
      .map(s => `${s.name} (${s.type}, ${s.totalTokens} tokens, ${s.indexedNodes} nodes)`)
      .join(', ');
    
    const knowledgeBlock = `<knowledge sources="${sourceAnnotations}">\n${pipelineResult.context}\n</knowledge>`;
    return { knowledgeBlock, provenance };
  }

  // Extract chunks with provenance metadata
  const chunks = extractChunksWithProvenance(pipelineResult, sourceChannels);
  
  if (chunks.length === 0) {
    const sourceAnnotations = pipelineResult.sources
      .map(s => `${s.name} (${s.type}, ${s.totalTokens} tokens, ${s.indexedNodes} nodes)`)
      .join(', ');
    
    const knowledgeBlock = `<knowledge sources="${sourceAnnotations}">\n${pipelineResult.context}\n</knowledge>`;
    return { knowledgeBlock, provenance };
  }

  // Create provenance-aware chunks
  const provenanceAwareChunks = createProvenanceAwareChunks(chunks);
  
  // Resolve any conflicts based on provenance
  const conflicts = resolveConflicts(provenanceAwareChunks);

  // Find contrasting chunks
  const contrastiveResult = findContrastingChunks(chunks, chunks);
  
  // Format with supporting and contrasting sections
  const supportingChunks = contrastiveResult.supporting.map(chunk =>
    wrapWithProvenance(
      chunk.content,
      chunk.source,
      chunk.section,
      chunk.type,
      chunk.depth,
      chunk.method,
    )
  );

  const contrastingChunks = contrastiveResult.contrasting.map(chunk =>
    wrapWithProvenance(
      chunk.content,
      chunk.source,
      chunk.section,
      chunk.type,
      chunk.depth,
      chunk.method,
    )
  );

  let knowledgeContent = '';
  
  if (supportingChunks.length > 0) {
    knowledgeContent += `<supporting>\n${supportingChunks.join('\n\n')}\n</supporting>`;
  }
  
  if (contrastingChunks.length > 0) {
    if (knowledgeContent) knowledgeContent += '\n\n';
    knowledgeContent += `<contrasting>\n${contrastingChunks.join('\n\n')}\n</contrasting>`;
  }
  
  // Add conflict resolution information if conflicts were found
  if (conflicts.length > 0) {
    if (knowledgeContent) knowledgeContent += '\n\n';
    knowledgeContent += '<conflicts_resolved>\n';
    for (const conflict of conflicts) {
      knowledgeContent += `Conflict: ${conflict.conflictingChunks.map(c => c.provenance.source).join(' vs ')}\n`;
      knowledgeContent += `Resolution: ${conflict.resolution.reason}\n\n`;
    }
    knowledgeContent += '</conflicts_resolved>';
  }
  
  // If no supporting/contrasting structure, fall back to regular format
  if (!knowledgeContent) {
    knowledgeContent = pipelineResult.context;
  }

  const sourceAnnotations = pipelineResult.sources
    .map(s => `${s.name} (${s.type}, ${s.totalTokens} tokens, ${s.indexedNodes} nodes)`)
    .join(', ');

  const knowledgeBlock = `<knowledge sources="${sourceAnnotations}">\n${knowledgeContent}\n</knowledge>`;
  return { knowledgeBlock, provenance };
}

interface KnowledgePipelineOptions {
  userMessage: string;
  navigationMode?: 'manual' | 'agent-driven' | 'tree-aware';
  providerId: string;
  model: string;
  /** Max tokens for assembled knowledge. If set, caps the total context budget. */
  tokenBudget?: number;
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
      const depth = DEPTH_LEVELS[ch.depth] ?? { label: 'Full', pct: depthPctToFraction(ch.depth) };
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
  pipelineStartIndexes: TreeIndex[],
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
  const { userMessage, navigationMode = 'tree-aware', providerId, model } = options;
  const activeChannels = channels.filter(ch => ch.enabled);

  let knowledgeBlock = residualKnowledgeBlock;
  let pipelineResult: PipelineResult | null = null;
  let provenance: ProvenanceSummary | null = null;
  let retrievalResult: import('./treeAwareRetriever').RetrievalResult | undefined;

  // 2c. Build pipeline sources from indexed content (regular channels only)
  //     Supports three paths: inline content, file-backed tree index, metadata-only fallback
  const sourcesWithContent: PipelineSource[] = [];
  for (const ch of regularChannels) {
    if (ch.content) {
      // Inline content path — index the markdown in-memory, then apply full depth filter
      const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
      const treeIndex = indexMarkdown(virtualPath, ch.content);
      const content = renderFilteredMarkdown(applyDepthFilter(treeIndex, 0).filtered);
      if (content.trim()) {
        sourcesWithContent.push({
          name: ch.name,
          type: 'markdown',
          content,
          sourceType: ch.knowledgeType,
        });
      }
    } else if (ch.path) {
      // File-backed path — use treeIndexStore with full depth
      const treeIndex = treeStore.getIndex(ch.path);
      if (treeIndex) {
        const content = renderFilteredMarkdown(applyDepthFilter(treeIndex, 0).filtered);
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

  // 2d. Tree-aware retrieval path (NEW DEFAULT)
  if (navigationMode === 'tree-aware' && regularChannels.length > 0) {
    const sourceBudget = activeChannels.reduce((sum, ch) => sum + ch.baseTokens, 0);
    const totalBudget = options.tokenBudget ? Math.min(sourceBudget, options.tokenBudget) : sourceBudget;
    
    // Build tree indexes for tree-aware retrieval
    const indexedSources: { treeIndex: TreeIndex; knowledgeType: KnowledgeType }[] = [];
    
    for (const ch of regularChannels) {
      if (ch.content) {
        // Inline content path
        if (ch.content.trim().length === 0) continue; // Skip empty content
        const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
        const treeIndex = indexMarkdown(virtualPath, ch.content);
        indexedSources.push({ treeIndex, knowledgeType: ch.knowledgeType });
      } else if (ch.path) {
        // File-backed path
        const treeIndex = treeStore.getIndex(ch.path);
        if (treeIndex) {
          indexedSources.push({ treeIndex, knowledgeType: ch.knowledgeType });
        }
      }
    }
    
    if (indexedSources.length > 0) {
      // Emit source assembly stage event
      const sourceAssemblyData = {
        sources: indexedSources.map(source => ({
          name: source.treeIndex.source,
          type: source.treeIndex.sourceType,
          rawTokens: source.treeIndex.totalTokens,
          included: true,
          reason: 'Valid indexed source'
        }))
      };
      emitPipelineStage(traceId, 'source_assembly', sourceAssemblyData);

      try {
        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'tree-aware-retrieval',
          query: userMessage,
          resultCount: indexedSources.length,
          durationMs: 0, // Will be updated below
        });
        
        retrievalResult = await treeAwareRetrieve(userMessage, indexedSources, totalBudget);
        
        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'tree-aware-retrieval',
          query: userMessage,
          resultCount: retrievalResult.chunks.length,
          durationMs: retrievalResult.retrievalMs,
        });
        
        if (retrievalResult.chunks.length > 0) {
          // Format the tree-aware retrieval results
          const formattedChunks = retrievalResult.chunks.map(chunk =>
            wrapWithProvenance(
              chunk.content,
              chunk.source,
              chunk.section,
              chunk.knowledgeType,
              chunk.depth.toString(),
              'tree-aware'
            )
          );
          
          const sourceAnnotations = indexedSources
            .map(s => `${s.treeIndex.source} (${s.knowledgeType}, ${s.treeIndex.totalTokens} tokens, ${s.treeIndex.nodeCount} nodes)`)
            .join(', ');
          
          const contextMetadata = `Query type: ${retrievalResult.queryType}, Diversity: ${retrievalResult.diversityScore.toFixed(2)}, Total chunks: ${retrievalResult.totalChunks}`;
          
          knowledgeBlock = `<knowledge sources="${sourceAnnotations}" method="tree-aware" metadata="${contextMetadata}">\n${formattedChunks.join('\n\n')}\n</knowledge>`;
          
          // Emit retrieval stage event
          const retrievalData = {
            query: userMessage,
            queryType: retrievalResult.queryType,
            chunks: retrievalResult.chunks.map(chunk => ({
              source: chunk.source,
              section: chunk.section,
              relevanceScore: chunk.relevanceScore || 0,
              inclusionReason: chunk.inclusionReason || 'direct',
            })),
            diversityScore: retrievalResult.diversityScore,
            totalChunks: retrievalResult.totalChunks,
            selectedChunks: retrievalResult.chunks.length,
          };
          emitPipelineStage(traceId, 'retrieval', retrievalData, retrievalResult.retrievalMs);
          
          // Build a minimal pipeline result for provenance tracking
          const contextText = formattedChunks.join('\n\n');
          const contextTokens = estimateTokens(contextText);
          pipelineResult = {
            context: contextText,
            tokens: contextTokens,
            utilization: totalBudget > 0 ? contextTokens / totalBudget : 0,
            sources: indexedSources.map(s => ({
              name: s.treeIndex.source,
              type: s.treeIndex.sourceType,
              totalTokens: s.treeIndex.totalTokens,
              indexedNodes: s.treeIndex.nodeCount,
            })),
            navigation: {
              selections: [],
            },
            compression: {
              originalTokens: retrievalResult.totalChunks > 0 ? indexedSources.reduce((s, ix) => s + ix.treeIndex.totalTokens, 0) : 0,
              compressedTokens: contextTokens,
              ratio: totalBudget > 0 ? contextTokens / Math.max(1, indexedSources.reduce((s, ix) => s + ix.treeIndex.totalTokens, 0)) : 1,
              removals: { duplicates: 0, filler: 0, codeComments: 0 },
            },
            indexes: indexedSources.map(s => s.treeIndex),
            timing: {
              indexMs: 0,
              navigationMs: 0,
              compressionMs: retrievalResult.retrievalMs,
              totalMs: retrievalResult.retrievalMs,
            },
          };
          
          // Build provenance for tree-aware retrieval
          if (pipelineResult) {
            provenance = buildProvenanceSummary(pipelineResult, regularChannels);
          }
          
          if (retrievalResult.collapseWarning) {
            traceStore.addEvent(traceId, {
              kind: 'error',
              errorMessage: `Low diversity score (${retrievalResult.diversityScore.toFixed(2)}) - chunks may be too similar`,
              durationMs: 0,
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        traceStore.addEvent(traceId, {
          kind: 'error',
          errorMessage: `Tree-aware retrieval failed: ${message} — falling back to pipeline`,
          durationMs: 0,
        });
        
        // Fall back to regular pipeline on error
        // (Continue to the existing pipeline logic below)
      }
    }
  }

  // 2d. Run pipeline if we have indexed content (traditional pipeline or fallback)
  if (sourcesWithContent.length > 0 && (navigationMode !== 'tree-aware' || !knowledgeBlock)) {
    const sourceBudget2 = activeChannels.reduce((sum, ch) => sum + ch.baseTokens, 0);
    const totalBudget = options.tokenBudget ? Math.min(sourceBudget2, options.tokenBudget) : sourceBudget2;

    // Budget allocation - create BudgetSource[] from sourcesWithContent
    const depthByName = new Map<string, number>();
    for (const ch of regularChannels) {
      depthByName.set(ch.name, ch.depth);
    }

    const budgetSources: BudgetSource[] = sourcesWithContent.map(source => ({
      name: source.name,
      knowledgeType: (source.sourceType ?? 'signal') as KnowledgeType,
      rawTokens: estimateTokens(source.content || ''),
      depthMultiplier: DEPTH_MULTIPLIERS[depthByName.get(source.name) ?? 2] ?? 1.0,
    }));

    const budgetAllocations = allocateBudgets(budgetSources, totalBudget);
    const budgetMap = new Map<string, number>();
    for (const allocation of budgetAllocations) {
      budgetMap.set(allocation.name, allocation.allocatedTokens);
    }

    // Emit budget allocation stage event
    const budgetAllocationData = {
      totalBudget,
      allocations: budgetAllocations.map(allocation => ({
        source: allocation.name,
        allocatedTokens: allocation.allocatedTokens,
        usedTokens: Math.min(allocation.allocatedTokens, estimateTokens(sourcesWithContent.find(s => s.name === allocation.name)?.content || '')),
        percentage: allocation.weight * 100,
        cappedBySize: allocation.cappedBySize,
        priority: allocation.knowledgeType === 'ground-truth' ? 0 : allocation.knowledgeType === 'signal' ? 1 : 2,
      }))
    };
    emitPipelineStage(traceId, 'budget_allocation', budgetAllocationData);

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
      // Apply contrastive retrieval and provenance enhancement
      const enhancementResult = enhanceWithContrastiveRetrieval(
        pipelineResult,
        regularChannels,
        userMessage,
      );
      knowledgeBlock = enhancementResult.knowledgeBlock;
      provenance = enhancementResult.provenance;
      
      // Emit contradiction check stage event (based on contrastive retrieval results)
      const contradictionData = {
        contradictionsFound: 0, // This would need to be extracted from enhancementResult
        conflicts: [],
        annotations: ['Contrastive retrieval completed'],
      };
      emitPipelineStage(traceId, 'contradiction_check', contradictionData);
    } else if (pipelineResult) {
      // Build provenance even if no context content
      provenance = buildProvenanceSummary(pipelineResult, regularChannels);
    }
  }

  // Fallback to metadata references if pipeline produced nothing
  if (!knowledgeBlock) {
    knowledgeBlock = buildKnowledgeFallback(channels);
  }

  // Add provenance tracking to trace store and emit stage event
  if (provenance) {
    traceStore.addEvent(traceId, {
      kind: 'provenance',
      provenanceSources: provenance.sources.map(source => ({
        path: source.path,
        type: source.type,
        sections: source.sections,
        depth: source.depth,
        chunkCount: source.chunkCount || 0,
      })),
      provenanceDerivations: provenance.derivations,
      resultCount: provenance.sources.length,
    });
    
    // Emit provenance stage event
    const provenanceData = {
      sources: provenance.sources.map(source => ({
        path: source.path,
        type: source.type,
        transformations: [
          {
            method: source.method,
            input: 'source_content',
            output: 'processed_chunks',
          },
        ],
      })),
      derivationChain: provenance.derivations,
    };
    emitPipelineStage(traceId, 'provenance', provenanceData);
  }

  return { knowledgeBlock, pipelineResult, provenance, retrievalResult };
}
