# Sprint Plan: Insights/Facts Pipeline

> Date: 2026-03-02
> Goal: Build the fact extraction, promotion, and scoping system for Modular Studio

---

## What Letta's "Context Repositories" Does

Analyzed from `letta/services/memory_repo/` and `letta/schemas/block.py`:

### Blocks System
- **Blocks** = mutable text chunks injected into agent context windows
- Each block has: `value` (text), `label` (e.g. "persona", "human"), `limit` (char cap), `read_only` flag
- Agents can `core_memory_append`, `core_memory_replace` — tool calls that mutate their blocks
- Multiple agents can share the same block (via `BlocksAgents` join table)
- Block history tracked (audit trail of mutations)

### Memory Repository (Git-backed)
- `memory_repo/storage/` — local filesystem or cloud-backed storage
- `MemfsClient` — git-like versioning for memory state
- Allows rollback, branching of agent memory

### Multi-Agent Memory Sharing
- Blocks shared across agents in a group
- Supervisor agent can read/write shared blocks
- Round-robin agents each modify shared state in turn
- "Sleeptime" agents — background agents that process and compress memory

### Strengths
- ✅ Persistent, mutable, in-context memory
- ✅ Audit trail via block history
- ✅ Git-backed versioning
- ✅ Multi-agent block sharing

### Weaknesses
- ❌ Blocks are **untyped text** — no schema, no validation
- ❌ No epistemic classification (is this a fact? hypothesis? decision?)
- ❌ No scoping hierarchy — blocks are shared or not, no agent/team/global tiers
- ❌ No extraction pipeline — agents manually mutate blocks via tool calls
- ❌ No promotion/demotion lifecycle
- ❌ Text mutations are brittle (regex-replace on raw strings)

---

## How Our Fact System Compares

| Dimension | Letta Blocks | Modular Studio Facts |
|---|---|---|
| **Data Model** | Untyped text with label | Typed facts with `epistemicType` (observation, inference, decision, hypothesis) |
| **Scoping** | Shared or private (binary) | 3-tier: agentStore → teamStore → globalStore |
| **Mutation** | Agent tool calls (`core_memory_replace`) | Extraction pipeline + promotion workflow |
| **Injection** | Always in context window (by label) | Selective: facts injected based on relevance + scope |
| **Lifecycle** | Create → mutate → (no lifecycle) | Extract → validate → promote → consume → archive |
| **Versioning** | Block history table + git repo | TBD — should add |
| **Validation** | Char limit only | Schema validation + confidence scoring |
| **Multi-Agent** | Shared blocks in groups | teamStore facts readable by all team agents |

### Where Our Edge Is

1. **Epistemic Types** — A "decision" fact (we chose REST over GraphQL) is fundamentally different from an "observation" (the repo uses Express). Letta treats both as text in a block.

2. **Scoping Hierarchy** — Agent discovers something → stays in agentStore. Relevant to team → promoted to teamStore. Universal truth → globalStore. Letta has flat sharing.

3. **Extraction Pipeline** — Facts should be automatically extracted from agent outputs, not manually managed via tool calls. An agent writes code → pipeline extracts "created file src/api/hurricanes.ts" as an observation fact.

4. **Contract Facts** — A new epistemic type: `contract`. DTOs, API schemas, interface definitions. These are the lingua franca between agents. Letta has no concept of this.

5. **Tree-Indexed Context** — Facts about code structure come from tree indexing, not from agents guessing. "The repo has 3 API routes" is a structural fact, not an inference.

---

## Sprint Backlog: Facts/Insights Pipeline

### Sprint 1: Foundation (1 week)

| # | Task | Priority | Estimate |
|---|---|---|---|
| 1.1 | **Define Fact schema** — `{ id, key, value, epistemicType, scope, source, confidence, createdAt, promotedAt }` | P0 | 2h |
| 1.2 | **Implement 3-tier store** — agentStore, teamStore, globalStore in Zustand | P0 | 4h |
| 1.3 | **Fact injection into agent context** — when building LLM prompt, include relevant facts from agent's scope | P0 | 4h |
| 1.4 | **Manual fact creation UI** — user can add facts to any scope from sidebar | P1 | 3h |
| 1.5 | **Fact display in node inspector** — show facts read/written by each node | P1 | 3h |

### Sprint 2: Extraction Pipeline (1 week)

| # | Task | Priority | Estimate |
|---|---|---|---|
| 2.1 | **Output fact extractor** — post-process agent output to extract facts (LLM-based) | P0 | 6h |
| 2.2 | **Epistemic type classifier** — classify extracted facts as observation/inference/decision/hypothesis/contract | P0 | 4h |
| 2.3 | **Confidence scoring** — assign confidence based on source (tree-index = high, LLM inference = medium, user input = high) | P1 | 3h |
| 2.4 | **Fact deduplication** — detect when a new fact contradicts or supersedes an existing one | P1 | 4h |
| 2.5 | **Tree-index fact generation** — automatically create structural facts from tree indexing (e.g., "repo has src/api/ directory") | P0 | 4h |

### Sprint 3: Promotion & Multi-Agent (1 week)

| # | Task | Priority | Estimate |
|---|---|---|---|
| 3.1 | **Promotion workflow** — agent fact → team fact (manual or rule-based) | P0 | 4h |
| 3.2 | **Contract fact type** — special handling for DTO/API schemas, with schema validation | P0 | 6h |
| 3.3 | **Cross-node fact flow** — graph edges carry fact dependencies (node B needs facts from node A) | P0 | 6h |
| 3.4 | **Fact history/versioning** — track mutations, show diff in inspector | P1 | 4h |
| 3.5 | **Parallel agent fact isolation** — two agents running in parallel can read shared teamStore but write only to agentStore | P0 | 4h |

### Sprint 4: Integration & Polish (1 week)

| # | Task | Priority | Estimate |
|---|---|---|---|
| 4.1 | **Integration check node** — validates contract facts match implementation facts | P0 | 6h |
| 4.2 | **Fact-aware prompt builder** — intelligently select which facts to include based on token budget + relevance | P1 | 6h |
| 4.3 | **Fact export/import** — save fact sets as templates for reuse | P2 | 3h |
| 4.4 | **Fact conflict resolution UI** — when two agents produce conflicting facts, surface the conflict | P1 | 4h |
| 4.5 | **End-to-end demo** — hurricane feature across two repos using the full pipeline | P0 | 8h |

---

## Key Architectural Decisions

### 1. Facts vs. Blocks
We use **structured typed facts**, not Letta-style text blocks. Facts have schemas, epistemic types, confidence scores, and scoping. This is more complex to build but dramatically more useful for coding agents that need to share precise contracts.

### 2. Extraction is Automatic
Unlike Letta where agents manually call `core_memory_append`, our facts are extracted from agent outputs by a post-processing pipeline. The agent just codes; the system extracts knowledge.

### 3. Contracts are First-Class
A `contract` epistemic type with schema validation means DTOs aren't just text — they're validated, versioned artifacts that both agents can trust.

### 4. Tree Indexing Feeds Facts
Structural facts (file layout, module structure, existing APIs) come from tree indexing, not from agents exploring. This is ground truth, not inference.

### 5. Promotion is Explicit
Moving a fact from agentStore → teamStore is a deliberate act (manual or rule-triggered). This prevents one agent's hallucination from poisoning the shared context.

---

## Success Metric

The hurricane demo works:
1. User writes feature spec in a node
2. System extracts `HurricaneData` DTO as a contract fact
3. Backend agent implements API endpoint (reading contract from teamStore)
4. Frontend agent implements visualization (reading same contract)
5. Integration check validates contract compliance
6. Both agents never directly communicate — facts are the medium
