# Modular Studio

**The context engineering IDE for AI agents.**

Build AI agents that truly understand your codebase, documentation, and tools — through intelligent knowledge pipelines, not just prompts.

## Quick Start

```bash
npx modular-studio
```

Opens at [localhost:4800](http://localhost:4800).

## What It Does

Modular Studio is a visual IDE for designing AI agent systems. You describe what you want → it generates a complete agent configuration with persona, constraints, objectives, workflow, and tool selection — all grounded in your actual knowledge sources.

### The Workflow

1. **Describe** — Write what your agent should do (or pick a template)
2. **Generate** — AI creates a full agent config from your description via meta-prompt
3. **Knowledge** — Connect repos, files, connectors. See what's missing.
4. **Tools** — Pick MCP servers and skills from 150+ integrations
5. **Memory** — Configure conversation memory strategy
6. **Review** — Inspect and refine: persona, constraints, objectives, workflow
7. **Test** — Chat with your agent, see the full pipeline trace
8. **Qualify** — Run structured evaluations against test cases
9. **Export** — Output for Claude Code, OpenClaw, Codex, Amp, or generic JSON

### What Makes It Different

| | **Prompt Engineering** | **RAG Tools** | **Modular Studio** |
|---|---|---|---|
| **Starting point** | Manual writing | Upload docs | Describe in natural language |
| **Knowledge** | Copy-paste | Chunk embeddings | Tree-aware semantic retrieval |
| **Visibility** | None | Similarity scores | Full pipeline observability |
| **Output** | One prompt | API endpoint | Multi-target agent definitions |
| **Iteration** | Rewrite | Re-embed | Visual refinement + qualification |

## Key Features

- **🧠 Meta-Prompt Generation** — Describe your agent, get a complete configuration
- **🌳 Tree-Aware Retrieval** — Knowledge pipeline understands document and code structure
- **📊 Pipeline Observability** — See exactly how context flows: source assembly → retrieval → provenance
- **🔌 150+ MCP Connectors** — GitHub, Notion, Slack, HubSpot, and more
- **🏗️ Agent Library** — Save, version, and manage multiple agents
- **📋 Structured Review** — Identity, persona, constraints, objectives, workflow — all editable
- **🧪 Built-in Testing** — Chat with your agent, run teams, trace every step
- **📤 Multi-Target Export** — Claude Code (.md), OpenClaw (.yaml), Codex (.json), Amp, generic

## Installation

### From npm

```bash
# Run directly
npx modular-studio

# Or install globally
npm install -g modular-studio
modular-studio --open
```

### From Source

```bash
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay
npm install --legacy-peer-deps
npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:4800`

## Configuration

### Providers

Connect at least one LLM provider in **Settings → Providers**:

- **Claude Agent SDK** — Zero-config if running inside Claude Code
- **Anthropic** — API key required
- **OpenAI** — API key required
- **OpenRouter** — API key for aggregated model access
- **Google** — API key for Gemini models

### Knowledge Sources

- **Local Files** — Drag and drop markdown, code, or documents
- **Git Repos** — Clone and index any GitHub repository
- **Connectors** — Notion, Slack, HubSpot via MCP

## Requirements

- **Node.js 18+**
- **LLM API Key** (Anthropic, OpenAI, or compatible provider)

## Architecture

```
src/
├── tabs/           # Wizard tab components (Describe, Knowledge, Tools, etc.)
├── panels/         # Sub-panels (AgentBuilder, review sections, pipeline)
├── components/     # Shared components (AgentLibrary, Topbar, InlineTraceView)
├── services/       # Pipeline services (treeIndexer, compress, contextAssembler)
├── store/          # Zustand stores (console, trace, conversation, memory)
├── utils/          # Agent generation, export, analysis utilities
└── layouts/        # WizardLayout, DashboardLayout
server/
├── routes/         # API routes (agents, providers, conversations)
└── services/       # Backend services (agentStore, embeddings)
```

## License

Apache 2.0 — Free for commercial and open source use.

## Links

- **npm**: [modular-studio](https://www.npmjs.com/package/modular-studio)
- **GitHub**: [VictorGjn/modular-patchbay](https://github.com/VictorGjn/modular-patchbay)
