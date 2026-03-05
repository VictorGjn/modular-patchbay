# MCP Tool Reliability + Repo Indexing + UI Fixes

## Core Insight (from Victor)
The whole point is to build an **indexed mapping** of repos locally to efficiently retrieve specific features/functions/components. The indexer already produces good compressed docs (file paths, categories, exports, imports, data flow). But:
- File references have no base URL → agent can't link to GitHub
- Old indexations pile up (28 duplicate dirs, 0.8MB of redundant data)
- The index should be THE lookup table — short path from question → feature file → full content

---

## Ticket 1: Clean repo indexation lifecycle
**Files:** `server/services/githubIndexer.ts`, `server/routes/repo-index.ts`

**1a. Add GitHub base URL to indexed content**
- When indexing `syrocolab/efficientship-live`, every file reference should include: `https://github.com/syrocolab/efficientship-live/blob/main/{path}`
- The compressed docs already have file paths (`src/App.tsx`). Prepend the base URL.
- Store `baseUrl` in scan metadata: `https://github.com/{owner}/{repo}/blob/{branch}/`
- In the compressed markdown output, file paths become clickable links: `[src/App.tsx](https://github.com/syrocolab/efficientship-live/blob/main/src/App.tsx)`

**1b. Delete old indexations on re-index**
- Currently: `modular-gh-knowledge/compass-{timestamp}` creates a new dir every time
- Fix: Before indexing, delete ALL previous dirs for the same repo name (e.g., `compass-*`)
- Keep only the latest indexation per repo
- Also add cleanup on server startup: remove dirs older than 7 days

**1c. Stable output directory names**
- Instead of `{repoName}-{timestamp}`, use just `{repoName}` (overwrite on re-index)
- Channel paths then stay valid across re-indexes
- Channels currently point to timestamped paths that become stale on re-index

## Ticket 2: Tool-aware error handling
**Files:** `src/services/toolRunner.ts`

When MCP tool returns null/empty:
- `get_file_contents` → "No content returned. This path may be a directory. Use list_directory first."
- Generic null → "Tool returned no result."
- `_parseError` args → "Malformed tool arguments from model."
- Surface error hints in agent context so it can self-correct on next turn

## Ticket 3: File tree in system prompt from indexed data
**Files:** `src/services/pipelineChat.ts`

- Parse the compressed markdown files to extract the full file listing
- Build a condensed tree view for the orientation block: `src/ → components/ (Hurricane/, Map/, Vessel/), hooks/, services/, store/`
- This prevents the agent from guessing paths — it KNOWS what exists
- Also include the GitHub base URL so the agent can construct valid paths for `get_file_contents`

## Ticket 4: Tool usage guide in system prompt  
**Files:** `src/services/pipelineChat.ts`

Dynamic `<tools_guide>` block generated from connected MCP servers:
- Lists each tool with its purpose and constraints
- `get_file_contents`: "Use only on FILES, not directories. Requires owner, repo, path."
- `list_directory`: "Use to explore directory contents."
- `search_nodes`: "Search knowledge graph — only useful if graph has been populated."
- Generated from actual connected server tool lists

## Ticket 5: Auto-connect MCP servers on repo index
**Files:** `src/panels/SourcesPanel.tsx`, `src/store/mcpStore.ts`

When indexing a GitHub repo:
1. Auto-register + connect `mcp-github` if not already connected
2. Auto-register + connect `mcp-memory` for graph population
3. Then run graphPopulator with the indexed data
4. Show connection status in the UI during indexing

## Ticket 6: "Save Agent" button in the app
**Files:** `src/components/Topbar.tsx` or `src/panels/AgentBuilder.tsx`

Currently there's no save button — only load from backend, import from file, export to file.
- Add a "Save" button in the Topbar (next to Load Agent)
- On click: save current state to backend via `PUT /api/agents/:id`
- Use agent name as ID (slugified)
- Show confirmation toast/badge
- If no name set, prompt for one

## Ticket 7: Fix import parsing into Agent Builder
**Files:** `src/utils/agentImport.ts`, `src/App.tsx`

Currently import pastes everything into the identity/persona field.
- `mapDataToState()` puts the system prompt into `result.prompt` which gets set via `store.setPrompt()`
- But `prompt` might not map to the right field in the Agent Builder UI
- Need to map imported data to the correct instructionState fields:
  - persona → `instructionState.persona`
  - constraints → `instructionState.constraints`
  - objectives → `instructionState.objectives`
  - The raw system prompt should be PARSED, not dumped into identity

## Ticket 8: Version history scrollbar
**Files:** `src/components/VersionIndicator.tsx`

- The version history panel container needs a scrollbar
- Check the parent container of the version items list — may be missing `overflow-y-auto` or `max-h`
- The inner changelog div has `max-h-[60vh] overflow-y-auto` but the VERSION LIST itself may overflow without scroll

---

## Implementation Order
- **Batch 1** (core): Tickets 1 + 3 (repo indexing fixes + file tree in prompt)
- **Batch 2** (tools): Tickets 2 + 4 + 5 (error handling + tool guide + auto-connect)
- **Batch 3** (UI): Tickets 6 + 7 + 8 (save button + import fix + version scroll)

## Model Strategy
- Plan: Opus ✅
- Tickets/delivery: Sonnet
- Review: Opus
