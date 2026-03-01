# Modular Studio

> Context engineering IDE for AI agents. Design knowledge pipelines, not just prompts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## What is this?

Modular Studio is a **context engineering IDE** — a 3-panel dashboard for building AI agents through structured knowledge pipelines rather than monolithic prompts.

Instead of writing one massive system prompt and hoping for the best, you design a pipeline:

```
Sources → Tree Index → Agent Navigator → Compress → Context Assembly → LLM
```

Every source (markdown files, Notion pages, HubSpot records, Slack threads, GitHub repos) becomes a **tree of headings** that an agent navigates per-task, selecting branches at the right depth. The result is dense, relevant context assembled within a token budget.

## The Pipeline

### 1. Source Connectors
Any source becomes a tree. Four connector types handle everything:

- **`indexMarkdown()`** — Markdown files (heading hierarchy)
- **`indexStructured()`** — Notion blocks, HubSpot fields, API responses
- **`indexChronological()`** — Slack threads, Granola transcripts, logs
- **`indexFlat()`** — Plain text, code files

### 2. Tree Index
Every source is parsed into a uniform tree: `{ nodeId, title, depth, text, tokens, totalTokens, children, meta }`. Meta carries `sourceType`, `sourceId`, `timestamp`, `fieldGroup` — supporting any connector.

### 3. Agent Navigator
Given a task, the navigator reads the tree headlines and decides which branches matter. It produces a navigation plan: branch IDs + target depth per branch. This is **agent-driven** — the LLM picks what's relevant, not the user.

### 4. Context Compression
Selected branches still contain noise. The compressor (inspired by [rtk-ai/rtk](https://github.com/rtk-ai/rtk)) reduces content through semantic dedup, filler removal, and code compression. Priority-aware budget allocation gives critical sources more room.

### 5. Context Assembly
Compressed branches are packed into `<source>` XML tags within the token budget, producing structured messages ready for any LLM.

### 6. Depth Filtering
Five depth levels control how much of each branch survives:

| Level | Name | What's included |
|-------|------|-----------------|
| 0 | Full | All text |
| 1 | Detail | Leaves → first paragraph |
| 2 | Summary | First sentence per section |
| 3 | Headlines | H1 + H2 titles only |
| 4 | Mention | Document title only |

Token budget enforcement auto-degrades depth when content exceeds the budget.

## Dashboard Layout

Three-panel IDE layout:

| Left (340px) | Center (flex) | Right (380px) |
|---|---|---|
| **Sources Panel** | **Agent Builder** | **Test & Export** |
| Generator, Knowledge (depth mixer), MCP servers, Skills, Memory, Fact Insights | Identity, Persona, Constraints, Objectives, System Prompt, Workflow, Context Budget | Chat testing + Export to Claude Code, Amp, Codex, Vibe Kanban, OpenClaw |

## Features

- **Knowledge Depth Mixer** — Per-source depth control with token budget visualization
- **MCP Server Registry** — 100+ pre-built configurations with health probes (green/yellow/red)
- **AI-Powered Generation** — Generate full agent configs from plain-language descriptions
- **Context Compression** — Semantic dedup + filler removal + code compression (inspired by [rtk-ai/rtk](https://github.com/rtk-ai/rtk))
- **Tree Navigator** — Agent-driven branch selection per task
- **Execution Traces** — Timeline of LLM calls, tool invocations, retrievals, errors
- **Team Knowledge Graph** — Multi-agent fact sharing with per-agent/per-team/global scoping
- **Automatic Versioning** — Every agent change is tracked with semantic diffs
- **Fact Insights** — Analyze extracted facts for promotion opportunities across agents
- **Universal Export** — Claude Code, Amp, Codex, Vibe Kanban, OpenClaw, Generic JSON
- **Repository Indexer** — Scan codebases and generate feature-level documentation

## Agent Definition Format

Modular Studio exports agents as standardized YAML:

```yaml
version: '1.0'
kind: agent

identity:
  name: fleet-monitor
  display_name: Fleet Monitor
  description: Real-time vessel performance monitoring agent
  tags: ['maritime', 'fleet', 'monitoring']

instructions:
  persona: |
    You are a maritime fleet performance analyst.
    Monitor vessel metrics and flag anomalies.
  constraints:
    - Never recommend speed changes without fuel impact analysis
    - Always include CII rating context
  objectives:
    primary: Detect performance anomalies early
    success_criteria:
      - Flag fuel overconsumption within 4 hours
      - Correlate weather impact on route efficiency

context:
  knowledge:
    - type: file
      ref: fleet-specs.md
      knowledge_type: ground-truth
      depth: 0
    - type: structured
      ref: hubspot://deals
      knowledge_type: signal
      depth: 2

  mcp_servers:
    - name: github
      transport: stdio
      command: npx @modelcontextprotocol/server-github
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"

workflow:
  steps:
    - id: ingest
      action: Read latest vessel telemetry
      condition: always
    - id: analyze
      action: Compare against baseline performance
    - id: alert
      action: Flag anomalies with severity and recommended actions
```

## Quick Start

```bash
# Install and run
npx modular-studio

# Or install globally
npm install -g modular-studio
modular-studio

# Development
npm install --legacy-peer-deps
npm run dev          # Frontend on :5173, backend on :4800
npm run build:all    # Full production build
npm test             # 241 tests
```

## Export Targets

| Target | Format | Use case |
|--------|--------|----------|
| Claude Code | `AGENTS.md` | Direct CLI integration |
| Amp | YAML | Sourcegraph agent definitions |
| Codex | JSON | OpenAI-compatible configs |
| Vibe Kanban | YAML | BloopAI task automation |
| OpenClaw | YAML | Open-source agent runtime |
| Generic | JSON | Custom integrations |

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + custom design system (18 DS primitives)
- **State**: Zustand (12+ stores)
- **Backend**: Express 5 + TypeScript (LLM proxy, MCP health, repo indexer)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Fonts**: Space Mono (labels) + Inter (body)

## Acknowledgments

- [rtk-ai/rtk](https://github.com/rtk-ai/rtk) — Rust Token Killer. Our context compression module is inspired by RTK's approach to minimizing LLM token consumption. RTK compresses CLI outputs; we apply similar principles to knowledge documents.
- [ReactFlow](https://reactflow.dev) — Used for the visual test mode canvas.
- [Anthropic](https://anthropic.com) — Claude Agent SDK for backend agent execution.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Context engineering is the layer every AI platform needs. Modular Studio is that layer.*
