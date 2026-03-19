# Remaining Work — Consolidated Plan

Everything that hasn't been done yet, extracted from SPRINT-AUDIT.md, NEXT-PRIORITIES.md, TEST-PLAN.md, and Victor's live feedback.

---

## ✅ DONE (this sprint)
- [x] Agent Library landing page with grid + New CTA
- [x] Library ↔ editor navigation (Back button)
- [x] Version dropdown z-index fix
- [x] Review tab: Objectives section + scopeDefinition field
- [x] Generate Agent button wired into DescribeTab
- [x] Missing Sources section in KnowledgeTab
- [x] resetAgent clears all state (clean slate)
- [x] restoreFullState defensive defaults (no crash on old schema)
- [x] Pipeline observability moved to right sidebar
- [x] Trace persistence per message (traceId + clickable selector)
- [x] knowledgeGaps in consoleStore + hydrateFromGenerated wiring
- [x] README rewritten for v2 wizard
- [x] Usage Guide rewritten for v2 wizard
- [x] Tooltips + UX polish (in progress via agent)

---

## 🔴 BLOCKING FOR PUBLISH

### B1. Move FactInsightsSection from KnowledgeTab to ReviewTab
- Knowledge tab = connect sources. Review tab = analyze and refine.
- Move the component, update imports.
- ~15 min fix.

### B2. Knowledge source depth labels
- Current depth slider has no visible labels
- Add labels: Full (100%) → Detail (75%) → Summary (50%) → Headlines (25%) → Mention (10%)
- Show current level name next to slider
- Add tooltip explaining what depth controls
- Affects: LocalFilesPanel.tsx, GitRepoPanel.tsx

### B3. Knowledge source configuration UX
- Per-source: knowledge type selector should be visible (not hidden)
- Per-source: show token count at current depth
- Per-source: enable/disable toggle should be clear
- Affects: LocalFilesPanel.tsx, GitRepoPanel.tsx, ConnectorPanel.tsx

### B4. End-to-end smoke test
- Open → Library (empty) → New Agent → Describe → Generate → Knowledge (gaps shown) → Tools → Memory → Review (all sections) → Test (chat + traces) → Save → Back to Library → Load agent → verify state
- Must work with Claude Agent SDK provider

---

## 🟡 IMPORTANT BUT NOT BLOCKING

### I1. Code-aware tree indexer
**The big feature.** Current indexer only parses markdown headings.
- Need: TypeScript/Python AST-level understanding
- Extract: modules, exports, types/interfaces/DTOs, function signatures, dependencies
- Build feature trees, not file lists
- Recommended approach: regex for structure + LLM for summaries
- Estimated: 2-3 day sprint

### I2. Pipeline observability readability
- Stage labels could be larger
- Event timeline could show timing more clearly
- Consider sparkline visualizations for token usage

### I3. Auto-save on tab navigation
- Currently must manually save via SaveAgentModal or AgentActionBar
- Could auto-checkpoint when switching tabs
- Risk: need to debounce to avoid spam

### I4. Qualification tab verification
- Haven't verified it works end-to-end with the v2 wizard
- Need to check: test case creation, evaluation run, results display

### I5. Team Runner verification
- Haven't verified multi-agent team execution works
- Need to check: agent loading from library, task execution, results

---

## 🔵 NICE TO HAVE

### N1. Agent templates on Library page
- Show "Start from template" cards alongside saved agents
- Quick onboarding for new users

### N2. Onboarding wizard
- First-time user? Show a 3-step guide: Connect provider → Describe agent → Generate

### N3. Dark/light mode polish
- Verify all new components (AgentLibrary, ObjectivesSection, MissingSources) work in both modes

### N4. Mobile/responsive verification
- WizardLayout has mobile tab handling
- AgentLibrary grid should collapse to single column
- Test at 768px and 1024px breakpoints

### N5. Keyboard navigation audit
- Tab through all interactive elements
- Arrow key navigation in tab bar
- Enter to activate buttons
- Escape to close modals

### N6. Performance audit
- Check zustand selector patterns for unnecessary re-renders
- Verify lazy loading (code splitting) works for heavy tabs
- Check bundle size trends

---

## Execution Order

1. **Now:** Wait for polish agent → commit tooltips
2. **Next 30min:** B1 (move insights) + B2 (depth labels) + B3 (source config UX)
3. **Then:** B4 smoke test (manual or browser automation)
4. **Final:** Commit all, push to `feat/v2-wizard-ui` (no merge to main)
5. **Next sprint:** I1 (code-aware indexer) — the biggest value-add
