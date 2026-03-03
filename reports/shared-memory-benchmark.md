# Shared Memory Feature Efficiency Benchmark

Date: 2026-03-03T22:13:04.081Z
Repo: C:\Users\victo\AppData\Local\Temp\modular-patchbay

## Objective
Compare two agent contexts for discovering the **shared memory feature**:
1. Bare repository context (raw files)
2. Tree-indexed + feature-focused + RTK-inspired compressed context

## Setup
- Query terms: sharedFacts, addSharedFact, teamFacts, teamStore, runtimeStore, shared memory, memory exchange
- Required signals: sharedFacts, teamFacts, addSharedFact
- Compression: tokenBudget=20000, aggressiveness=0.45, dedup+filler+code compression

## Context Stats
- Bare corpus tokens: **527 293**
- Tree-indexed knowledge tokens (global docs): **7 135**
- Feature-focused indexed corpus tokens (before compression): **41 978**
- Feature-focused indexed compressed tokens: **19 960**
- Compression gain on focused corpus: **52.5%**
- Net context reduction vs bare: **96.2%**

## Agent Results
### Agent 1 — Bare repo
- Context tokens: 527 293
- Total term hits: 206
- Matched terms: sharedFacts, addSharedFact, teamFacts, teamStore, runtimeStore, shared memory, memory exchange
- Confidence (required signals): 100%

### Agent 2 — Indexed + compressed
- Context tokens: 19 960
- Total term hits: 23
- Matched terms: sharedFacts, addSharedFact, teamFacts, teamStore, shared memory, memory exchange
- Confidence (required signals): 100%

## Efficiency Summary
- Token efficiency improvement (bare -> indexed/compressed): **96.2% less context**
- Signal retention: bare=100%, indexed/compressed=100%
- Interpretation: feature-focused indexed/compressed path should reduce token load while preserving required shared-memory signals.

## Sample Evidence (Indexed/Compressed Agent)
1. ractContracts?: boolean; } export interface TeamRunResult {   teamId: string;   agentResults: AgentRunResult[];   sharedFacts: ExtractedFact[];   contractFacts: ExtractedFact[];   durationMs: number;   status: 'completed' | 'partial' | 'error'; } async function extractContractsFromSpec(
2. agentId: string;   name: string;   systemPrompt: string;   task: string;   providerId: string;   model: string;   teamFacts: ExtractedFact[];   maxTurns?: number;   tools?: ToolDef[];   /** GitHub repo URL — if set, gets tree-indexed and injected into context */   repoUrl?: string;   /**
3. 999,                     opacity: 0.7,                   }}                 />               </div> # REQUIRED-SIGNAL addSharedFact   const addSharedFact = useTeamStore((s) => s.addSharedFact);

## Next Study
Benchmark this approach against external system claims (same task, same repos, same signal requirements):
- context tokens needed
- retrieval latency
- signal retention
- actionability score
