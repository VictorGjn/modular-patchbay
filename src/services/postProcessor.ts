/**
 * Post Processor — handles everything after the LLM response arrives.
 *
 * Steps 7-9 from the original pipeline:
 *   7. Memory post-write (extract facts from assistant response)
 *   8. End trace
 *   9. Build heatmap from tree indexes + return stats
 */

import { useTreeIndexStore } from '../store/treeIndexStore';
import { useTraceStore } from '../store/traceStore';
import { useMemoryStore } from '../store/memoryStore';
import { postWrite } from './memoryPipeline';
import { indexMarkdown, type TreeNode } from './treeIndexer';
import { applyDepthFilter } from '../utils/depthFilter';
import type { ChannelConfig } from '../store/knowledgeBase';

export interface SourceHeatmapEntry {
  name: string;
  path: string;
  nodeCount: number;
  totalTokens: number;
  filteredTokens: number;
  depth: number;
  knowledgeType: string;
  headings: { nodeId: string; title: string; depth: number; tokens: number }[];
}

export interface MemoryStats {
  recalledFacts: number;
  writtenFacts: number;
  recallMs: number;
  writeMs: number;
  recallTokens: number;
  domains: string[];
}

export interface PostProcessResult {
  heatmap: SourceHeatmapEntry[];
  memoryStats: MemoryStats | undefined;
}

export async function postProcess(options: {
  fullResponse: string;
  userMessage: string;
  agentId?: string;
  sandboxRunId?: string;
  traceId: string;
  activeChannels: ChannelConfig[];
  memoryStats: MemoryStats | undefined;
}): Promise<PostProcessResult> {
  const {
    fullResponse, userMessage, agentId, sandboxRunId,
    traceId, activeChannels, memoryStats: incomingMemoryStats,
  } = options;

  const traceStore = useTraceStore.getState();
  const memoryConfig = useMemoryStore.getState();
  let memoryStats = incomingMemoryStats;

  // 7. Post-write: extract facts from assistant response
  if (memoryConfig.longTerm.enabled && fullResponse) {
    const writeResult = postWrite({
      userMessage,
      assistantResponse: fullResponse,
      agentId,
      traceId,
      sandboxRunId,
    });

    if (memoryStats) {
      memoryStats = {
        ...memoryStats,
        writtenFacts: writeResult.stored.length,
        writeMs: writeResult.durationMs,
        domains: writeResult.stored.length > 0
          ? [...new Set([...memoryStats.domains, ...writeResult.stored.map(f => f.domain)])]
          : memoryStats.domains,
      };
    }
  }

  // 8. End trace
  traceStore.endTrace(traceId);

  // 9. Build heatmap from tree indexes
  const heatmap: SourceHeatmapEntry[] = [];
  const heatmapStore = useTreeIndexStore.getState();

  for (const ch of activeChannels) {
    let treeIdx = ch.path ? heatmapStore.getIndex(ch.path) : null;
    // Generate in-memory index for inline content channels (for heatmap)
    if (!treeIdx && ch.content) {
      const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
      treeIdx = indexMarkdown(virtualPath, ch.content);
    }
    if (!treeIdx) continue;

    const headings: SourceHeatmapEntry['headings'] = [];
    function walkHeadings(node: TreeNode) {
      if (node.depth > 0 && node.depth <= 2) {
        headings.push({ nodeId: node.nodeId, title: node.title, depth: node.depth, tokens: node.totalTokens });
      }
      for (const child of node.children) walkHeadings(child);
    }
    walkHeadings(treeIdx.root);

    const filtered = applyDepthFilter(treeIdx, ch.depth);
    heatmap.push({
      name: ch.name,
      path: ch.path || `content://${ch.contentSourceId || ch.sourceId}`,
      nodeCount: treeIdx.nodeCount,
      totalTokens: treeIdx.totalTokens,
      filteredTokens: filtered.totalTokens,
      depth: ch.depth,
      knowledgeType: ch.knowledgeType,
      headings,
    });
  }

  return { heatmap, memoryStats };
}
