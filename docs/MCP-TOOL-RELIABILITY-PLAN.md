# MCP Tool Reliability + Repo Indexing + UI Fixes (v2)

## Core Philosophy
The indexed repo is THE lookup table. Short path: question → feature mapping → specific file path → GitHub URL for full content. Keep context small, reference precisely.

---

## Ticket 1: Index lifecycle — base URL, cleanup, stable paths
**Files:** `server/services/githubIndexer.ts`, `server/routes/repo-index.ts`

**1a. Store base URL, reference files by path**
- Store `baseUrl: "https://github.com/{owner}/{repo}/blob/{branch}/"` in the scan metadata
- Indexed docs keep file paths as-is (`src/App.tsx`) but the orientation block and agent context include the base URL as a prefix instruction
- Agent can then construct full URLs: `{baseUrl}{filePath}`
- Pass `baseUrl` through to the channel's `repoMeta` so it's available at runtime

**1b. Stable directory names — overwrite on re-index**
- Change output dir from `{repoName}-{timestamp}` to just `{repoName}/`
- On re-index: delete existing dir for that repo, write new one
- Channels pointing to `modular-gh-knowledge/efficientship-live/05-src.compressed.md` stay valid

**1c. Cleanup old timestamped dirs**
- On server startup: scan `modular-gh-knowledge/`, delete dirs matching `{name}-{timestamp}` pattern if a stable `{name}/` dir exists
- One-time migration from old format to new

## Ticket 2: File tree in orientation block
**Files:** `src/services/pipelineChat.ts`

Parse indexed compressed markdown to extract full file listing. Build condensed tree:
```
efficientship-live (base: https://github.com/syrocolab/efficientship-live/blob/main/)
  src/components/ → Hurricane/, Map/, Vessel/, auto-update-registration/, ...
  src/hooks/ → map.hooks.ts, time-slider.ts, ...
  src/services/ → api.service.ts, ...
  src/store/ → voyage.store.ts, ...
```
This is the lookup table. Agent sees paths, constructs `{base}{path}` for file access tools. No guessing.

## Ticket 3: Auto-reconnect MCP servers on startup
**Files:** `server/index.ts`, `server/mcp/manager.ts`

**Root cause of skill.sh disconnect:** `loadSavedServers()` only calls `addServer()` (registers config) but never `connect()`. Every restart loses all connections.

Fix:
- After `loadSavedServers()`, iterate and auto-connect all registered servers
- Add `autoConnect: true` flag to McpServerConfig (default true) so user can disable for specific servers
- Log connection results (success/failure per server)
- On the frontend: show accurate connection state on load (currently shows "connected" from stale localStorage even when backend lost connection)

## Ticket 4: Tool error handling for path targeting
**Files:** `src/services/toolRunner.ts`

The main issue is bad path targeting (directory instead of file). When a tool returns null:
- For `get_file_contents`: "No content returned. This path may be a directory — use list_directory first, or check the file tree in your context."
- Include the hint in the tool result message so the agent self-corrects on the next turn
- For generic null: "Tool returned no result. Check arguments."

## Ticket 5: "Save Agent" button
**Files:** `src/components/Topbar.tsx`, `src/store/consoleStore.ts`

No save button exists in the app — only load/import/export.
- Add "Save" button in Topbar (floppy disk icon)
- On click: `collectFullState()` → `PUT /api/agents/:id`
- If no agent name set, show a quick inline prompt for the name
- Show brief confirmation (checkmark for 2s)

## Ticket 6: Fix import parsing into Agent Builder
**Files:** `src/utils/agentImport.ts`

Import dumps everything into the identity/persona field. Need proper field mapping:
- Parse system prompt to separate: persona (first paragraph/sentence), constraints (bullet lists with "never"/"always"/"must"), objectives (goal statements)
- Map to `instructionState.persona`, `.constraints.customConstraints`, `.objectives.primary`
- Don't dump raw text into a single field

## Ticket 7: Version history display
**Files:** `src/components/VersionIndicator.tsx`

Versions render as 1px containers. Fix:
- Add `min-h-[36px]` to VersionRow button for consistent height
- Ensure version title (v{version} + label) is always visible
- Expand on click should show changelog entries + what changed
- The version list container needs proper scroll behavior

---

## Implementation Order
- **Batch 1** (indexing): Ticket 1 + 2 (base URL + stable paths + file tree) — these are the core value
- **Batch 2** (reliability): Ticket 3 + 4 (auto-reconnect + error handling) — makes agents actually work
- **Batch 3** (UI): Ticket 5 + 6 + 7 (save button + import fix + version display)

## Model Strategy
- Plan: Opus ✅
- Delivery: Sonnet (parallel batches)
- Review: Opus
