# Context Engineering Vision

## The Pain Point
Every AI agent builder (Cursor, Claude Code, Codex, VK) treats context as a black box.
You throw files at it and hope the model figures out what matters. There's no visibility into:
- What's actually in the context window
- How much space each source consumes
- Whether knowledge is stale or redundant
- Which MCP tools are healthy vs broken
- How instructions interact with knowledge depth

## Modular's Value Prop
"The only tool that makes context engineering visible and manageable."

Not a runtime. Not another agent framework. A **design-time IDE for agent context.**

## Context Engineering Features (Hero)

### 1. Knowledge Depth Mixer
Each knowledge source has a tunable depth (Full → High → Reference → Skim → Mention).
Depth controls HOW MUCH context a source contributes:
- Full: entire document in context
- High: key sections + summaries
- Reference: summaries only
- Skim: one-line per section
- Mention: just the source name for awareness

### 2. Knowledge Type System
Six semantic types with visual color coding:
- 🔴 Ground Truth: canonical facts (PRD, API docs)
- 🟡 Signal: real-time data (Slack, alerts, metrics)
- 🔵 Evidence: supporting data (research, logs)
- 🟢 Framework: mental models (playbooks, processes)
- 🟣 Hypothesis: unverified ideas
- ⚪ Artifact: generated outputs

### 3. Context Budget Visualizer
Real-time token budget showing:
- Total allocation vs model limit
- Breakdown by category (knowledge, instructions, workflow, memory)
- Per-source token estimates
- Warning when approaching limit
- Optimization suggestions ("reduce Slack from Full to Skim to save 12K tokens")

### 4. Tool Health Dashboard
MCP servers and Skills with live status:
- Green: connected, responsive
- Yellow: slow response (>2s), rate-limited
- Red: auth failed, unreachable
- Gray: disabled
- Version/freshness for skills ("update available")

### 5. Context Boosters (Future — "Plugins")
Pluggable context optimization modules:
- **Token compressors**: Rust-based tokenizers that compress context efficiently
- **Semantic dedup**: detect redundant knowledge across sources
- **Relevance scoring**: LLM-powered ranking of source relevance to current task
- **Auto-depth**: automatically adjust depth based on query relevance
- **Context snapshots**: save/restore context configurations for different tasks

These would be installable via `npx modular-booster install <name>` or from a marketplace.

## VK Selling Angle
VK (Vibe Kanban / BloopAI) is a runtime — it executes agents. 
Modular is design-time — it designs agent context.
**"Design in Modular, run in VK."**

The export format bridges them:
- Modular exports structured YAML with context budget, knowledge depth, tool config
- VK imports and executes with those exact parameters
- No other tool gives VK this level of context control

## Why This Wins
1. **No competitor does this** — everyone focuses on runtime, nobody on context design
2. **Context is the bottleneck** — Shopify CEO, Karpathy, Anthropic all say "context engineering" is the skill
3. **Visual = accessible** — PMs and non-engineers can design agents without code
4. **Export-first = platform-agnostic** — works with any runtime, not locked in
