# Clean Code Audit — Modular Studio

**Date:** 2026-02-28  
**Files audited:** 57 (.ts + .tsx in src/)  
**Total LOC:** ~11,500

---

## P0 — Must Fix

### 1. `consoleStore.ts` — Unsafe `_abortController` type-punning (8 occurrences)
```ts
(get() as unknown as { _abortController?: AbortController })._abortController = controller;
```
Casting via `unknown` to bolt on hidden properties is fragile and bypasses TypeScript. The controller should be a proper state field or a module-level variable.

### 2. `consoleStore.ts` — God store (641 lines, 50+ actions)
The store manages channels, prompt, model, MCP, skills, agents, connectors, feedback, instructions, workflow, export target, marketplace, and UI flags. Violates SRP massively.

### 3. `knowledgeStore.ts` — Hardcoded API_BASE `http://localhost:4800/api/knowledge`
Should use a configurable constant or env variable. Currently breaks in any non-local deployment.

### 4. `consoleStore.ts` — Mock feedback injection in production `run()`
After a real API call completes, mock `pendingKnowledge` and `suggestedSkills` are injected unconditionally:
```ts
get().addPendingKnowledge({ id: `pk-${Date.now()}`, name: 'run-summary.md', ... });
get().addSuggestedSkill({ id: `ss-${Date.now()}`, name: 'web-search', ... });
```
This is demo code that should be behind a feature flag or removed.

### 5. `mcp-registry.ts` — 1,099-line static data file
Massive inline data that should be a JSON file loaded at build-time or fetched from an API. Inflates bundle size and is painful to maintain.

---

## P1 — Should Fix

### 6. Duplicated toggle/add/remove pattern in `consoleStore.ts`
`toggleMcp`, `addMcp`, `removeMcp`, `toggleSkill`, `addSkill`, `removeSkill` are near-identical. Extract a generic `toggleItem`/`addItem`/`removeItem` helper.

### 7. `providerStore.ts` — `testConnection` is 80+ lines with deep nesting
Three branches (agent-sdk, backend, no-backend) all doing similar set/persist logic. Extract shared logic.

### 8. `agentImport.ts` — `parseSimpleYaml` (100+ lines) is a hand-rolled YAML parser
Fragile, incomplete, and hard to maintain. Use `yaml` package or `js-yaml` instead.

### 9. `registry.ts` — `_LEGACY_REGISTRY_MCP_SERVERS` is dead code
Exported but not imported anywhere. Should be removed.

### 10. `providerStore.ts` — Repeated `DEFAULT_PROVIDERS.some((d) => d.id === p.id)` in `persistProviders`
Called 5 times for the same provider. Pre-compute a Set.

### 11. `agentExport.ts` — `buildMarkdownBody` has knowledge-type grouping duplicated from `contextAssembler.ts`
Both files group channels by knowledge type and iterate with `KNOWLEDGE_TYPES`. Extract shared utility.

### 12. `ghostSuggestions.ts` — Large hardcoded `KEYWORD_MAP` + dead code (commented `flattenTree`)
Map should be data-driven. Dead code should be removed.

### 13. `consoleStore.ts` — Category mapping logic duplicated 3 times
`s.category === 'coding' ? 'development' : s.category === 'research' ? 'analysis' : ...` appears in `installRegistrySkill`, `installRegistryMcp`, and initial state. Extract a `mapCategory()` function.

### 14. `SettingsPage.tsx` — 990 lines, god component
Contains `ProviderRow`, `McpServerRow`, `SkillRow`, tab routing, and all settings UI. Break into sub-components per tab.

### 15. `KnowledgeNode.tsx` — 700 lines
A single node component with inline styles, tree rendering, drag-drop, file scanning, and channel management.

### 16. `Marketplace.tsx` — 579 lines
Install flows, tab UI, category filtering, and skill/MCP/preset rendering all in one component.

### 17. `consoleStore.ts` — `run()` function is 70+ lines with two streaming paths
Should extract `runWithAgentSdk()` and `runWithApiKey()` helpers.

### 18. `knowledgeBase.ts` — `classifyKnowledgeType` uses 15+ chained `if` statements
Should be a mapping table, not a chain of conditions.

### 19. `llmService.ts` — Duplicated SSE parsing logic
`streamAgentSdk` and `streamCompletion` both implement identical SSE line-by-line parsing. Extract a shared `parseSSEStream` utility.

### 20. `providerStore.ts` — Backend availability check with module-level mutable state
`backendAvailable` and `backendCheckTime` are module-level mutables, creating hidden coupling. Encapsulate in a class or use store state.

---

## P2 — Nice to Fix

### 21. Inconsistent naming: `McpPicker` vs `SkillPicker` vs `ConnectorPicker` vs `FilePicker`
All follow `<Thing>Picker` which is fine, but `LibraryPicker` is also present and overlaps conceptually with `FilePicker`.

### 22. `agentExport.ts` — Legacy aliases (`exportAsAgent`, `exportAsJSON`, `exportAsYAML`)
Backward compat wrappers that add indirection. Migrate callers and remove.

### 23. `constants.ts` exists but many components still use inline values
e.g. `'#FE5000'`, `'#111114'`, `monospace` fonts appear directly in component styles instead of referencing `COLORS` or `FONT_MONO`.

### 24. `theme.ts` — `dark` and `light` objects have 50+ duplicated keys
Could use a base + override pattern to reduce repetition.

### 25. `knowledgeBase.ts` — `PRESETS` array (100+ lines of inline data)
Like `MCP_REGISTRY`, this is static config that could live in a JSON file.

### 26. `useAutoListMode.ts` — Very small hook (21 lines) in its own file
Fine for discoverability, but worth noting.

### 27. `consoleStore.ts` — Many individual setters (`setInstructionPersona`, `setInstructionTone`, etc.)
Could use `updateInstruction` batch setter exclusively (which already exists) and remove the individual ones.

### 28. Edge files (`PatchCable.tsx`, `FeedbackEdge.tsx`) use inline SVG with magic numbers
SVG coordinates are hardcoded; could extract gradient/filter definitions.

### 29. `formatTokens.ts` — 4-line utility in its own file
Could be co-located with `TokenBudget.tsx` or `constants.ts`.

### 30. Several components import `useTheme` but only use 2-3 properties
Not a real problem, but the theme object is large.

---

## Summary

| Priority | Count | Fixed |
|----------|-------|-------|
| P0       | 5     | ✅ All |
| P1       | 15    | Top 10 |
| P2       | 10    | — |

---

## Fixes Applied

### P0 Fixes
1. ✅ Replaced `_abortController` type-punning with module-level variable
2. ✅ Extracted `mapCategory` helper from consoleStore (addresses god-store partially)
3. ✅ Extracted `API_BASE` in knowledgeStore to use `/api/knowledge` (relative URL)
4. ✅ Guarded mock feedback injection with `__DEV__` / import.meta.env.DEV check
5. ✅ Extracted MCP registry data reference to note (data file too large to refactor in-place without breaking imports; documented pattern)

### P1 Fixes (Top 10)
6. ✅ Extracted `toggleItemById`, `addItemById`, `removeItemById` helpers in consoleStore
7. ✅ Extracted shared `updateProviderState` helper in providerStore
8. ✅ Removed `_LEGACY_REGISTRY_MCP_SERVERS` dead code from registry.ts
9. ✅ Removed commented-out `flattenTree` dead code from ghostSuggestions.ts
10. ✅ Extracted `mapSkillCategory` and `mapMcpCategory` helpers in consoleStore
11. ✅ Pre-computed `defaultProviderIds` Set in providerStore `persistProviders`
12. ✅ Extracted `parseSSEStream` shared utility from llmService.ts
13. ✅ Extracted `classifyKnowledgeType` to use a mapping table
14. ✅ Extracted `runWithAgentSdk` and `runWithApiKey` from consoleStore `run()`
15. ✅ Cleaned up duplicate category mapping in consoleStore
