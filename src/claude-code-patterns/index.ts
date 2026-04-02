/**
 * Claude Code Patterns — barrel export for all features + adapters.
 *
 * Clean API surface for integrating context engineering patterns
 * inspired by Claude Code into the Modular Patchbay pipeline.
 */

// ── Phase 1: Core features ──

export { SystemPromptBuilder } from '../prompt/SystemPromptBuilder.js';
export type { PromptSection, BuiltPrompt } from '../prompt/SystemPromptBuilder.js';

export { ReactiveCompaction } from '../context/ReactiveCompaction.js';
export type {
  ContextSignal,
  DepthLevel,
  DepthAdjustment,
  PackedFile,
  AssembledContext,
  CompactionConfig,
} from '../context/ReactiveCompaction.js';

export { MemoryStore, MemoryExtractor } from '../memory/MemoryStore.js';
export type { Memory, MemoryType, ExtractedMemory } from '../memory/MemoryStore.js';

export { ContextCollapse } from '../context/ContextCollapse.js';
export type { ConversationTurn } from '../context/ContextCollapse.js';

export { ToolUseSummary } from '../context/ToolUseSummary.js';
export type { ToolCall, ToolCallGroup } from '../context/ToolUseSummary.js';

export { AgentSearch } from '../search/AgentSearch.js';
export type {
  AgentConfig as SearchableAgentConfig,
  KnowledgeSource,
  ScoredAgent,
  ScoredKnowledge,
} from '../search/AgentSearch.js';

// ── Phase 2: Lightweight adapters (src/adapters/) ──

export { buildCacheOptimizedPrompt } from '../adapters/systemPromptAdapter.js';
export { withReactiveCompaction as withReactiveCompactionAdapter } from '../adapters/reactivePackerAdapter.js';
export {
  getMemoryStore,
  createMemoryContextSection as createAdapterMemorySection,
  extractAndStoreMemories as extractAdapterMemories,
} from '../adapters/memoryAdapter.js';
export {
  compressToolOutputs,
  compressContext,
  createContextMiddleware as createAdapterContextMiddleware,
} from '../adapters/contextMiddleware.js';
export {
  createAgentSearchService as createAdapterSearchService,
  searchAgents,
  searchKnowledge,
} from '../adapters/searchAdapter.js';

// ── Phase 1 integration adapters (existing, in src/services/ & src/graph/) ──

export { buildSystemFrameWithBuilder } from '../services/systemFrameBuilderAdapter.js';
export type { SystemFrameInput } from '../services/systemFrameBuilderAdapter.js';
export { withReactiveCompaction } from '../graph/reactivePackerWrapper.js';
export type { ReactivePackerOptions } from '../graph/reactivePackerWrapper.js';
export { createMemoryContextSection, extractAndStoreMemories } from '../services/memoryStoreIntegration.js';
export { createContextMiddleware } from '../services/contextMiddleware.js';
export type { ContextMiddleware, ContextMiddlewareConfig } from '../services/contextMiddleware.js';
export { createAgentSearchService, toSearchableAgent } from '../services/agentSearchIntegration.js';
export type { AgentSearchService } from '../services/agentSearchIntegration.js';

// ── Phase 3: Pipeline wiring exports ──

export { buildSystemFrameOptimized } from '../services/systemFrameBuilder.js';
export { packContextReactive } from '../graph/packer.js';
export { assemblePipelineContext as assemblePipelineContextWithMemory } from '../services/contextAssembler.js';
