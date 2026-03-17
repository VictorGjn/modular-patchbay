# Next Priorities — Post-Sprint

## P0: Knowledge Source UX (Victor's feedback 2026-03-17 ~01:00)

### Problem 1: Sources not configurable
The depth slider exists but has no labels or explanation. Users don't know what they're adjusting.
- **Fix:** Add clear labels to depth slider (Full → Detail → Summary → Headlines → Mention)  
- **Fix:** Add per-source configuration panel (click source → see knowledge type selector, depth, enable/disable, token budget preview)
- **Fix:** Show what depth does visually — preview of content at each level

### Problem 2: Tree indexer is shallow for code
Current indexer does heading-based parsing for markdown. For code repos:
- `builtinTools.ts` does file scanning with basic feature extraction
- `treeIndexer.ts` only handles markdown heading hierarchy  
- No understanding of: modules, classes, DTOs, API surfaces, function signatures, dependencies

**Need:** A code-aware tree indexer that:
1. Parses AST (TypeScript, Python at minimum)
2. Extracts: exports, types/interfaces/DTOs, function signatures, class hierarchies
3. Understands module boundaries and dependency graphs
4. Builds a feature tree: "Authentication module → login(), logout(), refreshToken() → uses UserDTO, TokenDTO"
5. Depth levels map to: Full source → Signatures + docs → Module overview → Feature list → Mentions

**Approach options:**
- A) Use tree-sitter in the server for fast AST parsing (would need WASM binds)
- B) Use LLM to generate code summaries at each level (slower but more intelligent)
- C) Hybrid: regex-based extraction for structure + LLM for summaries
- D) Use existing Language Server Protocol for type info (complex but accurate)

**Recommended:** Option C — regex for TypeScript/Python structure extraction (exports, interfaces, function sigs), LLM only for generating smart summaries of each module.

### Problem 3: Insights in wrong tab
- Move FactInsightsSection from KnowledgeTab to ReviewTab
- Knowledge tab: focuses on connecting and configuring sources
- Review tab: focuses on analyzing and refining the agent definition

## P1: Full End-to-End Smoke Test
1. Open app → Agent Library (empty state)
2. Click "+ New Agent" → clean Describe tab
3. Write description → click Generate
4. Verify all tabs populated (Knowledge gaps, Tools, Memory, Review sections)
5. Add a knowledge source (local file or git repo)
6. Go to Test → send chat → verify pipeline traces
7. Check Review → verify all categories filled
8. Save agent → verify appears in library
9. Load agent → verify all state restored

## P2: Provider connection flow
- Settings → connect Claude Agent SDK
- Verify model list populates
- Verify generation works with connected provider
- Verify chat in Test tab works
