# Modular Studio — Exit Roadmap

*March 2026 — "Build to be acquired, not maintained"*

---

## Strategic Pivot

**Old positioning:** "Figma for AI agents" (visual agent builder competing with Dify/Langflow/Flowise)
**New positioning:** "The Context Engineering Layer" — the only tool that makes agent context visible, testable, and self-improving

**Exit thesis:** Not a product company. Building IP that makes any agent platform better. Every competitor (Dify, Langflow, Flowise, Letta, VK) needs context engineering but none have it. We're the acquisition target, not the competitor.

**Target acquirers (in order):**
1. **Letta** — Already investing in context management. Our Knowledge Depth Mixer + Fact Insights = their missing design layer
2. **Dify** (LangGenius) — 90K stars, LF-backed. Need better RAG pipeline control + MCP health monitoring
3. **Langflow** (DataStax) — Want to differentiate from Flowise. Our context budget viz + self-improving agents = premium feature
4. **Flowise** — Needs a design layer to go enterprise
5. **VK/BloopAI** — Original target, still valid
6. **Anthropic/OpenAI** — If the tech is good enough, agent design tools are strategic

---

## The 8 Pillars (Unique IP)

### 1. Knowledge Depth/Type Mixer ✅ BUILT
**Status:** Working. 5 depth levels (Full→Mention), 6 knowledge types with color coding.
**Gap:** Visual is good but there's no actual RAG behind it — it's design-time only.
**For exit:** This IS the UI layer every competitor lacks. Keep polishing.

### 2. PageIndex Integration (Vectorless RAG) 🔴 NOT STARTED
**What:** PageIndex.ai does RAG without vectors — logical reasoning over document structure instead of embedding similarity. "No chunking, no vectors, human-like retrieval."
**Why this matters:** Every competitor uses vanilla vector RAG (embed → chunk → cosine similarity). PageIndex's approach is genuinely different:
- No embedding pipeline needed
- Explainable retrieval (exact page/section references)
- Works on domain-specific docs where similarity ≠ relevance
- Lightweight JSON tree index, no vector DB infra

**Integration plan:**
1. PageIndex has an MCP server (or can be wrapped as one)
2. Knowledge sources added in Modular → sent to PageIndex for indexing
3. Knowledge Depth levels map to PageIndex retrieval depth
4. At runtime: agent queries PageIndex instead of vanilla vector search
5. In test mode: show retrieved sections with page references + confidence

**Moat:** We're the first agent design tool with vectorless RAG built-in. Everyone else is stuck on embeddings.

### 3. MCP Health + Skill Health Dashboard ✅ PARTIAL
**Status:** MCP status dots exist. No actual health checks.
**Build:**
- Startup probe: can we connect? Does auth work?
- Schema probe: list tools, verify expected tools exist
- Latency probe: round-trip time to each server
- Dependency map: which workflow steps depend on which MCP servers
- **Alert:** "Step 3 uses `github-mcp` but it's unreachable"
- Skill validation: does the skill file exist? Is it parseable? Any import errors?

**For exit:** This is a MASSIVE pain point. Nobody has it. Agents fail silently when MCP servers are down. First-to-market on this.

### 4. Rust Token Killer (RTK) 🔴 NOT STARTED
**What:** Pluggable Rust-based token compression before context assembly.
**Why Rust:** 10-100x faster than Python/JS for text processing. Can run as WASM in browser or native binary.
**Techniques:**
- Semantic deduplication (remove near-duplicate paragraphs)
- Instruction compression (strip filler words, compress to essence)
- Knowledge summarization (depth-aware: Full=raw, Skim=LLM-summarized)
- Token-budget aware truncation (cut to fit budget, not just truncate)

**Integration:** After depth mixer, before context assembly. Shows token savings in real-time.
**Open-source:** Ship as `@modular-studio/rtk` — standalone value even without the UI.

### 5. Agent Generation (AI Center) ✅ BUILT
**Status:** GeneratorNode + per-section Generate ✨ buttons working.
**Gap:** Generation doesn't use PageIndex for knowledge grounding.
**Enhancement:** Brain dump → Generator → auto-discovers relevant docs via PageIndex → suggests knowledge sources with pre-computed depth levels.

### 6. Output Connectors with Target Hinting 🟡 DESIGNED
**Status:** Architecture doc exists. OutputNode has template picker (Notion, Slides, Slack/Email).
**Build:**
- **Target hinting:** User specifies WHERE value is delivered:
  - Notion: "This page/database" (paste URL → auto-detect workspace/page ID)
  - Jira: "This project/board" (project key → auto-map issue types)
  - HubSpot: "This pipeline/deal stage" (CRM object → property mapper)
  - GitHub: "This repo/issue label" (repo URL → issue template)
  - Slack: "This channel" (channel picker)
- **Schema preview:** Show what the agent will output (fields, types, example values)
- **Validation:** "Your agent has no workflow step that produces `deal_amount` — add one?"
- **One-shot delivery:** Agent runs → output goes directly to target. No copy-paste.

**For exit:** Structured output with target validation = enterprise feature. Competitors all produce text blobs.

### 7. Fact Insights (Self-Improving Agent) ✅ BUILT
**Status:** LLM analyzes accumulated facts → suggests promoting to instructions/constraints/workflow/knowledge/MCP.
**Enhancement:**
- Auto-run after every N test conversations (not just manual)
- Track promotion history (which facts became which components)
- Show agent improvement over time (v0.1 → v0.5: +3 constraints, +2 workflow steps, +1 knowledge source)
- **Version timeline:** Visual history of how the agent evolved through fact promotions

**For exit:** "Agents that design themselves" is a headline feature. Nobody has this.

### 8. Run Before Deploy (Test Sandbox) ✅ PARTIAL
**Status:** Test panel with chat exists. ConversationTester works.
**Build:**
- **Eval harness:** Define test cases (input → expected output pattern)
- **Regression tests:** Re-run after every change, flag regressions
- **A/B comparison:** Run same input through v1.2 vs v1.3, side by side
- **MCP mock mode:** Test without real MCP connections (mock responses)
- **Cost estimation:** "This conversation cost $0.03, projected $15/day at 500 msgs"
- **Multi-agent preview:** Show how this agent hands off to others

**For exit:** Testing/eval is the #1 missing feature in every competitor. Vellum charges $$$ for this.

---

## Execution Phases

### Phase 1: "Make It Real" (Week 1-2) 🎯
**Goal:** Stop being design-time-only. Make agents actually work.

| Task | Days | Impact |
|------|------|--------|
| Add "Run" button in test panel (calls LLM through backend) | ✅ Done | Table stakes |
| MCP health probes (connect, schema, latency) | 2 | Unique feature |
| Output target hinting UI (Notion URL → page detection) | 2 | Enterprise value |
| `npm publish` as `modular-studio` v0.1.0 | 0.5 | Get it out there |
| Post on HN with "Context Engineering" angle | 0.5 | Get 10 users |

### Phase 2: "PageIndex Integration" (Week 3-4) 🧠
**Goal:** Replace vanilla RAG with vectorless RAG. Genuine technical moat.

| Task | Days | Impact |
|------|------|--------|
| PageIndex API integration (index + retrieve) | 3 | Revolutionary RAG |
| Wire knowledge sources → PageIndex indexing | 2 | Depth mixer becomes real |
| Test panel shows retrieved sections with page refs | 1 | Explainable AI |
| Write blog post: "Why we ditched vector RAG" | 1 | Marketing |

### Phase 3: "Self-Improving Loop" (Week 5-6) 🔄
**Goal:** Fact Insights becomes the hero feature.

| Task | Days | Impact |
|------|------|--------|
| Auto-analyze after N test conversations | 1 | Hands-free improvement |
| Version timeline visualization | 2 | Show agent evolution |
| Promotion history tracking | 1 | Audit trail |
| RTK prototype (Rust WASM token compressor) | 3 | Performance moat |
| Blog post: "Agents that design themselves" | 1 | Marketing |

### Phase 4: "Enterprise Bait" (Week 7-8) 💰
**Goal:** Features that make acquirers drool.

| Task | Days | Impact |
|------|------|--------|
| Eval harness (test cases + regression) | 3 | Vellum competitor |
| A/B version comparison | 2 | Enterprise must-have |
| Output schema validation | 2 | "Your workflow can't produce this output" |
| MCP dependency map visualization | 1 | Unique |
| Cost estimation per conversation | 1 | Budget-conscious teams |

### Phase 5: "Exit Prep" (Week 9-10) 🚪
**Goal:** Package for acquisition.

| Task | Days | Impact |
|------|------|--------|
| Integration guides for Dify/Langflow/Flowise | 3 | Show fit |
| Patent-worthy documentation of unique algorithms | 2 | IP protection |
| Demo video (2min) showing full loop | 1 | Pitch material |
| Reach out to acquirer contacts | Ongoing | The actual exit |
| Usage metrics dashboard (if any users) | 1 | Traction proof |

---

## What NOT to Build

- ❌ Multi-agent orchestration UI (too complex, competitors have it)
- ❌ Custom MCP server builder (out of scope)
- ❌ User auth/teams/billing (not a SaaS)
- ❌ Hosting/deployment (we export, others run)
- ❌ Yet another visual node editor (kill React Flow in design mode — ✅ done)
- ❌ More viz styles (Card/Circuit/Layers — vanity, not value)

## What Makes Us Acquirable

| Feature | Who wants it | Why they can't build it |
|---------|-------------|----------------------|
| Knowledge Depth Mixer | Everyone | UX research + iteration we already did |
| PageIndex vectorless RAG | Dify, Langflow | Different paradigm, integration work |
| MCP Health Dashboard | Everyone | Unsexy infra work nobody prioritizes |
| Fact → Design promotion | Letta, VK | Novel concept, LLM pipeline + UX |
| Output target hinting | Enterprise buyers | Domain-specific schema mapping |
| RTK (Rust token compressor) | Everyone (perf) | Rust expertise barrier |
| Eval harness in-IDE | Vellum competitors | Testing is always "later" |

---

## Success Metrics

**Month 1:** npm published, 50+ GitHub stars, 10 real users, HN post
**Month 2:** PageIndex integrated, blog posts getting shared, first acquirer conversation
**Month 3:** RTK shipped, eval harness working, demo video viral
**Exit timeline:** 3-6 months from first acquirer conversation

---

*"Don't build a company. Build IP that a company needs."*
