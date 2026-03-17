# Comprehensive Test & Polish Plan

## Phase 1: Tooltips Everywhere
Add title/aria-label tooltips to every interactive element that doesn't have one:
- All tab buttons in WizardLayout (Describe, Knowledge, Tools, Memory, Review, Test, Qualification)
- All buttons in AgentLibrary (New Agent, agent cards)
- Back button in Topbar
- Version dropdown trigger
- Generate Agent button in DescribeTab
- Template selection cards
- All constraint toggles in ConstraintsSection
- Success criteria/failure mode add/remove buttons in ObjectivesSection
- Workflow step buttons in WorkflowSection
- Knowledge tab: file/repo/connector sub-tabs, add buttons, depth sliders
- Tools tab: MCP server toggles, skill toggles
- Memory tab: strategy selector, fact add/remove
- Review tab: all collapsible section headers, export buttons
- Test tab: chat/team/export sub-tabs, send button, model selector
- Pipeline stats bar elements (diversity, chunks, budget)
- InlineTraceView buttons (expand, select trace)
- PipelineObservabilityPanel: stage toggles, "viewing past" dismiss
- Topbar: settings gear, theme toggle, run button

## Phase 2: Code Verification (check each file compiles + renders)

### DescribeTab flow
- Verify handleGenerate calls generateFullAgent correctly
- Verify hydrateFromGenerated populates all stores
- Verify setKnowledgeGaps stores gaps
- Verify auto-advance to next tab works
- Verify error state shows on provider failure

### AgentLibrary flow  
- Verify API response mapping (json.data format)
- Verify loadAgent works with defensive defaults
- Verify resetAgent clears everything
- Verify navigation library ↔ editor works

### KnowledgeTab
- Verify MissingSources reads from consoleStore.knowledgeGaps
- Verify FactInsightsSection has correct imports (analyzeFactsForPromotion)
- Verify "Add source" buttons work

### ReviewTab
- Verify all 7 sections render: Identity, Persona, Constraints, Objectives, Workflow, Output, Export
- Verify ObjectivesSection handles empty arrays
- Verify ConstraintsSection shows scopeDefinition

### TestTab / TestPanel
- Verify InlineTraceView renders per-message with traceId
- Verify PipelineStatsBar shows after chat
- Verify PipelineObservabilityPanel in right sidebar gets data
- Verify trace selection (click ○ on inline trace → sidebar loads it)

### Topbar
- Verify z-index: version dropdown above content
- Verify Back button shows only in editor mode

### consoleStore
- Verify knowledgeGaps field exists with default []
- Verify setKnowledgeGaps action works
- Verify hydrateFromGenerated sets knowledgeGaps
- Verify restoreFullState defensive defaults prevent crashes
- Verify resetAgent clears all state

## Phase 3: UX Polish
- Make pipeline observability more readable (larger text, clearer labels)
- Ensure empty states have clear guidance text
- Verify dark/light mode works throughout
- Check all Geist Mono / Geist Sans usage is consistent
- Verify #FE5000 accent is used consistently
- Check tab completion indicators in WizardLayout

## Phase 4: Bug Hunt
- Check for any console errors in dev tools
- Check for React key warnings
- Check for missing imports or undefined references
- Check for stale closures in callbacks
- Verify zustand selectors don't cause unnecessary re-renders
