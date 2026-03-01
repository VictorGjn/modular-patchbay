# Modular Studio — Roadmap v2

*March 2026 — "Dogfood at Syroco, exit when it's undeniable"*

---

## What We're Building

**The Context Engineering Layer** — make agent context visible, testable, and self-improving. Use it at Syroco first. If it helps the team, it helps everyone.

---

## 5 Pillars (Trimmed from 8)

### 1. Execution Traces + MCP/Skill Health 🔴 PRIORITY
**The problem:** Agents fail silently. MCP server returns 429, skill import breaks, tool schema changed — you find out when the agent hallucinates instead of calling the tool.

**What we build:**
- **Pre-flight checks:** Before running, probe every MCP server (connect, auth, list tools, latency). Probe every skill (file exists, parseable, no import errors).
- **Execution trace viewer:** Every agent run captures: tool calls (which MCP, which tool, args, response, latency), retrieval hits (which knowledge source, what was returned, relevance), token usage per step, errors with stack traces.
- **Root cause analysis:** "Step 3 failed → `github-mcp` returned 403 → API token expired" not just "agent gave wrong answer."
- **Health dashboard in Sources panel:** Green/yellow/red dots with last-check timestamp. Yellow = slow (>2s). Red = unreachable or auth failure.

**Why it matters:** This is the unsexy infrastructure work nobody builds. But it's the #1 pain point when running agents.

### 2. Knowledge Graph Between Agents 🔴 PRIORITY
**The problem:** Agents are islands. Agent A learns something, Agent B doesn't know. In a team (Syroco: route optimizer, fleet monitor, report generator), shared context is everything.

**What we build:**
- **Shared fact store:** Facts can be scoped: `per_agent` (private), `per_team` (shared within agent group), `global` (all agents).
- **Cross-agent references:** Agent A's output connector → Agent B's knowledge source. Visible as edges in a team graph.
- **Fact propagation:** When Agent A promotes a fact to its design, prompt: "This fact is relevant to Agent B and C — propagate?"
- **Team view:** Simple graph showing agents as nodes, shared knowledge/facts as edges. Not a fancy orchestration UI — just visibility into what's shared.
- **Export:** Team YAML that defines agent relationships and shared context.

**Why it matters:** Letta has "Conversations API" for runtime sharing. We have design-time shared context — complementary, not competing.

### 3. PageIndex Integration (Vectorless RAG) 🔴 NEXT
**The problem:** Vector RAG (embed→chunk→cosine) is unreliable for domain-specific docs. Similarity ≠ relevance. No explainability.

**What we build:**
- Knowledge sources → PageIndex indexing (JSON tree, no vector DB)
- Knowledge Depth levels map to PageIndex retrieval depth
- Test panel shows retrieved sections with exact page/section references
- Retrieval quality scoring (did the agent use the right context?)

**Why it matters:** First agent design tool with vectorless RAG. Technical moat.

### 4. Fact Insights + Self-Improving Loop ✅ BUILT, ENHANCE
**What exists:** LLM analyzes facts → suggests promotions → one-click apply → version bump.
**Enhance:**
- Auto-analyze after N test conversations
- Propagation to other agents (see Pillar 2)
- Version timeline: visual history of how agent evolved through promotions
- Promotion audit trail

### 5. Versioning ✅ BUILT, KEEP
**What exists:** Automatic semver (MAJOR.MINOR.PATCH) based on change detection. Snapshots, restore, changelog.
**Keep as-is.** It's solid. Just wire it into the dashboard UI (version badge + history drawer).

---

## What We're NOT Building
- ❌ RTK (Rust token killer) — token costs dropping 10x/year, diminishing returns
- ❌ Output target hinting — nice feature, not a moat, later
- ❌ Eval harness / A/B testing — Vellum/Braintrust own this
- ❌ Multi-agent orchestration runtime — we design, others run
- ❌ Distribution strategy — dogfood first, distribute when it's proven

---

## Build Order (Tonight + This Week)

### Tonight: MCP/Skill Health + Execution Traces

**Step 1: Health probes** (~2h)
- `src/services/healthService.ts` — probe MCP servers (connect, list tools, latency)
- `src/store/healthStore.ts` — health state per server/skill
- Wire into SourcesPanel McpSection (green/yellow/red dots with detail tooltip)

**Step 2: Execution trace capture** (~2h)
- `src/store/traceStore.ts` — trace events (tool_call, retrieval, error, token_usage)
- Wrap LLM service calls to emit trace events
- `src/panels/TraceViewer.tsx` — timeline of events per conversation, expandable details

**Step 3: Knowledge graph store** (~2h)
- `src/store/teamStore.ts` — agents, shared facts, cross-references
- `src/panels/TeamGraph.tsx` — simple SVG graph of agent relationships
- Fact scope selector in MemorySection (per_agent / per_team / global)

### This Week: PageIndex + Polish
- PageIndex API client
- Wire knowledge sources to PageIndex
- Test panel shows retrieval provenance
- Version badge in dashboard header
- `npm publish` v0.1.0

---

## Syroco Dogfood Targets

| Agent | Purpose | Tests |
|-------|---------|-------|
| Route Optimizer | Voyage Prep TCE calculations | Does it pick the right MCP (weather, AIS)? |
| Fleet Monitor | Track vessel performance | Does shared context propagate fuel savings? |
| Report Generator | Weekly fleet reports | Does it pull from both agents' facts? |
| Competitor Intel | Track StormGeo/ZeroNorth | Does Fact Insights suggest new knowledge sources? |

---

*"Build for yourself. If it works for your team, it works for everyone."*
