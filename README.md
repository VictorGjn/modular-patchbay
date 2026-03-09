# Modular Studio

> The Context Engineering Layer — an IDE for designing AI agent knowledge pipelines.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests: 509](https://img.shields.io/badge/tests-509_passing-green.svg)]()
[![Version: 0.2.0](https://img.shields.io/badge/version-0.2.0-blue.svg)]()

## What is this?

Modular Studio is a **context engineering IDE** — a visual workspace for building AI agents through structured knowledge pipelines rather than monolithic prompts.

Instead of writing one massive system prompt and hoping for the best, you design a pipeline:

```
Sources → Tree Index → Budget Allocator → Agent Navigator → Compress → Context Assembly → LLM
```

Every source (markdown files, Notion pages, HubSpot records, Slack threads, GitHub repos) becomes a **tree of headings** that an agent navigates per-task, selecting branches at the right depth. An epistemic budget allocator ensures ground-truth sources get priority over hypotheses. The result is dense, relevant context assembled within a token budget.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Modular Studio IDE                              │
│                                                                         │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │ Sources Panel │   │  Agent Builder    │   │   Test & Export Panel   │  │
│  │              │   │                  │   │                        │  │
│  │ Knowledge    │   │ Identity         │   │ Chat Testing           │  │
│  │ MCP Servers  │   │ Instructions     │   │ Execution Traces       │  │
│  │ Skills       │   │ Constraints      │   │ Export (6 formats)     │  │
│  │ Memory       │   │ Workflow         │   │ Security Badges        │  │
│  │ Fact Insights│   │ Tools            │   │                        │  │
│  └──────┬───────┘   └────────┬─────────┘   └──────────┬─────────────┘  │
│         │                    │                         │                │
│  ───────┴────────────────────┴─────────────────────────┴────────────── │
│                                                                         │
│  ┌─────────────────── Context Engineering Pipeline ──────────────────┐  │
│  │                                                                   │  │
│  │  Sources ──► Tree    ──► Budget     ──► Agent      ──► Compress  │  │
│  │             Index       Allocator      Navigator               │  │
│  │             (4 connectors) (epistemic   (LLM-driven   (semantic  │  │
│  │                          weights)      branch sel.)   dedup)    │  │
│  │                              │              │                     │  │
│  │                              ▼              ▼                     │  │
│  │                    Contradiction    Corrective Re-Nav             │  │
│  │                     Detection       + HyDE                       │  │
│  │                              │              │                     │  │
│  │                              └──────┬───────┘                     │  │
│  │                                     ▼                             │  │
│  │                          Attention-Ordered                        │  │
│  │                          Context Assembly                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────── Memory System ─────────────────────────────────┐  │
│  │  Fact Extraction ──► Three-Factor Retrieval ──► Consolidation    │  │
│  │  (pattern + LLM)    (relevance + recency       (prune, merge,    │  │
│  │                      + importance)               promote)         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────── Team Runtime ──────────────────────────────────┐  │
│  │  POST /api/runtime/team ──► Parallel Agents ──► Shared Facts     │  │
│  │  (SSE streaming)            (Claude Agent SDK)   (deduplicated)   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Backend: Express 5 + TypeScript        Frontend: React 19 + Zustand   │
│  Port 4800                              Port 5173 (dev)                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

### Pipeline
- **Epistemic Budget Allocator** — Token budgets by knowledge type (ground-truth 30%, evidence 20%, framework 15%, guideline 15%, signal 12%, hypothesis 8%)
- **4 Source Connectors** — Markdown, Structured, Chronological, Flat — normalize any source to a navigable tree
- **Agent Navigator** — LLM reads tree headlines and selects relevant branches per task
- **Attention-Aware Ordering** — Sources reordered to exploit LLM primacy/recency attention bias
- **Contradiction Detection** — Heuristic entity extraction + epistemic priority resolution, no LLM calls
- **Context Compression** — Semantic dedup, filler removal, code compression (inspired by [rtk-ai/rtk](https://github.com/rtk-ai/rtk))
- **Corrective Re-Navigation** — Critique pass identifies gaps, re-navigates with 20% budget cap
- **HyDE Navigation** — Hypothetical ideal answer improves heading matching for complex queries

### Memory
- **Fact Extraction** — Pattern-based + LLM-based fact extraction with epistemic typing
- **Three-Factor Retrieval** — `score = relevance + 0.5×recency + 0.5×importance`
- **Ebbinghaus Decay** — Strength = importance × e^(-days/halfLife), half-life extends with access frequency
- **Consolidation** — Prune weak facts, merge similar ones, promote validated hypotheses

### Runtime
- **Team Execution** — Multi-agent parallel runs with SSE streaming and per-agent model override
- **Cross-Agent Facts** — Extracted facts shared across team members, deduplicated by confidence
- **Contract Extraction** — Automatic type/interface extraction from feature specs
- **Claude Agent SDK** — Virtual provider for backend agent execution

### IDE
- **Knowledge Type System** — 6 types with classification rules and visual color coding
- **MCP Server Registry** — 100+ pre-configured servers with live health probes
- **Skills Marketplace** — Searchable catalog with security badges (GEN, Socket, Snyk)
- **Universal Export** — Claude Code, Amp, Codex, Vibe Kanban, OpenClaw, Generic JSON
- **Execution Traces** — Timeline of LLM calls, tool invocations, retrievals
- **Automatic Versioning** — Semantic diffs on every agent change
- **AI-Powered Generation** — Generate full agent configs from plain-language descriptions

## Quick Start

```bash
# Run directly
npx modular-studio

# Or install globally
npm install -g modular-studio
modular-studio

# Development
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay
npm install --legacy-peer-deps
npm run dev          # Frontend on :5173, backend on :4800
npm run build:all    # Full production build
npm test             # 509 tests
```

### First steps

1. Add an LLM provider (Anthropic, OpenAI, OpenRouter, or Google)
2. Create an agent — set identity, persona, objectives, constraints
3. Add knowledge sources — assign knowledge types (ground-truth, evidence, framework, etc.)
4. Test with the chat panel — the pipeline assembles context automatically
5. Export to your preferred format (Claude Code, Amp, Codex, etc.)

## Agent Definition Format

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

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + custom design system (18 DS primitives)
- **State**: Zustand (12+ stores)
- **Backend**: Express 5 + TypeScript (LLM proxy, MCP health, repo indexer)
- **Agent SDK**: @anthropic-ai/claude-agent-sdk
- **Testing**: Vitest (unit) + Playwright (E2E) — 509 tests
- **Fonts**: Space Mono (labels) + Inter (body)

## Documentation

| Document | Description |
|---|---|
| [Release Notes v0.2.0](docs/RELEASE-v0.2.0.md) | What's new in v0.2.0 |
| [Usage Guide](docs/USAGE-GUIDE.md) | Comprehensive usage guide |
| [Hurricane Use Case](docs/USE-CASE-HURRICANE.md) | End-to-end maritime hurricane response validation |
| [Dogfood Review](docs/DOGFOOD-REVIEW.md) | Can Modular Studio improve itself? |
| [Agent Architecture](docs/AGENT-ARCHITECTURE.md) | Platform design and agent definition format |
| [Context Engineering Vision](docs/CONTEXT-ENGINEERING-VISION.md) | Product vision and value proposition |
| [Knowledge Pipeline v2](docs/KNOWLEDGE-PIPELINE-V2.md) | Pipeline architecture spec |
| [Memory System](docs/MEMORY-SYSTEM-ANALYSIS.md) | Memory management design |

## Contributing

We use conventional commits:

```
feat: add embedding-based navigation
fix: budget allocator overflow on empty sources
docs: add hurricane use case validation
refactor: simplify depth filter to budget multiplier
test: add contradiction detector edge cases
```

### Development workflow

1. Fork and clone the repository
2. `npm install --legacy-peer-deps`
3. `npm run dev` — starts frontend + backend
4. Make changes, write tests
5. `npm test` — ensure all 509 tests pass
6. `npm run build:all` — verify production build
7. Submit a PR with conventional commit title

### Code quality

- No dead code — if it's not used, delete it
- DRY + KISS — prefer simplicity over abstraction
- Continuous refactoring — leave code better than you found it
- Squash-and-merge for PRs

## Acknowledgments

- [rtk-ai/rtk](https://github.com/rtk-ai/rtk) — Rust Token Killer. Our context compression module is inspired by RTK's approach to minimizing LLM token consumption.
- [ReactFlow](https://reactflow.dev) — Used for the visual canvas mode.
- [Anthropic](https://anthropic.com) — Claude Agent SDK for backend agent execution.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

*Context engineering is the layer every AI platform needs. Modular Studio is that layer.*
