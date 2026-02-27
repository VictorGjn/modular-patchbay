# ROADMAP V2 — Prioritized Implementation Plan

**Date:** 2026-02-27
**Status:** Active — replaces ROADMAP-NEXT.md as the canonical roadmap

---

## Phase 1: Demo-Ready (This Week)

> **Goal:** Demo to 10 technical colleagues. First impression = "holy shit, this actually works."

| # | Item | Effort | Deps | Impact | Notes |
|---|------|--------|------|--------|-------|
| 1.1 | **Wire MCP frontend to real backend** | S | None | 🔴 High | McpNode reads from `MOCK_MCP_SERVERS`. Backend MCP manager already works (`/api/mcp`). Just replace mock data with `mcpStore` state. The plumbing exists on both sides. |
| 1.2 | **Real LLM run with visible streaming** | M | API key in settings | 🔴 High | Already works (`llmService.ts` + `server/routes/llm.ts`). Verify: open studio → type prompt → hit Run → see streaming response. Fix any rough edges. |
| 1.3 | **MCP tool use visible in response** | M | 1.1 | 🔴 High | Connect an MCP server (e.g. filesystem), run a prompt that triggers tool use, show tool calls inline in ResponseNode. The Agent SDK route already supports this. |
| 1.4 | **Real knowledge from files** | M | None | 🔴 High | Add `GET /api/knowledge?path=...` route that scans a directory. KnowledgeNode reads from this instead of `KNOWLEDGE_TREE`. Even a flat file listing with real token estimates is a huge upgrade. |
| 1.5 | **Fix top 5 UI bugs from AUDIT-REPORT** | S | None | 🔴 High | B1 (modal z-index), B3 (truncated buttons), A1 (missing aria-labels), plus any visible jank. Polish pass. |
| 1.6 | **One-command setup: `npx modular-studio`** | S | npm account | 🔴 High | `bin` entry exists in package.json. Verify `npm pack` → `npx` works. Fix any path issues in `dist-server/bin/modular-studio.js`. |
| 1.7 | **Node drag from sidebar** | M | None | 🟡 Medium | Currently nodes are static layout. Add a left sidebar with draggable node palette. React Flow has built-in DnD support. |
| 1.8 | **Cable animation during execution** | S | None | 🟡 Medium | `strokeDasharray` animation on active edges during a run. Pure CSS. Small effort, big "wow." |

**Demo script:** Open studio → drag nodes → connect filesystem MCP → load real project files as knowledge → write prompt → Run → watch streaming response with tool use → export as Claude agent file.

**Competitive position after Phase 1:** Ahead of interface0 (we have visual canvas + MCP), ahead of ChatGPT Projects (visible token budget, depth control), on par with Langflow for visual but far simpler UX.

---

## Phase 2: Alpha (Next 2 Weeks)

> **Goal:** Usable for daily work. Victor uses it instead of raw Claude.

| # | Item | Effort | Deps | Impact | Notes |
|---|------|--------|------|--------|-------|
| 2.1 | **npm publish as `modular-studio`** | S | 1.6 | 🔴 High | Publish to npm. README already has install instructions. Add `--open` flag to auto-launch browser. |
| 2.2 | **Save/load full workspace state** | M | None | 🔴 High | Currently presets are hardcoded. Save full canvas (node positions, connections, config, knowledge selections) to `~/.modular-studio/workspaces/`. Load via dropdown. |
| 2.3 | **Clipboard copy on response** | S | None | 🔴 High | One-click copy button on ResponseNode. `navigator.clipboard.writeText()`. Trivial but essential for daily use. |
| 2.4 | **Run history** | M | None | 🔴 High | Save each run: timestamp, prompt, assembled context summary, response, token usage, model. Browse past runs in a sidebar panel. |
| 2.5 | **Real connector: Notion** | L | MCP backend | 🟡 Medium | Use `@notionhq/mcp` server. Add guided setup in ConnectorTile (paste Notion API key + page URL). First real external integration. |
| 2.6 | **Real skill execution** | M | 1.1 | 🟡 Medium | SkillsNode tiles currently just labels. Wire to actual MCP tool calls or agent instructions that reference real skill capabilities. |
| 2.7 | **Snap to grid** | S | None | 🟢 Low | `snapToGrid` + `snapGrid` props on ReactFlow. One line. |
| 2.8 | **Real token counting (tiktoken)** | M | None | 🟡 Medium | Replace `Math.ceil(length / 4)` with tiktoken WASM. Matters for budget accuracy. |
| 2.9 | **Replace mock feedback with real analysis** | M | 2.4 | 🟡 Medium | After a run, parse LLM response for knowledge suggestions instead of hardcoded mocks. |
| 2.10 | **User-saveable presets** | S | 2.2 | 🟡 Medium | "Save as Preset" button that writes current config to disk. Load alongside built-in presets. |

**Competitive position after Phase 2:** Clear differentiation from all chat-based tools. The only visual agent builder that non-developers can use daily. Notion integration shows real-world utility.

---

## Phase 3: Multi-Agent (Month 2)

> **Goal:** The differentiator. No one else has visual multi-agent orchestration for knowledge workers.

| # | Item | Effort | Deps | Impact | Notes |
|---|------|--------|------|--------|-------|
| 3.1 | **AgentNode as separate node** | L | None | 🔴 High | Extract model config from PromptNode into a dedicated AgentNode. PromptNode = user input only. AgentNode = model, temperature, system prompt, planning mode. Foundation for multi-agent. |
| 3.2 | **Agent-to-agent cables** | L | 3.1 | 🔴 High | Wire AgentNode output → another AgentNode input. Data flows through the chain. Needs intermediate output storage. |
| 3.3 | **Team presets** | M | 3.1, 3.2 | 🔴 High | Deep Research (3 researchers → synthesizer), Content Pipeline (research → write → edit → format), Competitive Intel. Load from AGENT-TEAMS.md designs. |
| 3.4 | **Live execution monitoring** | L | 3.2 | 🔴 High | Show which agent is currently running (pulsing LED), progress bar per agent, streaming output with SOLO mode to watch one agent. |
| 3.5 | **Cost estimation per run** | M | 3.1 | 🟡 Medium | Before running, show estimated cost and time per agent based on model pricing and token estimates. See AGENT-TEAMS §VII design. |
| 3.6 | **STEER (mid-run intervention)** | M | 3.4 | 🟡 Medium | Inject instructions into a running agent. Pause/resume between agents (breakpoints/gates). |
| 3.7 | **Prompt → auto-team suggestion** | L | 3.1, 3.3 | 🟡 Medium | Analyze prompt complexity and suggest solo vs team mode with agent configuration. See AGENT-TEAMS §III. |

**Competitive position after Phase 3:** Unique in the market. Langflow/n8n have multi-agent but are developer tools. We're the only visual multi-agent tool for knowledge workers. This is the moat.

---

## Phase 4: Public Launch (Month 3)

> **Goal:** Other people can use it without Victor's help.

| # | Item | Effort | Deps | Impact | Notes |
|---|------|--------|------|--------|-------|
| 4.1 | **Hosted version (Vercel + Railway/Fly)** | XL | Phase 2 | 🔴 High | Frontend on Vercel, backend on Railway/Fly. Needs auth layer since backend handles API keys. |
| 4.2 | **User accounts + API key vault** | XL | 4.1 | 🔴 High | Auth (Clerk/Auth0), encrypted API key storage server-side, per-user workspaces. |
| 4.3 | **Documentation site** | M | None | 🔴 High | Astro/Docusaurus site. User manual already exists as markdown. Expand with tutorials, examples, API docs. |
| 4.4 | **Remote registry (clawhub.com)** | L | 2.1 | 🟡 Medium | API endpoint for skills/MCP/presets. Marketplace fetches from remote instead of hardcoded `registry.ts`. |
| 4.5 | **Community marketplace** | L | 4.4 | 🟡 Medium | Submit skills/presets to registry. Ratings, install counts, verified badges. |
| 4.6 | **VS Code extension** | L | 2.1 | 🟡 Medium | WebView panel that embeds the canvas. "Open in Modular Studio" command. Agent export writes directly to workspace. |
| 4.7 | **Progressive disclosure / onboarding** | M | None | 🟡 Medium | First-time user gets empty canvas + prompt bar. Guided tour adds knowledge, then tools, then output formats. SPEC-V3 §VI design. |

**Competitive position after Phase 4:** Public product competing with interface0 ($35/mo). Free tier + hosted version. VS Code presence reaches developers who discover it while coding.

---

## Phase 5: Advanced (Months 4–6)

> **Goal:** Features that make Modular Studio the definitive tool for AI-augmented knowledge work.

| # | Item | Effort | Deps | Impact | Notes |
|---|------|--------|------|--------|-------|
| 5.1 | **Expert Mode** | XL | Phase 2 | 🔴 High | Confidence scoring on response, inline source annotations, source attribution panel, contradiction detection. The killer differentiator vs plain chat. See SPEC-V3 §VII. |
| 5.2 | **Signal Flow view** | L | Phase 2 | 🟡 Medium | Horizontal pipeline visualization: Sources → Process → Model → Output. Shows how context is assembled. Collapsible, with processing stage inserts (summarize, verify, websearch). SPEC-V3 §III. |
| 5.3 | **Context history / audit trail** | M | 2.4 | 🟡 Medium | Every prompt includes a "context receipt": which sources, at what depth, actual tokens, which sections included. Replay any past configuration. |
| 5.4 | **Round Table debate mode** | XL | Phase 3 | 🟡 Medium | Agents with different personas debate: PM vs Engineering vs User Research. Multiple rounds of perspective exchange → synthesized output. AGENT-TEAMS §VIII. |
| 5.5 | **Real-time collaboration** | XL | 4.1, 4.2 | 🟢 Low | Multiple users on same canvas. CRDT-based state sync (Yjs). Shared workspaces. |
| 5.6 | **Plugin system** | L | Phase 4 | 🟢 Low | Third-party node types. Custom edge types. Theme plugins. Extensibility API. |
| 5.7 | **Cached summarization at depth levels** | L | 1.4 | 🟡 Medium | Depth knob actually summarizes content (LLM one-shot, cached in `.modular-studio/summaries/`). Currently depth just multiplies a fake number. |
| 5.8 | **Semantic relevance filter per module** | L | 5.7 | 🟡 Medium | RAG-per-channel: only include sections matching the prompt. The RELEVANCE knob from VISION.md. |

---

## Technical Debt

| Item | Effort | Priority | Notes |
|------|--------|----------|-------|
| **Remove mock data** (MOCK_MCP_SERVERS, MOCK_SKILLS, MOCK_CONNECTORS, KNOWLEDGE_TREE) | M | 🔴 High | Replace with real data sources as each feature lands. Currently mocks and real implementations exist in parallel (especially MCP). |
| **dist-server in git** | S | 🔴 High | Build artifacts shouldn't be committed. Add to `.gitignore`, build in CI/npm prepublish. |
| **McpNode dual-track** | S | 🔴 High | McpNode renders from knowledgeBase mocks while mcpStore talks to real backend. Merge to single source of truth. |
| **Hardcoded node positions** | S | 🟡 Medium | Nodes have fixed initial positions in App.tsx. Should auto-layout or load from saved workspace. |
| **Accessibility (7 issues from AUDIT-REPORT)** | M | 🟡 Medium | Missing aria-labels, no focus indicators, contrast issues. Fix incrementally. |
| **Token estimation accuracy** | S | 🟡 Medium | `Math.ceil(length / 4)` → tiktoken. Included in 2.8 but calling out as debt. |
| **Stale docs** | S | 🟡 Medium | SPEC.md (V1) should be archived. ROADMAP-NEXT.md superseded by this doc. TASK.md/TASK2.md likely stale — review and delete. |
| **No tests** | L | 🟢 Low | No unit or integration tests. Add as features stabilize. Critical paths: context assembly, export, MCP connection. |

---

## Open Questions (Need Victor's Input)

1. **AgentNode extraction timing** — Phase 3 has AgentNode as a separate node. But Phase 1 demos work fine with the current PromptNode-as-agent approach. Is it worth extracting earlier (Phase 2) to avoid rework, or ship the demo first?

2. **Hosting architecture** — Phase 4 assumes Vercel + Railway/Fly. Alternative: keep it local-only (like Cursor) and avoid hosting complexity entirely. The `npx` one-command setup is already compelling. Which path?

3. **npm package name** — `modular-studio` available on npm? If taken, alternatives: `modular-patchbay`, `@modular/studio`, `ai-studio`.

4. **Knowledge filesystem scope** — When scanning real files (1.4), how deep? Just the workspace root? User-configured paths? Security implications of a local server reading arbitrary files.

5. **Monetization model** — Free forever (OSS)? Freemium (local free, hosted paid)? Matters for Phase 4 architecture decisions.

6. **V1 module types** — SPEC.md lists 28 module types (FILE READ, WEB SEARCH, SHELL, BROWSER, etc.). The V3 pivot consolidated to 6 nodes. Do any V1 modules come back as individual nodes, or does everything stay channeled through MCP tools?

7. **Analog aesthetic** — The Moog/skeuomorphic vision (knobs, screws, scopes, panel textures) was softened during development. Double down on analog identity, or keep the current clean modern look? Brand decision.

---

## Summary Timeline

```
Week 1          Weeks 2-3        Month 2          Month 3          Months 4-6
─────────       ──────────       ──────────       ──────────       ──────────
PHASE 1         PHASE 2          PHASE 3          PHASE 4          PHASE 5
Demo-Ready      Alpha            Multi-Agent      Public Launch    Advanced

Real LLM runs   npm publish      AgentNode        Hosted version   Expert Mode
Real MCP tools   Save/load        Agent chains     User accounts    Signal Flow
Real files       Run history      Team presets     Documentation    Collaboration
Clean UI         Notion           Live monitoring  Marketplace      Round Table
npx setup        Clipboard copy   Cost estimation  VS Code ext      Plugin system
```

---

*This roadmap is a living document. Update as phases complete and priorities shift.*
*Generated 2026-02-27 — Claw 🦀*
