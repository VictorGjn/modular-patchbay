# Memory System Analysis

*March 2026 — Modular Studio Design-Time IDE*

---

## 1. Current State Assessment

### What Exists

**Store (`memoryStore.ts`):**
- `sessionMemory`: `maxMessages` (slider 5-100), `summarizeAfter`, `summarizeEnabled` toggle
- `longTermMemory`: flat array of `Fact` objects (id, content, tags[], timestamp)
- `workingMemory`: single string scratchpad
- Actions: addFact, removeFact, updateScratchpad, setSessionConfig

**UI (`MemoryNode.tsx` + `SourcesPanel.tsx` MemorySection):**
- Session: max messages range slider + summarize toggle/threshold
- Long-term: fact list with tags, add/remove
- Working: free-text scratchpad
- Generate button (AI-assisted config)

**Design Doc (`OUTPUT-AND-MEMORY-ARCHITECTURE.md`):**
- Defines 5 memory types (Session, Episodic, Semantic, Procedural, Working)
- Proposes YAML export with strategy, store config, recall settings, write modes
- Sketches Memory Node UI wireframe
- Defines memory vs knowledge distinction

### What's Missing

| Gap | Impact |
|-----|--------|
| **No session strategy picker** | Doc defines 4 strategies (full/sliding_window/summarize_and_recent/rag) but store only has summarize toggle |
| **No store/backend config** | Doc mentions local_sqlite/postgres/redis but store has no field for this |
| **No embedding model selection** | Critical for vector-based recall — not even mentioned in store |
| **No recall strategy config** | Doc defines top_k/threshold/hybrid but store doesn't model it |
| **No write mode config** | Doc defines auto_extract/explicit/both with extract_types — missing from store |
| **No memory scope** | per_user/per_agent/global — missing |
| **No token budget integration** | Memory competes with knowledge for context window — no budget fields |
| **No memory decay/TTL** | Doc mentions TTL but store doesn't implement it |
| **No episodic/procedural types** | Store has only session + facts + scratchpad — missing episodic and procedural from the doc's 5-type model |
| **No max_entries limit** | Doc mentions max_entries: 1000 but store has no limit |

**Summary:** The store implements ~30% of what the design doc specifies. The UI is even more minimal.

---

## 2. Competitor Analysis

### Claude Code (Anthropic)
- **CLAUDE.md files**: Hierarchical memory via project files (root → subfolder → local)
- **Session memory**: Full conversation history with compaction (summarize old turns)
- **No explicit long-term store**: Relies on file-system-as-memory pattern
- **Key insight**: Memory is *just files* — AGENTS.md, MEMORY.md, daily notes. Simple, composable, human-readable.

### OpenAI Agents SDK
- **Conversation history**: Passed as `messages[]` array — full context window management is on the developer
- **Tool call results**: Retained in conversation for multi-step reasoning
- **No built-in long-term memory**: Developers wire their own vector stores
- **Handoffs**: Memory passes between agents via conversation state
- **Key insight**: Minimal opinion on memory — maximum flexibility, minimum help.

### LangGraph (LangChain)
- **State**: Typed state object persisted across graph steps — the core primitive
- **Checkpointing**: Save/restore full graph state (memory + conversation + intermediate results)
- **MemorySaver**: In-memory checkpointer for dev; PostgresSaver/SQLiteSaver for prod
- **Message trimming**: `trim_messages()` utility for sliding window
- **Shared state**: Cross-thread memory via `Store` abstraction with namespace scoping
- **Key insight**: Memory = state. Everything is a checkpoint. Very powerful but complex.

### CrewAI
- **Short-term**: RAG over recent conversation (embeddings + similarity search)
- **Long-term**: Task results stored in SQLite, retrieved by relevance for future tasks
- **Entity memory**: Extracts and tracks entities (people, orgs, concepts) across interactions
- **Contextual**: Maintains per-task context with automatic summarization
- **Key insight**: Memory types map to cognitive categories. Entity extraction is unique and valuable.

### AutoGen (Microsoft)
- **Teachable agents**: Users can explicitly "teach" the agent facts that persist
- **Memory stores**: Pluggable backends (ChromaDB, Qdrant, etc.)
- **Transform messages**: Pipeline of message transformers (summarize, trim, filter) before sending to LLM
- **Shared memory**: Agents in a group chat share conversation state
- **Key insight**: Message transformation pipeline is brilliant — memory is a series of transforms on the conversation.

### Mem0 (standalone memory layer)
- **Automatic extraction**: LLM extracts memories from conversations without explicit instructions
- **Graph memory**: Entities and relationships stored as knowledge graph, not just flat facts
- **Conflict resolution**: When new info contradicts old, automatically resolves (update/merge/delete)
- **Multi-level**: User-level, agent-level, session-level scoping
- **Key insight**: Graph-based memory with conflict resolution is state-of-the-art for persistent memory.

### Synthesis for Modular Studio

Since Modular is **design-time** (we configure, not execute), we need to model all these patterns as configurable options that export to YAML. The designer picks the strategy; the runtime implements it.

---

## 3. Proposed Architecture

### 3.1 Store Shape

```typescript
// Session memory — how conversation history is managed
interface SessionMemoryConfig {
  strategy: 'full' | 'sliding_window' | 'summarize_and_recent' | 'rag';
  windowSize: number;           // messages to keep (sliding_window, summarize_and_recent)
  summarizeAfter: number;       // trigger point for summarization
  summaryModel: 'same' | 'fast'; // which model does summarization
  tokenBudget: number;          // max tokens allocated to session memory
}

// Long-term memory — persistent cross-session storage
interface LongTermMemoryConfig {
  enabled: boolean;
  store: 'local_sqlite' | 'postgres' | 'redis' | 'chromadb' | 'pinecone' | 'custom';
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large' | 'voyage-3' | 'custom';
  recall: {
    strategy: 'top_k' | 'threshold' | 'hybrid';
    k: number;
    minScore: number;
  };
  write: {
    mode: 'auto_extract' | 'explicit' | 'both';
    extractTypes: Array<'user_preferences' | 'decisions' | 'facts' | 'feedback' | 'entities'>;
  };
  scope: 'per_user' | 'per_agent' | 'global';
  maxEntries: number;
  ttl: string | null;           // null = forever, "30d", "1y"
  tokenBudget: number;          // max tokens for recalled memories in prompt
}

// Working memory — task-scoped scratchpad
interface WorkingMemoryConfig {
  enabled: boolean;
  maxTokens: number;
  persist: boolean;
  format: 'json' | 'markdown' | 'freeform';
  tokenBudget: number;
}

// Design-time facts (seeded knowledge the agent starts with)
interface Fact {
  id: string;
  content: string;
  tags: string[];
  type: 'preference' | 'decision' | 'fact' | 'entity' | 'custom';
  timestamp: number;
}

// Complete memory state
interface MemoryState {
  session: SessionMemoryConfig;
  longTerm: LongTermMemoryConfig;
  working: WorkingMemoryConfig;
  facts: Fact[];              // design-time seeded facts
  totalTokenBudget: number;   // total tokens allocated to all memory
}
```

### 3.2 Token Budget Integration

Memory competes with Knowledge, Instructions, and Workflow for the context window.

```
┌─────────────────────────────────────────────────┐
│  Model Context Window: 128K tokens              │
│                                                 │
│  ┌─ Instructions ──────────┐  ~8K (fixed)       │
│  ├─ Knowledge ─────────────┤  ~40K (depth mixer)│
│  ├─ Memory (session) ──────┤  ~20K (configurable)│
│  ├─ Memory (long-term) ────┤  ~5K (recall budget)│
│  ├─ Memory (working) ──────┤  ~2K (scratchpad)  │
│  ├─ Tools/MCP schemas ─────┤  ~8K (auto)        │
│  ├─ Output schemas ────────┤  ~2K (auto)        │
│  └─ Reserved (response) ───┘  ~43K (remainder)  │
└─────────────────────────────────────────────────┘
```

The Context Budget Visualizer shows this breakdown. When memory budget increases, knowledge budget must decrease (or the user picks a bigger model). The store tracks `totalTokenBudget` and each sub-budget.

The Knowledge Depth Mixer's 5 levels interact directly: if memory takes 25K tokens, knowledge sources auto-suggest depth reductions to fit. The UI shows warnings.

### 3.3 YAML Export Format

```yaml
memory:
  session:
    strategy: summarize_and_recent
    window_size: 20
    summarize_after: 10
    summary_model: fast
    token_budget: 20000
  long_term:
    enabled: true
    store: local_sqlite
    embedding_model: text-embedding-3-small
    recall:
      strategy: top_k
      k: 5
      min_score: 0.7
    write:
      mode: auto_extract
      extract_types:
        - user_preferences
        - decisions
        - facts
        - entities
    scope: per_user
    max_entries: 1000
    ttl: null
    token_budget: 5000
    seed_facts:
      - content: "User prefers concise responses"
        type: preference
        tags: [style]
      - content: "Company uses React + TypeScript"
        type: fact
        tags: [tech-stack]
  working:
    enabled: true
    max_tokens: 2000
    persist: false
    format: json
    token_budget: 2000
```

### 3.4 UI Components

The MemorySection in SourcesPanel gets significantly richer. Key additions:

1. **Strategy selector** (Select dropdown for session strategy)
2. **Store backend selector** (Select for long-term store type)
3. **Embedding model selector** (Select)
4. **Recall config** (strategy + k slider + min_score slider)
5. **Write mode config** (mode select + extract type chips)
6. **Scope selector** (Select)
7. **Token budget sliders** per memory type
8. **Fact type badges** (color-coded by type)
9. **TTL config** (optional expiry)
10. **Budget allocation mini-bar** (like Knowledge section's context allocation)

---

## 4. Implementation Plan

### Priority 1 — Store Redesign (memoryStore.ts)
- Expand store to match proposed architecture
- Add all missing config fields with sensible defaults
- Add YAML export method
- **File:** `src/store/memoryStore.ts`

### Priority 2 — MemorySection UI (SourcesPanel.tsx)
- Strategy picker, store selector, recall config
- Token budget sliders with allocation bar
- Fact type system with colored badges
- Write mode and scope selectors
- **File:** `src/panels/SourcesPanel.tsx` (MemorySection)

### Priority 3 — MemoryNode Update
- Sync MemoryNode.tsx with new store shape
- Add strategy selector, budget display
- **File:** `src/nodes/MemoryNode.tsx`

### Priority 4 — Context Budget Integration
- Wire memory token budgets into the Context Budget Visualizer
- Show memory vs knowledge trade-offs
- Add warnings when total exceeds model limit
- **File:** `src/store/consoleStore.ts` (budget calculations)

### Priority 5 — YAML Export
- Add memory section to the YAML export pipeline
- Include seed facts, all config
- **File:** `src/utils/exportYaml.ts`

---

*Memory is what separates a tool from an assistant. The design-time config is what separates a framework from an IDE.*
