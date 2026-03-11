# Modular Studio — Validated Roadmap to V1.0

*Reviewed & validated March 11, 2026.*
*Original by Opus. Review & corrections by Claw.*

---

## V1.0 Definition (unchanged — it's right)

**"A stranger installs it, builds an agent in 10 minutes, and gets a result good enough to keep using."**

Concrete criteria:
- `npx modular-studio` works first try on Mac, Windows, Linux
- Agent built in <10 minutes by someone who's never seen the tool
- Knowledge retrieval visibly better than naive RAG
- Agents + conversations persist between sessions
- Export → import cycle works between two people
- Basic eval exists (test cases with pass/fail)

NOT V1: multi-user, cloud, monetization, enterprise.

---

## Priority Stack (revised ordering)

### P0 — First Run Experience + CI Matrix (2 weeks)

**Why first:** The original plan starts with SQLite. Wrong. If nobody can install it, nothing else matters. Amélie's test proved this — crash on first run.

**What to build:**
- **README rewrite:** Hero GIF, 3-line Quick Start, screenshot of each panel
- **Starter template:** Pre-built "Code Assistant" agent with one knowledge source, so the first screen isn't empty
- **Guided first run:** On empty state, show "Add a GitHub repo → Test your agent" flow
- **CI matrix:** GitHub Actions testing `npm install -g modular-studio && modular-studio --version` on Node 18/20/22 × mac/win/linux
- **Fix the security finding:** Stricter GitHub URL regex in `repo-index.ts`

**Why before SQLite:** A crashing install blocks 100% of users. A missing cache blocks repeat users. Fix the funnel top first.

### P1 — Cache Persistence with SQLite (2 weeks)

**What to build:**
- `sql.js` (WASM-based SQLite, zero native binaries) — NOT `better-sqlite3` (native binary = sharp problem all over again)
- Single file: `~/.modular-studio/cache.db`
- Tables: `embeddings` (content_hash, model, vector BLOB, created_at), `conversations` (id, agent_id, messages JSON, created_at)
- Read-through cache: check SQLite before computing, write after
- Content-hash keyed — re-index only what changed
- **Include conversations** — don't split P0/P1 like the original plan. It's the same DB, same migration, ship together.

**What this unlocks:** Restart doesn't lose work. Conversations persist. Users can iterate.

### P2 — File-Backed Knowledge Search (1 week)

**What to build:**
- `search_knowledge` tool reads file-backed channels via the server API, not just inline content
- On indexing, store chunk embeddings in SQLite (from P1) so search doesn't need to re-embed
- This makes the built-in tools actually useful end-to-end

### P3 — Qualification v0 (2 weeks — scoped down)

**V1 scope (not the full Issue #7):**
- Test cases: input + expected output, stored in agent YAML
- Scoring: **exact match + contains + regex only.** No LLM-as-judge for V1 — it's slow, expensive, and non-deterministic. Add it in V1.1.
- Run all test cases → show pass/fail count in Test Panel
- Export includes test suite in the ZIP
- **No publish gate.** Just visibility.

**Why scoped down:** LLM-as-judge + publish gate + patch suggestions is 3 weeks minimum. Simple test cases are 1 week. Ship the simple version, iterate based on feedback.

### P4 — Pipeline Hardening (2 weeks, can parallel with P3)

**From the pipeline fix plan, phases 3-5:**
- Semantic compression: deduplicate near-identical chunks before LLM
- Cluster-based anti-collapse: force diversity in retrieval results
- Provenance tracking: source attribution on every chunk

**+ Dogfooding at Syroco:** Index a real Syroco codebase and test the pipeline on it. Real data finds real bugs.

### P5 — Cross-Platform Polish (1 week, but CI from P0 catches regressions)

- Fix any issues surfaced by CI matrix from P0
- `--help` and error messages that guide the user
- Test with clean Docker images (node:18-slim, node:20-slim)

### P6 — Agent Versioning (1 week)

- Auto-snapshot on save (JSON diff, not full copy)
- List + restore in UI
- Conversations tagged with agent version

---

## Revised Timeline

| Month | What | Dev time |
|-------|------|----------|
| **Mar 2026** | P0: First run experience + CI | ~15h |
| **Apr 2026** | P1: SQLite cache + conversations | ~20h |
| **Apr-May** | P2: File-backed search | ~10h |
| **May 2026** | P3: Qualification v0 + P4: Pipeline hardening | ~30h |
| **Jun 2026** | P5: Polish + P6: Versioning | ~15h |
| **Jun 2026** | Content: 3 posts + demo video + README | ~10h |
| **Early Jul** | **V1.0 → HN launch** | — |

**Total: ~100h over 4 months.** Unchanged from original, but reordered.

---

## Architecture Decisions (revised)

### Changed from original:

| Decision | Original | Revised | Why |
|----------|----------|---------|-----|
| **SQLite library** | Not specified | `sql.js` (WASM) | `better-sqlite3` has native binaries → same cross-platform hell as sharp. sql.js is pure JS/WASM. |
| **CI** | P5 (week 14) | P0 (week 1) | Cross-platform bugs compound. Catch them from day 1. |
| **Qualification** | LLM-as-judge | Exact match/regex only | Ship simple, iterate. LLM judge is V1.1. |
| **Onboarding** | Not mentioned | P0 (starter template) | Empty screen = bounce. Non-negotiable. |

### Kept from original (still right):
- YAML as canonical agent format
- Anthropic + OpenAI SDK native (no abstraction layer)
- npm-only distribution
- No rewrite of existing UI
- MCP as the plugin system

---

## Go-to-Market (revised)

### The pitch (sharper)

**Don't lead with "context engineering IDE."** That's what it IS, but it's not what people WANT.

Lead with the pain: **"Your AI agent sucks because its context sucks."**

Then the solution: "Modular Studio lets you see exactly what your agent knows, test whether it knows enough, and fix the gaps — in 10 minutes."

Then the mechanism: "Tree-aware retrieval, not naive RAG. 150+ MCP integrations. Built-in eval."

### The response to "why not just AGENTS.md?"

This WILL come up on HN. Prepare the answer:

> "AGENTS.md is great for simple agents. But when your agent needs to know 50K tokens of context from 3 repos, 2 Notion pages, and a HubSpot CRM — and you need to test that it actually uses them correctly — you need a pipeline, not a prompt file. That's what Modular Studio builds."

### HN post title (revised)

"Show HN: I built an IDE that shows you exactly what context your AI agent sees"

(Concrete > abstract. "Context engineering IDE" means nothing to 90% of HN.)

### Launch sequence (kept, with one addition)

Add: **Week -2: Private beta with 5-10 testers.** Find them on Twitter/Discord AI communities. Their feedback fixes the "10 minute test" before public launch. Their tweets on launch day provide social proof.

---

## Acquisition Positioning (reality check)

### Realistic range: $2-8M at 1K stars, $10-20M at 5K stars

The original $5-30M range is too wide to be useful. Here's the math:

- **<500 stars:** Acqui-hire territory. $1-3M. Basically buying Victor + IP.
- **500-2K stars:** Technology acquisition. $3-8M. The IP is proven, community exists.
- **2K-10K stars:** Product acquisition. $8-20M. Real distribution, category ownership.
- **10K+ stars:** Not happening in 18 months from a side project. Be honest.

### Most likely acquirer: Cursor or Vercel

- Anthropic/OpenAI build in-house, they don't buy small tools
- Cursor is expanding beyond code editing into "AI workflows" — Modular Studio fits
- Vercel wants the "AI developer platform" narrative — agent building completes it
- Datadog/New Relic is a stretch — they want observability, not builders

### The trigger for conversations

Don't wait for 500 stars. Start being visible now:
- Comment on Cursor's Discord about context engineering
- Write technical posts that reference Vercel's AI SDK
- Build a Cursor integration (export agent as Cursor rules file)
- Make the acquirers' products better → they notice you

---

## Risk Register (not in original — added)

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Syroco workload spike** | HIGH | Delays 2-4 weeks | Pre-build P0-P1 before Q2 starts |
| **sql.js WASM perf issues** | MEDIUM | Slow search | Benchmark before committing; fallback: `better-sqlite3` with platform-specific install |
| **HN launch flops** | MEDIUM | Low initial traction | Have backup: AI Twitter thread + direct outreach to 20 AI engineers |
| **Competitor ships same thing** | LOW | Accelerates timeline pressure | Speed > perfection. Ship V1 in July, not September |
| **Node.js breaking changes** | LOW | Install failures | CI matrix catches this; pin Node 20 LTS as recommended |

---

## The One-Line Plan (unchanged — it's right)

**Harden the pipeline, persist everything, add eval, and launch on HN in July.**

Test every decision against: *"Does this help a stranger get an 'aha' moment in 10 minutes?"*

---

*Validated March 11, 2026*
