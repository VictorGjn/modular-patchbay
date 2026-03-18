# Task Queue — Modular Studio Sprint

Working directory: C:\Users\victo\AppData\Local\Temp\modular-patchbay
Branch: feat/v2-wizard-ui
Quality gate: `npx vite build` must pass with 0 errors

---

## T01 — Knowledge depth labels
**Status:** TODO
**Files:** src/panels/knowledge/LocalFilesPanel.tsx, src/panels/knowledge/GitRepoPanel.tsx
**Task:** Add visible labels next to the depth slider showing the current level name. The depth is 10-100% continuous. Map to labels:
- 100%: "Full"
- 75%: "Detail"  
- 50%: "Summary"
- 25%: "Headlines"
- 10%: "Mention"
For values between, show nearest (e.g. 60% → "Summary"). Display as a small label next to or below the slider. Add a title tooltip on the slider: "Controls how much detail is included from this source".
**Quality gate:** npx vite build

## T02 — Knowledge source type visibility
**Status:** TODO  
**Files:** src/panels/knowledge/LocalFilesPanel.tsx, src/panels/knowledge/GitRepoPanel.tsx
**Task:** For each knowledge source card/row, make the knowledge type selector visible (not hidden behind a click). Show it as a small dropdown or pill selector next to the source name. Use the KNOWLEDGE_TYPES constant from store/knowledgeBase.ts for the options and their colors. Also show effective token count at current depth.
**Quality gate:** npx vite build

## T03 — Library search + filter + delete
**Status:** TODO
**Files:** src/components/AgentLibrary.tsx
**Task:** Add to the Agent Library:
1. Search input (filter by name/description as you type)
2. Delete button on each agent card (with confirmation) — calls DELETE /api/agents/:id then refreshes list
3. Sort by last modified (default) or name
Keep the grid layout. Use existing DS components (Input for search). The delete should be a small trash icon, not prominent — confirm with a simple window.confirm() dialog.
**Quality gate:** npx vite build

## T04 — Per-field AI refinement in Review tab
**Status:** TODO
**Files:** src/panels/review/PersonaSection.tsx, src/panels/review/ConstraintsSection.tsx, src/panels/review/ObjectivesSection.tsx
**Task:** Add a small "✨ Refine" button next to the main text fields (persona, customConstraints, scopeDefinition, primary objective). On click, call `refineField(fieldName, currentValue, agentContext)` from src/utils/refineInstruction.ts. Show a loading spinner while refining, then update the field with the result. The button should be subtle — small, ghost style, positioned at the end of the field label row.
Import: `import { refineField } from '../../utils/refineInstruction';`
You also need the agent context: `const agentMeta = useConsoleStore(s => s.agentMeta);` and `const prompt = useConsoleStore(s => s.prompt);`
**Quality gate:** npx vite build

## T05 — Ghost suggestions in Describe tab
**Status:** TODO
**Files:** src/tabs/DescribeTab.tsx
**Task:** After the user types 50+ characters, show ghost suggestions below the text area. Import `getGhostSuggestions` from src/utils/ghostSuggestions.ts. Call it with `(prompt, channels)` and render the suggestions as subtle hint pills below the textarea. Each suggestion should be clickable to append to the prompt. Debounce at 500ms. Only show when prompt.length >= 50.
**Quality gate:** npx vite build

## T06 — Agent clone/duplicate  
**Status:** TODO
**Files:** src/components/AgentLibrary.tsx
**Task:** Add a "Duplicate" button on each agent card (small copy icon). On click: loadAgent(id) → wait 100ms → then set agentMeta.name to `${name} (copy)` → switch to editor view. The duplicate should NOT save automatically — user edits then saves with new name.
**Quality gate:** npx vite build

## T07 — Demo presets as templates in Library
**Status:** TODO
**Files:** src/components/AgentLibrary.tsx
**Task:** Below the agent grid, add a "Templates" section showing cards from DEMO_PRESETS (import from src/store/demoPresets.ts). Each template card shows name, description. On click: call the preset's hydration (set prompt + instructionState + channels) then switch to editor view. Different visual style from saved agents — lighter border, "Template" badge.
**Quality gate:** npx vite build

## T08 — CHECKPOINT — Verify build + push
**Status:** TODO
**Task:** Run `npx vite build`. If clean, `git add -A && git commit -m "feat: knowledge UX, library features, AI refinement, ghost suggestions, templates" && git push origin feat/v2-wizard-ui`. Report file count changed and build status.

## T09 — Smart tree indexer: TypeScript code analysis
**Status:** TODO
**Files:** src/services/codeIndexer.ts (NEW), src/services/treeIndexer.ts
**Task:** Create a new `codeIndexer.ts` service that parses TypeScript/JavaScript source files and produces a TreeIndex with code-aware structure. It should:
1. Use regex patterns (NOT AST parsers — keep deps light) to extract:
   - `export` declarations (functions, classes, types, interfaces, constants)
   - Function signatures with param types and return types
   - Interface/type definitions with their fields
   - Class definitions with method signatures
   - Import statements (to understand dependencies)
2. Build a TreeNode hierarchy:
   - Root: file path
   - Level 1: module sections (exports, types, classes, internal functions)
   - Level 2: individual declarations with signatures
   - Level 3: interface fields, class methods
3. Each node's `text` should contain:
   - Full depth: complete source code
   - Detail depth: signature + JSDoc/comments + first line of body
   - Summary depth: signature only
   - Headlines depth: just the name and kind (e.g., "function createUser()")
   - Mention depth: just the export name
4. Export function: `indexTypeScript(source: string, code: string): TreeIndex`
5. Also export: `indexPython(source: string, code: string): TreeIndex` with equivalent Python patterns (def, class, import, type hints)

In treeIndexer.ts, add a dispatcher function:
```typescript
export function indexSource(source: string, content: string): TreeIndex {
  const ext = source.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return indexTypeScript(source, content);
  if (ext === 'py') return indexPython(source, content);
  return indexMarkdown(source, content); // fallback
}
```
**Quality gate:** npx vite build

## T10 — Wire code indexer into knowledge pipeline
**Status:** TODO
**Files:** src/store/treeIndexStore.ts, src/panels/knowledge/LocalFilesPanel.tsx
**Task:** In the treeIndexStore, when indexing a file, use the new `indexSource()` dispatcher instead of always calling `indexMarkdown()`. This way .ts/.tsx/.js/.py files get code-aware tree indexes automatically.
In LocalFilesPanel, when displaying an indexed source, show the code structure (exports, types, functions) as expandable nodes instead of just "N tokens".
**Quality gate:** npx vite build

## T11 — Qualification tab verification
**Status:** TODO
**Files:** src/tabs/QualificationTab.tsx, src/services/qualificationService.ts
**Task:** Read the QualificationTab component and verify it renders correctly in the wizard. Check:
1. Does it import and use qualificationService functions correctly?
2. Does the "Generate Suite" flow work (calls /api/qualification/generate-suite)?
3. Does the "Run" flow work (calls /api/qualification/run)?
4. Are results displayed properly?
5. Fix any import errors or missing props. Add defensive guards (|| []) on any arrays.
**Quality gate:** npx vite build

## T12 — FINAL CHECKPOINT — Build + push + report
**Status:** TODO
**Task:** Run `npx vite build`. If clean, `git add -A && git commit -m "feat: smart code indexer, qualification verification, final polish" && git push origin feat/v2-wizard-ui`. List all commits since the sprint started (last 20). Report any remaining TODO items.

---

## Audit Reports
(Worker writes findings here)
