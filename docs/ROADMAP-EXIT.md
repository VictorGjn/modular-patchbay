# Modular Studio — Roadmap v3

*March 2026 — "Dogfood at Syroco, exit when it's undeniable"*

---

## What We're Building

**The Context Engineering Layer** — make agent context visible, testable, and self-improving. Use it at Syroco first. If it helps the team, it helps everyone.

---

## 7 Pillars

### 1. Execution Traces + MCP/Skill Health ✅ STORES BUILT
**Built:** `healthStore.ts`, `traceStore.ts`, `healthService.ts`, `TraceViewer.tsx`, MCP "Check Health" button.
**Remaining:** Backend route `/api/mcp/:id/health`, skill health route, wire trace capture into LLM service calls.

### 2. Knowledge Graph Between Agents ✅ STORE BUILT
**Built:** `teamStore.ts` — agents, shared facts (per_agent/per_team/global scope), edges, fact propagation.
**Remaining:** `TeamGraph.tsx` visualization, fact scope selector in MemorySection, team YAML export.

### 3. Input Pipeline ✅ FULLY BUILT
**The core innovation.** Source-agnostic tree indexing + agent-driven navigation.

**Built (4 commits tonight):**
- `treeIndexer.ts` — 4 connectors: markdown, structured, chronological, flat
- `depthFilter.ts` — 5-level filtering with token budget enforcement
- `treeNavigator.ts` — **agent-driven branch selection** (replaces static depth slider)
- `repoIndexer.ts` — codebase scanner → feature-level markdown knowledge base
- `treeIndexStore.ts` — Zustand cache with TTL
- `contextAssembler.ts` — upgraded to use tree-filtered content
- Backend: `/api/knowledge/index`, `/api/knowledge/filter`, `/api/repo/scan`, `/api/repo/index`

**Architecture:**
```
Any Source → Connector → Tree Index → Agent Navigator → Per-Branch Depth → Context Assembly → LLM
```

**Key insight (Victor):** Depth is visualization, not control. The agent navigates the tree per-task, picking branches + depths. The UI shows a heatmap of what the agent chose.

**Competitor comparison:**
| Tool | Level | Depth Control | Pre-computed |
|------|-------|---------------|-------------|
| Aider repo map | Symbol | Token budget only | No |
| Autodoc | File | None | Yes (stale) |
| Sourcebot/Greptile | Runtime Q&A | None | No |
| **Modular** | **Feature** | **Per-branch, agent-driven** | **Yes** |

### 4. RTK — Rust Token Killer 🔴 BUILD NEXT
**The problem:** Agent navigator selects the right branches, but content within those branches still has noise. RTK compresses selected content for maximum signal density.

**Where RTK fits (post-navigator):**
```
Agent Navigator picks branches → RTK compresses each branch → Assembled context is dense signal
```

**Techniques:**
- Semantic dedup across selected branches (same fact stated in 2 branches → keep one)
- Filler removal (verbose paragraphs → essence)
- Code block compression (strip comments, collapse obvious patterns)
- Budget-aware packing (compress low-priority branches more aggressively)

**Implementation plan:**
- Phase 1: JS prototype with basic dedup + filler removal (ship fast)
- Phase 2: Rust WASM for 10-100x speed (if JS is bottleneck)
- Phase 3: Standalone `@modular-studio/rtk` npm package

### 5. Fact Insights + Self-Improving Loop ✅ BUILT
**Built:** LLM analyzes facts → suggests promotions → one-click apply → version bump.
**Enhance:** Auto-analyze after N test conversations, propagation via teamStore, timeline visualization.

### 6. Versioning ✅ BUILT
**Built:** Automatic semver, snapshots, restore, changelog.

### 7. PageIndex for PDFs 🟡 LATER
After tree indexer works for markdown/code, extend to PDFs via PageIndex API.

---

## The Context Engineering Pipeline (Updated)

```
                    ┌─────────────────┐
                    │     Sources     │
                    │  md / code /    │
                    │  notion / crm / │
                    │  slack / api    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Connectors     │  ← markdown / structured / chronological / flat / repo
                    │  (normalize)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Tree Indexer   │  ← heading tree / field groups / time segments
                    │  (JSON tree)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Agent Navigator │  ← agent sees headlines, picks branches per task
                    │ (per-branch     │
                    │  depth select)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │      RTK        │  ← compress selected branches (dedup, filler, code)
                    │  (JS → Rust)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    Context      │  ← assemble with token budget
                    │    Assembler    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Agent       │  ← execute with traces + health checks
                    │    Execution    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Facts       │  ← extract learnings → feed back
                    │    Insights     │
                    └─────────────────┘
```

---

## Build Order

| # | What | Status | Commit |
|---|------|--------|--------|
| 1 | Execution traces + health stores | ✅ | `792b50c` |
| 2 | Team knowledge graph store | ✅ | `792b50c` |
| 3 | Tree indexer (markdown) | ✅ | `cf1bf2d` |
| 4 | Source-agnostic connectors (4 types) | ✅ | `e59ffac` |
| 5 | Repository indexer | ✅ | `cc85862` |
| 6 | Agent-driven tree navigator | ✅ | `25d29f1` |
| 7 | **RTK prototype (JS dedup + compression)** | 🔴 **NEXT** | — |
| 8 | Wire trace capture into LLM service | 🟡 | — |
| 9 | `npm publish` v0.1.0 | 🟡 | — |
| 10 | Backend health routes | 🟡 | — |

## Stashed (Build Later)
- LLM-enhanced repo docs (agent reads key files, writes richer feature descriptions)
- TeamGraph SVG visualization
- PageIndex PDF integration
- Output target hinting
- Eval harness / A/B testing
- RTK Rust WASM rewrite (only if JS is bottleneck)
- Connector UIs (Notion, HubSpot, Slack, Granola pickers)

## What We're NOT Building
- ❌ Multi-agent orchestration runtime — we design, others run
- ❌ Distribution strategy — dogfood first, distribute when it's proven
- ❌ Custom vector DB — tree index + reasoning beats embeddings

---

## Syroco Dogfood Targets

| Agent | Purpose | Context Sources | Pipeline Feature |
|-------|---------|----------------|-----------------|
| Route Optimizer | Voyage Prep TCE | Weather MCP, AIS MCP, regulatory md | Tree navigator on EU ETS docs |
| Fleet Monitor | Vessel performance | Live data MCP, performance md | Shared facts with Route Optimizer |
| Report Generator | Weekly fleet reports | Both agents' facts + templates | RTK compression of multi-source |
| Competitor Intel | StormGeo/ZeroNorth | Web scraper MCP, product docs | Repo indexer on competitor code |

---

*"Connectors → Tree Index → Agent Navigator → RTK → Context Assembly. That's the pipeline. Everything else is UI."*
