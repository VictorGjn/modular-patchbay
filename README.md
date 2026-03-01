# Modular Studio

> The visual agent builder. Design AI agents, not just prompts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

![Modular Studio](./prototypes/light-full.png)

## What is this?

Modular Studio is a visual canvas for building AI agents through **context engineering**—the emerging paradigm of designing agents through layered context assembly rather than monolithic prompting. Think Figma for AI agents: drag, connect, and configure modular components to create sophisticated AI workflows that adapt to your specific needs.

## Key Features

• **Visual Canvas Interface** — Drag-and-drop components with real-time connections and data flow visualization
• **Mixing Console Metaphor** — Audio-inspired controls for fine-tuning agent behavior and context layers
• **Multi-Modal Knowledge Sources** — Seamlessly integrate documents, APIs, databases, and real-time data streams
• **MCP Server Integration** — Native support for Model Context Protocol servers and tool ecosystems
• **Workflow Orchestration** — Design multi-step reasoning patterns based on Anthropic's proven agent architectures
• **Universal Export** — Deploy to Claude Code, Amp, Codex, Gemini, Vibe Kanban, OpenClaw, and more
• **Context Engineering** — Advanced prompt composition with identity, instructions, constraints, and dynamic workflows
• **Real-time Agent Preview** — Live visualization of your agent's capabilities and token usage

## Architecture

Modular Studio is built around three core concepts:

### Canvas Nodes
- **Identity Node**: Define agent personality, role, and metadata
- **Instruction Node**: Configure behavior, expertise level, and objectives
- **Knowledge Node**: Connect documents, databases, and information sources
- **Skills Node**: Attach reusable capabilities and tools
- **MCP Node**: Integrate Model Context Protocol servers
- **Workflow Node**: Design step-by-step reasoning patterns
- **Output Node**: Configure response format and structure

### Mixing Console Metaphor
Inspired by audio production, the console provides precision controls for:
- **Channel Strips**: Individual knowledge source controls with EQ-style depth adjustments
- **Crossfader**: Balance between different knowledge types (ground-truth vs hypothesis)
- **Master Bus**: Global agent configuration and output formatting
- **Effects Chain**: Apply constraints, verification, and evaluation layers

### Context Engineering
Move beyond simple prompting to engineered context assembly:
- **Layered Context**: Structured identity + instructions + knowledge + tools
- **Dynamic Workflows**: Conditional step execution with loop and branching support
- **Token Budget Management**: Optimize context windows with smart depth controls
- **Multi-format Output**: Generate markdown, JSON, structured data, and more

## Agent Definition Format

Modular Studio exports agents in a standardized YAML format:

```yaml
version: '1.0'
kind: agent
identity:
  name: react-code-reviewer
  display_name: React Code Reviewer
  description: Senior React engineer specializing in code quality and accessibility
  avatar: 🔍
  tags: ['react', 'code-review', 'typescript', 'accessibility']

instructions:
  persona: You are a senior React engineer with 8+ years of experience
  tone: professional
  expertise: 5
  constraints:
    - Never approve code without proper TypeScript types
    - Always check for accessibility violations
    - Enforce consistent coding standards
  objectives:
    primary: Provide thorough, actionable code reviews
    success_criteria:
      - Identify potential bugs and performance issues
      - Suggest accessibility improvements
      - Maintain code consistency across the project

context:
  knowledge:
    - type: file
      ref: react-style-guide.md
      knowledge_type: framework
      depth: 2
    - type: file
      ref: accessibility-checklist.md
      knowledge_type: evidence
      depth: 3

  skills:
    - ref: clean-code
      source: registry

  mcp_servers:
    - name: github
      description: GitHub repository access
      transport: stdio

workflow:
  steps:
    - id: analyze
      action: Read the code diff and understand the changes
      condition: always
    - id: style-check
      action: Verify code follows React/TypeScript best practices
      tool: clean-code
    - id: accessibility
      action: Check for accessibility violations and improvements
    - id: categorize
      action: Classify issues by severity (critical/major/minor)
    - id: review
      action: Write comprehensive review with specific suggestions
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

Open `http://localhost:3000` to start designing your first agent.

## Export Targets

Modular Studio agents can be deployed to:

- **Claude Code** — Direct integration with Anthropic's CLI tool
- **Amp** — Reusable agent definitions for the Amp platform
- **Codex** — OpenAI-compatible agent configurations
- **Gemini** — Google AI agent specifications
- **Vibe Kanban** — BloopAI's workflow automation platform
- **OpenClaw** — Open-source agent runtime
- **Generic JSON** — Universal format for custom integrations

## 🔌 Runtime Integration

Modular Studio is a **design-time** tool. It produces portable agent definitions — it doesn't run them. For execution, you pair it with a runtime. This section covers how that works.

### The Model: Design → Export → Run

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│  Modular Studio  │  YAML   │   Runtime    │  exec   │   External      │
│  (design-time)   │────────▶│  (VK, etc.)  │────────▶│   Services      │
│                  │         │              │         │  (GitHub, Slack) │
└─────────────────┘         └──────────────┘         └─────────────────┘
```

1. **Design** your agent visually — identity, instructions, knowledge, tools, workflow steps
2. **Export** as YAML (or JSON for specific targets)
3. **Import** into any compatible runtime to execute the agent

### What Modular Handles vs What Runtimes Handle

| Concern | Modular Studio (design) | Runtime (execution) |
|---|---|---|
| Agent identity & persona | ✅ Define name, role, tone | Read from YAML |
| Instructions & constraints | ✅ Visual editor | Injected into system prompt |
| Knowledge sources | ✅ Attach files, URLs, DBs | Fetches & indexes content |
| MCP server config | ✅ Configure servers & env | Spawns & manages processes |
| Workflow steps | ✅ Define step graph | Orchestrates execution |
| Output schemas | ✅ Design structured output | Validates & routes to targets |
| Token budget | ✅ Set limits per channel | Enforces at inference time |
| Model selection | ✅ Pick model | Makes API calls |
| Secrets / API keys | ❌ Never stored | Resolved from environment |
| Scheduling / triggers | ❌ Not in scope | Cron, webhooks, events |
| Conversation memory | ❌ Schema only | Manages state across turns |
| Monitoring / logs | ❌ Not in scope | Observability, error handling |

### YAML Export Schema

The canonical export format that runtimes consume:

```yaml
version: "1.0"
kind: agent

identity:
  name: "pr-reviewer"
  display_name: "PR Reviewer"
  description: "Reviews pull requests for quality and accessibility"
  tags: ["code-review", "react"]
  agent_version: "1.0.0"

instructions:
  persona: |
    You are a senior engineer. Be thorough but constructive.
  constraints:
    - "Never approve code with accessibility violations"
    - "Always suggest a concrete fix"
  objectives:
    primary: "Provide actionable code reviews"
    success_criteria:
      - "Every issue includes a code suggestion"

context:
  knowledge:
    - type: file
      ref: "./knowledge/style-guide.md"
      knowledge_type: framework
      depth: 2
    - type: url
      ref: "https://react.dev/reference/rules"
      refresh: weekly

  skills:
    - ref: clean-code
      source: registry

  mcp_servers:
    - name: github
      transport: stdio
      command: "npx @modelcontextprotocol/server-github"
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"

workflow:
  steps:
    - id: analyze
      action: "Read the PR diff"
      condition: always
    - id: review
      action: "Check against style guide and a11y rules"
      tool: clean-code
    - id: format
      action: "Format as GitHub PR comment"
      condition: always
```

### Vibe Kanban Integration

[Vibe Kanban](https://github.com/BloopAI/vibe-kanban) (VK) is an open-source task automation platform. Modular YAML maps naturally to VK task templates:

| Modular YAML field | VK concept |
|---|---|
| `identity.name` | Task template name |
| `instructions.persona` + `constraints` | System prompt |
| `context.mcp_servers` | Tool configuration |
| `workflow.steps` | Task steps / subtasks |
| `context.knowledge` | Attached context |

**Workflow:**

```bash
# 1. Export from Modular Studio
#    File → Export → YAML → saves modular-agent.yaml

# 2. Import into Vibe Kanban
vk import modular-agent.yaml

# 3. Run
vk run pr-reviewer --input "Review PR #42"
```

VK reads the `workflow.steps` array to create its task pipeline, wires up MCP servers as tool providers, and uses `instructions` to configure the underlying LLM call.

### Other Runtimes

The YAML format is runtime-agnostic. Here's how other tools consume it:

**Claude Code / OpenClaw:**
```bash
# Convert to AGENTS.md-style prompt
modular export --target claude-code --output AGENTS.md

# Or use the YAML directly with OpenClaw
openclaw agent run modular-agent.yaml
```

**Custom integration:**
```python
import yaml

with open("modular-agent.yaml") as f:
    agent = yaml.safe_load(f)

# Build your system prompt from the definition
system = f"{agent['instructions']['persona']}\n"
system += "\n".join(f"- {c}" for c in agent['instructions']['constraints'])

# Wire up MCP servers, knowledge, etc.
```

The export format is intentionally declarative — it describes *what* the agent needs, not *how* to wire it. Any runtime that can parse YAML can consume it.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Canvas**: ReactFlow for visual node editing
- **Styling**: Tailwind CSS with custom design system
- **State**: Zustand for predictable state management
- **UI Components**: Custom design system with modular theming
- **Export**: Multi-format agent definition generation

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Context engineering is the future of AI agent development. Start building with Modular Studio today.*
