# Knowledge Pipeline V2 — Make Knowledge Reach the Agent

## Problem
Knowledge sources (indexed GitHub repos, scanned files) are connected in the UI but don't effectively reach the agent at runtime. The agent can't see repo structure, file contents, or indexed knowledge — so it asks the user basic questions instead of exploring autonomously.

## Root Cause Analysis
1. **Channels without paths are invisible**: When repos are indexed via `/api/repo/index-github`, the generated knowledge docs are written to temp dirs. But channels created by the generator have `path: ''` — so `treeIndexStore.indexFiles()` skips them entirely.
2. **GitHub index results aren't wired to channels**: The repo index endpoint returns `overviewMarkdown`, `fullMarkdown`, `knowledgeDocs` — but this content never gets stored in a way that the pipeline chat can access it.
3. **No repo structure in system prompt**: Even when content exists, the agent doesn't get a "you have access to repo X with structure Y" orientation block.
4. **Retrieval during conversation is keyword-only**: `computeRelevance()` uses word overlap, missing most semantic matches.

## Architecture

```
                     ┌─────────────────────────┐
                     │   GitHub Repo Indexer    │
                     │  (shallow clone + scan)  │
                     └──────────┬──────────────┘
                                │ overviewMd + knowledgeDocs
                     ┌──────────▼──────────────┐
  NEW ──────────────▶│   Knowledge Store V2     │
                     │  (persisted to backend)  │
                     │  - repo summaries        │
                     │  - file trees            │
                     │  - indexed content       │
                     └──────────┬──────────────┘
                                │ content by sourceId
                     ┌──────────▼──────────────┐
                     │   Context Assembler V2   │
                     │  - orientation block     │
                     │  - depth-filtered content│
                     │  - auto-generated hints  │
                     └──────────┬──────────────┘
                                │ system prompt
                     ┌──────────▼──────────────┐
                     │   Pipeline Chat          │
                     │  (LLM call)              │
                     └──────────────────────────┘
```

---

## Phase 1 — Wire indexed content into agent context (P0)

### Ticket 1.1: Backend content store for indexed repos
**File**: `server/routes/knowledge.ts` + new `server/services/contentStore.ts`
- When `/api/repo/index-github` completes, persist the indexed content (overview, knowledge docs, scan metadata) keyed by sourceId
- New endpoint: `GET /api/knowledge/content/:sourceId` — returns stored content for a source
- Content is stored in `~/.modular-studio/content/` as JSON files (one per source)

### Ticket 1.2: Channels with content (not just paths)
**File**: `src/store/knowledgeBase.ts`, `src/store/consoleStore.ts`
- Extend `ChannelConfig` with optional `content?: string` and `repoMeta?: { name, stack, totalFiles, features }`
- When a GitHub repo is indexed in the UI, store the overview markdown directly on the channel
- Fallback chain: `content` → `path` (read from backend) → metadata-only reference

### Ticket 1.3: Orientation block in system prompt
**File**: `src/services/pipelineChat.ts`
- Before the `<knowledge>` section, inject an `<orientation>` block listing:
  - Connected repos with their tech stack, key features, file counts
  - Autonomous exploration instructions: "You have full access to these codebases. Explore file structures and read code before asking the user."
- Generated automatically from channel metadata — no manual config needed

### Ticket 1.4: Content-aware context assembly
**File**: `src/services/pipelineChat.ts`, `src/services/contextAssembler.ts`
- When a channel has `content` (from indexed repo), use it directly instead of trying to read from path
- Apply existing depth filter + tree indexer to the inline content
- Respect token budget: if total content exceeds budget, compress per depth settings

---

## Phase 2 — Auto-generate instructions from knowledge (P1)

### Ticket 2.1: Knowledge-aware instruction generation
**File**: `src/utils/generateAgent.ts`
- After the agent config is generated, if repos are connected, auto-append to the persona:
  - "You have deep knowledge of {repo names} ({tech stacks})"
  - "Key features: {feature list}"
  - "Explore the codebase autonomously — read files, check structure, trace dependencies before asking."
- This is additive to the user's persona, not a replacement

### Ticket 2.2: Auto-constraints from knowledge types
**File**: `src/utils/generateAgent.ts`
- If ground-truth sources exist: auto-add "Do not contradict information from {source names}"
- If signal sources exist: auto-add "Interpret user feedback — look for underlying needs"
- These map directly from KNOWLEDGE_TYPES.instruction

---

## Phase 3 — Semantic retrieval for runtime recall (P1)

### Ticket 3.1: Embedding-based fact recall
**File**: `src/services/memoryPipeline.ts`
- Replace `computeRelevance()` keyword matching with embedding cosine similarity
- Use provider's embedding model (configured in memoryStore.longTerm.embeddingModel)
- New backend endpoint: `POST /api/knowledge/embed` — compute embeddings via provider
- Cache embeddings alongside facts (compute on addFact, store in fact object)

### Ticket 3.2: Multi-granularity recall
**File**: `src/services/memoryPipeline.ts`
- Facts stored at 3 granularities: raw (full text), fact (extracted S-V-O), summary (episode)
- Recall pipeline: query → embed → search across all granularities → rank by relevance × recency
- Return mixed results: top facts + relevant episodes + raw context when needed

### Ticket 3.3: Intent-based recall routing
**File**: `src/services/memoryPipeline.ts`
- Before recall, classify query intent: needs-specific-fact vs needs-summary vs needs-raw-context
- Route to appropriate granularity first, expand only if score is below threshold
- Simple heuristic first (question words, specificity), can add LLM classification later

---

## Implementation Order
1. **Phase 1** (1.1 → 1.2 → 1.3 → 1.4) — sequential, each builds on previous
2. **Phase 2** (2.1, 2.2) — can run parallel after Phase 1
3. **Phase 3** (3.1 → 3.2 → 3.3) — sequential, independent of Phase 2

## Model Strategy
- **Planning + architecture**: Opus (this doc)
- **Phase 1 tickets**: Sonnet (straightforward wiring, file I/O)
- **Phase 2 tickets**: Sonnet (prompt engineering, template generation)
- **Phase 3 tickets**: Opus review after Sonnet implementation (retrieval quality is critical)
- **Integration testing**: Opus (verify end-to-end flow)
