# MCP Audit — UX Research & Architecture Review

*March 11, 2026 — Written from a user's perspective.*

---

## 1. The User's Experience Today (Broken Flows)

### Scenario: "I want to connect Notion"

A new user opens Modular Studio and wants to connect their Notion workspace. Here's what happens:

**Path A — Sources Panel → "Connect" button**
1. User sees Knowledge section with `+ Files`, `⊕ Connect`, `⌂ Repo` buttons
2. Clicks "Connect" → **ConnectorPicker modal** opens
3. Sees "Notion" in Available Connectors list with read/write/both badges
4. Status says "Setup required" → "Configure in Settings" button
5. Clicks it → Settings opens, but **there's no obvious Notion config there**
6. The Settings MCP tab shows `mcpStore` servers (runtime), not `consoleStore` connectors
7. **Dead end.** User has to manually figure out they need a Notion Integration Token.

**Path B — Sources Panel → MCP Servers section → "MCP Library" button**
1. User clicks "MCP Library" → **McpPicker modal** opens
2. Searches "Notion" → finds `mcp-notion` (Notion, API Key) and `notion-remote` (Notion Cloud, OAuth)
3. Clicks one → it gets added to `consoleStore.mcpServers`
4. But it's NOT the same as the Connector from Path A
5. **Now there are two Notion things** in the left panel: a connector slot AND an MCP server

**Path C — ConnectorPicker → OAuth section**
1. In the ConnectorPicker modal, there's ALSO an OAuth section showing "Notion (Cloud)"
2. Clicking "Connect" starts an OAuth popup flow
3. This creates BOTH an MCP server entry AND a connector entry
4. **This is the only place OAuth works** — it's invisible from MCP Library or Settings

### Result: User Confusion Matrix

| Action | What user expects | What actually happens |
|--------|------------------|----------------------|
| "Connect" → Notion | Single Notion connection | Gets a connector stub, needs separate config |
| MCP Library → Notion | Same as above | Gets a different MCP server entry |
| MCP Library → Notion Cloud | OAuth connection | Nothing — OAuth only works in ConnectorPicker |
| Settings → MCP | See all connections | Only sees `mcpStore` servers, not connectors |

---

## 2. Architecture: Why It's Broken

### The Core Problem: 3 Parallel Identity Systems

```
SYSTEM 1: Connectors (consoleStore.connectors[])
  - Created by ConnectorPicker
  - Has: service, direction (read/write/both), authMethod
  - Shows in: SourcesPanel "Connectors" subsection
  - Types: ConnectorService (union of hardcoded service names)

SYSTEM 2: MCP Servers — Agent Config (consoleStore.mcpServers[])  
  - Created by McpPicker or syncFromConfig
  - Has: id, name, icon, connected, enabled, added
  - Shows in: SourcesPanel "MCP Servers" section
  - Type: McpServer (from knowledgeBase.ts)

SYSTEM 3: MCP Servers — Runtime (mcpStore.servers[])
  - Created by addServer/connect API calls
  - Has: id, name, status, tools[], command, args, env
  - Shows in: SettingsPage MCP tab
  - Type: McpServerState (from mcpStore.ts)
```

These three systems represent **the same concept** (an external data source connection) but with different types, different stores, different UIs, and different lifecycle management.

### The Notion Identity Crisis

| ID | Where | Type | Auth | Transport |
|----|-------|------|------|-----------|
| `mcp-notion` | mcp-registry.ts:426 | Registry entry | API key (`NOTION_TOKEN`) | stdio (npx) |
| `notion-remote` | mcp-registry.ts:435 | Registry entry | OAuth | streamable-http |
| `notion` | ConnectorPicker BUILT_IN | Connector service | Implied API key | Via mcpServerId |
| `notion-api` | registry.ts:97 | Skill | npx install | N/A |

A user sees "Notion" in at least 3 different places with different behavior. None of them clearly explain the difference.

---

## 3. UI Surface Inventory

### Surface 1: SourcesPanel → Knowledge section
- **What it shows**: Indexed channels, file connectors, repo connectors
- **Buttons**: `+ Files` (FilePicker), `⊕ Connect` (ConnectorPicker), `⌂ Repo` (inline)
- **Store**: `consoleStore.channels`, `consoleStore.connectors`
- **Problem**: "Connect" implies a connection wizard, but ConnectorPicker is a catalog with no config flow

### Surface 2: SourcesPanel → Connectors subsection (below Knowledge)
- **What it shows**: Active connectors with read/write badges and auth status dots
- **Store**: `consoleStore.connectors`, fetches `/connectors/auth` for status
- **Problem**: Shows connectors added via ConnectorPicker, but NOT OAuth connections made in the same modal

### Surface 3: SourcesPanel → MCP Servers section
- **What it shows**: Added MCP servers with health status (ok/warn/err/off)
- **Buttons**: "MCP Library" (McpPicker), "Probe All"
- **Store**: `consoleStore.mcpServers` + `mcpStore.servers` + `healthStore.mcpHealth`
- **Problem**: This is a completely separate section from Connectors, even though they represent the same thing

### Surface 4: ConnectorPicker modal (from "Connect" button)
- **Sections**: "Connected Services" (OAuth + MCP), "Available Connectors" (built-in + extra MCP)
- **Store reads**: `consoleStore.connectors`, `mcpStore.servers`, `MCP_REGISTRY` (OAuth filter)
- **Store writes**: `consoleStore.addConnector()`, `mcpStore.addServer()`
- **Problem**: 
  - OAuth section is the **only place** to start OAuth flows
  - Built-in connectors were hardcoded (now derived from registry — Fix 5 done)
  - "Configure in Settings" button sends users to a dead end

### Surface 5: McpPicker modal (from "MCP Library" button)
- **What it shows**: All 125 registry entries, searchable, filterable by category
- **Store reads**: `MCP_REGISTRY`, `consoleStore.registryMcpServers`
- **Store writes**: `consoleStore.upsertMcpServer()`
- **Problem**: 
  - Adding an MCP server here does NOT make it appear as a Connector
  - OAuth servers (Notion Cloud, Slack Cloud) are listed but clicking "Add" doesn't start OAuth

### Surface 6: SettingsPage → MCP tab
- **What it shows**: Runtime MCP servers from `mcpStore`
- **Actions**: Connect, disconnect, edit config, delete
- **Store**: `mcpStore.servers`
- **Problem**: 
  - Completely disconnected from `consoleStore.connectors`
  - Shows runtime state, not agent config state
  - No OAuth management

---

## 4. Proposed Fix: Unified Connection Model

### Principle: One concept, one place

**Delete the Connector/MCP duality.** A "Connection" is a connection. The user doesn't care if it's stdio, streamable-http, or OAuth internally.

### Phase 1: Merge UI (quick win, do now)

1. **Kill the Connectors subsection** in SourcesPanel
   - Move connector entries into the MCP Servers section
   - Each entry shows: name, auth method badge (🔑/🔐), status, tools count
   
2. **Merge ConnectorPicker + McpPicker into one modal**
   - Title: "Add Connection"
   - Top section: "Quick Connect" — OAuth services (Notion, Slack, GitHub) with one-click
   - Bottom section: "MCP Library" — full catalog, searchable
   - When an OAuth service is added, it appears in the MCP Servers section like any other

3. **Fix "Configure in Settings" dead end**
   - For API-key services: show inline config (token input field) right in the modal
   - For OAuth services: start OAuth flow directly
   - Remove the Settings redirect entirely

### Phase 2: Merge stores (cleanup, do after)

1. **Deprecate `consoleStore.connectors[]`** — merge into `consoleStore.mcpServers[]`
   - Add `authMethod`, `direction`, `oauthUrl` fields to `McpServer` type
   
2. **Single sync path**: `consoleStore.mcpServers` → `mcpStore.servers` → backend
   - Remove the parallel connector → backend flow

3. **Settings MCP tab reads from `consoleStore`** (agent config) with a "Runtime Status" column from `mcpStore`

### Phase 3: Registry cleanup (polish)

1. **Merge Notion entries**: One "Notion" entry with `authMethods: ['api-key', 'oauth']`
   - UI shows auth method selector when adding
   - `sameServiceAs` field is a hack — proper `authMethods[]` is the right model

2. **Remove `registry.ts` connector entries** that duplicate MCP registry
   - `notion-api` skill is fine (it's a different thing — a skill, not a server)
   - But `BUILT_IN_CONNECTORS` derivation is the right direction

---

## 5. Font Size Fixes (Done)

| Component | Element | Before | After |
|-----------|---------|--------|-------|
| PickerModal | Title | text-[17px] | text-[14px] |
| PickerModal | Search | text-[17px] | text-[13px] |
| ConnectorPicker | Server name | text-[17px] | text-[13px] |
| ConnectorPicker | Description | text-[14px] | text-[11px] |
| ConnectorPicker | Buttons | text-[13px] | text-[11px] |
| ConnectorPicker | Badges | text-[12px] | text-[10px] |
| ConnectorPicker | Row padding | px-5 py-2.5 | px-4 py-1.5 |
| McpPicker | Same pattern | Same reductions | Applied |

---

## 6. Priority Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Merge ConnectorPicker + McpPicker into "Add Connection" | 2-3h | Eliminates confusion |
| **P0** | Show OAuth in MCP Library entries | 1h | OAuth no longer hidden |
| **P1** | Inline API key config in add modal | 2h | No more dead ends |
| **P1** | Move connectors into MCP section | 1h | One list, not two |
| **P2** | Merge stores (connectors → mcpServers) | 3-4h | Clean architecture |
| **P2** | Merge Notion registry entries with authMethods[] | 1h | Clean data |
| **P3** | Settings MCP tab reads consoleStore | 2h | Consistent state |
