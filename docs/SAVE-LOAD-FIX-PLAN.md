# Save / Load / Import Fix Plan

## Problem Statement
The save/load/import system is fundamentally broken:
1. **Save** only downloads a file — doesn't persist the agent to the backend
2. **Load** only works for 3 hardcoded preset IDs (senior-pm, feedback-manager, company-intel)
3. **Import** parses files but doesn't restore instructions, workflow, memory config, MCP servers, or skills
4. **Runtime agent dropdown** reads from `teamStore.agentLibrary` (localStorage only) — fragile, loses data, no full state
5. **No backend persistence** for saved agents — no `server/routes/agents.ts`, no storage

## Root Causes

### Save Path (broken)
1. `SaveAgentModal.handleSave()` calls `upsertLibraryAgent()` with only `{id, name, description, avatar, version, mcpServerIds, skillIds}` — NO instructions, NO channels, NO workflow, NO memory config
2. Then downloads a file in the selected export format (Claude MD, Amp YAML, etc.)
3. The `agentLibrary` in teamStore is a shallow summary — it can't restore the full agent state

### Load Path (broken)
1. `consoleStore.loadAgent(id)` looks up hardcoded `presetMap` → `loadPreset()`
2. No way to load a saved agent from the library
3. No way to load from the backend (because nothing is saved there)

### Import Path (partial)
1. `importAgent()` parser works for JSON/YAML/Markdown formats
2. `handleImportFile()` in App.tsx only restores: channels, model, outputFormat, prompt, agentMeta
3. Missing: instructionState (persona, constraints, objectives), workflowSteps, mcpServers, skills, memoryConfig, agentConfig

### Runtime Dropdown (broken)
1. Reads `agentLibrary` from localStorage — only has summary metadata
2. `addAgentFromLibrary()` creates a team agent but with no real state (no instructions, no channels, no workflow)
3. If localStorage clears, all saved agents are gone

## Solution Architecture

```
┌─────────────────────┐
│  SaveAgentModal      │ ── full state snapshot ──▶ Backend + Library
│  (handleSave)        │
└──────────────────────┘

┌─────────────────────┐
│  Backend Agent Store │ ── ~/.modular-studio/agents/{id}.json
│  (CRUD API)          │
└──────────┬───────────┘
           │ GET /api/agents/:id
┌──────────▼──────────┐
│  loadAgent(id)       │ ── full state restore ──▶ consoleStore
│  (consoleStore)      │
└──────────────────────┘

┌─────────────────────┐
│  Import (file)       │ ── parse + full restore ──▶ consoleStore
│  (App.tsx)           │
└──────────────────────┘

┌─────────────────────┐
│  Runtime Dropdown    │ ── reads from backend API, shows full agents
│  (RuntimePanel)      │
└──────────────────────┘
```

## Tickets

### Ticket A: Backend Agent Store (server)
**File**: `server/services/agentStore.ts` + `server/routes/agents.ts` + `server/index.ts`

Create persistent agent storage:
- Directory: `~/.modular-studio/agents/`
- Each agent: `{id}.json` containing FULL state snapshot
- State snapshot interface (`SavedAgentState`):
  ```ts
  {
    id: string;
    version: string;
    savedAt: string; // ISO timestamp
    agentMeta: AgentMeta;
    instructionState: InstructionState;
    workflowSteps: WorkflowStep[];
    channels: ChannelConfig[];
    mcpServers: McpServerEntry[];
    skills: SkillEntry[];
    connectors: Connector[];
    agentConfig: AgentConfig;
    memoryConfig: { session, longTerm, working, sandbox };
    exportTarget: ExportTarget;
    outputFormat: OutputFormat;
    outputFormats: OutputFormat[];
    tokenBudget: number;
    prompt: string;
  }
  ```
- API endpoints:
  - `GET /api/agents` — list all (id + agentMeta + savedAt, no full state)
  - `GET /api/agents/:id` — full state
  - `PUT /api/agents/:id` — save/update full state
  - `DELETE /api/agents/:id` — delete

### Ticket B: Save Full State (frontend)
**Files**: `src/components/SaveAgentModal.tsx`, `src/store/consoleStore.ts`

1. `handleSave()` must collect FULL state from all stores:
   - `consoleStore`: agentMeta, instructionState, workflowSteps, channels, mcpServers, skills, connectors, agentConfig, exportTarget, outputFormat, outputFormats, tokenBudget, prompt
   - `memoryStore`: session, longTerm, working, sandbox configs
2. POST full state to `PUT /api/agents/:id`
3. ALSO update `teamStore.agentLibrary` for backward compat
4. ALSO download file (existing behavior)
5. Add a new `collectFullState()` function in consoleStore that snapshots everything

### Ticket C: Load Full State (frontend)
**Files**: `src/store/consoleStore.ts`, `src/components/Topbar.tsx` or new `AgentPicker` component

1. Replace hardcoded `loadAgent()` with real backend load:
   - `GET /api/agents/:id` → parse → restore ALL fields
2. New `restoreFullState(state: SavedAgentState)` in consoleStore:
   - Sets agentMeta, instructionState, workflowSteps, channels, mcpServers, skills, connectors, agentConfig, exportTarget, outputFormat, outputFormats, tokenBudget, prompt
   - Also restores memoryStore config
3. Add agent picker dropdown/modal in the Topbar (next to "Load Demo"):
   - Fetches `GET /api/agents` on open
   - Shows name, description, savedAt
   - Click → loads full state
   - Delete button → `DELETE /api/agents/:id`

### Ticket D: Fix Import to Restore Full State
**Files**: `src/utils/agentImport.ts`, `src/App.tsx`

1. Extend `ImportResult` to include ALL restorable fields:
   - `instructionState`, `workflowSteps`, `mcpServers`, `skills`, `agentConfig`
2. Update parsers to extract these from each format:
   - Claude MD: parse persona/constraints from frontmatter or body sections
   - Generic JSON: map `agent.instructions` → instructionState
   - YAML: map `instructions`, `tools`, `mcp` to respective fields
3. Update `handleImportFile()` in App.tsx to call `restoreFullState()` instead of individual setters

### Ticket E: Fix Runtime Agent Dropdown
**Files**: `src/panels/RuntimePanel.tsx`, `src/store/teamStore.ts`

1. Runtime agent dropdown should fetch from backend `GET /api/agents` instead of localStorage
2. `addAgentFromLibrary()` should fetch full state from `GET /api/agents/:id` and populate the team agent with real instructions/channels
3. Keep localStorage as cache/fallback

### Ticket F: Fix Export to Include Full State
**Files**: `src/utils/agentExport.ts`, `src/components/SaveAgentModal.tsx`

1. `ExportConfig` is missing: `instructionState`, `workflowSteps`, `memoryConfig`
2. `buildAgentData()` doesn't use instructionState — `system` prompt is just the raw `config.prompt`
3. Exports should include:
   - Claude MD: persona, constraints, objectives in the body; workflow steps as numbered list
   - Generic JSON: full `instructionState` + `workflowSteps` + `memoryConfig` sections
   - Amp YAML: instructions should compile persona + constraints + workflow
   - All formats: MCP server configs, skill configs, connector configs
4. `SaveAgentModal` collects config via `useMemo` but doesn't pull from instructionState — add it

## Implementation Order
- Ticket A → B+F → C → D → E (B and F can be parallel since B is backend save, F is export format)

## Model Strategy
- Plan: Opus (this doc) ✅
- Tickets/implementation: Sonnet
- E2E tests: Haiku
- Final review: Opus
