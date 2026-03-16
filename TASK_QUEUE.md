# TASK_QUEUE.md — Overnight Autonomous Work

## Instructions for Cron Agent
1. Read this file
2. Find the first task with status `TODO`
3. Execute it following the task description
4. Run the quality gate if specified
5. Update status to `DONE` with timestamp
6. Commit + push to feat/v2-wizard-ui
7. If a task fails build/tsc, set status to `FAILED` and move to next

## Quality Gates
- **TSC**: `npx tsc -p tsconfig.app.json --noEmit` — zero errors
- **BUILD**: `npm run build` — exit code 0
- **SMOKE**: Start dev server, verify app loads, tabs switch, no console errors

---

## Task 1: TestTab center → TestPanel
- **Status:** DONE — 2026-03-16 23:41
- **What:** In src/tabs/TestTab.tsx, replace ConversationPanel import/usage with TestPanel from src/panels/TestPanel.tsx in the center panel. TestPanel already has chat, markdown, streaming, input bar. Pass appropriate props (onCollapse, onExpand, onMinimize, isExpanded).
- **Gate:** TSC + BUILD

## Task 2: QualificationTab → QualificationPanel  
- **Status:** TODO
- **What:** In src/tabs/QualificationTab.tsx, replace the recreated UI with QualificationPanel from src/panels/QualificationPanel.tsx. The panel already has generateSuite, runQualification, applyPatches wired up. Keep the tab wrapper (header, description) but render QualificationPanel as the content.
- **Gate:** TSC + BUILD

## Task 3: ReviewTab → consoleStore
- **Status:** TODO
- **What:** In src/tabs/ReviewTab.tsx, verify all fields (identity, model, constraints, workflow, output format) read from AND write to consoleStore. Remove any local state that duplicates store state. Test: change a constraint in ReviewTab, switch to another tab, come back — it should persist.
- **Gate:** TSC + BUILD

## — CHECKPOINT 1: AUDIT —
- **Status:** TODO
- **What:** Run full audit of the 3 tasks above. For each modified file: verify no `as` casts, no inline styles >3 props, no unused imports, functions <20 lines. Check that stores are the single source of truth. Run TSC + BUILD. Report findings in a comment at the bottom of this file.
- **Gate:** TSC + BUILD clean

## Task 4: KnowledgeTab → real stores
- **Status:** TODO
- **What:** In src/tabs/KnowledgeTab.tsx, ensure sources read from treeIndexStore (indexed files, status, progress) and knowledgeStore (types, depth, budget). Remove any hardcoded/mock data. Index button should call real treeIndexer service.
- **Gate:** TSC + BUILD

## Task 5: ToolsTab → real stores
- **Status:** TODO
- **What:** In src/tabs/ToolsTab.tsx, ensure MCP servers read from mcpStore.servers (status, tool count, latency). Skills read from skillsStore or healthStore. Probe button calls real healthService. Remove mock data.
- **Gate:** TSC + BUILD

## — CHECKPOINT 2: AUDIT —
- **Status:** TODO
- **What:** Audit tasks 4-5. Same criteria as Checkpoint 1. Additionally: verify that switching between wizard tabs preserves all state (no data loss on tab switch). Report findings.
- **Gate:** TSC + BUILD clean

## Task 6: Fix `as any` in TracePanel
- **Status:** TODO
- **What:** In src/components/test/TracePanel.tsx, replace `(traces as any)[conversationId]` with proper typed access using TraceStore types. Replace `event.inputTokens` etc with proper type guards or typed interfaces. Zero `as` casts when done.
- **Gate:** TSC + BUILD

## Task 7: manualChunks vite.config
- **Status:** TODO
- **What:** In vite.config.ts, add rollupOptions.output.manualChunks to split: react-markdown + remark-gfm → 'markdown' chunk, lucide-react → 'icons' chunk, zustand stores → 'stores' chunk. Target: main index chunk < 500KB.
- **Gate:** BUILD + verify chunk sizes in output

## Task 8: Delete dead files
- **Status:** TODO
- **What:** Remove: src/components/test/ConversationPanel.tsx (replaced by TestPanel), V2_TASK.md, V2_EXECUTION_PLAN.md. Verify no imports reference deleted files.
- **Gate:** TSC + BUILD

## — CHECKPOINT 3: E2E SMOKE TEST —
- **Status:** TODO
- **What:** Start dev server (`npm run dev`). Verify in order:
  1. App loads without console errors
  2. All 7 tabs render and switch correctly
  3. Describe tab: type text, switch away, come back — text persists
  4. Knowledge tab: add a source (if API available) or verify UI renders
  5. Tools tab: MCP servers show real status from store
  6. Memory tab: change strategy, verify it saves
  7. Review tab: edit a constraint, verify it persists in consoleStore
  8. Test tab: TestPanel renders in center panel with chat input
  9. Qualification tab: QualificationPanel renders with generate/run buttons
  10. Tab keyboard navigation (arrow keys) works
  Report pass/fail for each item. If all pass, set status DONE. If any fail, list the failures.
- **Gate:** All 10 checks pass

## Task 9: Export handlers ReviewTab
- **Status:** TODO
- **What:** In src/tabs/ReviewTab.tsx, wire export dropdown handlers to real functions from src/utils/agentExport.ts (exportForTarget, downloadAgentFile). JSON export: collectFullState() → JSON.stringify → download. YAML: use agentExportYaml. Markdown: use exportForTarget('claude-code'). Claude/OpenAI formats: use exportForTarget with appropriate target.
- **Gate:** TSC + BUILD

## Task 10: Step completion indicators
- **Status:** TODO
- **What:** In src/layouts/WizardLayout.tsx, add completion indicators to tab buttons. A tab is "complete" when: Describe has >20 chars prompt, Knowledge has >0 sources, Tools has >0 MCP servers or skills, Memory has a strategy selected, Review has agent name set. Show a small checkmark icon next to completed tab labels. Use Check from lucide-react, 12px, color #2ecc71.
- **Gate:** TSC + BUILD

## — FINAL CHECKPOINT: FULL AUDIT —
- **Status:** TODO
- **What:** Final review of entire feat/v2-wizard-ui branch:
  1. `npx tsc -p tsconfig.app.json --noEmit` — zero errors
  2. `npm run build` — zero errors, main chunk < 500KB
  3. No `as` casts in any tab or test component
  4. No inline styles > 3 properties
  5. All tabs use real stores (no mock/local duplicate state)
  6. All panels properly integrated
  7. git log summary of all commits
  Report: grade (A/B/C/D/F) with justification. Write results to bottom of this file.
- **Gate:** All checks pass → push final

---

## Audit Reports
(Agents write their findings below)
