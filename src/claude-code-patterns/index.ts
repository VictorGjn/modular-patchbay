/**
 * Claude Code Patterns — barrel export for all Phase 1 features.
 *
 * Clean API surface for integrating context engineering patterns
 * inspired by Claude Code into the Modular Patchbay pipeline.
 */

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

// Integration adapters
export { buildSystemFrameWithBuilder } from '../services/systemFrameBuilderAdapter.js';
export type { SystemFrameInput } from '../services/systemFrameBuilderAdapter.js';
export { withReactiveCompaction } from '../graph/reactivePackerWrapper.js';
export type { ReactivePackerOptions } from '../graph/reactivePackerWrapper.js';
export { createMemoryContextSection, extractAndStoreMemories } from '../services/memoryStoreIntegration.js';
export { createContextMiddleware } from '../services/contextMiddleware.js';
export type { ContextMiddleware, ContextMiddlewareConfig } from '../services/contextMiddleware.js';
export { createAgentSearchService, toSearchableAgent } from '../services/agentSearchIntegration.js';
export type { AgentSearchService } from '../services/agentSearchIntegration.js';
