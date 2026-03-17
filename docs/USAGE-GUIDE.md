# Modular Studio — Usage Guide

## Getting Started

### Install & Run

```bash
npx modular-studio
# Opens at http://localhost:4800
```

For development:
```bash
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay
npm install --legacy-peer-deps
npm run dev    # Frontend :5173, Backend :4800
```

### Connect a Provider

Before building agents, connect an LLM provider:

1. Click **⚙ Settings** (gear icon, top right)
2. Go to **Providers** tab
3. Options:
   - **Claude Agent SDK** — Zero-config inside Claude Code (auto-detected)
   - **Anthropic** — Enter API key → Test → models load automatically
   - **OpenAI** — Enter API key → Test
   - **OpenRouter** — Enter API key for aggregated access to 100+ models
4. Click **Test** — green dot = connected

---

## Building Your First Agent

### Step 1: Agent Library

The app opens to your **Agent Library** — a grid of saved agents.

- **+ New Agent** — Creates a blank agent and enters the editor
- Click any agent card to load and edit it
- **← Back** button returns to the library from the editor

### Step 2: Describe Tab

Write what you want the agent to do. Be specific:

> "A code review agent that analyzes TypeScript pull requests for security vulnerabilities, performance issues, and adherence to our internal style guide. It should use our codebase as ground truth and never make up information."

**Quick Start Templates** — Pick a pre-built template (Code Review, Research, Content Writer, Product Manager) to auto-fill common configurations.

**Generate Agent** — The main CTA. Sends your description through a meta-prompt to generate:
- Agent identity (name, description, avatar)
- Persona and tone
- Constraints and scope
- Objectives and success criteria
- Workflow steps
- Tool and knowledge recommendations

After generation, all tabs get populated automatically.

### Step 3: Knowledge Tab

Connect the knowledge your agent needs:

- **Local Files** — Drag & drop markdown, code, documents
- **Git Repos** — Clone any GitHub repository (auto-indexes)
- **Connectors** — Notion, Slack, HubSpot, etc. via MCP

**Missing Sources** — After generation, the tab shows what knowledge the AI recommends you connect (e.g., "Add your style guide", "Connect your API documentation").

Each source has:
- **Knowledge Type** — Ground Truth, Signal, Evidence, Framework, Hypothesis, Guideline
- **Depth** — Controls how much detail is included (Full → Detail → Summary → Headlines → Mention)
- **Token budget** — See how many tokens each source consumes

### Step 4: Tools Tab

Select MCP servers and skills for your agent:

- **MCP Servers** — 150+ integrations (GitHub, Notion, Slack, filesystem, etc.)
- **Skills** — Pre-built capabilities (code analysis, research, feedback analysis)
- **Marketplace** — Browse and install from the registry

### Step 5: Memory Tab

Configure how the agent remembers context:

- **Strategy** — Sliding window, RAG, summarize-and-recent
- **Long-term memory** — Enable fact extraction and recall
- **Session config** — Max messages, summarization triggers

### Step 6: Review Tab

Inspect and refine every aspect of the generated agent:

- **Identity** — Name, description, avatar, tags
- **Persona** — Who the agent is, tone, expertise level
- **Constraints** — Safety toggles + custom constraints + scope definition
- **Objectives** — Primary goal, success criteria, failure modes
- **Workflow** — Step-by-step process the agent follows
- **Output** — Format configuration
- **Fact Insights** — Analyze accumulated facts and promote them to agent design
- **Export** — Download as .md, .yaml, .json for any target platform

### Step 7: Test Tab

Chat with your agent to verify it works:

- **Conversation Tester** — Send messages, see responses with full context
- **Pipeline Stats** — Context tokens, system tokens, compression ratio, retrieval metrics
- **Inline Traces** — Per-message pipeline data (click to load full trace in sidebar)
- **Pipeline Observability** — Right sidebar shows: source assembly, retrieval, provenance
- **Team Runner** — Coordinate multiple agents on a shared task

### Step 8: Qualification Tab

Run structured evaluations:

- Define test cases with expected behaviors
- Run against your agent configuration
- Track pass/fail with detailed reasoning

---

## Knowledge Pipeline

The context engineering pipeline transforms raw knowledge into optimized LLM context:

```
Sources → Tree Indexing → Depth Filtering → Budget Allocation → Retrieval → Compression → Assembly
```

1. **Tree Indexing** — Converts documents into heading-based hierarchies
2. **Depth Filtering** — Selects content at the configured depth level
3. **Budget Allocation** — Distributes token budget across sources
4. **Retrieval** — Semantic search for query-relevant chunks
5. **Compression** — Removes filler, compresses code, packs to budget
6. **Assembly** — Combines system frame, knowledge, memory, and tools

### Pipeline Observability

Every chat message shows:
- **Diversity score** — How varied the retrieved sources are
- **Chunk selection** — How many chunks were selected vs. available
- **Timing** — Embedding + retrieval latency
- **Source assembly** — Which sources contributed
- **Provenance** — Full derivation chain from raw source to context

---

## Saving & Versioning

- **Save** — Persists the full agent state to the backend
- **Versions** — Each save creates a version checkpoint
- **Restore** — Roll back to any previous version via the version dropdown (Topbar)
- **Library** — All saved agents appear on the Agent Library landing page

---

## Export Targets

| Target | Format | Use Case |
|--------|--------|----------|
| Claude Code | `.md` | Drop into `.claude/agents/` |
| OpenClaw | `.yaml` | OpenClaw agent definition |
| Codex | `.json` | OpenAI Codex agents |
| Amp | `.yaml` | Sourcegraph Amp agents |
| Vibe Kanban | `.json` | BloopAI agents |
| Generic JSON | `.json` | Any custom integration |
| Agent Directory | `.zip` | Complete portable package |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open file picker |
| `Ctrl/Cmd + Enter` | Run/generate |
| `Escape` | Close modals |
| `←` `→` | Navigate tabs (when focused) |
