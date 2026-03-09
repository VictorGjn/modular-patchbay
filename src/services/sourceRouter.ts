/**
 * Source Router — classifies channels into framework vs regular, indexes files,
 * and extracts framework rules (constraints, workflow, persona) from framework/guideline channels.
 *
 * Steps 2a (tree indexing) and 2b (framework extraction) from the original pipeline.
 */

import type { ChannelConfig } from '../store/knowledgeBase';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { useTraceStore } from '../store/traceStore';
import { indexMarkdown } from './treeIndexer';
import { renderFilteredMarkdown, applyDepthFilter } from '../utils/depthFilter';
import { extractFramework, compileFrameworkBlocks } from './frameworkExtractor';

export interface FrameworkSummary {
  constraints: number;
  workflowSteps: number;
  personaHints: number;
  toolHints: number;
  outputRules: number;
  namingPatterns: number;
  sources: string[];
}

export interface SourceRouterResult {
  frameworkBlock: string;
  frameworkSummary: FrameworkSummary | undefined;
  regularChannels: ChannelConfig[];
  residualKnowledgeBlock: string;
}

/**
 * Route active channels into framework vs regular knowledge, index files,
 * and extract structured framework blocks from framework/guideline channels.
 */
export async function routeSources(
  activeChannels: ChannelConfig[],
  traceId: string,
): Promise<SourceRouterResult> {
  const treeStore = useTreeIndexStore.getState();
  const traceStore = useTraceStore.getState();

  const extractableTypes = new Set(['framework', 'guideline']);
  const frameworkChannels = activeChannels.filter(ch => extractableTypes.has(ch.knowledgeType));
  const regularChannels = activeChannels.filter(ch => !extractableTypes.has(ch.knowledgeType));

  let frameworkBlock = '';
  let frameworkSummary: FrameworkSummary | undefined;
  let residualKnowledgeBlock = '';

  // 2a. Index files that have paths (fetches content from backend, caches in treeIndexStore)
  const pathChannels = activeChannels.filter(ch => ch.path);
  if (pathChannels.length > 0) {
    const indexStart = Date.now();
    await treeStore.indexFiles(pathChannels.map(ch => ch.path));

    traceStore.addEvent(traceId, {
      kind: 'retrieval',
      sourceName: 'pipeline:fetch',
      query: `${pathChannels.length} sources`,
      resultCount: pathChannels.filter(ch => treeStore.getIndex(ch.path) != null).length,
      durationMs: Date.now() - indexStart,
    });
  }

  // 2b. Extract framework sources → active agent shaping (constraints, workflow, persona)
  if (frameworkChannels.length > 0) {
    const frameworks = frameworkChannels
      .map(ch => {
        let treeIndex = ch.path ? treeStore.getIndex(ch.path) : null;
        // Inline content fallback for framework channels
        if (!treeIndex && ch.content) {
          const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
          treeIndex = indexMarkdown(virtualPath, ch.content);
        }
        if (!treeIndex) return null;
        const filtered = applyDepthFilter(treeIndex, 0); // Full depth for framework extraction
        const content = renderFilteredMarkdown(filtered.filtered);
        return content.trim() ? extractFramework(content, ch.name) : null;
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    if (frameworks.length > 0) {
      const compiled = compileFrameworkBlocks(frameworks);
      const blocks = [
        compiled.constraintsBlock,
        compiled.workflowBlock,
        compiled.personaBlock,
        compiled.toolHintsBlock,
        compiled.outputBlock,
      ].filter(Boolean);
      frameworkBlock = blocks.join('\n\n');

      // Build summary for UI visibility
      frameworkSummary = {
        constraints: frameworks.reduce((s, f) => s + f.constraints.length, 0),
        workflowSteps: frameworks.reduce((s, f) => s + f.workflowSteps.length, 0),
        personaHints: frameworks.reduce((s, f) => s + f.personaHints.length, 0),
        toolHints: frameworks.reduce((s, f) => s + f.toolHints.length, 0),
        outputRules: frameworks.reduce((s, f) => s + f.outputRules.length, 0),
        namingPatterns: frameworks.reduce((s, f) => s + f.namingPatterns.length, 0),
        sources: frameworks.map((f) => f.source),
      };

      // Residual content (sections that didn't match extraction rules) goes to knowledge
      if (compiled.residualKnowledge.trim()) {
        residualKnowledgeBlock = `<knowledge type="framework-residual">\n${compiled.residualKnowledge}\n</knowledge>`;
      }

      traceStore.addEvent(traceId, {
        kind: 'retrieval',
        sourceName: 'pipeline:framework',
        query: `${frameworks.length} framework sources`,
        resultCount: frameworks.reduce((s, f) => s + f.constraints.length + f.workflowSteps.length, 0),
        durationMs: 0,
      });
    }
  }

  return { frameworkBlock, frameworkSummary, regularChannels, residualKnowledgeBlock };
}
