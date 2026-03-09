# Plan V2: Epistemic Budget Allocator + Pipeline Evolution

> Generated: 2026-03-09 | Status: READY FOR EXECUTION
> Strategy: Haiku workers → Sonnet reviewers → Opus for heavy lifting
> Estimated: 12-15 days across 11 phases

---

## Execution Strategy: Agents All The Way Down

This plan implements context engineering improvements using context engineering techniques.
Each phase is designed for low-cost agent execution with quality gates.

### Agent Tiers

| Tier | Model | Role | Cost | When |
|------|-------|------|------|------|
| **Worker** | Haiku | Write code, tests, docs. Single-file focused tasks. | $$ | Default for all implementation |
| **Reviewer** | Sonnet | Code review, type-check, test verification, integration check. | $$$ | After every Worker commit |
| **Architect** | Opus | Design decisions, cross-file refactoring, debugging complex failures. | $$$$ | Only when Sonnet flags issues |

### Quality Gates (applied to every phase)

```
Worker (Haiku) writes code
  → npm run build (automated, must pass)
  → npm test (automated, must pass)
  → Reviewer (Sonnet) checks:
      1. Does it match the spec exactly?
      2. Are there edge cases missed?
      3. Does it integrate with existing code correctly?
      4. Any type safety issues?
  → If Reviewer rejects → Worker fixes (max 2 rounds)
  → If Worker fails twice → escalate to Opus
  → Merge
```

### Context Engineering for Agents

Each agent gets a task-specific context brief using the techniques from this plan:

1. **Ground Truth first**: The exact files to modify, with line numbers
2. **Framework block**: TypeScript interfaces, import paths, naming conventions
3. **Worked example**: A similar change already in the codebase
4. **Budget**: Keep prompt < 8K tokens. One file per task. No full-repo dumps.
5. **Anti-patterns**: Explicit list of what NOT to do (from past agent failures)

---

## Phase 1: Budget Allocator Core (2h)

### Goal
New module `src/services/budgetAllocator.ts` that allocates token budgets by Knowledge Type.

### Agent Brief (Worker - Haiku)

**Ground Truth (files to read):**
- `src/store/knowledgeBase.ts` lines 13-27 (KNOWLEDGE_TYPES definition)
- `src/services/knowledgePipeline.ts` lines 1-20 (imports + KnowledgeResult interface)

**Task:** Create `src/services/budgetAllocator.ts` (~100 lines)

```typescript
import { type KnowledgeType, KNOWLEDGE_TYPES } from '../store/knowledgeBase';

// Budget weight per knowledge type — epistemic value determines allocation
const TYPE_WEIGHTS: Record<KnowledgeType, number> = {
  'ground-truth': 0.30,
  'guideline':    0.15,
  'framework':    0.15,
  'evidence':     0.20,
  'signal':       0.12,
  'hypothesis':   0.08,
};

const MIN_BUDGET_FLOOR = 0.03; // Every source gets at least 3% of total budget

interface BudgetSource {
  name: string;
  knowledgeType: KnowledgeType;
  rawTokens: number;
  depthMultiplier?: number; // from UI depth slider: 0=1.5x, 1=1.2x, 2=1.0x, 3=0.6x, 4=0.2x
}

interface BudgetAllocation {
  name: string;
  knowledgeType: KnowledgeType;
  allocatedTokens: number;
  weight: number;
  cappedBySize: boolean;
}

export function allocateBudgets(
  sources: BudgetSource[],
  totalBudget: number,
): BudgetAllocation[];
```

**Algorithm (pseudocode):**
```
1. Group sources by knowledgeType
2. For each source:
   rawWeight = TYPE_WEIGHTS[type] / count(sources of same type)
   rawWeight *= depthMultiplier (default 1.0)
3. Apply MIN_BUDGET_FLOOR: max(rawWeight, MIN_BUDGET_FLOOR)
4. Normalize weights so they sum to 1.0
5. allocatedTokens = rawWeight × totalBudget
6. Cap: if source.rawTokens < allocatedTokens:
   cappedBySize = true
   excess = allocatedTokens - rawTokens
   redistribute excess proportionally to uncapped sources
7. Repeat redistribution max 3 rounds until stable
8. Return allocations sorted by knowledgeType priority
```

**Depth multiplier mapping (from existing UI slider):**
```typescript
const DEPTH_MULTIPLIERS: Record<number, number> = {
  0: 1.5,  // Full → user wants maximum detail
  1: 1.2,  // Detail
  2: 1.0,  // Summary (default)
  3: 0.6,  // Headlines → user wants less
  4: 0.2,  // Mention → minimal
};
```

**Anti-patterns:**
- Do NOT import from pipeline.ts or any UI stores
- Do NOT add LLM calls — this is pure math
- Do NOT use floating point equality checks
- Export DEPTH_MULTIPLIERS and TYPE_WEIGHTS (tests need them)

**Tests:** Create `tests/unit/budgetAllocator.test.ts`

| Test | Description |
|------|-------------|
| single source per type | Each gets its type weight × budget |
| 3 ground-truth sources | Budget split equally within type: 0.30/3 = 0.10 each |
| small source redistribution | 100-token source with 500-token allocation → 400 redistributed |
| MIN_BUDGET_FLOOR | A hypothesis source still gets ≥3% |
| all same type | Weights normalize to 1.0, equal split |
| empty sources array | Returns empty array, no crash |
| depth multiplier | depth=0 source gets 1.5× its type weight |
| mixed types realistic | 2 ground-truth + 3 signal + 1 evidence → verify allocations |
| redistribution converges | 3 rounds max, result is stable |

### Reviewer Checklist (Sonnet)
- [ ] TYPE_WEIGHTS values sum to 1.0
- [ ] MIN_BUDGET_FLOOR prevents starvation
- [ ] Redistribution converges (no infinite loop)
- [ ] All tests pass with exact numeric assertions (±1 token tolerance)
- [ ] No circular imports
- [ ] Exported types match what knowledgePipeline.ts will need

---

## Phase 2: Wire Allocator into Pipeline (2h)

### Goal
Replace global `totalBudget` with per-source budget caps from allocator.

### Agent Brief (Worker - Haiku)

**Ground Truth (files to read):**
- `src/services/budgetAllocator.ts` (Phase 1 output — read the exports)
- `src/services/knowledgePipeline.ts` (full file — this is where changes go)
- `src/services/pipeline.ts` lines 80-180 (completePipeline function)

**Changes to `knowledgePipeline.ts`:**

In `compressKnowledge()`, after building `sourcesWithContent` array (~line 120):

```typescript
// NEW: Allocate budgets by knowledge type
import { allocateBudgets, DEPTH_MULTIPLIERS } from './budgetAllocator';

const budgetSources = sourcesWithContent.map((src, i) => ({
  name: src.name,
  knowledgeType: (src.sourceType || 'evidence') as KnowledgeType,
  rawTokens: estimateTokens(src.content || ''),
  depthMultiplier: DEPTH_MULTIPLIERS[regularChannels[i]?.depth ?? 2],
}));

const allocations = allocateBudgets(budgetSources, totalBudget);
const budgetMap = new Map(allocations.map(a => [a.name, a.allocatedTokens]));
```

Then pass `budgetMap` to `completePipeline` or truncate each source's content to its budget before compression:

```typescript
// Truncate each source to its budget cap before compression
for (const src of sourcesWithContent) {
  const cap = budgetMap.get(src.name) ?? totalBudget;
  if (src.content && estimateTokens(src.content) > cap) {
    // Truncate to approximately cap tokens (rough: 4 chars/token)
    src.content = src.content.slice(0, cap * 4);
  }
}
```

**Anti-patterns:**
- Do NOT change the pipeline.ts API — just truncate inputs before calling it
- Do NOT remove the existing compression step — budget cap is pre-compression
- Do NOT break the metadata fallback path (when sourcesWithContent is empty)
- The `regularChannels[i]` index alignment is fragile — verify with a test

**Tests:** Add to existing pipeline tests or create `tests/unit/budget-wiring.test.ts`
- Source with 10K tokens + 2K budget → content truncated before compression
- Ground-truth source always gets ≥30% budget in a mixed pipeline
- Budget allocator trace event added to traceStore

### Reviewer Checklist (Sonnet)
- [ ] `regularChannels[i]` index aligns with `sourcesWithContent[i]` (channels without content are filtered out — index may drift!)
- [ ] Fallback path still works when no sources have content
- [ ] estimateTokens import already exists (from treeIndexer)
- [ ] No behavior change when all sources are small (budget > rawTokens)

---

## Phase 3: Simplify Depth → Budget Multiplier (1h)

### Goal
Remove depth filtering from the assembly path. The depth slider now only affects budget allocation (via DEPTH_MULTIPLIERS in Phase 1).

### Agent Brief (Worker - Haiku)

**Ground Truth:**
- `src/services/knowledgePipeline.ts` (modified in Phase 2)
- `src/services/contextAssembler.ts` lines 130-175 (knowledge assembly with depth filter)
- `src/utils/depthFilter.ts` (DO NOT DELETE — still used by treeNavigator)

**Changes to `knowledgePipeline.ts`:**

Replace depth-filtered source building:
```typescript
// OLD:
const filtered = applyDepthFilter(treeIndex, ch.depth);
const content = renderFilteredMarkdown(filtered.filtered);

// NEW:
const content = renderFullTree(treeIndex); // full content, budget allocator handles sizing
```

Create a simple `renderFullTree` helper that renders all tree content as markdown (no depth filtering). Or use `renderFilteredMarkdown` with depth=0 (Full).

**Changes to `contextAssembler.ts`:**

In `assembleContext()`, same change — remove `applyDepthFilter` from the knowledge section. The budget allocator (Phase 2) handles sizing.

**DO NOT:**
- Delete `depthFilter.ts` — treeNavigator uses it for headline extraction
- Remove DEPTH_LEVELS from knowledgeBase.ts — UI still shows the slider
- Break the inline content path (ch.content without tree index)

**Tests:**
- Existing tests that check depth filtering output may need updating
- Verify that rendering at depth=0 produces the same output as renderFullTree

### Reviewer Checklist (Sonnet)
- [ ] `applyDepthFilter` removed from assembly path only (not from navigation)
- [ ] `renderFilteredMarkdown` or equivalent still works for full content
- [ ] No unused imports left
- [ ] contextAssembler tests still pass

---

## Phase 4: Attention-Aware Ordering (30min)

### Goal
Reorder sources within `<knowledge>` by epistemic priority: ground-truth first (high attention zone), hypothesis in middle (low attention), evidence last (recency zone near user message).

### Agent Brief (Worker - Haiku)

**Ground Truth:**
- `src/services/contextAssembler.ts` — the `assemblePipelineContext()` function (~line 280)
- `src/store/knowledgeBase.ts` lines 13-22 (KNOWLEDGE_TYPES with type order)

**Change in `assemblePipelineContext()`:**

The `knowledgeBlock` string contains `<source>` tags. After it's built, reorder the source blocks:

```typescript
// Attention-aware ordering: ground-truth at start, hypothesis in middle, evidence at end
const ATTENTION_ORDER: Record<string, number> = {
  'ground-truth': 0,  // START — highest attention
  'guideline': 1,
  'framework': 2,
  'hypothesis': 3,    // MIDDLE — lowest attention (acceptable)
  'signal': 4,
  'evidence': 5,      // END — recency bias, high attention
};
```

Parse `<source>` blocks from knowledgeBlock, sort by ATTENTION_ORDER using the `type` attribute, rejoin.

**Anti-patterns:**
- Do NOT reorder non-knowledge sections (frame, orientation, etc. stay in their fixed order)
- Only reorder WITHIN `<knowledge>` — the assembly order frame→orientation→knowledge is preserved
- Handle the case where `type` attribute is missing (default to middle)

**Tests:** `tests/unit/attention-ordering.test.ts`
- 3 sources (hypothesis, ground-truth, evidence) → reordered to (ground-truth, hypothesis, evidence)
- Single source → unchanged
- No `<source>` tags → returns unchanged

### Reviewer Checklist (Sonnet)
- [ ] Only reorders within `<knowledge>`, not across sections
- [ ] Regex for `<source>` extraction is robust (handles multiline content)
- [ ] Attribution preserved (no content loss during reorder)

---

## Phase 5: Contradiction Detection (3h)

### Goal
Before assembling context from multiple sources, detect contradictions and resolve by epistemic priority.

### Agent Brief (Worker - Haiku, may escalate to Sonnet)

**Ground Truth:**
- `src/store/knowledgeBase.ts` KNOWLEDGE_TYPES (type priority order)
- `src/services/contextAssembler.ts` (where to insert the check)

**New file: `src/services/contradictionDetector.ts`** (~60 lines)

```typescript
interface SourceBlock {
  name: string;
  type: KnowledgeType;
  content: string;
}

interface ContradictionResult {
  sources: SourceBlock[];          // filtered sources (contradictions resolved)
  annotations: string[];           // human-readable notes about what was removed/flagged
  contradictionsFound: number;
}

export function resolveContradictions(sources: SourceBlock[]): ContradictionResult;
```

**Algorithm (simple heuristic, no LLM):**
1. For each pair of sources, check if they share entity names (simple noun overlap)
2. If two sources mention the same entity with different assertions:
   - Compare knowledge types: higher priority wins (ground-truth > evidence > signal > hypothesis)
   - Add annotation: `"Conflict: '{entityName}' — kept {winner.name} (${winner.type}), dropped {loser.name} (${loser.type})"`
3. If same priority: keep the source with more content (more context = more nuance)
4. If no contradictions detected: return sources unchanged

**Important:** This is a conservative heuristic — it catches obvious contradictions (same entity, different claims) but doesn't need an LLM. Phase 2 enhancement could add LLM-powered contradiction detection.

**Entity extraction (simple):** Extract capitalized multi-word phrases and technical terms:
```typescript
const entities = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
```

**Anti-patterns:**
- Do NOT add LLM calls — this must be fast and deterministic
- Do NOT remove sources silently — always add an annotation
- Do NOT modify source content — only filter the source list
- Keep it conservative: better to miss a contradiction than to remove valid content

**Tests:** `tests/unit/contradictionDetector.test.ts`
- No contradictions → sources unchanged
- Same entity, different types → lower priority removed
- Same entity, same type → larger source kept
- Empty sources → returns empty

### Reviewer Checklist (Sonnet)
- [ ] Conservative behavior — doesn't over-filter
- [ ] Annotations are informative
- [ ] No false positives on common words (filter out stopwords)
- [ ] Performance: O(n²) is fine for <20 sources

---

## Phase 6: Three-Factor Memory Retrieval (1-2 days)

### Goal
Replace simple text matching in fact retrieval with `score = relevance × recency × importance`.

### Agent Brief (Worker - Haiku)

**Ground Truth:**
- `server/services/factExtractor.ts` (existing fact extraction)
- Find the fact recall/retrieval function (likely in factExtractor.ts or a memory service)
- Check existing Fact interface and storage format

**Pre-work (Sonnet reads codebase):**
Before the Worker starts, Sonnet should identify:
1. Where facts are stored (JSON? Zustand store? File?)
2. Where facts are recalled (which function, which file)
3. Current Fact interface fields
4. How retrieval is currently scored

**Changes:**

Update the Fact interface (wherever it's defined):
```typescript
interface Fact {
  // existing fields...
  importance: number;      // 0.0-1.0, set at extraction time
  created_at: number;      // timestamp ms
  accessed_at: number;     // timestamp ms, updated on recall
  access_count: number;    // incremented on recall
}
```

Update the retrieval function:
```typescript
function scoreFact(fact: Fact, query: string, now: number): number {
  // Relevance: simple keyword overlap (no embeddings needed yet)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  const factTerms = fact.content.toLowerCase();
  const matchCount = queryTerms.filter(t => factTerms.includes(t)).length;
  const relevance = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;

  // Recency: exponential decay, half-life = 7 days
  const hoursSinceAccess = (now - fact.accessed_at) / (1000 * 60 * 60);
  const recency = Math.pow(0.99, hoursSinceAccess);

  // Importance: from extraction
  const importance = fact.importance || 0.5;

  return (1.0 * relevance) + (0.5 * recency) + (0.5 * importance);
}
```

On recall: update `accessed_at` and increment `access_count`.

**Anti-patterns:**
- Do NOT add embeddings or vector stores — simple keyword matching for now
- Do NOT change the fact extraction path — only the retrieval/scoring path
- Do NOT break existing fact display in the UI

**Tests:**
- Fresh important fact with keyword match → highest score
- Old unimportant fact without match → lowest score
- Accessed fact gets updated timestamps
- Empty query → all facts scored by recency × importance only

### Reviewer Checklist (Sonnet)
- [ ] Backward compatible: existing facts without new fields get defaults
- [ ] access_count and accessed_at are updated on retrieval
- [ ] Score formula weights are reasonable
- [ ] No performance issues with large fact stores (>1000 facts)

---

## Phase 7: Enhanced Fact Model + Temporal Decay (2-3 days)

### Goal
Add Ebbinghaus-style strength decay to facts. Facts that aren't accessed fade over time.

### Agent Brief (Worker - Haiku)

**Depends on:** Phase 6 (fact model with timestamps)

**Ground Truth:** Phase 6 output files + `server/services/factExtractor.ts`

**Add `strength` computation:**
```typescript
function computeStrength(fact: Fact, now: number): number {
  const daysSinceAccess = (now - fact.accessed_at) / (1000 * 60 * 60 * 24);
  // Ebbinghaus: strength decays exponentially, but access_count extends half-life
  const halfLife = 30 * (1 + Math.log2(1 + fact.access_count)); // 30, 60, 90... days
  return fact.importance * Math.exp(-daysSinceAccess / halfLife);
}
```

**Add maintenance function (called from heartbeat or cron):**
```typescript
export function consolidateMemory(facts: Fact[], now: number): {
  kept: Fact[];
  pruned: Fact[];
  merged: Fact[];
} {
  // 1. Compute strength for all facts
  // 2. Prune: strength < 0.05 → remove
  // 3. Merge: cosine similarity > 0.90 on content → keep the one with higher strength
  // 4. Promote: hypothesis facts with access_count > 3 AND importance > 0.7 → type = 'signal'
  return { kept, pruned, merged };
}
```

**Simple cosine similarity (no embeddings):**
```typescript
function textSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0; // Jaccard similarity
}
```

**Tests:**
- Fresh fact with high importance → strength ≈ importance
- Fact not accessed for 60 days, access_count=0 → strength < 0.15
- Fact not accessed for 60 days, access_count=5 → strength > 0.5 (extended half-life)
- Two near-duplicate facts → merged into one
- Hypothesis with high access → promoted to signal

### Reviewer Checklist (Sonnet)
- [ ] Strength formula produces sensible values across edge cases
- [ ] Pruning threshold (0.05) is conservative enough
- [ ] Merge doesn't lose important metadata
- [ ] Promotion has a clear audit trail (annotation added)

---

## Phase 8: Corrective Re-Navigation Loop (3-5 days)

### Goal
After initial navigation + assembly, run a self-critique pass to find gaps, then re-navigate to fill them.

### Agent Brief (Sonnet designs, Haiku implements)

**This is complex — Sonnet should design the architecture before Haiku writes code.**

**Ground Truth:**
- `src/services/knowledgePipeline.ts` — `compressKnowledge()` function
- `src/services/treeNavigator.ts` — navigation API
- `src/services/pipeline.ts` — `completePipeline()` function

**Architecture (Sonnet designs this):**

```
Pass 1 (existing): Query → Navigate → Assemble → Initial Context
Pass 2 (new):      Initial Context → Critique Prompt → LLM → Gap Analysis
Pass 3 (new):      Gap Query → Navigate (different branches) → Assemble → Supplement
Final:             Initial Context + Supplement = Enhanced Context
```

**Critique prompt template:**
```
You were given this context to answer: "{query}"

<context>
{initial_context}
</context>

What information is MISSING or UNCERTAIN that would improve your answer?
Reply with a JSON array of gap descriptions:
["need details on X configuration", "missing Y dependency info", ...]
```

**Key decisions (Sonnet resolves):**
1. Should the critique use a cheap model (Haiku) or the same model as navigation?
2. Budget for supplement: how many extra tokens? (suggest: 20% of remaining budget)
3. How to prevent infinite loops: max 1 re-navigation pass
4. How to merge initial + supplement without duplication

**Anti-patterns:**
- Do NOT run more than 1 re-navigation round (cost + latency)
- Do NOT let supplement exceed 20% of total budget
- Do NOT re-navigate branches already selected in Pass 1
- Make re-navigation OPTIONAL (feature flag or config)

**Tests:**
- Simple query → no gaps found → no re-navigation (fast path)
- Complex query → 2 gaps found → 2 new branches selected → supplement added
- Feature flag off → no re-navigation
- Budget exhausted → no re-navigation

### Reviewer Checklist (Sonnet)
- [ ] Latency acceptable: adds 1 LLM call + 1 navigation pass
- [ ] Budget accounting is correct (initial + supplement ≤ total)
- [ ] No duplicate branches between Pass 1 and Pass 3
- [ ] Feature flag works correctly
- [ ] Trace events added for observability

---

## Phase 9: HyDE Navigation (1-2 days)

### Goal
Generate a hypothetical "ideal answer section" before tree navigation to improve heading matching.

### Agent Brief (Worker - Haiku)

**Ground Truth:**
- `src/services/treeNavigator.ts` — `buildNavigationPrompt()` function
- `src/services/knowledgePipeline.ts` — where navigation is called

**New function in `treeNavigator.ts`:**
```typescript
export function buildHyDEQuery(userQuery: string): string {
  return `Imagine you are writing documentation that perfectly answers this question: "${userQuery}"

Write a 2-3 sentence passage that would answer it. Use technical terms and specific concepts.
Do NOT actually answer — just write what the ideal documentation section would say.`;
}
```

**Integration in `knowledgePipeline.ts`:**

Before calling `buildNavigationPrompt()`:
1. Call LLM with `buildHyDEQuery(userMessage)` → get hypothetical passage
2. Use hypothetical passage as the navigation query instead of raw userMessage
3. Fall back to raw query if HyDE call fails

**Anti-patterns:**
- Do NOT use HyDE for simple/short queries (< 10 words) — waste of an LLM call
- HyDE prompt must be SHORT (< 200 tokens)
- Fall back gracefully on failure
- Make it optional (config flag)

**Tests:**
- Short query (< 10 words) → skip HyDE, use raw query
- HyDE generates passage → used as navigation query
- HyDE call fails → falls back to raw query
- Feature flag off → no HyDE

---

## Phase 10: Reflection Engine (3-5 days)

### Goal
Periodically synthesize higher-order insights from accumulated facts.

### Agent Brief (Sonnet designs, Haiku implements)

**This is the highest long-term impact feature. Sonnet should design carefully.**

**Ground Truth:**
- Phase 6-7 output (enhanced fact model with strength/importance)
- `server/services/factExtractor.ts`

**New file: `server/services/reflectionEngine.ts`**

```typescript
interface ReflectionInput {
  facts: Fact[];
  domain: string;
  agentId: string;
}

interface Reflection {
  content: string;         // "Pattern: Victor's agents consistently need..."
  evidence_ids: string[];  // fact IDs that support this reflection
  confidence: number;
  created_at: number;
}

export async function generateReflections(
  input: ReflectionInput,
  llmCall: (prompt: string) => Promise<string>,
): Promise<Reflection[]>;
```

**Reflection prompt:**
```
Here are recent observations for the "{domain}" domain:

{facts formatted as bullet list with timestamps}

Based on these observations:
1. What patterns do you notice?
2. What higher-level insights can you derive?
3. What predictions or recommendations follow?

Generate 2-3 reflections. For each, cite the specific observations that support it.

Respond as JSON:
[{"content": "...", "evidence_ids": ["id1", "id2"], "confidence": 0.0-1.0}]
```

**Integration:**
- Called from a heartbeat task or server-side cron
- Reflections stored as facts with type='reflection' and importance=0.8
- Reflections are themselves recallable and can be reflected upon (meta-reflection)

**Guard rails:**
- Only reflect when sum(importance) of recent facts > 5.0 (enough material)
- Max 3 reflections per run
- Don't reflect on facts already reflected upon (track via evidence_ids)
- Use Haiku for reflection generation (cheap, sufficient)

**Tests:**
- < 3 facts → no reflections generated (not enough material)
- 10 facts with patterns → 2-3 reflections generated
- Reflections stored as facts with correct metadata
- Already-reflected facts are excluded from next run

---

## Phase 11: Update Competitive Docs (30min)

### Goal
Update positioning based on empirical findings.

### Agent Brief (Worker - Haiku)

**Files to modify:**
- `docs/competitive/COMPETITIVE_SYNTHESIS.md`
- `docs/knowledge-pipeline-format.md`

**Key messaging changes:**

Old:
> "5-level depth filtering for granular context control"

New:
> "Epistemic budget allocation — context budget distributed by knowledge reliability.
> Facts are never sacrificed for noise."

Old pipeline:
```
Source → Tree Index → Depth Filter → Compress → Assemble
```

New pipeline:
```
Source → Tree Index → Navigate → Budget Allocate → Compress → Contradiction Check → Attention Order → Assemble
```

Add to the "Unique IP" section:
- Epistemic Budget Allocator (empirically validated +5%)
- Contradiction Detection (prevents -39% performance cliff)
- Three-Factor Memory Retrieval (relevance × recency × importance)
- Reflection Engine (higher-order insight synthesis)

---

## Execution Schedule

### Week 1: Pipeline Core (Phases 1-5)

| Day | Phase | Worker | Reviewer | Notes |
|-----|-------|--------|----------|-------|
| 1 AM | Phase 1: Budget Allocator | Haiku | Sonnet | Pure logic + tests |
| 1 PM | Phase 2: Wire into pipeline | Haiku | Sonnet | Integration, index alignment is tricky |
| 2 AM | Phase 3: Simplify depth | Haiku | Sonnet | Remove depth filter from assembly |
| 2 PM | Phase 4: Attention ordering | Haiku | Sonnet | Quick, < 30 lines |
| 2 PM | Phase 5: Contradiction detection | Haiku | Sonnet | Heuristic, no LLM |

### Week 2: Memory System (Phases 6-7, 10)

| Day | Phase | Worker | Reviewer | Notes |
|-----|-------|--------|----------|-------|
| 3 | Phase 6: Three-factor retrieval | Haiku | Sonnet | Needs codebase scan first |
| 4 | Phase 7: Temporal decay | Haiku | Sonnet | Depends on Phase 6 |
| 5-6 | Phase 10: Reflection engine | Haiku writes, Sonnet designs | Opus if needed | Most complex |

### Week 3: Navigation Upgrades (Phases 8-9, 11)

| Day | Phase | Worker | Reviewer | Notes |
|-----|-------|--------|----------|-------|
| 7-8 | Phase 8: Corrective re-navigation | Sonnet designs, Haiku implements | Opus reviews | LLM integration |
| 9 | Phase 9: HyDE navigation | Haiku | Sonnet | Simple LLM call + fallback |
| 9 | Phase 11: Update docs | Haiku | — | Docs only |

---

## Dependencies Graph

```
Phase 1 (allocator) ──→ Phase 2 (wire) ──→ Phase 3 (simplify depth)
                                               │
Phase 4 (ordering) ←── independent             │
Phase 5 (contradictions) ←── independent       │
                                               ▼
Phase 6 (three-factor) ──→ Phase 7 (decay) ──→ Phase 10 (reflection)
                                               
Phase 8 (re-navigation) ←── independent (but after Phase 2)
Phase 9 (HyDE) ←── independent (but after Phase 2)
Phase 11 (docs) ←── after all phases
```

**Parallelizable:**
- Phase 1 + Phase 4 + Phase 5
- Phase 6 + Phase 8 (if Phase 2 is done)
- Phase 9 + Phase 7

---

## Cost Estimate

| Phase | Haiku tokens | Sonnet tokens | Opus tokens | Est. cost |
|-------|-------------|---------------|-------------|-----------|
| 1 | ~20K | ~5K | 0 | $0.02 |
| 2 | ~15K | ~8K | 0 | $0.03 |
| 3 | ~10K | ~5K | 0 | $0.02 |
| 4 | ~8K | ~3K | 0 | $0.01 |
| 5 | ~15K | ~5K | 0 | $0.02 |
| 6 | ~20K | ~10K | 0 | $0.04 |
| 7 | ~20K | ~10K | 0 | $0.04 |
| 8 | ~25K | ~15K | ~10K | $0.15 |
| 9 | ~15K | ~5K | 0 | $0.02 |
| 10 | ~25K | ~15K | ~10K | $0.15 |
| 11 | ~10K | 0 | 0 | $0.01 |
| **Total** | **~183K** | **~81K** | **~20K** | **~$0.50** |

*Estimate assumes Haiku at $0.25/M input, $1.25/M output; Sonnet at $3/$15; Opus at $15/$75.*
*Real cost may be 2-5× higher due to retries, context overhead, and tool calls.*

---

## Success Criteria

After all 11 phases:

1. **Budget allocator**: ground-truth sources always get ≥25% of total budget
2. **No depth filtering in assembly**: pipeline uses tree for navigation only
3. **Ordering**: ground-truth rendered first, hypothesis in middle, evidence last
4. **Contradictions**: conflicting sources resolved by epistemic priority
5. **Memory**: facts scored by relevance × recency × importance
6. **Decay**: unused facts naturally fade (strength < 0.05 after 90 days without access)
7. **Reflection**: periodic insights generated from accumulated facts
8. **Re-navigation**: complex queries get gap-filling second pass
9. **HyDE**: non-obvious queries get improved heading matching
10. **All 439+ tests pass, TypeScript build clean**
11. **Competitive docs updated with empirically-validated claims**
