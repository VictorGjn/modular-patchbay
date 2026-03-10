# Reddit Post — r/LocalLLaMA + r/ClaudeAI + r/ChatGPTCoding

## Title Options (pick one):

**Option A:** "I built a Context Engineering IDE — design AI agent knowledge pipelines instead of writing giant system prompts"

**Option B:** "Show HN/Reddit: Modular Studio — an IDE where you design agent context as a pipeline, not a monolith"

**Option C:** "Your system prompts are the problem. I built an IDE that treats context engineering as pipeline design."

---

## Post Body (r/LocalLLaMA version)

Hey everyone,

I've been building **Modular Studio** — an open-source IDE for designing AI agent configurations through structured knowledge pipelines.

### The problem

Every agent framework has you write one massive system prompt and hope the model figures it out. But context quality determines output quality, and nobody has tools for engineering context systematically.

### What it does

Instead of a monolithic prompt, you design a pipeline:

```
Sources → Tree Index → Knowledge Types → Contrastive Retrieval → Budget Allocator → Context Assembly → LLM
```

**Key ideas:**

- **Knowledge Type System** — Every source gets classified: ground-truth (never contradict), evidence (cite and weigh), signal (interpret the need), framework (structure thinking), hypothesis (validate/invalidate), guideline (follow as rules). The LLM gets different instructions per type.

- **Tree Indexing** — Markdown files are parsed into heading trees. An agent navigates branches per-task instead of dumping everything into context. You control depth per-source (summary → key points → details → full → verbatim).

- **Contrastive Retrieval** — For analytical queries ("should we X?", "compare A vs B"), the pipeline automatically pulls both supporting AND contradicting chunks. Labels them `<supporting>` and `<contrasting>` so the model sees both sides instead of confirmation-biasing toward whatever's in context.

- **Provenance Chains** — Every chunk carries its derivation path (source → section → type → depth → extraction method). When sources conflict, the LLM gets resolution instructions: "prefer ground-truth over evidence, full-depth over summary."

- **Epistemic Budget Allocator** — Token budget distributed by knowledge type priority, not equally. Ground-truth gets 30%, evidence 20%, etc. Your most reliable sources get the most tokens.

- **Agent Directory Format** — Export agents as a folder of human-readable files: `agent.yaml`, `SOUL.md`, `INSTRUCTIONS.md`, `TOOLS.md`, `KNOWLEDGE.md`, `MEMORY.md`. Git-friendly, diffable, portable across Claude Code / OpenClaw / Cursor / Amp.

- **Team Runner** — Run multiple agents in parallel on a shared task. Each agent gets its own system prompt + role. Facts are extracted from outputs and shared across agents.

- **MCP Integration** — Full MCP support with 100+ pre-configured servers, OAuth flow, health monitoring.

### Stack

React 18 + TypeScript + Zustand (frontend), Express + TypeScript (backend). Works with any OpenAI-compatible API + Claude Agent SDK. 646 tests.

### What makes this different from LangFlow/Dify/n8n?

Those are **runtime orchestrators** — they chain LLM calls, manage state, route messages. Modular Studio is a **design-time layer** — it engineers what goes INTO a single LLM call. Better input = better output, regardless of which runtime executes it.

Think of it this way: Dify decides which LLM to call and when. Modular Studio decides what to put in the context window.

### Demo

[screenshots / gif would go here]

### Links

- **GitHub:** https://github.com/VictorGjn/modular-patchbay
- **Install:** `npx modular-studio`

MIT licensed. Feedback welcome — especially from people who've hit the wall with giant system prompts and RAG pipelines that return irrelevant context.

---

## Shorter version (r/ClaudeAI)

**Title:** "Built an IDE for context engineering — design what goes into Claude's context window as a pipeline"

Every Claude project I work on, I spend more time engineering the context than writing the actual prompt. So I built a tool for it.

**Modular Studio** lets you design agent context as a pipeline:
- Classify sources by type (ground-truth, evidence, signal, hypothesis)
- Tree-index markdown so agents navigate headings instead of getting everything
- Contrastive retrieval: automatically pull contradicting evidence alongside supporting evidence
- Budget allocation: your most reliable sources get the most context tokens
- Export as Agent Directory (SOUL.md + INSTRUCTIONS.md + TOOLS.md — like a git repo for your agent)

Works with Claude API, Agent SDK, and any OpenAI-compatible endpoint.

https://github.com/VictorGjn/modular-patchbay

---

## HN version (Show HN)

**Title:** "Show HN: Modular Studio – Context Engineering IDE for AI Agents"

Modular Studio is an open-source IDE for engineering AI agent context as a structured pipeline rather than monolithic system prompts.

Core innovation: a knowledge type system (6 epistemic types with different LLM instructions), contrastive retrieval (pulls both supporting and contradicting evidence for analytical queries), and provenance-weighted conflict resolution.

Sources → Tree Index → Knowledge Types → Contrastive Retrieval → Budget Allocator → Context Assembly → LLM

Export agents as human-readable directories (agent.yaml + SOUL.md + INSTRUCTIONS.md). Works with any OpenAI-compatible API.

https://github.com/VictorGjn/modular-patchbay

---

## Subreddits to post in:
1. **r/LocalLLaMA** — full version, technical audience
2. **r/ClaudeAI** — shorter version, Claude-focused
3. **r/ChatGPTCoding** — shorter version, coding-focused
4. **r/MachineLearning** — HN-style, research angle on contrastive retrieval
5. **Hacker News** — Show HN format

## Timing:
- Best posting times: Tuesday-Thursday, 8-10 AM EST (14:00-16:00 CET)
- Cross-post with 1-2 hour gaps to avoid spam detection
- Respond to every comment in the first 2 hours
