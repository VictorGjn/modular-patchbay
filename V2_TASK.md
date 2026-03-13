# V2 Wizard Layout — Implementation Task

## Goal
Convert the current 3-panel dashboard into a 7-tab wizard flow.

## Current Architecture
- `src/layouts/DashboardLayout.tsx` — 3-panel: Sources | AgentBuilder | TestPanel
- `src/panels/` — existing panel components
- `src/store/` — Zustand stores (keep ALL as-is)
- `src/theme.ts` — dark/light theme (keep using)

## New Tab Order
1. **Describe** — textarea + quick templates (new, simple)
2. **Knowledge** — from SourcesPanel: source list, knowledge types, depth, tree index, repo indexer, budget
3. **Tools** — from AgentBuilder: MCP servers + skills sections
4. **Memory** — from consoleStore/memoryStore: session config, seed facts, long-term, working memory
5. **Review** — editable agent card: identity, persona, constraints, workflow, model/output, system prompt preview
6. **Test** — from TestPanel + TraceViewer: trace, chat, context panel
7. **Qualification** — from QualificationPanel: test suites

## Implementation Steps

### 1. Create `src/layouts/WizardLayout.tsx`
- Tab bar at top with 7 tabs
- Active tab state (useState)
- Renders one tab at a time
- Next/Previous navigation at bottom of each tab

### 2. Create `src/tabs/` directory with:
- `DescribeTab.tsx` — simple: textarea bound to consoleStore.prompt, quick template buttons
- `KnowledgeTab.tsx` — extract from SourcesPanel (channels list, knowledge type pills, depth controls, tree index, repo indexer section, token budget)
- `ToolsTab.tsx` — extract MCP and Skills sections from AgentBuilder
- `MemoryTab.tsx` — extract memory section from AgentBuilder (use memoryStore)
- `ReviewTab.tsx` — combine: agent meta (name/description), persona, constraints, workflow steps, model/output config, system prompt preview, export
- `TestTab.tsx` — wrap TestPanel + TraceViewer
- `QualificationTab.tsx` — wrap QualificationPanel

### 3. Update `src/App.tsx`
- Import WizardLayout instead of DashboardLayout
- Keep all modals/pickers

### 4. Update `src/components/Topbar.tsx`
- Replace current nav with tab buttons
- Keep settings gear + Run button on right

## Design Rules
- NO EMOJIS — use SVG icons only
- Use existing theme.ts colors
- Light mode default
- Cards: white bg, subtle shadow, rounded corners
- Accent: #FE5000
- 44px minimum touch targets
- Collapsible sections with chevron icons

## Stores to Use
- `consoleStore` — prompt, model, outputFormat, agentMeta, workflowSteps, instructionState
- `knowledgeStore` — channels (sources), knowledgeTypes
- `mcpStore` — MCP servers
- `skillsStore` — installed skills
- `memoryStore` — memory config, seed facts
- `healthStore` — health checks
- `qualificationStore` — test suites
- `traceStore` — execution traces
- `providerStore` — API providers

## After Done
1. Run `npm run build` to verify
2. Commit: `git add -A && git commit -m "feat(v2): wizard layout with 7-tab flow"`
