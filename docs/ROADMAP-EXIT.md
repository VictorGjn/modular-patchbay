# Modular Studio — Roadmap v2

*March 2026 — "Dogfood at Syroco, exit when it's undeniable"*

---

## What We're Building

**The Context Engineering Layer** — make agent context visible, testable, and self-improving. Use it at Syroco first. If it helps the team, it helps everyone.

---

## 7 Pillars

### 1. Execution Traces + MCP/Skill Health ✅ STORES BUILT
**The problem:** Agents fail silently. MCP returns 429, skill import breaks, tool schema changed — you find out when the agent hallucinates instead of calling the tool.

**Built:** `healthStore.ts`, `traceStore.ts`, `healthService.ts`, `TraceViewer.tsx`, MCP "Check Health" button.
**Remaining:** Backend route `/api/mcp/:id/health`, skill health route, wire trace capture into LLM service calls.

### 2. Knowledge Graph Between Agents ✅ STORE BUILT
**The problem:** Agents are islands. Agent A learns something, Agent B doesn't know.

**Built:** `teamStore.ts` — agents, shared facts (per_agent/per_team/global scope), edges, fact propagation, promotion tracking.
**Remaining:** `TeamGraph.tsx` visualization, fact scope selector in MemorySection, team YAML export.

### 3. Markdown Tree Indexer 🔴 PRIORITY — BUILD TONIGHT
**The problem:** PageIndex is PDF-only. Agent context is mostly markdown. But the core insight — tree-structured index + reasoning-based retrieval — applies to ALL structured text.

**What we build:**
- `src/services/treeIndexer.ts` — parse markdown headings (`#`/`##`/`###`) into PageIndex-compatible tree JSON
- Same tree structure: `{ title, node_id, text, depth, children[] }`
- Each node has token count, enabling depth-aware budget allocation
- Code files: AST-based tree (functions/classes as nodes) — later
- PDFs: PageIndex API integration — later

**How it connects to the Depth Mixer:**
- **Full (depth 0):** Include leaf nodes with full text
- **High (depth 1):** Include all nodes but summarize leaves to first paragraph
- **Reference (depth 2):** Section titles + first sentence only
- **Skim (depth 3):** Top-level tree headings only
- **Mention (depth 4):** Document title only

**This makes the Knowledge Depth Mixer FUNCTIONAL, not just visual.**

### 4. RTK — Rust Token Killer 🔴 BUILD AFTER TREE INDEXER
**The problem:** A 200K context window with 180K of noise is worse than 50K of compressed, relevant content. Token costs dropping ≠ unlimited context. The bottleneck is signal-to-noise ratio, not price.

**What RTK does in the pipeline:**
```
Knowledge Sources → Tree Index → Depth Mixer (what to include) → RTK (how much to include) → Context Assembly
```

**Techniques:**
- **Semantic dedup:** Remove near-duplicate paragraphs across sources (same fact stated 3 ways → keep best one)
- **Instruction compression:** Strip filler words, compress to essence while preserving meaning
- **Depth-aware summarization:** At depth 2 (Reference), RTK summarizes each tree node to 1-2 sentences instead of just truncating
- **Budget-aware packing:** Given a token budget, pack maximum signal by compressing low-priority nodes more aggressively

**Why Rust:**
- Tokenization + text processing is CPU-bound — Rust is 10-100x faster than JS/Python
- Ships as WASM for browser (design-time preview of compressed context)
- Ships as native binary for server-side (runtime compression)
- Standalone value as `@modular-studio/rtk` npm package — useful even without the UI

**RTK + Tree Indexer together = the full context engineering pipeline.** Nobody has this.

### 5. Fact Insights + Self-Improving Loop ✅ BUILT, ENHANCE
**Built:** LLM analyzes facts → suggests promotions → one-click apply → version bump.
**Enhance:**
- Auto-analyze after N test conversations
- Propagation to other agents via teamStore
- Version timeline visualization

### 6. Versioning ✅ BUILT
**Built:** Automatic semver, snapshots, restore, changelog. Solid — just wire into dashboard UI.

### 7. PageIndex for PDFs 🟡 LATER
**After tree indexer works for markdown**, extend to PDFs via PageIndex API. Syroco use case: IMO regulations, EU ETS documents, fleet performance reports. Same tree structure, same depth mixer, same RTK compression — just different source parser.

---

## The Context Engineering Pipeline

```
                    ┌─────────────┐
                    │   Sources   │
                    │ md / pdf /  │
                    │ code / url  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Tree Indexer│  ← markdown parser / PageIndex API / AST parser
                    │  (JSON tree)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Depth Mixer │  ← WHAT to include (5 levels)
                    │ (per source)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     RTK     │  ← HOW MUCH to include (compression)
                    │ (Rust/WASM) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Context    │  ← Final assembly with token budget
                    │  Assembler  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Agent     │  ← Run with traces + health checks
                    │  Execution  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Facts     │  ← Extract learnings → feed back to design
                    │  Insights   │
                    └─────────────┘
```

This pipeline IS the product. Everything else is UI around it.

---

## Build Order (Tonight)

| # | What | Time | Status |
|---|------|------|--------|
| 1 | Execution traces + health stores | 2h | ✅ Done |
| 2 | Team knowledge graph store | 1h | ✅ Done |
| 3 | **Markdown tree indexer** | 1h | 🔴 Now |
| 4 | Wire tree indexer to Depth Mixer | 1h | Next |
| 5 | Backend `/api/mcp/:id/health` route | 30min | Next |
| 6 | TeamGraph visualization (simple SVG) | 1h | Next |

## This Week

| # | What | Days |
|---|------|------|
| 7 | RTK prototype (Rust WASM, semantic dedup + compression) | 2-3 |
| 8 | Wire trace capture into LLM service | 0.5 |
| 9 | `npm publish` v0.1.0 | 0.5 |
| 10 | PageIndex PDF integration | 1 |

---

## What We're NOT Building
- ❌ Output target hinting — nice feature, not a moat, later
- ❌ Eval harness / A/B testing — Vellum/Braintrust own this
- ❌ Multi-agent orchestration runtime — we design, others run
- ❌ Distribution strategy — dogfood first, distribute when it's proven

---

## Syroco Dogfood Targets

| Agent | Purpose | Context Sources | Tests |
|-------|---------|----------------|-------|
| Route Optimizer | Voyage Prep TCE | Weather MCP, AIS MCP, regulatory markdown | Tree index on EU ETS docs |
| Fleet Monitor | Vessel performance | Live data MCP, performance markdown | Shared facts with Route Optimizer |
| Report Generator | Weekly fleet reports | Both agents' facts + templates | RTK compression of multi-source context |
| Competitor Intel | StormGeo/ZeroNorth | Web scraper MCP, product docs | Fact Insights → new knowledge sources |

---

*"Tree Index → Depth Mixer → RTK → Context Assembly. That's the pipeline. Everything else is UI."*
