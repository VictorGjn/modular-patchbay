# Integration Guide: Claude Code Patterns

This guide documents how to integrate the Claude Code–inspired features
into the existing Modular Patchbay pipeline. Each section identifies
the current integration point, the adapter to use, and a migration path.

---

## Architecture Overview

```
Existing Pipeline
  systemFrameBuilder → contextAssembler → packer → pipeline.ts
        |                |             |               |
   Prompt Adapter   Reactive Packer  Memory Adapter  Context Middleware
        |                |             |               |
   SystemPrompt     Reactive       MemoryStore     ContextCollapse +
   Builder          Compaction                     ToolUseSummary

   Phase 1 Features (standalone, zero modifications to existing code)
```

---

## 1. System Prompt Building

**Current code:** `src/services/systemFrameBuilder.ts` (line ~68)

The existing `buildSystemFrame()` and `buildSystemFrameOptimized()`
assemble identity, instructions, constraints, workflow, and tool guide
sections by reading from `useConsoleStore`. Sections are emitted as XML tags.

**Lightweight adapter:** `src/adapters/systemPromptAdapter.ts`

`buildCacheOptimizedPrompt()` provides a simple function interface that
automatically separates static sections (role, tools, instructions) from
dynamic sections (memory, context, conversation state) for optimal prompt
caching. Returns a cache breakpoint character index.

**Deep integration:** `src/services/systemFrameBuilderAdapter.ts`

`buildSystemFrameWithBuilder()` is the full-fidelity adapter that maps
all `SystemFrameInput` fields through SystemPromptBuilder. Already
wired into `buildSystemFrame()`.

**How to migrate:**

```typescript
// Before (manual string concatenation)
const prompt = buildSystemFrame();

// After (lightweight adapter)
import { buildCacheOptimizedPrompt } from './adapters/systemPromptAdapter';
const { fullText, cacheBreakpoint, staticTokens } = buildCacheOptimizedPrompt({
  role: agentMeta.persona,
  tools: toolGuide,
  memory: memorySection,
  context: contextSection,
});
```

---

## 2. Depth Packing / Context Assembly

**Current code:** `src/graph/packer.ts` (line ~83)

`packContext()` takes `TraversalResult` + `tokenBudget` and
assigns depth levels (0–4) based on relevance scores. Uses `depthFilter`
for tree-index-aware rendering.

**Lightweight adapter:** `src/adapters/reactivePackerAdapter.ts`

`withReactiveCompaction()` wraps any pack function with signal-driven
depth adjustments. Feed in `ContextSignal[]` (token_pressure,
hedging_detected, topic_shift, tool_heavy, error_recovery) to
automatically adjust depths at runtime.

**Deep integration:** `src/graph/reactivePackerWrapper.ts`

The existing `withReactiveCompaction()` in `reactivePackerWrapper.ts`
is already wired into `packContextReactive()` in `packer.ts` (line ~180).

**How to migrate:**

```typescript
import { withReactiveCompaction } from './adapters/reactivePackerAdapter';

const reactivePack = withReactiveCompaction(myPackFn, {
  pressureThreshold: 0.75,
});
const result = reactivePack(files, budget, 'full', [
  { type: 'token_pressure', ratio: 0.85 },
]);
```

---

## 3. Memory Persistence

**Current code:** `server/routes/memory.ts`, `server/services/memoryScorer.ts`

The server-side memory system uses SQLite-backed scoring. The frontend
has `src/store/memoryStore.ts` (Zustand) and `src/services/memoryPipeline.ts`.

**Lightweight adapter:** `src/adapters/memoryAdapter.ts`

`getMemoryStore()` provides singleton filesystem-backed MemoryStore.
`createMemoryContextSection()` generates a formatted section for injection
into system prompts. `extractAndStoreMemories()` extracts memories from
agent output using pattern-based MemoryExtractor.

**Deep integration:** `src/services/memoryStoreIntegration.ts`

Already wired into `contextAssembler.ts` via `assemblePipelineContextWithMemory()`.

**How to migrate:**

```typescript
import { getMemoryStore, createMemoryContextSection } from './adapters/memoryAdapter';

const memorySection = createMemoryContextSection(task, 2000);
builder.addDynamic('memory', memorySection);

// After agent run:
import { extractAndStoreMemories } from './adapters/memoryAdapter';
const count = extractAndStoreMemories(agentId, agentOutput);
```

---

## 4. Conversation & Tool Output Compression

**Current code:** `src/services/pipeline.ts` (line ~28)

`createContextMiddleware` is imported and optionally applied during pipeline
execution. Conversation history is in `src/services/pipelineChat.ts`.

**Lightweight adapter:** `src/adapters/contextMiddleware.ts`

Standalone functions:
- `compressToolOutputs(calls)` — summarizes tool call sequences
- `compressContext(content, type, maxTokens)` — generic compression
- `createContextMiddleware(config)` — middleware factory

**Deep integration:** `src/services/contextMiddleware.ts`

Full middleware pipeline with `processToolCalls`, `collapseConversation`,
`collapseCode`, and `collapse` dispatcher. Already imported in `pipeline.ts`.

**How to migrate:**

```typescript
import { createContextMiddleware } from './adapters/contextMiddleware';

const mw = createContextMiddleware({ maxToolTokens: 500 });
const collapsed = mw.processToolOutput('bash', longOutput);
const compressed = mw.processConversation(turns);
```

---

## 5. Agent & Knowledge Search

**Current code:** `server/services/agentStore.ts`, `server/routes/agents.ts`

Agent discovery uses the registry (`src/store/registry.ts`) with simple name/tag filtering.

**Lightweight adapter:** `src/adapters/searchAdapter.ts`

`createAgentSearchService(agents, knowledge)` builds a TF-IDF index.
`searchAgents(query)` and `searchKnowledge(query)` provide ranked results.

**Deep integration:** `src/services/agentSearchIntegration.ts`

Manages singleton with auto-reindex. `toSearchableAgent()` converts registry agents.

**How to migrate:**

```typescript
import { createAgentSearchService, searchAgents } from './adapters/searchAdapter';

createAgentSearchService(allAgents, allKnowledge);
const matches = searchAgents('maritime expert', 3);
```

---

## File Reference

| Layer | File | Purpose |
|-------|------|---------|
| **Feature** | `src/prompt/SystemPromptBuilder.ts` | Static/dynamic prompt sections |
| **Feature** | `src/context/ReactiveCompaction.ts` | Signal-driven depth adjustment |
| **Feature** | `src/memory/MemoryStore.ts` | Filesystem-backed memory |
| **Feature** | `src/context/ContextCollapse.ts` | Smart context compression |
| **Feature** | `src/context/ToolUseSummary.ts` | Tool call summarization |
| **Feature** | `src/search/AgentSearch.ts` | TF-IDF agent search |
| **Adapter** | `src/adapters/systemPromptAdapter.ts` | Prompt builder wrapper |
| **Adapter** | `src/adapters/reactivePackerAdapter.ts` | Packer wrapper |
| **Adapter** | `src/adapters/memoryAdapter.ts` | Memory store wrapper |
| **Adapter** | `src/adapters/contextMiddleware.ts` | Collapse + summary wrapper |
| **Adapter** | `src/adapters/searchAdapter.ts` | Agent search wrapper |
| **Integration** | `src/services/systemFrameBuilderAdapter.ts` | Full pipeline adapter |
| **Integration** | `src/graph/reactivePackerWrapper.ts` | Packer + reactive |
| **Integration** | `src/services/memoryStoreIntegration.ts` | Memory + pipeline |
| **Integration** | `src/services/contextMiddleware.ts` | Full middleware pipeline |
| **Integration** | `src/services/agentSearchIntegration.ts` | Search + registry |
| **Barrel** | `src/claude-code-patterns/index.ts` | All exports |
