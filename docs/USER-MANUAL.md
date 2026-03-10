# Modular Studio — User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [Layout Overview](#layout-overview)
- [Sources Panel (Left)](#sources-panel-left)
- [Agent Builder (Center)](#agent-builder-center)
- [Test Panel (Right)](#test-panel-right)
- [Settings](#settings)
- [Marketplace](#marketplace)
- [Knowledge Pipeline](#knowledge-pipeline)
- [Team Runner](#team-runner)
- [Agent Directory Format](#agent-directory-format)
- [MCP Servers](#mcp-servers)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **git**

### Installation

```bash
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay
npm install
```

### Running

```bash
# Terminal 1 — Backend (port 4800)
npm run server

# Terminal 2 — Frontend (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser.

### First Launch

1. Open **Settings** (gear icon, top-right) → **Providers**
2. Add an API key for Anthropic, OpenAI, or any OpenAI-compatible provider
3. Click **Test Connection** to verify
4. Close Settings — you're ready to build agents

---

## Layout Overview

Modular Studio uses a **3-panel layout**:

```
┌─────────────┬────────────────────┬──────────────┐
│   Sources   │   Agent Builder    │  Test Panel   │
│   (30%)     │   (flexible)       │  (collapsible)│
│             │                    │              │
│  Knowledge  │  Identity          │  Chat        │
│  MCP        │  Instructions      │  Team        │
│  Skills     │  Constraints       │  Export      │
│  Connectors │  Workflow          │              │
│             │                    │  Results     │
│ Save/Load   │  Save/Load/Export  │  (expandable)│
│  Context    │    Agent           │              │
└─────────────┴────────────────────┴──────────────┘
```

**Topbar** — Model selector, Marketplace, Settings, theme toggle, Run button (Ctrl+Enter).

**Two conceptual objects:**
- **Context** (left panel) — Sources, MCP servers, skills, connectors. Saved/loaded independently.
- **Agent** (center panel) — Identity, persona, constraints, objectives, workflow. Saved/loaded/exported independently.

---

## Sources Panel (Left)

Width: 30% of viewport (min 300px, max 480px).

### Knowledge Sources

Add files that feed context into the agent. Each source has:

- **Knowledge Type** — Classification that tells the LLM how to treat the source:

| Type | Color | LLM Instruction |
|------|-------|-----------------|
| Ground Truth 🔴 | Red | "Do not contradict this." |
| Signal 🟡 | Yellow | "Interpret the underlying need." |
| Evidence 🔵 | Blue | "Cite and weigh against other evidence." |
| Framework 🟢 | Green | "Use to structure thinking." |
| Hypothesis 🟣 | Purple | "Help validate or invalidate." |
| Guideline 📏 | Orange | "Follow as active constraints." |

- **Depth** — Controls how much of the source to include:
  - Summary → Key Points → Details → Full → Verbatim
  - Each level uses more tokens but provides more context

- **Index** button — Scans the file and builds a tree index (headings → sections → content)

### MCP Servers

Shows connected MCP servers and their tools. Click **+ Add** to open the MCP picker or install from Marketplace.

### Skills

Toggle agent skills on/off. Browse more via Marketplace.

### Connectors

External integrations (Notion, Google Docs, etc.). OAuth-aware: status dots show connection state. Only addable when authenticated.

### Save/Load Context

Save the entire left panel state (sources + MCP + skills + connectors) for reuse across agents.

---

## Agent Builder (Center)

### Identity

- **Name** — Agent name
- **Description** — What the agent does
- **Icon** — Visual identifier

### Persona

Free-text field defining the agent's personality, tone, and behavior. This becomes part of the system prompt.

### Safety Profile

Three presets:
- **Autonomous** — Minimal guardrails, agent acts independently
- **Balanced** — Default. Reasonable safety with flexibility
- **Careful** — Strict constraints, asks before acting

### Constraints

Editable via modal. Displayed as compact read-only chips. Constraints are injected into the system prompt as hard rules the agent must follow.

### Objectives

- **Primary** — Main goal
- **Secondary** — Supporting goals

### Workflow

Ordered steps the agent follows. Edited via modal with two generate modes:
- **Refine** — Improve existing workflow
- **Generate** — Create from scratch based on objectives

Displayed as a compact numbered list.

### Evaluation Criteria

How to judge the agent's output quality. Displayed as chips, edited via modal.

### Save/Load/Export Agent

- **Save** — Store agent config to local library (`~/.modular-studio/agents/`)
- **Load** — Restore a previously saved agent
- **Export** — Download as Agent Directory (ZIP) or legacy formats (MD/YAML/JSON)

---

## Test Panel (Right)

Collapsed by default (48px strip with "Test ▶"). Expands to 400px.

### Three tabs:

#### Chat Tab

Single-agent conversation. Type a message, hit Enter or click Send. Uses the currently configured agent + sources.

#### Team Tab

Multi-agent execution. Configure 1-5 agents, each with:
- **Name** — Agent identifier
- **Load from Library** — Import a saved agent's config as the system prompt
- **Role Prompt** — Role-specific instructions appended to the system prompt
- **Repo URL** — GitHub repo the agent works on (added to context)

**Task** — Shared task description all agents receive.

**Run Team** — Executes all agents in parallel. Each agent gets:
- The shared system prompt (from current builder config)
- Its own role overlay
- Access to MCP tools
- Shared fact pool (facts extracted from one agent are visible to others)

**Results** — Agent cards show real-time progress:
- Current turn, status (waiting/running/completed/error)
- Output text (expandable — click "Expand" for full output)
- Token usage
- Extracted facts (color-coded by epistemic type)
- **Maximize** button (↗) — Full-screen results overlay for reading long outputs
- **Copy** button — Copy agent output to clipboard

**Shared Memory** — Facts extracted across all agents, deduplicated by key.

#### Export Tab

Download the current agent configuration:

- **Agent Directory** (primary, orange highlight) — ZIP with:
  - `agent.yaml` — Core config (name, model, token budget)
  - `SOUL.md` — Persona and tone
  - `INSTRUCTIONS.md` — Objectives, constraints, workflow
  - `TOOLS.md` — MCP servers and skills
  - `KNOWLEDGE.md` — Knowledge sources and connectors
  - `MEMORY.md` — Memory template

- **Legacy formats** — Markdown, YAML, JSON (single-file exports)

---

## Settings

### Providers

Configure LLM credentials:

| Provider | Auth | Notes |
|----------|------|-------|
| Anthropic | API Key | `x-api-key` header |
| OpenAI | API Key | Bearer token |
| Claude Agent SDK | Zero-config | Requires `claude` CLI authenticated |
| Custom | API Key | Any OpenAI-compatible endpoint |

**Test Connection** verifies the key works and fetches available models.

### MCP Servers

View all servers, their status, tool count, and errors. Connect/disconnect/remove.

### General

Theme (System/Light/Dark) and display preferences.

---

## Marketplace

Access via the shopping bag icon in the Topbar.

**Skills** — Browse and install agent capabilities. Each skill shows name, description, supported runtimes, and install count.

**MCP Servers** — Browse MCP servers (Firecrawl, Filesystem, PostgreSQL, etc.). Install with transport config.

---

## Knowledge Pipeline

The knowledge pipeline processes sources before they reach the LLM:

```
Sources → Tree Index → Knowledge Types → Contrastive Retrieval → Adaptive Depth → Context Assembly
```

1. **Tree Index** — Parses markdown headings into a navigable tree structure
2. **Knowledge Types** — Tags each chunk with its epistemic type (ground-truth, evidence, signal...)
3. **Contrastive Retrieval** — For analytical queries ("compare", "pros and cons", "evaluate"), finds both supporting AND contradicting chunks. Labels them `<supporting>` and `<contrasting>` so the LLM sees both sides.
4. **Adaptive Depth** — Allocates token budget across sources based on type priority and depth settings
5. **Context Assembly** — Wraps everything with provenance tags (`<chunk source="..." section="..." type="..." method="...">`)

### Provenance

Every chunk carries its derivation path:
- Which source file it came from
- Which section (heading path)
- What knowledge type
- What depth level
- How it was extracted

When sources conflict, the LLM is instructed to prefer ground-truth over evidence, full-depth over summary.

---

## Team Runner

### Architecture

```
Team Runner
├── Agent 1 (parallel) → LLM call → extract facts → done
├── Agent 2 (parallel) → LLM call → tool calls → extract facts → done
└── Agent 3 (parallel) → LLM call → extract facts → done
         ↓
    Shared Fact Pool (deduplicated)
         ↓
    Team Result (all outputs + shared facts)
```

### Provider Support

- **Anthropic / OpenAI / Custom** — Raw API calls with explicit tool handling. Agents use MCP tools via the backend manager.
- **Claude Agent SDK** — Routes through `query()` with built-in tools (Read, Edit, Bash, Grep, Glob, WebSearch, WebFetch). Tools are handled by the SDK internally.

### Fact Extraction

After each agent completes, its output is scanned for facts:
- **Observations** — Things the agent noticed
- **Inferences** — Conclusions drawn
- **Decisions** — Choices made
- **Hypotheses** — Theories proposed

Facts are deduplicated by key and shared across all agents in the team.

---

## Agent Directory Format

The primary export format. A self-contained directory of human-readable files:

```
my-agent/
├── agent.yaml          # Name, model, token budget, tags
├── SOUL.md             # Persona and tone
├── INSTRUCTIONS.md     # Objectives, constraints, workflow
├── TOOLS.md            # MCP servers and skills
├── KNOWLEDGE.md        # Sources and connectors
└── MEMORY.md           # Memory template
```

**Properties:**
- Git-friendly (all text files, diffable)
- Human-editable (no binary formats)
- Portable (works with Claude Code, OpenClaw, Cursor, Amp)
- Composable (mix and match files across agents)

**Export:** TestPanel → Export tab → "Agent Directory" button → downloads ZIP.

**Import:** TestPanel → Export tab → "Import Agent" button → upload ZIP.

---

## MCP Servers

### Transports

| Transport | Use Case |
|-----------|----------|
| `stdio` | Local CLI tools (npx, node, python) |
| `streamable-http` | Remote servers (Notion, cloud APIs) |

### OAuth Flow

For remote MCP servers requiring OAuth (e.g., Notion):
1. Click **Connect** on the connector
2. OAuth popup opens → authorize
3. Token stored securely (600 permissions)
4. Bearer token injected automatically on requests

### Security

- **Command allowlist** — Only safe executables: npx, node, python, python3, uvx, uv, deno, bun
- **Argument sanitization** — Shell injection prevention
- **Env var blocking** — Dangerous variables (`LD_PRELOAD`, `NODE_OPTIONS --require`) blocked

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open file picker |
| `Ctrl/Cmd + Enter` | Run agent |
| `Escape` | Close any modal/picker |

---

## Troubleshooting

### "No provider configured"

Settings → Providers → add API key → Test Connection → green checkmark.

### Run Team button does nothing

1. Verify a provider is connected (not just configured — must show green/connected status)
2. Check the browser console (F12) for `[TeamRunner]` logs
3. Make sure you typed a task in the text area

### Agent SDK shows "Not authenticated"

Run `claude` in your terminal to authenticate the CLI, then retry.

### 429 Too Many Requests

The rate limiter caps at 600 requests/minute. If you hit it, wait a moment and retry. Usually caused by rapid page refreshes.

### Results panel too small

Click the **↗ Maximize** button in the results header to view in full-screen overlay. Click **↙ Minimize** to return.
