# Plan: Epistemic Budget Allocator + Pipeline Simplification

> Generated: 2026-03-09 | Status: PLAN (not implemented)

## Context

Empirical benchmarks showed:
1. **Per-source budget caps = biggest win (+5%)**
2. **Depth filtering = complexity for marginal value** (useful for navigation, not assembly)
3. **Lost-in-the-Middle ordering = modest (+2.5%)**
4. **Compression defaults = already well-tuned**
5. **Tree indexing = valuable for navigation, not for pre-filtering assembly**

Key insight: **Knowledge Type System IS the budget allocator.** Ground truth should get more budget than hypothesis. This is epistemic-aware allocation — nobody else has it.

---

## Action Item 1: Epistemic Budget Allocator

### Concept

Replace equal token allocation across sources with weighted allocation based on Knowledge Type:

```
budget(source) = TOTAL_BUDGET 
                 × TYPE_WEIGHT[source.knowledgeType]
                 × (1 / count_of_same_type)
                 × relevance_boost(source, query)
```

### Type Weights

| Knowledge Type | Weight | Rationale |
|---------------|--------|-----------|
| ground-truth  | 0.35   | Source of truth — never starved, never contradicted |
| framework     | 0.15   | Constraints and rules — compact by nature, fixed budget |
| guideline     | 0.15   | Active constraints — similar to framework |
| evidence      | 0.20   | Data and analysis — proportional to relevance |
| signal        | 0.10   | User feedback — relevant but noisy, compressible |
| hypothesis    | 0.05   | Speculative — first to be truncated |

### `(1 / count_of_same_type)` factor

Prevents 10 signal sources from collectively consuming 100% of the signal budget.
Each source of type T gets: `TYPE_WEIGHT[T] / count(sources of type T)`.

### `relevance_boost(source, query)` factor

Optional Phase 2 enhancement. Simple keyword overlap score (0.5–1.5 multiplier):
- Count query terms that appear in source content headlines
- Normalize: boost = 0.5 + (matched_terms / total_terms)
- Ground truth always gets boost = 1.0 (never penalized)

### Files to modify

**New file: `src/services/budgetAllocator.ts`** (~80 lines)

```typescript
import { type KnowledgeType } from '../store/knowledgeBase';

const TYPE_WEIGHTS: Record<KnowledgeType, number> = {
  'ground-truth': 0.35,
  'framework':    0.15,
  'guideline':    0.15,
  'evidence':     0.20,
  'signal':       0.10,
  'hypothesis':   0.05,
};

interface BudgetSource {
  name: string;
  knowledgeType: KnowledgeType;
  rawTokens: number;      // estimated size before compression
  headlines?: string[];    // for relevance scoring
}

interface BudgetAllocation {
  name: string;
  knowledgeType: KnowledgeType;
  allocatedTokens: number; // max tokens this source should occupy
  weight: number;          // normalized weight (0-1)
  cappedBySize: boolean;   // true if raw content < allocated budget
}

export function allocateBudgets(
  sources: BudgetSource[],
  totalBudget: number,
  query?: string,
): BudgetAllocation[];
```

**Logic:**
1. Group sources by knowledgeType
2. For each source: `rawWeight = TYPE_WEIGHTS[type] / count(sources of same type)`
3. Normalize weights so they sum to 1.0
4. `allocatedTokens = rawWeight × totalBudget`
5. Cap: if source's rawTokens < allocatedTokens, redistribute excess to other sources
6. Iterate redistribution until stable (max 3 rounds)

**Modify: `src/services/knowledgePipeline.ts`**

In `compressKnowledge()`:
- After building `sourcesWithContent`, call `allocateBudgets()` to get per-source caps
- Pass per-source budgets to `completePipeline()` instead of global `totalBudget`
- Each source gets compressed to its own cap, not fighting for a shared pool

**Modify: `src/services/pipeline.ts`**

In `completePipeline()`:
- Accept optional `sourceBudgets?: Map<string, number>` parameter
- When assembling from navigation plan, truncate each source's content to its allocated budget
- Compress each source independently, then concatenate

**Modify: `src/store/knowledgeBase.ts`**

Add weight to `KNOWLEDGE_TYPES`:
```typescript
export const KNOWLEDGE_TYPES: Record<KnowledgeType, { 
  label: string; color: string; icon: string; instruction: string; 
  budgetWeight: number;  // NEW
}> = {
  'ground-truth': { ..., budgetWeight: 0.35 },
  'signal':       { ..., budgetWeight: 0.10 },
  'evidence':     { ..., budgetWeight: 0.20 },
  'framework':    { ..., budgetWeight: 0.15 },
  'hypothesis':   { ..., budgetWeight: 0.05 },
  'guideline':    { ..., budgetWeight: 0.15 },
};
```

### Tests

New file: `tests/unit/budgetAllocator.test.ts`

1. **Single source per type** → each gets its type weight × budget
2. **Multiple sources of same type** → budget split equally within type
3. **Small source redistribution** → excess goes to larger sources
4. **All ground-truth** → weight normalizes to 1.0 (entire budget)
5. **Empty sources** → skipped, budget redistributed
6. **Mixed types** → ground-truth always gets >= 35% of budget

---

## Action Item 2: Simplify Depth Filtering

### Concept

Remove depth levels (Full/Detail/Summary/Headlines/Mention) as a pre-filter for context assembly. Keep the tree for navigation only.

### Current flow (complex):
```
Source → Tree Index → Depth Filter (5 levels) → Render filtered → Compress → Assemble
```

### New flow (simple):
```
Source → Tree Index → Navigate (select branches) → Raw content → Budget Cap → Compress → Assemble
```

### Files to modify

**`src/services/knowledgePipeline.ts`**

In `compressKnowledge()`, the source building loop currently does:
```typescript
const filtered = applyDepthFilter(treeIndex, ch.depth);
const content = renderFilteredMarkdown(filtered.filtered);
```

Replace with:
```typescript
// Use tree for navigation (which branches), not depth (how much detail)
// Budget allocator controls how much content each source gets
const content = renderFullMarkdown(treeIndex); // full content
// Budget cap is applied during compression via allocateBudgets
```

**`src/services/contextAssembler.ts`**

Same change in the `assembleContext()` function — remove `applyDepthFilter` calls.

**DO NOT DELETE:**
- `src/utils/depthFilter.ts` — keep for now, used by treeNavigator for headline extraction
- `DEPTH_LEVELS` in knowledgeBase.ts — keep the type, remove from pipeline path
- The UI depth slider — can be repurposed later for "budget priority" slider

**Note:** The UI `ChannelConfig.depth` field (0-4) can be repurposed as a manual budget override:
- depth=0 (Full) → 1.5× type weight (user wants max detail)
- depth=1 (Detail) → 1.2× type weight
- depth=2 (Summary) → 1.0× type weight (default)
- depth=3 (Headlines) → 0.6× type weight
- depth=4 (Mention) → 0.2× type weight

This preserves the slider's purpose but reframes it as budget allocation, not content filtering.

### Tests to update

Any test that calls `applyDepthFilter` in the assembly path needs updating.
Tests for `depthFilter.ts` itself can stay (it's still used for navigation).

---

## Action Item 3: Keep Attention-Aware Ordering (+2.5%)

### Concept

Lost-in-the-Middle says: put important content at the START and END of context, less important in the middle.

### Implementation

In `assemblePipelineContext()` in `contextAssembler.ts`, order sources by knowledge type:

```
Position 1 (START): ground-truth sources   ← HIGH attention
Position 2:         framework/guideline     ← MEDIUM (short, rule-based)
Position 3 (MID):   signal/hypothesis       ← LOW attention (acceptable loss)
Position 4:         evidence                ← MEDIUM
Position 5 (END):   query-relevant sources  ← HIGH attention (recency bias)
```

### Files to modify

**`src/services/contextAssembler.ts`**

In `assemblePipelineContext()`:
- After all parts are assembled, reorder the `<knowledge>` block's internal `<source>` tags
- Ground truth first, hypothesis in the middle, evidence last (near the user message)

### Complexity: LOW (~20 lines)

This is just sorting the source blocks within `<knowledge>`. No changes to data flow.

---

## Action Item 4: No Changes to Compression

Compression in `src/services/compress.ts` is already well-tuned. No modifications needed.

Keep as-is. Revisit only if budget allocator reveals that per-source compression needs different aggressiveness levels per knowledge type. That would be a Phase 2 enhancement:
- ground-truth: aggressiveness=0.2 (preserve detail)
- signal: aggressiveness=0.7 (aggressive, keep gist)
- hypothesis: aggressiveness=0.8 (very aggressive)

---

## Action Item 5: Update Competitive Documentation

### Files to modify

**`docs/competitive/COMPETITIVE_SYNTHESIS.md`**

Update the positioning section:

Old pitch:
> "5-level depth filtering for granular context control"

New pitch:
> "Epistemic budget allocation — context budget is distributed by knowledge reliability. Facts are never sacrificed for noise."

Update the feature comparison tables to highlight:
- Knowledge Type System → Budget Engine (unique IP)
- Per-source budget caps (validated +5% improvement)
- No competitor has epistemic-aware allocation

**`docs/knowledge-pipeline-format.md`**

Update the pipeline description to reflect simplified flow:
```
Source → Tree Index → Navigate → Budget Allocate → Compress → Order → Assemble
```

Remove references to depth levels as assembly mechanism.

---

## Implementation Order

| Phase | Action | Files | Effort | Impact |
|-------|--------|-------|--------|--------|
| 1 | Budget Allocator | NEW `budgetAllocator.ts` + tests | 2h | HIGH (+5%) |
| 2 | Wire allocator into pipeline | `knowledgePipeline.ts`, `pipeline.ts` | 2h | HIGH |
| 3 | Simplify depth filtering | `knowledgePipeline.ts`, `contextAssembler.ts` | 1h | MEDIUM (simplification) |
| 4 | Attention ordering | `contextAssembler.ts` | 30min | LOW (+2.5%) |
| 5 | Repurpose depth slider | `knowledgeBase.ts`, UI components | 1h | LOW (UX) |
| 6 | Update docs | `COMPETITIVE_SYNTHESIS.md`, `knowledge-pipeline-format.md` | 30min | — |

**Total: ~7 hours of focused work**

### Dependencies
- Phase 2 depends on Phase 1 (needs allocator)
- Phase 3 depends on Phase 2 (needs per-source budgets to replace depth filtering)
- Phase 4 is independent
- Phase 5 depends on Phase 3 (slider semantics change)
- Phase 6 is independent

### Parallelizable
- Phase 1 + Phase 4 can run in parallel
- Phase 5 + Phase 6 can run in parallel

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Budget allocator over-starves signal sources | Medium | Low | Min floor: every source gets at least 5% of budget |
| Removing depth filter breaks edge cases | Low | Medium | Keep depthFilter.ts, gate behind feature flag |
| Reordering confuses models with structured prompts | Low | Low | Only reorder within `<knowledge>`, not across sections |
| Tests break from pipeline changes | Medium | Medium | Run full test suite after each phase |

---

## Success Metrics

After implementation, run the context engineering benchmark:
1. **Budget utilization**: each source should use 90-100% of its allocated budget (no waste)
2. **Type distribution**: ground-truth sources should never be compressed below 80% of their raw content
3. **Quality**: same or better benchmark scores vs current pipeline (regression test)
4. **Code reduction**: knowledgePipeline.ts should shrink by ~30% (simpler flow)
