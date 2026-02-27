# STATUS-AUDIT.md — Vision vs Implementation Gap Analysis

**Date:** 2026-02-27  
**Auditor:** Claw 🦀 (automated)  
**Repo:** modular-patchbay (Modular Studio)

---

## Section 1: Feature Matrix

### Canvas & Node System

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| React Flow canvas with pan/zoom | SPEC.md | ✅ Done | `src/App.tsx` — @xyflow/react v12, fitView, delete key, minimap, controls |
| 6 core node types (Knowledge, Skills, MCP, Prompt, Output, Response) | SPEC-V3, ROADMAP-NEXT | ✅ Done | All in `src/nodes/` |
| AgentNode (explicit model config) | ROADMAP-NEXT §1, ANALYSIS | ❌ Not Started | Agent config is embedded in PromptNode instead. No separate AgentNode on canvas |
| Node drag & drop from sidebar | SPEC.md | ❌ Not Started | No sidebar/library. Nodes are static initial layout. |
| Snap to grid | SPEC.md | ❌ Not Started | `snapToGrid` not set in App.tsx ReactFlow config |
| Custom node sizing / collapse | ROADMAP-NEXT §0 (queued) | ❌ Not Started | No card/list toggle, no collapse/expand |
| Decorative screws on modules | SPEC.md | ❌ Not Started | No Screw component used |
| Oscilloscope / scope display | SPEC.md | ❌ Not Started | No Scope component |
| LED indicators on nodes | SPEC.md | 🔧 Partial | Simple colored dots, not full LED glow |

### Cables & Edges

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| PatchCable custom edge | SPEC.md | ✅ Done | `src/edges/PatchCable.tsx` |
| Catenary/droop curve | SPEC.md | 🔧 Partial | Uses quadratic bezier approximation, not true catenary |
| Random cable colors | SPEC.md | 🔧 Partial | Colors assigned by source node type, not random per cable |
| Cable hover glow + click delete | SPEC.md | ✅ Done | Delete via Backspace confirmed in AUDIT-REPORT |
| FeedbackEdge (dashed, distinct) | ROADMAP-NEXT §7 | ✅ Done | `src/edges/FeedbackEdge.tsx` — dashed cyan edges for knowledge/skills feedback |
| Cable animation during execution | SPEC.md | ❌ Not Started | No strokeDasharray animation on run |
| Reconnectable edges | SPEC.md | ✅ Done | `edgesReconnectable` enabled in App.tsx |

### Knowledge System

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Knowledge tree (folder structure) | VISION.md | ✅ Done | `src/store/knowledgeBase.ts` — KNOWLEDGE_TREE with full hierarchy |
| Knowledge Type System (6 types) | SPEC-V3 §I | ✅ Done | ground-truth, signal, evidence, framework, hypothesis, artifact — all in knowledgeBase.ts |
| Auto-classification by path | SPEC-V3 | ✅ Done | `classifyKnowledgeType()` function |
| Knowledge type badge cycling | SPEC-V3 | ✅ Done | `cycleKnowledgeType` in consoleStore |
| Depth levels (Full/Detail/Summary/Headlines/Mention) | VISION.md, SPEC-V3 | ✅ Done | DEPTH_LEVELS with percentage multipliers |
| Token budget / VU meter | VISION.md | ✅ Done | `TokenBudget` component, totalTokens() in store |
| Channel strips (add/remove/toggle/reorder) | SPEC-V3 | ✅ Done | Full CRUD in consoleStore + KnowledgeNode.tsx renders them |
| Ghost channels (prompt analysis suggestions) | SPEC-V3 §I | 🔧 Partial | `ContextualHint` component exists but ghost channels based on prompt analysis are not implemented — hints are static/mock |
| Freshness indicators | SPEC-V3 §I | ❌ Not Started | No freshness dots on channels |
| Semantic relevance filter per module | VISION.md | ❌ Not Started | No per-channel relevance knob |
| Weight/priority knob per channel | VISION.md | ❌ Not Started | Only depth control exists |
| Real filesystem scanning | VISION.md, SPEC-V3 Phase 6 | ❌ Not Started | All data is mock (KNOWLEDGE_TREE is hardcoded) |
| Cached summaries at depth levels | VISION.md | ❌ Not Started | Depth just multiplies token count — no actual summarization |
| Context history / audit trail | VISION.md | ❌ Not Started | No run history saved |
| Patch presets saved as JSON | VISION.md | 🔧 Partial | Presets exist (PRESETS array) but are hardcoded, not user-saveable to disk |

### Presets & Agent Config

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Preset loading (dropdown) | SPEC-V3, ROADMAP-NEXT | ✅ Done | 10 presets, loadPreset in consoleStore |
| Preset includes agent config (model, temp, planning mode) | SPEC-V3 | ✅ Done | Some presets set agentConfig |
| Save as Agent export | SPEC-V5, ROADMAP-NEXT §3 | ✅ Done | SaveAgentModal, agentExport utils for claude/amp/codex/openclaw/generic/vibe-kanban |
| Import agent file | SPEC-V5 | ✅ Done | importAgent util + file input in App.tsx |
| Export to 6 targets (Claude, Amp, Codex, OpenClaw, Vibe Kanban, Generic) | SPEC-V5 | ✅ Done | ExportTarget type in consoleStore |
| Model selector | SPEC-V3 | ✅ Done | In PromptNode with 7 models |
| Temperature control | SPEC.md, ROADMAP-NEXT | ✅ Done | In agentConfig store |
| Planning mode (single-shot/CoT/ReAct) | ROADMAP-NEXT | ✅ Done | PlanningMode type, stored in agentConfig |
| Max tokens control | SPEC.md | ✅ Done | In agentConfig + PromptNode settings panel |
| Thinking depth selector | Implicit | ✅ Done | PromptNode has low/medium/high thinking depth |

### LLM Integration

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Streaming LLM responses | ROADMAP-NEXT §2 | ✅ Done | `llmService.ts` — streamCompletion with SSE parsing |
| OpenAI-compatible API support | ROADMAP-NEXT §2 | ✅ Done | Direct fetch to /chat/completions |
| Anthropic API support | BACKEND-SPEC | ✅ Done | Server-side proxy in `server/routes/llm.ts` handles Anthropic format |
| Claude Agent SDK integration | BACKEND-SPEC | ✅ Done | `server/routes/agent-sdk.ts` — streaming via @anthropic-ai/claude-agent-sdk |
| Context assembly (knowledge type ordering) | ROADMAP-NEXT §2 | ✅ Done | `contextAssembler.ts` — groups by type priority, includes MCP tools |
| API key management | ROADMAP-NEXT §2 | ✅ Done | SettingsModal with localStorage + SettingsPage with provider management |
| Run cancellation | Implicit | ✅ Done | cancelRun() aborts fetch controller |
| Error handling in response | ROADMAP-NEXT §2 | ✅ Done | Errors displayed in mockResponse |
| MCP tools included in context | BACKEND-SPEC | ✅ Done | contextAssembler checks mcpStore for connected tools |
| Real token counting (tiktoken) | SPEC-V3 Phase 6 | ❌ Not Started | Uses `Math.ceil(length / 4)` approximation |

### MCP System

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| MCP server management (add/remove/connect/disconnect) | BACKEND-SPEC | ✅ Done | Full CRUD in `server/routes/mcp.ts` + McpManager class |
| MCP tool discovery (listTools) | BACKEND-SPEC | ✅ Done | mcpManager.connect() fetches tools |
| MCP tool execution (callTool) | BACKEND-SPEC | ✅ Done | `/:id/call` route |
| MCP health endpoint | BACKEND-SPEC | ✅ Done | `/:id/health` route with uptime + lastError |
| Config persistence (~/.modular-studio/config.json) | BACKEND-SPEC | ✅ Done | `server/config.ts` reads/writes JSON config |
| MCP servers in frontend (McpNode) | SPEC-V3 | 🔧 Partial | McpNode renders tiles but uses MOCK_MCP_SERVERS; mcpStore.ts connects to real backend |
| MCP server status indicators | SPEC-V3 | 🔧 Partial | mcpStore tracks status per server, but UI uses mocks |

### Provider System

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Multi-provider management | BACKEND-SPEC | ✅ Done | `server/routes/providers.ts` — CRUD, `providerStore.ts` on frontend |
| Provider types (OpenAI, Anthropic, OpenRouter, Google, Custom) | BACKEND-SPEC | ✅ Done | TypeScript types + server test endpoint |
| Provider test/validate | BACKEND-SPEC | ✅ Done | `/:id/test` route fetches models list |
| Settings page for providers | Implicit | ✅ Done | `SettingsPage.tsx` with ProviderPanel |

### Marketplace

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Marketplace modal (Skills + MCP + Presets tabs) | SPEC-V4 | ✅ Done | `Marketplace.tsx` with 3 tabs |
| Skills registry (curated list) | SPEC-V4 | ✅ Done | REGISTRY_SKILLS — 22 skills with metadata, categories, install counts |
| MCP registry (curated list) | SPEC-V4 | ✅ Done | REGISTRY_MCP_SERVERS — 16 MCP servers with config fields |
| Preset registry | SPEC-V4 | ✅ Done | REGISTRY_PRESETS — 6 workflow presets |
| Search/filter in marketplace | SPEC-V4 | ✅ Done | Confirmed in AUDIT-REPORT test #7 |
| Category filtering | SPEC-V4 | ✅ Done | MARKETPLACE_CATEGORIES — 7 categories |
| Runtime target selection (Claude/Amp/Codex) | SPEC-V5 | ✅ Done | Install modal with runtime + scope selection |
| One-click skill install | SPEC-V4 | 🔧 Partial | UI simulates install (toggles `installed` flag) — no real `npx` execution |
| One-click MCP install | SPEC-V4 | 🔧 Partial | Same — toggles state only |
| Remote registry fetch (clawhub.com) | SPEC-V4 | ❌ Not Started | All registry data is hardcoded in `registry.ts` |
| Install progress/spinner | SPEC-V4 | 🔧 Partial | suggestedSkills have installing state with timeout simulation |

### Output System

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Output format selector | SPEC-V3 §II | ✅ Done | 8 formats in OUTPUT_FORMATS |
| Smart auto-detect from prompt | SPEC-V3 | ✅ Done | `detectOutputFormat()` in knowledgeBase.ts |
| Multi-format output selection | Implicit | ✅ Done | `toggleOutputFormat` + outputFormats array |
| Response display | SPEC.md | ✅ Done | ResponseNode with markdown rendering |
| File export (.md, .html, etc.) | VISION.md | ❌ Not Started | No actual file writing |
| Clipboard copy | VISION.md | ❌ Not Started | No copy-to-clipboard |
| Message channel output (WhatsApp/etc.) | SPEC.md | ❌ Not Started | No integration |

### Connectors

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Connector system (Notion, Slack, HubSpot, etc.) | SPEC-V3 §V | ✅ Done | MOCK_CONNECTORS with 5 entries, ConnectorPicker + ConnectorTile |
| Connector directions (read/write/both) | SPEC-V3 | ✅ Done | ConnectorDirection type |
| Connector auth methods | SPEC-V3 | ✅ Done | oauth/api-key/none |
| Real connector integration | SPEC-V3 | ❌ Not Started | All mock data |

### UI / Design

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Dark/light theme | SPEC.md | ✅ Done | themeStore + 50+ theme tokens |
| Moog/analog aesthetic | SPEC.md, DESIGN-GUIDE | 🔧 Partial | Clean modern UI, but lost most skeuomorphic elements (no knobs, screws, scope, VU meters) |
| Space Mono + Inter typography | SPEC.md | ✅ Done | Used in styling |
| Keyboard shortcuts (Delete, Escape, Ctrl+K, Ctrl+Enter) | SPEC.md | ✅ Done | In App.tsx useEffect |
| Minimap | SPEC.md | ✅ Done | With custom colors |
| Topbar (logo, model, preset, output, run) | SPEC-V3 | ✅ Done | Topbar.tsx |
| Responsive design | DESIGN-GUIDE | 🔧 Partial | Nodes have fixed positions, not responsive to viewport |
| Accessibility (aria-labels, keyboard nav) | DESIGN-GUIDE §7 | 🔧 Partial | AUDIT-REPORT found 7 a11y issues; some aria-labels present, many missing |
| Progressive disclosure (6 levels) | SPEC-V3 §VI | ❌ Not Started | No guided onboarding or progressive reveal |
| Contextual hints | SPEC-V3 §VI | 🔧 Partial | ContextualHint component exists but triggers are not prompt-analysis-driven |

### Agent Teams / Multi-Agent

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Solo/Team mode toggle | SPEC-V3 §IV, AGENT-TEAMS | ❌ Not Started | No team mode |
| Agent team presets (Deep Research, etc.) | AGENT-TEAMS | ❌ Not Started | |
| Agent-to-agent cables | AGENT-TEAMS | ❌ Not Started | |
| Prompt → auto-team suggestion | AGENT-TEAMS §III | ❌ Not Started | |
| Live team monitoring (SOLO, STEER, breakpoints) | AGENT-TEAMS §IV | ❌ Not Started | |
| Round Table debate mode | AGENT-TEAMS §VIII | ❌ Not Started | |
| Cost/time estimation | AGENT-TEAMS §VII | ❌ Not Started | |
| Run history / recording playback | AGENT-TEAMS §IX | ❌ Not Started | |

### Backend / Server

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Express server with API routes | BACKEND-SPEC | ✅ Done | `server/index.ts` — port 4800 |
| Provider management API | BACKEND-SPEC | ✅ Done | CRUD + test |
| MCP management API | BACKEND-SPEC | ✅ Done | Full lifecycle |
| LLM proxy (streaming) | BACKEND-SPEC | ✅ Done | Anthropic + OpenAI-compatible |
| Agent SDK route | BACKEND-SPEC | ✅ Done | SSE streaming via claude-agent-sdk |
| Static file serving (SPA) | Implicit | ✅ Done | Serves dist/ |
| CLI binary (`modular-studio`) | package.json | ✅ Done | bin entry in package.json |

### Spec V1 (Original SPEC.md) — Module Types

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| PROMPT module | SPEC.md | ✅ Done | PromptNode |
| FILE READ module | SPEC.md | ❌ Not Started | |
| WEB SEARCH module | SPEC.md | ❌ Not Started | |
| WEB FETCH module | SPEC.md | ❌ Not Started | |
| SCHEDULE module | SPEC.md | ❌ Not Started | |
| WEBHOOK IN module | SPEC.md | ❌ Not Started | |
| LLM module | SPEC.md | 🔧 Partial | Config embedded in PromptNode, not a separate module |
| VISION module | SPEC.md | ❌ Not Started | |
| TTS module | SPEC.md | ❌ Not Started | |
| EMBEDDINGS module | SPEC.md | ❌ Not Started | |
| TRANSFORM module | SPEC.md | ❌ Not Started | |
| SHELL module | SPEC.md | ❌ Not Started | |
| BROWSER module | SPEC.md | ❌ Not Started | |
| MEMORY module | SPEC.md | ❌ Not Started | |
| CODE AGENT module | SPEC.md | ❌ Not Started | |
| HTTP REQUEST module | SPEC.md | ❌ Not Started | |
| DATABASE module | SPEC.md | ❌ Not Started | |
| SPLITTER module | SPEC.md | ❌ Not Started | |
| MIXER module | SPEC.md | ❌ Not Started | |
| GATE module | SPEC.md | ❌ Not Started | |
| LOOP module | SPEC.md | ❌ Not Started | |
| DELAY module | SPEC.md | ❌ Not Started | |
| SWITCH module | SPEC.md | ❌ Not Started | |
| MESSAGE output | SPEC.md | ❌ Not Started | |
| FILE WRITE output | SPEC.md | ❌ Not Started | |
| WEBHOOK OUT | SPEC.md | ❌ Not Started | |
| CANVAS output | SPEC.md | ❌ Not Started | |
| NOTIFY output | SPEC.md | ❌ Not Started | |
| Skeuomorphic knobs (drag interaction) | SPEC.md | ❌ Not Started | No Knob component in use |
| Toggle switches (synth-style) | SPEC.md | ❌ Not Started | Standard toggles used |

### Expert Mode (SPEC-V3 §VII)

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Expert mode toggle | SPEC-V3 | ❌ Not Started | |
| Confidence meter on response | SPEC-V3 | ❌ Not Started | |
| Inline source annotations | SPEC-V3 | ❌ Not Started | |
| Source attribution panel | SPEC-V3 | ❌ Not Started | |
| Contradiction detection | SPEC-V3 | ❌ Not Started | |
| Insight Ladder for signals | SPEC-V3 | ❌ Not Started | |

### Signal Flow View (SPEC-V3 §III)

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Collapsible signal flow pipeline | SPEC-V3 | ❌ Not Started | |
| Processing stage inserts (summarize, websearch, verify) | SPEC-V3 | ❌ Not Started | |
| Cable override between stages | SPEC-V3 | ❌ Not Started | |

### Feedback System (ROADMAP-NEXT §7)

| Feature | Spec Source | Status | Notes |
|---------|-----------|--------|-------|
| Pending knowledge from runs | ROADMAP-NEXT | 🔧 Partial | Store actions exist, mock data injected after each run. Not driven by actual LLM output |
| Suggested skills from runs | ROADMAP-NEXT | 🔧 Partial | Same — mock injection, not real find-skills analysis |
| Feedback edges (visual) | ROADMAP-NEXT | ✅ Done | FeedbackEdge renders dashed cyan lines |

---

## Section 2: Spec Drift

### 1. PromptNode absorbed AgentNode

- **Spec says:** ROADMAP-NEXT calls for a separate AgentNode between inputs and outputs, dedicated to model config, system prompt, planning mode.
- **Implemented:** PromptNode contains model selector, thinking depth, output format, settings panel, temperature — it IS the agent. No separate node.
- **Verdict:** Intentional shortcut. Works for single-agent mode but blocks multi-agent (team) features since there's no reusable "agent" node to duplicate.

### 2. Architecture shifted from SPEC V1 (28 module types) to SPEC V3 (6 panel types)

- **Spec V1 says:** 28 module types (sources, processors, tools, routing, outputs) — a full visual programming environment like n8n.
- **Implemented:** 6 consolidated nodes: Knowledge, Skills, MCP, Prompt, Output, Response. Each aggregates multiple concerns.
- **Verdict:** Intentional pivot. SPEC-V3 explicitly redesigned around the "mixing console" metaphor with channel strips instead of granular modules. The V1 vision was too complex for the UX goal of "3 clicks to answer."

### 3. Analog aesthetic significantly softened

- **Spec says:** "Must look like a Moog synthesizer." Knobs, screws, oscilloscopes, jack sockets with metallic rings, walnut panel textures, catenary cables with gravity sag.
- **Implemented:** Clean modern UI with subtle theme tokens. JackPort has chrome rings. No knobs, screws, scopes, or panel textures in use. Cable droop is minimal bezier.
- **Verdict:** Accidental drift. The `src/components/controls/` directory likely had Knob.tsx, Scope.tsx, Screw.tsx, etc. at one point but they're not imported anywhere. The UI evolved toward a cleaner look during development.

### 4. Knowledge is mock, not filesystem-backed

- **Spec says:** "Auto-scanned from filesystem" with real file reading, token counting, and cached summaries.
- **Implemented:** `KNOWLEDGE_TREE` is a hardcoded array with fake token estimates. No filesystem access.
- **Verdict:** Known gap. The backend exists (`server/`) but no route reads the filesystem. This is a Phase 6 feature per SPEC-V3.

### 5. Marketplace installs are simulated

- **Spec V4 says:** Real `npx` installation, progress bars, registry API fetch.
- **Implemented:** `installRegistrySkill` and `installRegistryMcp` just toggle boolean flags in zustand state. No real commands executed.
- **Verdict:** Known. Registry data is curated but static. Real install needs server-side `child_process.exec`.

### 6. MCP dual-track: backend is real, frontend is mock

- **Spec says:** Unified MCP management.
- **Implemented:** `mcpStore.ts` has full server interaction (connect, disconnect, callTool) using `/api/mcp`. But `McpNode.tsx` renders from `MOCK_MCP_SERVERS` in knowledgeBase.ts, not from the real mcpStore state.
- **Verdict:** Accidental gap. Two parallel implementations exist. The McpNode UI should read from mcpStore instead of consoleStore's mock data.

### 7. Run feedback is hardcoded

- **Spec says:** After a run, the system should analyze output and suggest knowledge additions + skills.
- **Implemented:** `consoleStore.run()` hardcodes `addPendingKnowledge` and `addSuggestedSkill` after every successful run with static mock data. No LLM analysis.
- **Verdict:** Placeholder implementation. The store machinery works, but the data source is fake.

---

## Section 3: Missed Features (Prioritized by Impact)

### Critical (Would transform the product)

1. **Real filesystem access** — Without reading actual files, the knowledge system is a demo. Needs a server route to scan directories and read file contents.
2. **AgentNode as separate entity** — Blocking multi-agent, team presets, and the entire AGENT-TEAMS vision. Currently merged into PromptNode.
3. **Real MCP in frontend** — Backend MCP manager works. Frontend ignores it and uses mocks. Just needs wiring.

### High Impact

4. **Progressive disclosure / onboarding** — SPEC-V3 §VI describes 6 levels of progressive disclosure. Nothing implemented. New users see everything at once.
5. **Expert Mode (confidence/attribution)** — The differentiator vs. plain chat. Source attribution, grounding scores, contradiction detection — all absent.
6. **Signal Flow view** — The horizontal pipeline visualization that makes context assembly visible and configurable. Completely absent.
7. **Run history** — No record of past runs. Can't compare configurations or replay.

### Medium Impact

8. **Ghost channels from prompt analysis** — NLP-driven suggestions based on entities in the prompt. Would significantly improve UX.
9. **Real token counting** — tiktoken WASM instead of `length/4`. Matters for budget accuracy.
10. **Cached summarization at depth levels** — Currently depth is just a multiplier on a fake number. Real value requires actual text processing.
11. **Semantic relevance filter** — RAG-per-module as described in VISION.md. No implementation.
12. **Multi-agent / Team mode** — The entire AGENT-TEAMS spec. Massive scope, but the core differentiator long-term.

### Lower Impact

13. **Analog skeuomorphic elements** — Knobs, scopes, screws. Cosmetic but part of the brand identity.
14. **Keyboard piano presets** — The "keyboard" quick-action metaphor from VISION.md.
15. **Webhook/schedule input triggers** — InputNode from ANALYSIS spec.
16. **Guardrail nodes** — Content filtering, PII detection between agent and output.
17. **Collaborative consoles** — Multi-user support.

---

## Section 4: Deprecated/Obsolete Docs

| Document | Status | Recommendation |
|----------|--------|----------------|
| **SPEC.md** | Superseded | Describes V1 with 28 module types, sidebar library, full Moog aesthetic. Architecture was intentionally pivoted in V3. Keep as historical reference only. |
| **SPEC-V3.md** | Current | Primary spec. Most accurately describes the channel-strip approach. Some Phase 1 items done, most later phases not started. |
| **SPEC-V4-MARKETPLACE.md** | Partially current | Marketplace UI exists but installs are mock. ClawhHub registry doesn't exist. |
| **SPEC-V5-UNIVERSAL.md** | Current | Export system is implemented. `npx modular-skills` CLI does not exist. |
| **VISION.md** | Foundational | Core philosophy still holds (knowledge modules, depth, budget, presets). Many details superseded by V3. Keep as north star. |
| **ROADMAP-NEXT.md** | Outdated | Sprint 1 items (AgentNode, Test Run, Save as Agent) are partially done differently than specified. Test Run and Save are done; AgentNode was merged into PromptNode. Needs update. |
| **AGENT-TEAMS.md** | Future spec | Nothing implemented. Valid design doc for future. |
| **ANALYSIS-AGENTIC-ARCHITECTURE.md** | Current | Gap analysis still accurate. AgentNode is still the #1 gap. |
| **AUDIT-REPORT.md** | Current | Recent E2E test results. All bugs listed are still relevant. |
| **BACKEND-SPEC.md** | Current | Backend is implemented as specified. |
| **DESIGN-GUIDE.md** | Current | UX patterns reference. Partially followed. |
| **COMPETITIVE-LANDSCAPE.md** | Current | Market context. No code implications. |
| **EXPLORATION.md** | Current | Design exploration notes. |
| **INSIGHT.md** | Current | Product insight notes. |
| **CONTRIBUTING.md** | Current | Standard contribution guide. |
| **LANDING.md** | Current | Landing page copy. |
| **PROMPT-TESTS.md** | Current | Test prompts for validation. |
| **README.md** | Needs update | May not reflect current architecture. |
| **TASK.md / TASK2.md** | Stale | Task-specific files, likely completed. Review and delete. |
| **docs/USER-MANUAL.md** | Current if exists | User-facing documentation. |

---

## Section 5: Recommended Next Steps

### Tier 1: Finish What's Started

1. **Wire MCP frontend to backend** — McpNode should read from mcpStore (which talks to real `/api/mcp`) instead of MOCK_MCP_SERVERS. The plumbing exists on both sides; just connect them.

2. **Fix the 15 UI bugs from AUDIT-REPORT** — Especially B1 (modal z-index), B3 (truncated buttons), A1 (missing aria-labels), A3 (no focus indicators). Quick wins that improve polish dramatically.

3. **Replace mock feedback with real analysis** — After a run, parse the LLM response for potential knowledge items and skill suggestions instead of hardcoding mocks.

4. **Replace mock marketplace installs with real commands** — Add a server route that runs `npx` commands for skill/MCP installation. Frontend already has the UI.

### Tier 2: High-Impact Missing Features

5. **Add filesystem scanning route** — `GET /api/knowledge?path=...` that scans a directory and returns file metadata. Connect to KnowledgeNode to show real files instead of KNOWLEDGE_TREE mock.

6. **Build the AgentNode** — Separate from PromptNode. PromptNode = user input only. AgentNode = model config + system prompt + planning mode. This unlocks multi-agent later.

7. **Implement real context assembly with file reading** — When running, actually read the files referenced by channels (via server API), apply depth processing, count real tokens.

8. **Add progressive disclosure** — Start with empty canvas + prompt bar. Guide users through adding context, then formats, then tools. Use the SPEC-V3 §VI hierarchy.

9. **Build Signal Flow view** — Horizontal pipeline below channels showing Sources → Process → Model → Output. Auto-wired, with click-to-configure.

### Tier 3: Polish & Differentiation

10. **Expert Mode** — Confidence scoring, inline source annotations, contradiction detection. The killer differentiator.

11. **Run history** — Save each run config + response. Allow replay and comparison.

12. **Restore analog aesthetic** — Bring back knobs for temperature, scopes for token visualization, panel textures. The "Moog" brand identity.

13. **Real token counting** — Integrate tiktoken WASM for accurate budget tracking.

14. **Ghost channels with NLP** — Analyze prompt to suggest relevant knowledge sources not yet connected.

---

## Section 6: Document Cleanup Recommendations

| Action | Documents | Rationale |
|--------|-----------|-----------|
| **Keep as-is** | VISION.md, DESIGN-GUIDE.md, AGENT-TEAMS.md, COMPETITIVE-LANDSCAPE.md, CONTRIBUTING.md, BACKEND-SPEC.md | Still accurate and valuable |
| **Update** | SPEC-V3.md | Add checkboxes for completed items. Currently all phases show `[ ]` |
| **Update** | ROADMAP-NEXT.md | Reflect that Test Run and Save Agent are done, AgentNode was merged into PromptNode, queued items status |
| **Update** | README.md | Should reflect current architecture (6 nodes, backend server, marketplace) |
| **Update** | SPEC-V5-UNIVERSAL.md | Note that export works but `npx modular-skills` CLI doesn't exist |
| **Merge** | SPEC-V4-MARKETPLACE.md → into SPEC-V3.md | V4 is a small extension of V3. No need for a separate doc. |
| **Archive** | SPEC.md | Rename to `SPEC-V1-ORIGINAL.md`. It's historical — the 28-module-type vision was replaced. |
| **Delete** | TASK.md, TASK2.md | Task-specific, likely completed. If not, fold remaining items into ROADMAP-NEXT.md |
| **Keep** | AUDIT-REPORT.md | Recent, actionable bugs. Delete after bugs are fixed. |
| **Keep** | ANALYSIS-AGENTIC-ARCHITECTURE.md | Gap analysis is still the architectural north star |
| **Keep** | EXPLORATION.md, INSIGHT.md, LANDING.md, PROMPT-TESTS.md | Supporting docs, not stale |

---

*Generated 2026-02-27 by automated audit. Verified against actual source code, not just doc claims.*
