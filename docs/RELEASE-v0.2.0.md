# Modular Studio v0.2.0 Release Notes

**The Context Intelligence Release** — Modular Studio now understands *what* knowledge matters, *how much* to include, and *when* sources conflict.

Released: 2026-03-09

---

## What's New

### Pipeline

#### Epistemic Budget Allocator
Token budgets are now distributed based on knowledge type, not just source count. Ground-truth sources (API specs, schemas) receive 30% of the budget, while hypotheses get 8%. Per-source caps prevent any single source from dominating, with automatic redistribution of excess across up to 3 rounds.

`src/services/budgetAllocator.ts`

| Knowledge Type | Budget Weight |
|---|---|
| Ground Truth | 30% |
| Evidence | 20% |
| Guideline | 15% |
| Framework | 15% |
| Signal | 12% |
| Hypothesis | 8% |

#### Depth Simplification
The 5-level depth filtering system has been simplified. The depth slider now acts as a **budget multiplier** rather than a content filter:

| Depth | Multiplier | Effect |
|---|---|---|
| 0 (Full) | 1.5x | Highest budget priority |
| 1 (Detail) | 1.2x | Above baseline |
| 2 (Summary) | 1.0x | Baseline |
| 3 (Headlines) | 0.6x | Reduced budget |
| 4 (Mention) | 0.2x | Minimal budget |

The tree index is preserved for navigation — depth no longer removes content from the tree, it adjusts how much budget a source receives.

`src/services/budgetAllocator.ts:25-31`

#### Attention-Aware Ordering
Sources within `<knowledge>` blocks are now reordered by epistemic priority to exploit LLM attention patterns:

1. **Ground Truth** (primacy position — highest attention)
2. Guideline
3. Framework
4. Hypothesis (middle — acceptable attention loss)
5. Signal
6. **Evidence** (recency position — benefits from end-of-context boost)

`src/services/contextAssembler.ts:402-490`

#### Contradiction Detection
When multiple sources reference the same entities, the system now detects and resolves contradictions without LLM calls:

- **Entity extraction**: Capitalized multi-word phrases (`/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g`)
- **Priority resolution**: Higher-authority knowledge types win (ground-truth > guideline > framework > evidence > signal > hypothesis)
- **Same-type conflicts**: Largest source by content length is kept
- **Audit trail**: Every resolution is tracked in annotations

`src/services/contradictionDetector.ts`

### Memory

#### Three-Factor Retrieval
Memory retrieval now scores facts using three weighted factors:

```
score = relevance + 0.5 × recency + 0.5 × importance
```

- **Relevance**: Jaccard similarity of word tokens between query and fact
- **Recency**: Exponential decay (`0.99^hours` since creation)
- **Importance**: `confidence × 0.8` (default) or explicit importance score

Retrieved facts get `accessed_at` timestamps and `access_count` incremented for future scoring.

`server/services/memoryScorer.ts:7-28`

#### Memory Consolidation
Periodic consolidation keeps the fact store healthy through three operations:

- **Prune**: Remove facts with strength < 0.05. Strength uses Ebbinghaus-inspired decay: `importance × e^(-days / halfLife)` where `halfLife = 30 × (1 + log₂(1 + accessCount))` days
- **Merge**: Facts with Jaccard text similarity > 0.7 are merged. Merged confidence = `min(0.95, avgConfidence + 0.05 × (groupSize - 1))`
- **Promote**: Hypotheses with `access_count > 3` and `confidence > 0.7` are promoted to observations with `+0.1` confidence boost

`server/services/memoryScorer.ts:54-187`

### Navigation

#### Corrective Re-Navigation
After initial context assembly, a critique pass identifies information gaps and re-navigates the tree to fill them:

1. LLM audits assembled context against the task
2. Identifies up to 3 missing information gaps
3. Re-navigates with a **20% budget cap** (`Math.floor(totalBudget * 0.2)`)
4. Already-selected nodes are filtered out
5. Failures are traced but never block the pipeline

`src/services/knowledgePipeline.ts`

#### HyDE Navigation
For complex queries (≥10 words), the system generates a hypothetical ideal answer *before* tree navigation. This hypothetical document improves heading matching accuracy by giving the navigator a richer query to work with.

- Activation: `query.split(/\s+/).length >= 10`
- Fallback: Original query used if HyDE generation fails
- No extra latency for short queries

`src/services/treeNavigator.ts`

### Runtime

#### Team Runtime API
Multi-agent execution via SSE streaming:

```
POST /api/runtime/team
Content-Type: application/json

{
  "teamId": "hurricane-response",
  "featureSpec": "Monitor and route vessels around storms",
  "agents": [...],
  "providerId": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "extractContracts": true
}
```

- Per-agent model override (`agent.model` takes precedence)
- Per-agent `maxTurns` (default: 100)
- Contract extraction from feature specs
- Cross-agent memory validation with fact pattern matching
- Parallel execution via `Promise.allSettled`
- Virtual `claude-agent-sdk` provider

`server/routes/runtime.ts`, `server/services/teamRunner.ts`

#### Team Client
Frontend SSE client with three functions:

| Function | Purpose |
|---|---|
| `startTeamRun(config, onEvent)` | Initiates SSE stream, returns abort handle |
| `getTeamStatus(teamId)` | Polls run status |
| `stopTeamRun(teamId)` | Sends stop request |

`src/services/teamClient.ts`

### UI

#### Marketplace Security Badges
Skills in the marketplace now display audit results from three security systems:
- **GEN** — Agent Trust Hub
- **SOC** — Socket
- **SNK** — Snyk

Results are cached for 30 minutes per skill.

`src/components/SecurityBadges.tsx`

---

## Breaking Changes

### Depth Slider Behavior
**Before (v0.1.0)**: The depth slider directly filtered content — depth 3 removed everything below H2 headings from the context.

**After (v0.2.0)**: The depth slider is a budget multiplier. Content is preserved in the tree index for navigation; depth affects how many tokens a source is allocated during budget distribution.

**Impact**: Agents that relied on depth filtering to exclude content sections will now see those sections included at reduced token budgets. The agent navigator handles relevance-based selection instead.

**Migration**: No code changes needed. If you were using depth=3 to exclude large sources, reduce the source's budget allocation or disable it instead.

---

## Migration Guide

### From v0.1.0 to v0.2.0

1. **Depth slider**: The slider still works — it now controls budget priority instead of content filtering. Depth 0 = 1.5x budget, Depth 4 = 0.2x budget.

2. **Knowledge types**: If you had sources without explicit knowledge types, they default to `evidence`. Review your sources and assign appropriate types for optimal budget allocation.

3. **Memory facts**: Existing facts will have `access_count = 0` and `importance = confidence × 0.8`. The consolidation system will begin pruning/merging on next run.

4. **Test count**: Test suite has grown from 241 to 509 tests. Run `npm test` to verify your environment.

---

## Performance

| Metric | v0.1.0 | v0.2.0 | Change |
|---|---|---|---|
| Context assembly (10 sources) | ~200ms | ~180ms | -10% (depth filter removal) |
| Memory retrieval (1000 facts) | Linear scan | Three-factor ranked | Scored + sorted |
| Contradiction detection | N/A | ~5ms per 10 sources | New capability |
| Navigation accuracy | Single pass | +20% budget for gaps | Higher relevance |
| Test coverage | 241 tests | 509 tests | +111% |

---

## Known Issues

1. **HyDE skip threshold**: Fixed at 10 words. Short but complex queries (e.g., "explain CII vs EEXI compliance") don't trigger HyDE despite benefiting from it.

2. **Contradiction detection**: Relies on capitalized multi-word phrase heuristic. Entities in lowercase or single-word form (e.g., "kubernetes", "React") are not detected.

3. **Memory consolidation**: No scheduled trigger — must be called manually or on pipeline run. Stale facts accumulate between sessions.

4. **Team runtime**: No built-in retry for failed agents in a team run. If one agent errors, its results are lost while others continue.

5. **Budget redistribution**: Capped at 3 rounds. In edge cases with many small sources, some excess may remain unallocated.

---

## What's Next (v0.3.0 Preview)

- **Streaming pipeline**: Real-time context assembly with progressive rendering
- **Embedding-based navigation**: Replace keyword matching with vector similarity for tree heading selection
- **Memory persistence**: SQLite-backed fact store with cross-session retention
- **Plugin system**: User-installable context boosters (custom compressors, rankers, validators)
- **Collaborative teams**: Multi-user team editing with shared agent configurations
- **Cost tracking**: Per-run token cost estimation and historical cost dashboard

---

*Context engineering is the layer every AI platform needs. Modular Studio is that layer.*
