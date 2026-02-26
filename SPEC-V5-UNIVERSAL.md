# SPEC V5 — Modular as Universal Agent Design Layer

## Vision
Modular is the **design-time layer** for AI agents. You compose once, export everywhere. No vendor lock-in, no runtime dependency. The canvas IS the agent definition — visual, portable, universal.

## Core Principle
**Modular does NOT execute agents. It designs them.**

Execution is delegated to runtimes:
- Claude Code / Amp / Codex / Gemini CLI / OpenCode (coding agents)
- Vibe Kanban (orchestration)
- OpenClaw (always-on assistant)
- Custom pipelines (API calls, CI/CD)

## Architecture

```
┌─────────────────────────────────────────┐
│           MODULAR CANVAS                │
│                                         │
│  Knowledge ──► Agent ──► Output         │
│  Skills   ──►   ↑   ──► Response       │
│  MCP      ──►   │                       │
│                  │                       │
│  ◄── feedback loops ──►                 │
└──────────────┬──────────────────────────┘
               │
         EXPORT / SAVE AS AGENT
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 .claude/   .amp/     mcp.json    openclaw.yaml   vibe-kanban/
 agents/    agents/   (Amp)       (OpenClaw)      tasks/
 *.md       *.yaml                                *.json
```

## Export Targets

### 1. Claude Code / Claude Desktop
```yaml
# .claude/agents/my-agent.md
---
name: Research Analyst
model: claude-opus-4
temperature: 0.7
tools:
  - web-search
  - file-reader
mcp_servers:
  - name: notion
    transport: stdio
    command: npx @notionhq/mcp
reads:
  - ./data/guidelines.md
---
## Role
Deep research analyst...
```

### 2. Amp (Sourcegraph)
```yaml
# .amp/agents/my-agent.yaml
name: Research Analyst
model: claude-opus-4
tools:
  - web-search
mcp:
  notion:
    command: npx @notionhq/mcp
```

### 3. OpenAI Codex
```json
// .codex/agents/my-agent.json
{
  "name": "Research Analyst",
  "model": "gpt-4o",
  "instructions": "Deep research analyst...",
  "tools": ["web-search"],
  "mcp_servers": [{"name": "notion", "transport": "stdio"}]
}
```

### 4. Vibe Kanban
```json
// Task template exported for VK
{
  "template": "Research Analyst",
  "agent": "claude-code",
  "context_files": ["./data/guidelines.md"],
  "mcp_config": {"notion": {"command": "npx @notionhq/mcp"}},
  "tools": ["web-search"]
}
```

### 5. OpenClaw
```yaml
# openclaw.yaml fragment
agents:
  research-analyst:
    model: claude-opus-4
    temperature: 0.7
    skills:
      - web-search
    mcp:
      servers:
        notion:
          command: npx @notionhq/mcp
```

### 6. Generic JSON (portable)
```json
{
  "modular_version": "1.0",
  "agent": {
    "name": "Research Analyst",
    "model": "claude-opus-4",
    "temperature": 0.7,
    "system_prompt": "Deep research analyst...",
    "planning_mode": "chain-of-thought",
    "knowledge": [...],
    "skills": [...],
    "mcp_servers": [...],
    "output_formats": ["markdown", "slides"],
    "connectors": {
      "read": [{"service": "notion", "config": {...}}],
      "write": [{"service": "slack", "config": {...}}]
    }
  }
}
```

## Skill Installation (Runtime-Agnostic)

### CLI: `npx modular-skills`
```bash
# Interactive mode
npx modular-skills install web-search
  ? Target: (Claude Code / Amp / Codex / Gemini / OpenCode / All)
  ? Scope: (Global ~/.agents/ / Project ./.agents/)
  ? Mode: (Copy / Symlink / Registry link)

# Direct mode  
npx modular-skills install web-search --target claude --scope project
npx modular-skills install web-search --target amp --scope global --symlink

# List installed
npx modular-skills list
npx modular-skills list --target claude

# Search registry
npx modular-skills search "maritime"

# Uninstall
npx modular-skills remove web-search --target claude
```

### How it works per target:
| Target | Install location | Config format |
|--------|-----------------|---------------|
| Claude Code | `.claude/agents/` or `~/.claude/agents/` | YAML frontmatter .md |
| Amp | `.amp/` or `~/.amp/` | YAML |
| Codex | `.codex/` or `~/.codex/` | JSON |
| Gemini CLI | `.gemini/` or `~/.gemini/` | YAML |
| OpenCode | `.opencode/` or `~/.opencode/` | JSON |
| OpenClaw | `.agents/skills/` or `~/.agents/skills/` | SKILL.md |

### Skill package format (universal)
```
my-skill/
├── SKILL.md          # Human-readable description
├── skill.json        # Machine-readable manifest
│   {
│     "name": "web-search",
│     "version": "1.2.0",
│     "description": "Search the web via Brave API",
│     "requires": { "env": ["BRAVE_API_KEY"] },
│     "mcp": { "command": "npx @anthropic/mcp-brave" },
│     "adapters": {
│       "claude": { "tool_name": "web_search" },
│       "amp": { "tool_name": "brave_search" },
│       "codex": { "function_name": "search_web" }
│     }
│   }
├── adapters/
│   ├── claude.md     # Claude-specific SKILL.md
│   ├── amp.yaml      # Amp-specific config
│   └── codex.json    # Codex-specific config
└── scripts/
    └── install.sh    # Post-install hook
```

## MCP Server Management (Runtime-Agnostic)

MCP servers are declared in Modular's canvas (McpNode / ConnectorTile) and exported to the target runtime's config format.

### In Modular canvas:
User adds "Notion" connector → configures page_id, auth → Modular stores:
```json
{
  "service": "notion",
  "name": "Product Wiki",
  "transport": "stdio",
  "command": "npx @notionhq/mcp",
  "env": { "NOTION_API_KEY": "${NOTION_API_KEY}" },
  "config": { "page_id": "abc123" }
}
```

### Export writes to target config:
- Claude Desktop → `claude_desktop_config.json`
- Amp → `mcp.json`
- Codex → `.codex/mcp.json`
- OpenClaw → `openclaw.yaml` mcp.servers section
- Vibe Kanban → task-level MCP config

## Feedback Edges (Internal Canvas Feature)

### Knowledge Output
- AgentNode has secondary output port "KNOWLEDGE OUT"
- Dashed cyan edge → KnowledgeNode
- After a run, structured output tagged as new knowledge appears as ghost tile
- User validates → permanent tile in the right Knowledge Type category
- Exported as additional `reads:` entries in the agent config

### Skills Discovery
- If agent suggests missing capabilities during Test Run
- Ghost tile appears in SkillsNode with "Install?" action
- Click → runs `npx modular-skills install <skill> --target <current>`
- Tile goes solid after install

## Canvas → Config Mapping

| Canvas Element | Config Field |
|---------------|-------------|
| KnowledgeNode tiles | `reads:` / `context_files:` |
| Knowledge depth levels | Token allocation / summarization hints |
| Knowledge types | Epistemic weight in system prompt |
| SkillsNode tiles | `tools:` |
| McpNode tiles | `mcp_servers:` |
| ConnectorTile (read) | `reads:` + MCP source config |
| ConnectorTile (write) | `output.destinations:` |
| AgentNode model | `model:` |
| AgentNode temperature | `temperature:` |
| AgentNode system prompt | `system:` / `instructions:` |
| AgentNode planning mode | Planning strategy in system prompt |
| OutputNode formats | `output_format:` |
| PromptNode text | Default prompt / task template |
| Cable connections | Determines which elements are active |

## Pain Points Solved

| Pain Point | Current State | Modular Solution |
|-----------|--------------|-----------------|
| Agent config is manual YAML/JSON | Edit text files blindly | Visual canvas, drag & drop |
| No portability between runtimes | Rewrite config per tool | Export to any target |
| MCP server setup is arcane | Copy-paste JSON, env vars | ConnectorTile with guided setup |
| Knowledge context is invisible | Stuffed in system prompt | Knowledge Type System with depth control |
| Skills discovery is manual | Google → GitHub → install | Marketplace search → one-click install |
| No feedback loops | Agent output is terminal | Knowledge/Skills feedback edges |
| Can't visualize agent architecture | Mental model only | Canvas IS the architecture |
| Team collaboration on agents | Share text files | Share canvas state / export files |
| Switching between Claude/Amp/Codex | Rewrite everything | Change export target, same canvas |

## Vibe Kanban Integration Path

1. **Phase 1 — Export compatibility**
   Modular "Save as Agent" can generate VK-compatible task templates.
   VK loads them as pre-configured agent variants.

2. **Phase 2 — Bidirectional sync**
   VK task results → Modular Knowledge (via webhook/file)
   Modular agent updates → VK picks up new config automatically

3. **Phase 3 — Embedded canvas**
   Modular canvas embedded as iframe/component in VK UI.
   "Configure Agent" button in VK opens Modular canvas inline.

## Implementation Priority

1. Export system (multi-target Save as Agent) — THE feature
2. `npx modular-skills` CLI — standalone, publishable
3. Vercel deploy — shareable URL
4. README + demo GIF — launch material
5. Feedback edges — canvas innovation
6. VK export format — partnership opener
