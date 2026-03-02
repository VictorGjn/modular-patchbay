# Multi-Agent Orchestration Research for Modular Studio

> Research date: 2026-03-02
> Focus: Two coding agents collaborating across repos on a shared feature

## The Use Case

Backend agent (repo A) defines a hurricane API + DTO. Frontend agent (repo B) consumes that DTO and renders hurricane visualization. They must agree on the contract and coordinate execution.

---

## Framework Comparison

| Dimension | AutoGen (Microsoft) | LangGraph (LangChain) | CrewAI | Letta |
|---|---|---|---|---|
| **Communication** | Pub/sub via `TopicId` + direct `send_message` to `AgentId`. CloudEvents-style topics with type/source. | Shared state graph — nodes read/write to typed `State` channels. No direct agent-to-agent messaging. | Sequential task handoff — each task output becomes next task's context. Event bus for side-effects. | Shared memory **blocks** with labels (e.g. "persona", "human"). Agents read/write blocks in their context window. Multi-agent groups via supervisor/round-robin. |
| **Shared Context** | No built-in shared memory. Agents share context only through messages. `task_centric_memory` sample exists but is experimental. | **State is the shared context.** Every node reads from and writes to a typed state dict. Channels handle merge semantics (last-value, append, barrier). Checkpointed. | Memory system with scopes: short-term (task), long-term (cross-crew), entity memory. LanceDB-backed embeddings. LLM-analyzed memory encoding. | **Blocks are the killer feature.** Mutable text blocks in agent context windows. Multiple agents can share the same block (e.g. a "project_spec" block). Block manager handles CRUD + history. Git-backed memory repo for versioning. |
| **Coordination Model** | Flexible: `SingleThreadedAgentRuntime` for local, gRPC worker runtime for distributed. Subscriptions route messages. Teams (e.g. MagenticOne) use orchestrator patterns. | **Graph-based.** Nodes = agent steps, edges = transitions. Conditional edges for routing. Supports parallel branches via fan-out. `Command` type for dynamic routing. | `Process.sequential` or `Process.hierarchical`. Sequential = chain. Hierarchical = manager agent delegates. No graph, no parallel execution. | Groups: round-robin, supervisor, dynamic, "sleeptime" (agents decide when to wake). Supervisor pattern = one agent routes to others via tool calls. |
| **Execution Model** | Async event-driven. Agents are actors with message handlers. Runtime manages delivery. Can be distributed across processes via gRPC. | DAG execution via Pregel engine. Each "superstep" processes nodes in parallel where possible. Checkpointing between steps. Supports streaming, interrupts, human-in-the-loop. | Synchronous task chain. Each task runs to completion before next starts. `kickoff()` blocks. Async variant exists but is a wrapper. | Step-based agent loop. Each agent has a `step()` that processes messages, calls tools, updates blocks. Groups orchestrate multi-step conversations. |
| **Strengths for Cross-Repo Coding** | ✅ True actor model — agents can be in different processes/machines. ✅ Topic-based routing maps well to "backend publishes DTO → frontend subscribes". ✅ Distributed runtime exists. | ✅ Typed state = natural contract surface. ✅ Checkpointing = resumable. ✅ Parallel branches = backend/frontend can run simultaneously. ❌ But state is in-process, not cross-repo. | ❌ Too linear. Sequential/hierarchical doesn't map to parallel cross-repo work. ✅ Memory system is interesting for knowledge retention. | ✅ Shared blocks = closest to "shared facts". ✅ Block history = audit trail. ✅ Git-backed memory repo. ❌ Blocks are text, not structured contracts. |
| **Weaknesses for Cross-Repo Coding** | ❌ No built-in shared state/memory. ❌ Messages are fire-and-forget or request-response — no persistent shared context. ❌ No code-awareness. | ❌ Single-process state graph. ❌ No native code understanding. ❌ State merging logic is channel-based, not fact-based. | ❌ No parallel execution. ❌ No structured contract sharing. ❌ Memory is retrieval-based, not live-shared. | ❌ No code-awareness or repo understanding. ❌ Block updates are text mutations, not structured diffs. ❌ Multi-agent is still early (most code is commented out). |

### Bloop (BloopAI)
- **Status:** Archived/deprecated. Was a code search engine with AI agents.
- **Relevance:** Demonstrated that code search + embeddings + agent Q&A over repos is valuable. Their approach: index code → semantic search → LLM answers questions about code.
- **Lesson for us:** Code-aware agents need tree-structured indexing (which we already have), not just embedding search.

---

## Architecture Patterns That Work for Coding Agents

### Pattern 1: Shared State Graph (LangGraph-style)
```
[Feature Spec] → [Backend Node] → [Contract State] → [Frontend Node] → [Integration Check]
                        ↑                                     ↑
                        └──── shared typed state ─────────────┘
```
- State = the DTO contract + implementation status
- Each node reads state, does work, writes back
- **Problem:** Single process. Not how real coding works across repos.

### Pattern 2: Pub/Sub with Contract Topics (AutoGen-style)
```
[Orchestrator]
    ├── publish("contract.defined", DTO schema) → TopicId("contract", "hurricane-feature")
    ├── Backend Agent subscribes → implements API → publishes "contract.implemented.backend"
    └── Frontend Agent subscribes → implements UI → publishes "contract.implemented.frontend"
```
- Distributed, async, event-driven
- **Problem:** No persistent shared context. Contract lives only in messages.

### Pattern 3: Shared Memory Blocks (Letta-style)
```
Block: "hurricane-dto" (shared by both agents)
  value: "{ lat: number, lon: number, category: 1-5, windSpeed: number, ... }"

Backend Agent: reads block → implements API → updates block with endpoint info
Frontend Agent: reads block → implements components → updates block with component status
```
- Persistent, mutable, labeled context
- **Problem:** Text-based, no type checking, no structured merge.

### Pattern 4: What Modular Studio Should Do — **Fact-Mediated Contract Graph**
```
[Feature Spec Node]
    │
    ├── extracts → Fact: "DTO:HurricaneData" (type: contract, scope: team)
    │               { lat: number, lon: number, category: 1-5, windSpeed: number }
    │
    ├── [Backend Agent Node]
    │     context: tree-index of backend repo (depth-filtered)
    │     reads: Fact "DTO:HurricaneData" (from teamStore)
    │     produces: API implementation + Fact "Endpoint:/api/hurricanes" (type: implementation)
    │
    └── [Frontend Agent Node]
          context: tree-index of frontend repo (depth-filtered)
          reads: Fact "DTO:HurricaneData" + Fact "Endpoint:/api/hurricanes"
          produces: React components consuming the DTO
```

---

## Our Edge

What Modular Studio already has that none of these frameworks do:

| Capability | Us | AutoGen | LangGraph | CrewAI | Letta |
|---|---|---|---|---|---|
| **Tree indexing of repos** | ✅ depth-filtered, token-aware | ❌ | ❌ | ❌ | ❌ |
| **Structured facts with epistemic types** | ✅ (observation/inference/decision/hypothesis) | ❌ | ❌ | ❌ | ❌ (blocks are untyped text) |
| **Per-agent / per-team / global scoping** | ✅ agentStore/teamStore/globalStore | ❌ | Partial (state is shared) | Partial (memory scopes) | Partial (blocks can be shared) |
| **Visual graph editor** | ✅ React Flow canvas | ❌ (code only) | ❌ (code only) | ❌ | ❌ |
| **Code-aware context** | ✅ tree index = structural understanding | ❌ | ❌ | ❌ | ❌ |

---

## Proposed Architecture for Modular Studio Runtime

### Core Concept: **Contract-First Multi-Agent Execution**

```
┌─────────────────────────────────────────────────────────────┐
│                    MODULAR STUDIO CANVAS                     │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Feature   │───▶│ Contract     │───▶│ Execution    │       │
│  │ Spec Node │    │ Extract Node │    │ Splitter     │       │
│  └──────────┘    └──────────────┘    └──────┬───────┘       │
│                                        ┌────┴────┐          │
│                                   ┌────▼───┐ ┌───▼────┐    │
│                                   │Backend │ │Frontend│    │
│                                   │Agent   │ │Agent   │    │
│                                   │Node    │ │Node    │    │
│                                   └────┬───┘ └───┬────┘    │
│                                        └────┬────┘          │
│                                        ┌────▼───────┐       │
│                                        │Integration │       │
│                                        │Check Node  │       │
│                                        └────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Runtime Components

1. **Feature Spec Node** — User writes natural language feature description
2. **Contract Extract Node** — LLM extracts structured DTO/API contracts → promotes to teamStore as typed facts
3. **Execution Splitter** — Routes to parallel agent nodes based on contract
4. **Agent Nodes** — Each gets:
   - Tree-indexed view of their repo (depth-filtered)
   - Contract facts from teamStore (read-only)
   - Own agentStore for implementation notes
   - Tool access: file read/write, terminal, git
5. **Integration Check Node** — Validates contract compliance across implementations

### The Shared Feature Spec → DTO Contract → Cross-Repo Execution Flow

```
1. USER creates Feature Spec:
   "Add hurricane visualization. Backend fetches from NOAA API,
    frontend renders on Mapbox with category-colored markers."

2. CONTRACT EXTRACTION (automatic):
   Fact: { type: "contract", key: "HurricaneData",
           schema: { id, lat, lon, category, windSpeed, name, timestamp },
           scope: "team" }
   Fact: { type: "contract", key: "GET /api/hurricanes",
           response: "HurricaneData[]",
           scope: "team" }

3. BACKEND AGENT receives:
   - Contract facts (what to implement)
   - Tree index of backend repo at depth 2 (understand structure)
   - Deeper index of relevant dirs (e.g., src/api/, src/models/)
   - Instruction: "Implement the hurricane API endpoint matching this contract"

4. FRONTEND AGENT receives (in parallel):
   - Same contract facts
   - Tree index of frontend repo at depth 2
   - Deeper index of src/components/, src/services/
   - Instruction: "Implement hurricane visualization consuming this API contract"

5. INTEGRATION CHECK:
   - Backend agent promotes Fact: "endpoint.implemented: GET /api/hurricanes ✓"
   - Frontend agent promotes Fact: "component.implemented: HurricaneMap ✓"
   - Integration node validates: types match? endpoint consumed correctly?
   - If mismatch → feeds back to agents with specific diff
```

### Key Design Decisions

1. **Facts are the contract layer** — Not messages, not shared text blocks. Typed, scoped, promotable facts with epistemic types.
2. **Tree indexing is the code awareness** — Agents don't need embeddings. They need structural understanding: "this repo has src/api/hurricanes.ts and src/models/Hurricane.ts."
3. **Parallel execution with shared reads** — Both agents can read teamStore facts simultaneously. Only write to their own agentStore. Contract facts are immutable once promoted.
4. **Integration node is the sync point** — Like a CI check but semantic. Did the backend actually return `HurricaneData[]`? Does the frontend actually call `/api/hurricanes`?

### What to Build (Priority Order)

1. **teamStore with fact promotion** — Agent nodes can read team-scoped facts
2. **Parallel execution in graph** — Two agent nodes run simultaneously
3. **Contract extraction node type** — Specialized node that parses feature specs into typed contracts
4. **Integration check node type** — Validates cross-agent implementation consistency
5. **Cross-repo tree indexing** — Multiple repos indexed, each agent gets their repo's tree

---

## Comparison: What Each Framework Got Right

| Insight | Source | Apply to Modular Studio |
|---|---|---|
| Actor model with topic routing | AutoGen | Good for distributed execution. Our graph edges already define routing. |
| Typed state channels with merge semantics | LangGraph | Our fact stores need merge policies (last-write-wins vs. append vs. conflict). |
| Memory scoping (short/long/entity) | CrewAI | Validates our 3-tier scoping (agent/team/global). |
| Mutable shared blocks in context window | Letta | Our facts should be injectable into agent context, not just retrievable. |
| Code search + structural indexing | Bloop (RIP) | Our tree indexing is the evolution of this. Structure > embeddings for code. |
| Git-backed memory versioning | Letta memory_repo | Facts should have history/versioning. |

---

## TL;DR

No existing framework solves "two coding agents, two repos, one feature." They're all either:
- **Chat-oriented** (AutoGen, Letta) — agents talk to each other, not build code together
- **Pipeline-oriented** (CrewAI, LangGraph) — sequential/graph processing, no code awareness
- **Dead** (Bloop) — had the right idea about code search but wrong execution

**Modular Studio's edge is the combination of:**
1. Tree-indexed code awareness (none of them have this)
2. Typed facts with scoping (Letta has blocks, but untyped)
3. Visual graph editor (none of them have this)
4. Contract-first execution model (novel — treat DTOs as first-class shared artifacts)

The runtime should be: **a visual graph where fact-mediated contracts flow between parallel coding agents, each with depth-filtered tree views of their repos.**
