# Modular Studio — Roadmap to V1.0

*Strategic plan. March 11, 2026.*
*Written for Victor, by someone who'd bet their own time on this.*

---

## 1. V1.0 Definition

V1.0 is not "feature complete." V1.0 is **the version where a stranger installs it, builds an agent with their own data, and gets a result good enough to keep using it.** That's the bar. Everything below serves that single outcome.

Concretely, V1.0 means:

- **`npx modular-studio` works first try** on Mac, Windows, Linux — no workarounds, no Discord DMs to debug
- **An agent can be built in under 10 minutes** by someone who's never seen the tool, using only the UI
- **Knowledge retrieval is visibly better than naive RAG** — the tree-aware pipeline must produce results that make people say "wait, how did it know that?"
- **Agents persist between sessions** — conversation history, embeddings, configuration. Nothing evaporates on restart.
- **One export format** that another person can import and run — the "share an agent" loop is closed
- **Qualification exists** — even a basic version. Without eval, you're shipping vibes. V1.0 ships scores.

What V1.0 is **not**: multi-user, cloud-hosted, monetized, or enterprise-ready. It's a sharp local tool for individual power users. Think Obsidian's first release, not Notion.

---

## 2. Priority Stack

Ordered. Do them in this order. Each one unlocks the next.

### P0 — Cache Persistence (1-2 weeks)

**Why first:** Everything downstream depends on this. Embeddings lost on restart means the product is a demo, not a tool. Nobody will index a large repo twice.

**What to build:**
- SQLite-backed embedding store (single file, zero config, portable)
- Content-hash keyed — re-index only what changed
- Migrate LRU cache to read-through cache backed by SQLite
- Ship it behind the existing API surface — no UI changes needed

**Architecture lock-in:** SQLite. Not Postgres, not LevelDB, not a vector DB. SQLite is the right answer for a local-first tool. It ships everywhere, it's a single file, it backs up trivially, and it's fast enough for 384-dim vectors at the scale you'll see (tens of thousands of chunks, not millions). If you ever need to scale beyond that, you'll have raised money and can migrate.

### P1 — Persistent Conversation History (1-2 weeks)

**Why second:** Without this, every test is a cold start. You can't iterate on an agent if you lose the conversation that revealed the problem.

**What to build:**
- Conversations stored in SQLite (same DB as embeddings, or a sibling file)
- Conversation list in the Test Panel sidebar
- Resume, fork, or delete a conversation
- Conversations linked to agent version (so you know which config produced which result)

**Skip:** Branching, tree-of-thought visualization, fancy UIs. Just a list of conversations you can re-open.

### P2 — File-Backed Knowledge Search (1 week)

**Why now:** `search_knowledge` only working on inline content is a bug, not a feature gap. Fix it. This is the kind of thing that makes early adopters bounce — they index a repo, try to search it, and get nothing. Instant trust destruction.

**What to build:**
- `search_knowledge` queries all indexed sources, regardless of backing type
- Unified search interface — user doesn't need to know if content is inline, file-backed, or GitHub-sourced

### P3 — Qualification & Training (2-3 weeks)

**Why before launch:** This is your moat. Every competitor lets you build agents. None of them help you know if your agent is actually good. Eval is the feature that makes Modular Studio a *professional* tool instead of a toy.

**What to build (Issue #7):**
- Test cases: input/expected-output pairs, stored per agent
- Scoring: LLM-as-judge + exact match + regex — keep it simple
- Score display in Test Panel (per-conversation and aggregate)
- Publish gate: agent export shows a quality badge (pass/fail on test suite)
- **No training loop yet** — just eval. The training/fine-tuning cycle is a V2 concern.

**Why this matters for GTM:** "Build agents with built-in quality scores" is a headline. "Another agent builder" is not.

### P4 — Pipeline Hardening (2 weeks, parallel with P3)

**What to build (Phases 3-5 from pipeline fix plan):**
- Semantic compression: reduce redundant chunks before they hit the context window
- Cluster-based anti-collapse: ensure retrieval diversity doesn't degrade as knowledge grows
- Provenance tracking: every chunk in the context window traces back to its source

**Why now:** These are the things that make the demo work reliably at scale. Without them, the pipeline looks great on small repos and falls apart on real codebases. Early adopters will test with their actual projects, not your curated examples.

### P5 — Cross-Platform Polish (1 week, ongoing)

**What to build:**
- Automated smoke tests on Mac/Windows/Linux in CI
- `npx modular-studio` tested in clean environments (Docker, fresh VMs)
- Error messages that tell you what to do, not what broke

**Why:** The v0.2.x cross-platform fixes tell a story: people are trying to use it and hitting walls. Every install failure is a lost user, forever. This isn't glamorous, but it's existential for a CLI-distributed tool.

### P6 — Agent Versioning (1 week)

**What to build:**
- Auto-version on save (like git commits but implicit)
- Diff view between versions
- Rollback to any previous version
- Conversations linked to the version that produced them

**Why before launch:** Without versioning, people will break their agents and not be able to undo it. That's a churn driver for power users.

---

**Total to V1.0: ~10-12 weeks of development time.**

What's explicitly **deferred to V2+:**
- Collaborative features (multi-user, sharing, permissions)
- Cloud deployment / hosted version
- Training loop (fine-tuning from eval results)
- Marketplace / agent store
- Billing / monetization
- Advanced visualization (agent graph view, knowledge maps)

---

## 3. Architecture Decisions

### Lock in now:

| Decision | Choice | Rationale |
|---|---|---|
| **Local storage** | SQLite | Single file, zero config, portable. Battle-tested. |
| **Embedding model** | Keep MiniLM-L6-v2 | Good enough. Switching models means re-indexing everything. Lock the model for V1, allow override in V2. |
| **Agent format** | YAML as canonical | Human-readable, diffable, versionable. ZIP for distribution (YAML + knowledge + test cases). |
| **LLM interface** | Anthropic + OpenAI SDK native | Don't abstract. The SDKs are the abstraction. Adding LiteLLM or similar adds a failure mode for zero benefit at this scale. |
| **Distribution** | npm + npx only | Don't add Docker, Homebrew, or binaries yet. npm is where your users are. Fix the npx experience instead of multiplying distribution channels. |
| **UI framework** | Whatever you have now | Don't rewrite the frontend. The 3-panel layout works. Polish it, don't replace it. |

### Defer explicitly:

| Decision | Why defer |
|---|---|
| **Vector DB migration** | SQLite handles your scale. HNSW indexing can be added later without changing the API surface. |
| **Multi-model embeddings** | One model, one dimension, one index. Simplicity > flexibility until you have users demanding otherwise. |
| **Plugin system** | MCP is your plugin system. Don't build another one. |
| **Auth / multi-user** | Local-first single-user is your V1 identity. Don't dilute it. |
| **Telemetry** | Too early. You don't have enough users for quantitative data to matter. Qualitative feedback (Discord, GitHub issues) is more valuable right now. |

---

## 4. Go-to-Market: First 100 Users

### The narrative

"Context engineering" is having its moment. Karpathy named it. Shopify's CEO is evangelizing it. But there's no tool for it yet — people are stitching together LangChain, vector DBs, and prayer. **Modular Studio is the first IDE purpose-built for context engineering.** That's the headline. Say it everywhere.

### Launch sequence

**Week -4: Seed content (before any launch)**
- Write 2-3 deep technical posts:
  1. "What is context engineering and why RAG isn't enough" (define the category)
  2. "Tree-aware retrieval: how Modular Studio beats naive chunking" (show the IP)
  3. "Building an agent that actually knows your codebase" (tutorial, 10-minute walkthrough)
- Post these on your personal blog/Medium/Dev.to. They're ammunition for launch day.
- Record a 3-minute demo video. No narration fluff — just build an agent from scratch, show the pipeline trace, show the eval scores. Speed it up. Make it look effortless.

**Week 0: Hacker News launch**
- Title: "Show HN: Modular Studio – Context engineering IDE for AI agents"
- Post at 6 AM PT on a Tuesday or Wednesday
- The post text: what it is, what makes it different (tree-aware retrieval, eval built-in), `npx modular-studio` to try it. Three sentences max.
- Be in the comments for 6+ hours. Answer everything. Be technical. HN rewards depth.
- **This is your most important launch moment.** HN is where your early adopters live. Get this right.

**Week +1: Twitter/X campaign**
- Thread: "I built a context engineering IDE. Here's why RAG is broken and what I did about it."
- Tag Karpathy, Shopify CEO, Simon Willison, swyx — they've all talked about context engineering
- Post the 3-minute demo as a native video
- Don't buy followers. Don't use growth hacks. Just be genuine and technical.

**Week +2: Product Hunt**
- Nice to have, not essential. PH audiences skew less technical than you need.
- Do it for the backlink and social proof, not for users.

**Week +4: Discord community**
- Open a Discord only after you have ~50 users. Before that, GitHub Discussions is enough.
- Channels: #general, #showcase, #bugs, #feature-requests
- Be in there daily for the first month.

### Who are the first 100 users?

1. **AI engineer solo devs** building agents for their own projects (30%)
2. **DevRel / technical content people** who need to build demo agents quickly (20%)
3. **Startup CTOs** evaluating agent infrastructure (20%)
4. **Open-source contributors** who find you through GitHub trending (20%)
5. **Syroco colleagues** and their network (10%)

### What makes them stay?

Not features. **Results.** The moment someone indexes their codebase and asks a question that gets a surprisingly good answer — that's the hook. Optimize the first 10-minute experience ruthlessly. If they don't have an "aha" moment in the first session, they're gone.

---

## 5. Acquisition Positioning

### The thesis

Modular Studio is **not** a company to be built into a $100M ARR business. It's a **technology acquisition target** — a team + IP deal worth $5-30M within 18-24 months if the market timing is right.

### What makes it acquirable

1. **Unique IP:** Tree-aware retrieval + knowledge type system + qualification pipeline. No one else has this stack. An acquirer would need 6-12 months and a team to replicate it.

2. **Category definition:** If "context engineering" becomes a standard term (it's trending that way), owning the first IDE for it has brand value. Acquirers pay premiums for category-defining tools.

3. **Integration surface:** MCP support + Anthropic/OpenAI native means it plugs into any AI stack. It's not locked to one provider, which makes it attractive to platform players.

4. **Developer distribution:** npm distribution + open-source community = organic reach without sales teams. Acquirers love products with bottom-up adoption.

### Who would buy it

| Acquirer | Why | What they'd pay for |
|---|---|---|
| **Anthropic** | They need developer tools. Claude is an API — they have no IDE story. Modular Studio is their missing "build with Claude" experience. | IP + team + npm distribution |
| **OpenAI** | Same logic. GPT Store failed. They need a professional agent-building tool. | IP + developer community |
| **Vercel / Netlify** | Context engineering complements their deployment story. "Build, test, and deploy AI agents" is a powerful pitch. | Integration with existing platform |
| **Datadog / New Relic** | Observability for AI agents is their next market. Pipeline visibility + eval is adjacent. | Pipeline trace technology |
| **Cursor / Replit** | AI coding tools want to expand into AI agent building. Modular Studio is a natural extension. | Product + user base |

### How to make it happen

- **Stars matter.** Get to 1K GitHub stars. It's vanity, but acquirers check it first. (Realistic target: 3-6 months post-launch with good content.)
- **npm downloads matter.** Track weekly installs. Growth rate > absolute numbers.
- **Blog about the technology.** Technical posts that explain your approach attract acquirer engineering teams.
- **Don't raise money prematurely.** A $0 investment + 1K stars is more acquirable than a $500K pre-seed with 200 stars. The moment you take money, the acquisition math changes.
- **Talk to people.** When you hit 500+ stars, reach out to DevRel leads at Anthropic, Vercel, Cursor. Not to sell — to "get feedback." They'll notice.

---

## 6. Timeline

Reality check: Victor is Head of Product at Syroco. This is nights-and-weekends, augmented by AI coding agents (Codex, Claude Code). Assume **10-15 hours/week of effective development time**, where AI agents do 60-70% of the implementation work and Victor does architecture, review, and product decisions.

| Phase | What | Calendar time | Dev time |
|---|---|---|---|
| **March 2026** | P0: Cache persistence | 2-3 weeks | ~15h |
| **April 2026** | P1: Conversation history + P2: File-backed search | 3-4 weeks | ~25h |
| **May 2026** | P3: Qualification + P4: Pipeline hardening (parallel) | 4-5 weeks | ~35h |
| **June 2026** | P5: Cross-platform polish + P6: Agent versioning | 2-3 weeks | ~20h |
| **June 2026** | Seed content: blog posts, demo video, README polish | 2 weeks | ~10h |
| **Early July 2026** | **V1.0 release + HN launch** | — | — |
| **July-Aug 2026** | Bug fixes, community building, iterate on feedback | Ongoing | ~10h/week |
| **Sept 2026** | V1.1: Top community-requested feature | 3-4 weeks | ~25h |
| **Oct-Dec 2026** | V1.x: Build toward 1K stars, refine acquisition story | Ongoing | ~10h/week |

**Total to V1.0 launch: ~4 months, ~105 hours of Victor's time.**

This is aggressive but achievable because:
- The foundation is solid (642 tests, working pipeline, published npm package)
- AI coding agents handle the implementation grunt work
- None of the P0-P6 items require architectural breakthroughs — they're known problems with known solutions
- You're not building new features, you're hardening what exists and filling the gaps that block real usage

### What kills this timeline

- Scope creep. The #1 risk is adding "just one more feature" before launch. Resist.
- Syroco demands spiking. If work hours go to 60+/week, the side project stalls. Plan for it.
- Rewriting instead of fixing. The current codebase works. Don't rewrite the UI, don't switch frameworks, don't migrate to a monorepo. Ship V1 with what you have.

---

## The One-Line Plan

**Harden the pipeline, persist everything, add eval, and launch on HN in July. Get to 1K stars by December. Be acquired by mid-2027.**

Every decision between now and July should be tested against: *"Does this help a stranger install Modular Studio, build an agent in 10 minutes, and be impressed enough to star the repo?"*

If yes, do it. If no, defer it.

---

*Last updated: March 11, 2026*
