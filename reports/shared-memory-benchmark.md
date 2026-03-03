# Shared Memory Feature Efficiency Benchmark

Date: 2026-03-03T22:25:18.211Z
Repo: C:\Users\victo\AppData\Local\Temp\modular-patchbay

## Objective
Compare two agent contexts for discovering the **shared memory feature**:
1. Bare repository context (raw files)
2. Tree-indexed + feature-focused + RTK-inspired compressed context

## Setup
- Query terms: sharedFacts, addSharedFact, teamFacts, teamStore, runtimeStore, shared memory, memory exchange
- Required signals: sharedFacts, teamFacts, addSharedFact
- Compression: tokenBudget=16000, aggressiveness=0.45, dedup+filler+code compression
- Packing: two-lane context (anchor lane + compressed background lane)

## Context Stats
- Bare corpus tokens: **527 293**
- Tree-indexed knowledge tokens (global docs): **7 487**
- Feature-focused indexed corpus tokens (before compression): **41 978**
- Feature-focused indexed compressed tokens: **15 974**
- Compression gain on focused corpus: **62.1%**
- Net context reduction vs bare: **97.0%**

## Agent Results
### Agent 1 — Bare repo
- Context tokens: 527 293
- Total term hits: 206
- Matched terms: sharedFacts, addSharedFact, teamFacts, teamStore, runtimeStore, shared memory, memory exchange
- Confidence (required signals): 100%

### Agent 2 — Indexed + compressed
- Context tokens: 15 974
- Total term hits: 21
- Matched terms: sharedFacts, addSharedFact, teamFacts, teamStore, shared memory
- Confidence (required signals): 100%

## Efficiency Summary
- Token efficiency improvement (bare -> indexed/compressed): **97.0% less context**
- Signal retention: bare=100%, indexed/compressed=100%
- Interpretation: feature-focused indexed/compressed path should reduce token load while preserving required shared-memory signals.

## Sample Evidence (Indexed/Compressed Agent)
1. # ANCHOR sharedFacts   sharedFacts: ExtractedFact[]; # ANCHOR teamFacts   teamFacts: ExtractedFact[]; # ANCHOR addSharedFact   const addSharedFact = useTeamStore((s) => s.addSharedFact)
2. # ANCHOR sharedFacts   sharedFacts: ExtractedFact[]; # ANCHOR teamFacts   teamFacts: ExtractedFact[]; # ANCHOR addSharedFact   const addSharedFact = useTeamStore((s) => s.addSharedFact); --- # FILE: docs/MEMORY-SYSTEM-ANALYSIS.md # Memory
3. # ANCHOR sharedFacts   sharedFacts: ExtractedFact[]; # ANCHOR teamFacts   teamFacts: ExtractedFact[]; # ANCHOR addSharedFact   const addSharedFact = useTeamStore((s) => s.addSharedFact); --- # FILE: docs/MEMORY-SYSTEM-ANALYSIS.md # Memory System Analysis *March 2026 — Modular Studio Des

## Next Study
Benchmark this approach against external system claims (same task, same repos, same signal requirements):
- context tokens needed
- retrieval latency
- signal retention
- actionability score
