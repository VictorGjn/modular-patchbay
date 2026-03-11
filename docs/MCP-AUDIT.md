# MCP Audit

## Architecture Overview

The MCP (Model Context Protocol) system in this codebase consists of:
1. **Static Registry** (`src/store/mcp-registry.ts`) — 125+ curated MCP server configurations
2. **Store Layer** — Multiple Zustand stores managing different aspects 
3. **Server Layer** — Backend MCP connection management 
4. **UI Layer** — Various components for MCP server management

## Notion Appearances (4 Different IDs Found)

### 1. `mcp-notion` (in `src/store/mcp-registry.ts`)
- **Type**: MCP Registry Entry 
- **Auth**: API Key (`NOTION_TOKEN`)
- **Transport**: `stdio`
- **Command**: `npx @notionhq/notion-mcp-server`
- **Description**: "Notion pages, databases, blocks - read, create, update, search"

### 2. `notion-remote` (in `src/store/mcp-registry.ts`)
- **Type**: MCP Registry Entry
- **Auth**: OAuth (no API key needed)  
- **Transport**: `streamable-http`
- **URL**: `https://mcp.notion.com/mcp`
- **Description**: "Notion pages, databases, blocks - OAuth, no API key needed"

### 3. `notion` (in `src/components/ConnectorPicker.tsx` - BUILT_IN_CONNECTORS)
- **Type**: Available Connector
- **MCP Server ID**: `notion`
- **Service**: `notion`
- **Description**: "Read and write Notion pages and databases"

### 4. `notion-api` (in `src/store/registry.ts` - REGISTRY_SKILLS)
- **Type**: Registry Skill
- **Install Command**: `npx modular-skills install notion-api`
- **Description**: "Full Notion integration — read, create, update pages and databases"
- **Author**: Notion

## UI Surfaces and Store Dependencies

### ConnectorPicker.tsx
- **Reads**: `BUILT_IN_CONNECTORS` (hardcoded), `MCP_REGISTRY` (via OAuth lookup)
- **Stores**: `useConsoleStore`, `useMcpStore`
- **Purpose**: OAuth connector selection modal

### McpPicker.tsx  
- **Reads**: `MCP_REGISTRY` (directly)
- **Stores**: `useConsoleStore`
- **Purpose**: MCP library modal for adding servers

### PickerModal.tsx
- **Purpose**: Shared modal shell for both ConnectorPicker and McpPicker
- **Stores**: None (pure UI component)

### SettingsPage.tsx (MCP Tab)
- **Reads**: MCP servers from `mcpStore`
- **Stores**: `useMcpStore`, `useConsoleStore` 
- **Purpose**: MCP server management and configuration

### SourcesPanel.tsx (MCP Section)
- **Reads**: MCP servers and connectors
- **Stores**: `useConsoleStore`, `useMcpStore`
- **Purpose**: Left panel MCP section for agent configuration

## Data Flow: Registry → Store → Server → Connection

```
MCP_REGISTRY (static catalog)
    ↓
consoleStore.registryMcpServers (UI state)  
    ↓
consoleStore.mcpServers (selected servers)
    ↓
server/routes/mcp.ts (API layer)
    ↓  
server/mcp/manager.ts (connection manager)
    ↓
McpConnection (active connection)
```

### Store Interactions

1. **consoleStore** manages:
   - `registryMcpServers` (from MCP_REGISTRY)
   - `mcpServers` (user-selected servers)
   - `connectors` (OAuth connectors)

2. **mcpStore** manages:
   - `servers` (runtime MCP server states)
   - Connection status and tools
   - Server lifecycle (connect/disconnect)

3. **Data Sync**: 
   - `consoleStore.mcpServers` ↔ `mcpStore.servers` via `syncFromConfig()`
   - Settings changes update both stores

## Font Size Issues in ConnectorPicker

Current problematic font sizes:

- **`text-[17px]`** (server names) — too large, should be `text-[13px]`
- **`text-[14px]`** (descriptions, badges) — too large, should be `text-[11px]` 
- **`text-[13px]`** (buttons) — should be `text-[11px]`
- **`text-[12px]`** (small badges) — should be `text-[10px]`
- **`px-5 py-2.5`** (row padding) — should be `px-4 py-1.5`

## McpPicker Font Issues

Same font size issues as ConnectorPicker:
- `text-[17px]` for server names  
- `text-[14px]` for descriptions and badges

## Duplication Issues

### BUILT_IN_CONNECTORS vs MCP_REGISTRY
- ConnectorPicker uses hardcoded `BUILT_IN_CONNECTORS` array
- This duplicates data already in `MCP_REGISTRY`
- Creates maintenance burden and inconsistency
- Should derive connectors from `MCP_REGISTRY` instead

### Notion Entry Confusion
- Two separate Notion entries (`mcp-notion`, `notion-remote`) serve same purpose
- Different auth methods but same service
- UI should clarify this is the same service with different auth options
- Need to link them with `variants` or `sameServiceAs` field