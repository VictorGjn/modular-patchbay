# Modular Studio — Roadmap V3

**Updated:** 2026-03-23
**Position:** The Context Engineering Layer
**Exit thesis:** $5-30M acquisition by any agent platform that needs context engineering
**Target buyers:** Dify, LangChain/LangFlow, VK/VibeKanban, Flowise, Wordware, Letta

---

## Why They'd Buy Us

Every agent builder has the same gap: they let you WIRE agents but not ENGINEER their context. They're plumbing without water treatment.

| Buyer | What they have | What they need (= us) |
|-------|---------------|----------------------|
| **Dify** (90K★) | Visual workflow builder, RAG | Knowledge Type System, Depth Mixer, context budgeting, auto-lessons |
| **LangChain/LangFlow** (50K★) | Chain orchestration, memory | Tree-aware retrieval, contrastive retrieval, qualification loop |
| **VibeKanban** | Project management + AI | Agent design studio, context pipeline, export to any runtime |
| **Flowise** (35K★) | No-code chatflows | Metaprompt v2 (research-augmented), cost intelligence |
| **Wordware** ($30M YC) | "Compounding context" | We built exactly that — with IP they'd take 6 months to replicate |
| **Letta** ($10M) | "Context repositories" | Our pipeline is production-ready, theirs is research |

---

## Defensible IP (what's hard to copy)

1. **Knowledge Type System** — 6 types (Ground Truth, Signal, Evidence, Framework, Hypothesis, Guideline) with different retrieval priorities
2. **Tree-Aware Retrieval** — heading-structure-aware chunk selection, not flat vector similarity
3. **Depth Mixer** — 5 levels (Full→Mention) with token budget allocation per source
4. **Metaprompt V2** — 7-phase research-augmented pipeline (parse→tools→research→pattern→context→assemble→evaluate)
5. **Auto-Lessons (Instinct Model)** — self-improving agents via correction extraction with confidence scoring
6. **Cost Intelligence** — model routing based on complexity heuristics, budget enforcement
7. **Context Graph** — cross-file dependency analysis for code + markdown + YAML (backend done, UI pending)
8. **14 Native Connectors** — REST API integrations separate from MCP, with multi-surface model (knowledge/tool/output)

---

## What We Ship vs What They Have

### Context Engineering (our moat)
| Feature | Modular | Dify | LangFlow | Flowise |
|---------|---------|------|----------|---------|
| Token budget cap | ✅ (just shipped) | ❌ | ❌ | ❌ |
| Knowledge type classification | ✅ 6 types | ❌ | ❌ | ❌ |
| Depth control per source | ✅ 5 levels | ❌ | ❌ | ❌ |
| Tree-aware retrieval | ✅ | ❌ (flat RAG) | ❌ (flat RAG) | ❌ (flat RAG) |
| Contrastive retrieval | ✅ | ❌ | ❌ | ❌ |
| Research-augmented generation | ✅ V2 pipeline | ❌ | ❌ | ❌ |
| Self-improving agents | ✅ instinct model | ❌ | ❌ | ❌ |
| Cost-aware model routing | ✅ | ❌ | ❌ | ❌ |
| Context ablation testing | 🔜 (#71) | ❌ | ❌ | ❌ |

### Agent Building (table stakes)
| Feature | Modular | Dify | LangFlow | Flowise |
|---------|---------|------|----------|---------|
| Visual builder | ✅ wizard | ✅ canvas | ✅ canvas | ✅ canvas |
| MCP support | ✅ 150+ | ✅ | ✅ | ⚠️ |
| Native connectors | ✅ 14 | ✅ | ✅ | ✅ |
| Export formats | ✅ 5 (YAML, JSON, MD, Claude, OpenAI) | ⚠️ | ⚠️ | ❌ |
| Template gallery | ✅ 10 | ✅ 20+ | ✅ | ✅ |
| Qualification/testing | ✅ LLM-as-judge | ❌ | ❌ | ❌ |
| E2E tests | ✅ 916 unit + 62 E2E | ? | ? | ? |

---

## Roadmap — Acquisition-Ready in 4 Phases

### Phase A — Demo-Ready (THIS WEEK)
_What a buyer sees in a 30-min demo._

| # | Feature | Why it sells | Effort |
|---|---------|-------------|--------|
| A1 | **Fix retrieved context display** — show all 8 sources with pre/post compression | Proves context engineering works | ✅ Done |
| A2 | **Token budget actually works** — pipeline respects wizard setting | Core value prop | ✅ Done |
| A3 | **Provider detection** — Refine/Analyze works with Agent SDK | No broken buttons in demo | ✅ Done |
| A4 | **Wire Context Graph UI** — force-directed graph in Knowledge tab | Visual wow factor for demo | 2 days |
| A5 | **Live Generate demo** — V2 pipeline with real research output | "Watch it think" moment | Ready (needs stable provider) |

### Phase B — Differentiation (NEXT 2 WEEKS)
_Features that make buyers say "we can't build this in 6 months."_

Inspired by: Boris Cherny's Layer model, Samuel Neveu's dual-agent loop, ECC's instinct model.

| # | Feature | Why it's defensible | Effort |
|---|---------|-------------------|--------|
| B1 | **Dual-Agent Qualification Loop** (#7) | Agent Testeur + Agent Correcteur in auto-fix loop (Samuel Neveu pattern). No competitor has this. | 3-5 days |
| B2 | **Context Ablation Testing** (#71) | A/B test knowledge sources: "removing source X drops quality by 12%". Novel. | 3-4 days |
| B3 | **Layer Progression Indicator** | Boris Cherny's dependency graph as UX: "You're at Layer 2 — unlock Layer 3 by adding tools." Gamifies agent maturity. | 2 days |
| B4 | **Code-Aware Tree Indexer** | TypeScript/Python AST extraction → symbol-level retrieval. "Glob and grep beats RAG" validated. Makes Context Graph real. | 3-5 days |
| B5 | **Export to CLI** | Generate `.claude/CLAUDE.md` or `.cursorrules` directly from wizard. Bridges design-time → runtime. | 1-2 days |

### Phase C — Enterprise Signals (MONTH 2)
_What makes a buyer's CFO comfortable._

| # | Feature | Signal | Effort |
|---|---------|--------|--------|
| C1 | **Auth + multi-tenant** | "It's not a toy" | 3-5 days |
| C2 | **Usage analytics dashboard** | "X agents created, Y generations, Z exports" | Backend done, UI 2 days |
| C3 | **OpenAPI docs** | "Integrable" | 2-3 days |
| C4 | **Docker + Helm chart** | "Deployable" | Docker done, Helm 1 day |
| C5 | **npm publish v1.0.0** | "Installable" — `npm i -g modular-studio` | 1 day |

### Phase D — Narrative (MONTH 2-3)
_The story that gets meetings._

| # | Item | Purpose |
|---|------|---------|
| D1 | **Landing page** | "The AI Studio for Knowledge Work" — 3 sections: problem, demo video, features |
| D2 | **Case study: Syroco** | Dogfooding story — PM agent built with Modular |
| D3 | **"Context Engineering" blog post** | Position paper — why RAG is dead, context engineering is the future |
| D4 | **Product Hunt launch** | Stars + awareness |
| D5 | **Direct outreach** | Dify, LangChain, VK — "we built your missing layer" |

---

## Technical Health (as of today)

| Metric | Value | Status |
|--------|-------|--------|
| Build | 0 errors | ✅ |
| Unit tests | 916 passing | ✅ |
| E2E tests | 62 (Chromium + Firefox) | ✅ |
| CI | Green (build + test + lint + audit) | ✅ |
| Audit score | 6.2→7.5/10 (P0+P1+P2 done) | ✅ |
| TypeScript strict | Yes | ✅ |
| Security | Encrypted creds, SSRF protection, MCP allowlist, Docker non-root | ✅ |
| Open issues | 11 (all backlog) | ✅ |
| Token budget | Actually works now | ✅ |
| Lines of code | 23,070 TypeScript | — |

---

## Key Insight from Research

> "These tips are not a menu. They're a dependency graph." — Boris Cherny (via Arjan Giri)

Modular Studio IS the tool that encapsulates this dependency graph:
- Layer 0 → Describe tab
- Layer 1 → Knowledge tab + context pipeline
- Layer 2 → Tools tab (MCP, skills, connectors)
- Layer 3 → Agent IDE (#68) + dual-agent loop
- Layer 4 → Qualification tab
- Layer 5 → Review tab (auto-lessons, cost intelligence)

No other tool in the market maps to this structure. That's the pitch.

---

*"Context engineering > prompt engineering" — this is our entire product.*
