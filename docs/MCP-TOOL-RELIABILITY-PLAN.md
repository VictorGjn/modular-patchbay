# MCP Tool Reliability + Auto Graph Population

## Problems Observed

### 1. `get_file_contents` returns `null`
**Symptom:** Agent calls `mcp-github.get_file_contents` with a path like `src/components/Hurricane` → result is `null` in 3ms.
**Root causes:**
- **Path is a directory, not a file.** GitHub's contents API returns 404 for directories when using the single-file endpoint. The agent doesn't know the difference because it doesn't have the file tree.
- **Tool result handling:** When MCP returns `null` or an error, the tool runner returns it as `"null"` string — the agent can't distinguish "file not found" from "empty file" from "auth error".
- **No file tree in tool context:** The agent has no way to know what files exist without first calling `list_directory` or having the tree in context.

### 2. Empty knowledge graph
**Symptom:** Agent calls `read_graph` / `search_nodes` → empty result.
**Root cause:** MCP Memory server starts empty. Nobody populates it. Previous commit added `graphPopulator.ts` but it only runs if:
  a) The repo has already been indexed, AND
  b) A memory MCP server is connected at index time
**Missing:** Auto-connect memory server when repo indexing is triggered.

### 3. Agent uses wrong tools for codebase navigation
**Symptom:** Agent calls `search_nodes` (knowledge graph) when it should use `get_file_contents` (GitHub). Or calls `get_file_contents` on a directory.
**Root cause:** Agent doesn't know the capabilities/limitations of each tool. The system prompt says "use your context" but doesn't explain when/how to use each MCP tool.

---

## Fix Plan

### Ticket 1: Tool-aware error handling in toolRunner
**Files:** `src/services/toolRunner.ts`

When a tool returns null/empty/error:
1. Don't return raw `"null"` — return a structured error message:
   `"Tool get_file_contents returned no content. This path may be a directory, not a file. Try list_directory instead, or check the path."`
2. For common MCP tools (get_file_contents, search_files, list_directory), add tool-specific error messages
3. When args have `_parseError: true` (from our earlier fix), return a clear "malformed arguments" error

### Ticket 2: Auto-inject file tree into tool context
**Files:** `src/services/pipelineChat.ts`, `src/services/toolRunner.ts`

When the agent has GitHub repos indexed:
1. The orientation block should include a **condensed file tree** (top 2-3 levels) so the agent knows what paths are valid
2. Format: `src/ → components/ (Hurricane/, Map/, Vessel/), hooks/, services/, store/`
3. Pull this from the indexed scan data (features → keyFiles → extract directory structure)
4. This prevents the agent from guessing paths and calling tools on directories

### Ticket 3: Auto-connect MCP Memory when indexing repos
**Files:** `src/panels/SourcesPanel.tsx`, `src/store/mcpStore.ts`

When a repo index is triggered:
1. Check if `mcp-memory` server is registered in mcpStore
2. If registered but not connected → auto-connect it
3. If not registered → auto-register with default config (`npx -y @modelcontextprotocol/server-memory`) then connect
4. THEN run graphPopulator (which currently silently skips if no memory server is connected)
5. Also auto-connect `mcp-github` if indexing a GitHub repo and it's not connected

### Ticket 4: Tool usage guide in system prompt
**Files:** `src/services/pipelineChat.ts`

Add a `<tools_guide>` block to the system prompt when MCP tools are available:
```xml
<tools_guide>
Available tools and when to use them:

## mcp-github
- get_file_contents(owner, repo, path): Read a SINGLE FILE. Do NOT use on directories.
- search_files(query): Search for files by name/content.
- list_directory(owner, repo, path): List directory contents. Use this FIRST to explore structure.

## mcp-memory (Knowledge Graph)
- read_graph: Read the full knowledge graph (entities + relations).
- search_nodes(query): Search for entities by name/content.
- create_entities: Add new entities to the graph.
- Do NOT search_nodes for basic codebase structure — that's already in your context.

General rules:
1. Use your loaded context FIRST for structure questions
2. Use list_directory to explore unfamiliar paths
3. Use get_file_contents only on specific files (not directories)
4. Use search_files when you don't know the exact path
</tools_guide>
```
Generate this dynamically from connected MCP servers and their tool lists.

### Ticket 5: Graceful null result handling in UI
**Files:** `src/services/toolRunner.ts`, potentially trace display

When a tool returns null:
1. Display "No content returned" instead of raw `null`
2. If the tool is `get_file_contents` and result is null, suggest "This may be a directory. Try list_directory."
3. Surface these suggestions in the agent's next context so it can self-correct

---

## Implementation Order
- Ticket 1 + 5: Quick fixes in toolRunner (parallel, same file)
- Ticket 2 + 4: System prompt improvements (parallel, same file)
- Ticket 3: Auto-connect MCP (independent)

## Model Strategy
- Plan: Opus (this doc) ✅
- Implementation: Sonnet
- Review: Opus
