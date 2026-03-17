# Modular Studio — User Flow Map

Complete mapping of every user flow, subflow, current status, and market comparison.

---

## 1. AGENT CREATION

### 1.1 From Blank
```
Library → "+ New Agent" → resetAgent() → Describe tab (clean slate)
```
**Status:** ✅ Working
**Subflows:**
- 1.1a Write free-form description → min 20 chars validation
- 1.1b Select quick template (Code Review / Research / Content Writer / PM) → auto-fills description + constraints + memory strategy
- 1.1c Click "Generate Agent" → LLM meta-prompt → `generateFullAgent()` → `hydrateFromGenerated()` populates ALL stores

### 1.2 From Generation (the core flow)
```
Description text → Generate → LLM produces JSON config → Hydrate stores:
  ├── agentMeta (name, description, avatar, tags)
  ├── instructionState (persona, tone, expertise, constraints, objectives)
  ├── workflowSteps (3-8 ordered steps)
  ├── mcpServerIds (selected from 150+ registry)
  ├── skillIds (selected from registry)
  ├── knowledgeSelections (maps to connected sources by sourceId)
  ├── knowledgeGaps (what's missing — shown in Knowledge tab)
  ├── memoryConfig (strategy, facts)
  └── outputSuggestions
```
**Status:** ✅ Wired (DescribeTab → generateAgent → hydrateFromGenerated)
**Gap:** No streaming progress during generation. No preview of what will be generated.

### 1.3 From Import
```
Import button → file picker → parse .md/.yaml/.json → importAgent() → restore state
```
**Status:** ✅ Working (via AgentBuilder import + SaveAgentModal import ZIP)
**Formats:** Claude Code .md, OpenClaw .yaml, Generic .json, Agent Directory .zip

### 1.4 From Demo Preset
```
[Not in v2 wizard yet] — Demo presets exist (Senior PM, Feedback Manager, Competitor Scraper)
```
**Status:** ⚠️ Presets exist in `demoPresets.ts` but not exposed in v2 wizard UI
**Gap:** Should be templates on the Library page or in the Describe tab

### 1.5 From Clone (duplicate existing agent)
**Status:** ❌ Not implemented
**Need:** "Duplicate" button on agent card → loadAgent + clear ID → new agent with same config

---

## 2. AGENT TESTING

### 2.1 Conversation Testing
```
Test tab → Chat sub-tab → Type message → Send (Ctrl+Enter)
  → pipelineChat orchestrator:
    1. buildSystemFrame() — persona, constraints, workflow
    2. routeSources() — classify channels, extract framework rules
    3. compressKnowledge() — tree-aware retrieval + budget allocation
    4. preRecall() — memory facts injection
    5. assemblePipelineContext() — combine frame + knowledge + memory
    6. executeChat() — stream through provider (SSE or Agent SDK)
    7. postProcess() — memory write, trace end, heatmap
  → Response streams into chat bubble
  → InlineTraceView shows per-message: tokens, sources, timing
  → PipelineStatsBar shows: diversity, chunks, budget, compression
  → PipelineObservabilityPanel (right sidebar) shows: stages, events
```
**Status:** ✅ Working
**Gap:** Pipeline observability sometimes shows "No data" if trace ID not preserved across re-renders

### 2.2 Pipeline Inspection
```
After chat → Click inline trace ○ → Sidebar loads that message's trace
  ├── Source Assembly: which sources contributed
  ├── Retrieval: chunks selected, diversity score, query type
  ├── Provenance: derivation chain from raw source → context
  └── Event Timeline: retrieval, LLM calls, tool calls, memory ops
```
**Status:** ✅ Working (traceId persisted per message, selectedTraceId in sidebar)

### 2.3 Team Testing
```
Test tab → Team sub-tab → Define 2-5 agents (blank or from library)
  → Set role prompts + repo URLs
  → Write team task → Run Team
  → Agents execute via runtime service with shared knowledge pipeline
  → Results stream in RuntimeResults panel
```
**Status:** ⚠️ Exists but not verified with v2 wizard flow
**Backend:** POST /api/runtime/run-team

### 2.4 Context Inspector
```
Test tab → Left panel (desktop) → Shows:
  ├── Token diff (current vs previous)
  ├── System tokens breakdown
  └── Context health metrics
```
**Status:** ⚠️ ContextInspector exists but replaced by PipelineObservabilityPanel in TestTab right panel

### 2.5 Capability Validation
```
Before chat → CapabilityGate checks provider supports: streaming, toolCalling, mcpBridge
  → Warnings shown if agent needs capabilities provider doesn't have
```
**Status:** ✅ Working

---

## 3. AGENT REFINEMENT

### 3.1 Manual Review & Edit
```
Review tab → 7 collapsible sections:
  ├── Identity: name, description, avatar, tags
  ├── Persona: free-text persona, tone (formal/neutral/casual), expertise (1-5)
  ├── Constraints: 6 toggles + word limit + custom text + scope definition
  ├── Objectives: primary goal, success criteria [], failure modes []
  ├── Workflow: ordered steps (add/remove/reorder)
  ├── Output: format selector, token budget
  └── Export: save, download, preview prompt
```
**Status:** ✅ Working

### 3.2 Fact Insights (AI-assisted refinement)
```
Review tab → Fact Insights section → "Analyze N facts"
  → LLM analyzes accumulated memory facts
  → Suggests promotions to: persona, constraints, workflow, knowledge
  → User applies individually or bulk "Apply All"
  → Version checkpoint created
```
**Status:** ✅ Moved to Review tab, wired to analyzeFactsForPromotion

### 3.3 Missing Sources (knowledge gap analysis)
```
Knowledge tab → Missing Sources section (top)
  → After generation, shows what AI recommends connecting
  → Each gap: name, type, description
  → "Add source" button opens file picker
```
**Status:** ✅ Working

### 3.4 Knowledge Configuration
```
Knowledge tab → 3 sub-tabs:
  ├── Local Files: drag & drop, depth slider, enable/disable
  ├── Git Repos: clone URL → index → compressed markdown
  └── Connectors: Notion, Slack, HubSpot via MCP OAuth
Each source has:
  ├── Knowledge type: ground-truth | signal | evidence | framework | hypothesis | guideline
  ├── Depth: 10-100% (continuous slider)
  └── Token budget contribution
```
**Status:** ⚠️ Functional but UX needs labels, type selector not visible enough, depth unexplained
**Gap:** No code-aware indexing (only heading-based markdown)

### 3.5 Prompt Preview
```
Review tab → "View Prompt" → Modal shows full assembled system prompt
  → Line-numbered preview with syntax highlighting
```
**Status:** ✅ Working (PromptPreviewModal)

### 3.6 Per-Field AI Refinement
```
AgentBuilder → Click ✨ on persona/constraint/objective field
  → refineField() → LLM improves that specific field
  → Applies result to store
```
**Status:** ⚠️ Exists in AgentBuilder but not in v2 Review tab sections
**Gap:** Review sections don't have per-field AI refinement buttons

### 3.7 Framework Extraction
```
When a Framework-type source is connected:
  → frameworkExtractor auto-extracts:
    ├── Constraints (rules, naming conventions)
    ├── Workflow steps (processes, checklists)
    ├── Persona hints (tone, style)
    └── Tool hints (preferred tools)
  → These actively reshape the agent (not just passive knowledge)
```
**Status:** ✅ Working (frameworkExtractor.ts)

### 3.8 Ghost Suggestions
```
While typing in Describe:
  → getGhostSuggestions() suggests knowledge types based on prompt content
```
**Status:** ⚠️ Exists but not wired in v2 DescribeTab

---

## 4. AGENT SAVE & VERSIONING

### 4.1 Save to Backend
```
Two paths:
  a) AgentBuilder → Save button → name prompt → PUT /api/agents/:id
  b) SaveAgentModal → name + icon + category → PUT /api/agents/:id + download
Both call collectFullState() → persists full agent state
```
**Status:** ✅ Working
**Backend:** Full CRUD at /api/agents

### 4.2 Version History
```
Topbar → version badge (v0.1.0) → dropdown:
  ├── List last 5 versions with timestamps
  ├── Click "Restore" → restores that version's state
  └── Versions created on: save, qualification patch, fact promotion
Backend: GET /api/agents/:id/versions
```
**Status:** ✅ Working
**Gap:** No diff view between versions. No version labels/descriptions.

### 4.3 Auto-Checkpoint
```
versionStore → checkpoint(label) creates a named snapshot
  → Called automatically on: qualification patches, fact promotions
  → NOT called on: tab navigation, manual edits
```
**Status:** ⚠️ Partial — only auto-checkpoints on specific operations

### 4.4 Delete Agent
```
DELETE /api/agents/:id
```
**Status:** ✅ Backend exists but no UI delete button in AgentLibrary
**Gap:** Need delete/archive on agent cards

---

## 5. AGENT EXPORT

### 5.1 Single-Target Export
```
SaveAgentModal → Select target → Download:
  ├── Claude Code (.md) — drop into .claude/agents/
  ├── OpenClaw (.yaml) — OpenClaw agent definition
  ├── Codex (.json) — OpenAI Codex agents
  ├── Amp (.yaml) — Sourcegraph Amp
  ├── Vibe Kanban (.json) — BloopAI
  └── Generic JSON (.json) — universal
```
**Status:** ✅ Working

### 5.2 Multi-Target Export
```
SaveAgentModal → "Export All Targets" → downloads all formats
```
**Status:** ✅ Working

### 5.3 Agent Directory Export
```
TestPanel → Export sub-tab → "Agent Directory" → .zip containing:
  ├── agent.yaml (config)
  ├── AGENTS.md (instructions)
  ├── knowledge/ (source files)
  └── tools/ (MCP config)
```
**Status:** ✅ Working (agentDirectory.ts)

### 5.4 Agent Directory Import
```
TestPanel → Export sub-tab → "Import Agent" → .zip upload → parse → restore state
```
**Status:** ✅ Working

### 5.5 YAML Export
```
SaveAgentModal → "Export as YAML" → exports via exportAgentYaml()
```
**Status:** ✅ Working

### 5.6 Clipboard Copy
```
SaveAgentModal → "Copy" → copies current format preview to clipboard
```
**Status:** ✅ Working

---

## 6. AGENT QUALIFICATION

### 6.1 Suite Generation
```
Qualification tab → Enter mission brief
  → POST /api/qualification/generate-suite
  → LLM generates: test cases, scoring dimensions, pass threshold
  → User reviews and edits test cases
```
**Status:** ⚠️ Backend exists, tab exists, not verified with v2

### 6.2 Qualification Run
```
Qualification tab → "Run" → POST /api/qualification/run
  → For each test case:
    1. Agent responds to test input
    2. LLM judge scores against expected behavior
    3. Scores per dimension + overall pass/fail
  → Results displayed with per-case breakdown
```
**Status:** ⚠️ Backend exists, not verified end-to-end

### 6.3 Patch Application
```
After qualification → Suggested improvements (patches)
  → User selects patches to apply
  → POST /api/qualification/apply-patches
  → Agent config updated, version checkpoint created
```
**Status:** ⚠️ Backend exists, not verified

### 6.4 Manual Test Cases
```
Test tab → Chat section → conversation store has test cases:
  ├── saveCurrentAsTest(name, expectedBehavior) — save chat as test
  ├── addTestCase() — manual creation
  └── runningTests state for batch execution
```
**Status:** ⚠️ Store actions exist but UI not prominently exposed

---

## 7. AGENT RETRIEVAL FROM LIBRARY

### 7.1 Browse Library
```
App opens → AgentLibrary:
  ├── Grid of agent cards (name, description, avatar, tags, last modified)
  ├── Empty state with CTA
  └── "+ New Agent" button
```
**Status:** ✅ Working
**Gap:** No search/filter. No sorting. No categories view.

### 7.2 Load Agent
```
Click agent card → loadAgent(id):
  1. GET /api/agents/:id → full state
  2. restoreFullState() with defensive defaults
  3. Auto-reconnect MCP servers
  4. Switch to editor view (Topbar + WizardLayout)
```
**Status:** ✅ Working (with schema migration)

### 7.3 Delete Agent from Library
**Status:** ❌ No UI — backend DELETE exists

### 7.4 Search & Filter
**Status:** ❌ Not implemented
**Need:** Search by name/description, filter by category/tags

### 7.5 Agent Templates Gallery
**Status:** ❌ Not implemented
**Need:** Pre-built agent templates alongside saved agents

---

## MARKET COMPARISON

### vs. Dify (90K★)
| Feature | Dify | Modular Studio |
|---------|------|----------------|
| Agent creation | Visual flow builder | Meta-prompt generation (faster) |
| Knowledge | RAG with chunk retrieval | Tree-aware semantic (deeper) |
| Testing | Prompt debugger | Full pipeline observability |
| Export | API endpoint only | 6 target formats |
| Multi-agent | Sequential chains | Team runner with shared context |
| **Unique** | Marketplace, cloud hosting | Context engineering, depth control |

### vs. LangGraph Studio
| Feature | LangGraph Studio | Modular Studio |
|---------|-----------------|----------------|
| Agent creation | Code-first (Python) | No-code + AI generation |
| Knowledge | Custom retriever code | Visual source management |
| Testing | Thread replay | Live chat + pipeline traces |
| Export | Python deployable | Multi-format agent defs |
| **Unique** | Graph state machine | Knowledge pipeline visibility |

### vs. CrewAI Studio
| Feature | CrewAI | Modular Studio |
|---------|--------|----------------|
| Agent creation | Role/goal/backstory | Full structured definition |
| Knowledge | Tool-based RAG | Budget-aware tree retrieval |
| Multi-agent | Crew orchestration | Team runner |
| Export | Python code | 6 target formats |
| **Unique** | Process orchestration | Context engineering pipeline |

### vs. Claude Code / Cursor / Windsurf
| Feature | Coding agents | Modular Studio |
|---------|---------------|----------------|
| Agent creation | AGENTS.md manual writing | AI-generated from description |
| Knowledge | Manual file references | Auto-indexed, budget-managed |
| Testing | Run and see | Pipeline-traced chat testing |
| Qualification | None | LLM-judged test suites |
| **Unique** | Code execution | Agent design + export for any target |

### What Modular Uniquely Offers
1. **Meta-prompt generation** — Describe → full agent in seconds (nobody else does this)
2. **Knowledge pipeline visibility** — See exactly how context is assembled (black box elsewhere)
3. **Multi-target export** — One agent, export for Claude/Codex/OpenClaw/Amp (vendor-neutral)
4. **Budget-aware retrieval** — Token-aware depth control per source (not just "chunk size")
5. **Fact insights** — AI suggests improvements from accumulated knowledge (evolutionary design)
6. **Framework extraction** — Style guides and rules auto-shape agent behavior

### Market Gaps We Should Fill
1. **Code-aware tree indexer** — Nobody does AST-level code understanding for agent context
2. **Agent marketplace/sharing** — Export agents for others to import (ClaHub potential)
3. **Live agent deployment** — One-click deploy to Claude Code/OpenClaw/API endpoint
4. **Continuous qualification** — Auto-run test suites on agent changes (CI for agents)
5. **Collaborative editing** — Multiple users refining the same agent
6. **Agent analytics** — Track how agents perform across conversations over time

---

## FLOW GAPS SUMMARY (by priority)

### Must Fix
- [ ] Knowledge depth labels + configuration UX
- [ ] Code-aware tree indexer (TypeScript/Python AST)
- [ ] Library: search, filter, delete agents
- [ ] Per-field AI refinement in Review tab sections
- [ ] End-to-end smoke test of full flow

### Should Fix
- [ ] Qualification tab verification
- [ ] Team runner verification
- [ ] Ghost suggestions in Describe tab
- [ ] Demo presets as templates in Library
- [ ] Agent clone/duplicate
- [ ] Version diff view

### Nice to Have
- [ ] Agent deployment (one-click to target platform)
- [ ] Collaborative editing
- [ ] Agent analytics dashboard
- [ ] Continuous qualification (CI)
- [ ] Agent marketplace/sharing
