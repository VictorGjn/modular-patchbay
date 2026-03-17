# Sprint Audit: Agent Lifecycle & UX Regressions

## Current State
- Branch: `feat/v2-wizard-ui` (73 commits ahead of master)
- Layout: WizardLayout with 7 tabs: Describe → Knowledge → Tools → Memory → Review → Test → Qualification
- Backend: Full agent CRUD at `/api/agents` with versioning already exists
- Agent definition: `InstructionState` has persona, tone, expertise, constraints (8 fields), objectives (primary, successCriteria, failureModes), rawPrompt

## Issues to Fix (Priority Order)

### 1. CRITICAL: Always editing "Senior Frontend Engineer" — No Agent CRUD flow
**Problem:** App loads into a single agent editing session. No way to create new agents or switch between saved ones.
**Backend:** `/api/agents` already supports LIST, CREATE, GET, PUT, DELETE with versions.
**Fix:** 
- Add `AgentLibrary` landing page component: grid of saved agents + "+ New Agent" CTA
- App starts on AgentLibrary. Clicking an agent loads it into WizardLayout. "+ New" resets state and enters WizardLayout.
- Add route/state to toggle between library view and editor view
- Wire `consoleStore.loadAgent(id)` and `consoleStore.resetAgent()` properly
- Add "Back to Library" button in Topbar when editing

### 2. HIGH: Version dropdown hidden behind content
**Problem:** Topbar version dropdown has `zIndex: 100` but Topbar itself has no `position: relative` or explicit `z-index`, so the dropdown renders behind WizardLayout content (which has `overflow-hidden` creating a stacking context).
**Fix:** Add `position: relative; z-index: 50` to the Topbar container div, ensuring its children (including the dropdown) stack above the WizardLayout content below.

### 3. HIGH: Agent Review tab drifted from spec
**Problem:** ReviewTab should show the full agent definition categories that were researched:
- Identity (name, description, avatar, tags)
- Persona (persona text, tone, expertise level)
- Constraints (8 toggles: neverMakeUp, askBeforeActions, stayInScope, useOnlyTools, limitWords + wordLimit, customConstraints, scopeDefinition)
- Objectives (primary objective, success criteria, failure modes)
- Workflow (steps with verification, error handling)
- Output config (format selection)
- Export actions

**Current state:** ReviewTab exists with IdentitySection, PersonaSection, ConstraintsSection, WorkflowSection, OutputConfigSection, ExportActions sub-components. Need to verify they're all rendering properly and match the InstructionState interface.

### 4. MEDIUM: Save should persist to store
**Problem:** Saving an agent should call the backend `/api/agents` endpoint and persist for future use.
**Current:** `SaveAgentModal` exists, `AgentActionBar` in AgentBuilder has save logic that calls `/api/agents`. But it's buried — not prominent enough.
**Fix:** Ensure save flows through to the backend. Add auto-save on tab navigation. Show save status clearly.

### 5. MEDIUM: Insights & missing sources analysis missing
**Problem:** Was available on main branch via SourcesPanel analysis features.
**What exists on current branch:** SourcesPanel is still imported in the old DashboardLayout but WizardLayout uses KnowledgeTab instead.
**Fix:** Verify KnowledgeTab has source analysis capabilities (missing sources detection, insight extraction). If not, port from SourcesPanel.

### 6. LOW: Pipeline traces not showing in conversation panel
**Problem:** After previous fix session, InlineTraceView renders per-message but PipelineStatsBar may not show when no lastPipelineStats.
**Fix:** Already partially fixed. Verify InlineTraceView and PipelineStatsBar render after a chat exchange.

## Files to Touch
- `src/App.tsx` — Add library/editor routing state
- `src/components/AgentLibrary.tsx` — NEW: Agent grid + New CTA
- `src/components/Topbar.tsx` — z-index fix, "Back to Library" button
- `src/layouts/WizardLayout.tsx` — Receive agent context from library selection
- `src/tabs/ReviewTab.tsx` — Verify all sections render correctly
- `src/panels/review/*.tsx` — Verify constraint/objective/persona sections match InstructionState
- `src/store/consoleStore.ts` — Ensure loadAgent/resetAgent work end-to-end
- `src/tabs/KnowledgeTab.tsx` — Verify insight/missing source analysis

## Key Constraint
Do NOT break existing functionality. The pipeline, test panel, qualification flow, and trace system must continue working.
