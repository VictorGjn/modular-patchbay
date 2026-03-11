# Broken UX Flows — Full Inventory

*Audit from user perspective, March 11, 2026.*

---

## 🔴 CRITICAL: Dead Ends

### 1. ConnectorTile → "Configure in Settings" (KnowledgeNode + OutputNode)
**Where:** `KnowledgeNode.tsx:245`, `OutputNode.tsx:638`, `ConnectorPicker.tsx:378`
**Flow:** User sees "Setup required" on a connector → clicks "Configure in Settings" → opens Settings page MCP tab → **MCP tab shows `mcpStore` runtime servers, NOT connector config** → dead end, no way to configure the connector from here.
**Impact:** Any user who tries to set up a connector via the canvas nodes hits a wall.
**Fix:** Settings MCP tab should show connector auth status + inline API key entry. Or better: clicking "Configure" opens the new ConnectionPicker with the relevant service pre-selected.

### 2. Topbar "Authenticate a provider to load models"
**Where:** `Topbar.tsx:84-95`
**Flow:** New user sees model dropdown → says "Authenticate a provider to load models" → **no link, no button, no redirect** → user has to discover Settings on their own → find Providers tab → figure out which provider → enter API key.
**Impact:** First thing every new user sees. Zero guidance.
**Fix:** Make "Authenticate a provider" a clickable link that opens Settings → Providers tab. Or show an inline API key prompt.

### 3. Settings MCP tab disconnected from reality
**Where:** `SettingsPage.tsx:668` (`McpServersTab`)
**Flow:** Settings → MCP tab shows servers from `mcpStore.servers` (runtime) → these are NOT the same as `consoleStore.mcpServers` (agent config) → user can "connect" a server here but it doesn't appear in the agent's Sources panel. And vice versa.
**Impact:** User configures MCP in Settings, goes to Sources panel, doesn't see it.
**Fix:** Settings MCP tab should read from `consoleStore.mcpServers` with runtime status from `mcpStore`.

---

## 🟡 MEDIUM: Orphan / Duplicate Components

### 4. 15 orphan components (never imported)
**Files:** `Divider.tsx`, `EmptyState.tsx`, `SkeletonLoader.tsx`, `StatusIndicator.tsx`, `AgentPreview.tsx`, `CanvasLegend.tsx`, `ContextualHint.tsx`, `ConversationTester.tsx`, `JackGutter.tsx`, `PromptArea.tsx`, `ProviderPanel.tsx`, `ResizeHandle.tsx`, `ResponseArea.tsx`, `RuntimeFlowDiagram.tsx`, `WorktreeGraphPanel.tsx`
**Impact:** Dead code. Increases bundle size, confuses developers.
**Fix:** Delete or wire in. Notably:
- `ConversationTester.tsx` — duplicate of TestPanel chat functionality? 
- `ProviderPanel.tsx` — was this replaced by SettingsPage providers tab?
- `RuntimePanel.tsx` (in panels/) — imported by TestPanel but is it the old "Runtime" tab Victor mentioned?

### 5. ConnectorPicker.tsx still wired (should be deprecated)
**Where:** `App.tsx:64`, `SourcesPanel.tsx` (old "Connect" button path)
**Impact:** Two modals can open for the same purpose if old code paths are hit.
**Fix:** Remove old ConnectorPicker/McpPicker from App.tsx modal stack. Keep files but unwire.

### 6. Connector ↔ MCP identity crisis propagates to exports
**Where:** `agentExport.ts:110-111`, `agentDirectory.ts:215`, `SaveAgentModal.tsx:74`
**Flow:** When exporting an agent, connectors and MCP servers are exported as SEPARATE concepts → importing on another machine recreates the confusion.
**Fix:** Export should merge connectors into the MCP servers list with auth metadata.

---

## 🟡 MEDIUM: Confusing UX

### 7. Connectors have "read/write/both" concept but MCP servers don't
**Where:** `ConnectorPicker.tsx`, `KnowledgeNode.tsx:51`, `OutputNode.tsx:436`
**Flow:** ConnectorPicker asks user to choose read/write/both direction → this determines if the connector appears in KnowledgeNode (read) or OutputNode (write) → but MCP servers in the MCP section have no direction concept → user can't understand why some tools appear in Knowledge and others in Output.
**Impact:** The direction concept adds confusion without adding value — MCP tools can do both.
**Fix:** Drop direction concept. A connection is a connection. Let the agent decide what to use it for.

### 8. Canvas nodes reference connectors, SourcesPanel references MCP
**Where:** `KnowledgeNode.tsx:34` reads `connectors`, `SourcesPanel.tsx:717` reads `mcpServers`
**Flow:** Canvas view shows connectors as data sources → SourcesPanel shows MCP servers → same data, different names, different locations.
**Fix:** One concept, one name: "Connections" everywhere.

### 9. Marketplace MCP tab vs MCP Library vs Connection Picker
**Where:** `Marketplace.tsx:12` has `type Tab = 'skills' | 'mcp' | 'presets'`
**Flow:** Marketplace has its own MCP tab → McpPicker has the MCP library → ConnectionPicker has MCP library section → THREE places to browse MCP servers.
**Fix:** Marketplace MCP tab should link to ConnectionPicker, not duplicate it.

---

## 🔵 LOW: Technical Debt

### 10. `/api/connectors/auth` endpoint duplicates MCP OAuth
**Where:** `server/routes/connectors.ts` — full OAuth flow for Notion/Slack/GitHub/Google
**Vs:** `server/routes/mcp-oauth.ts` — another full OAuth flow for MCP servers
**Impact:** Two OAuth systems for the same services. `connectors.ts` has hardcoded redirect URIs, `mcp-oauth.ts` uses dynamic discovery.
**Fix:** Keep only `mcp-oauth.ts` (the better implementation). Remove `connectors.ts` OAuth in favor of MCP OAuth.

### 11. Provider sync timing issues
**Where:** `providerStore.ts:140-200` — debounced provider sync
**Flow:** User enters API key → providerStore debounces → syncs to server after 500ms → if user navigates away too fast, sync is lost.
**Impact:** Rare but frustrating — "I entered my key but it didn't save."
**Fix:** Save immediately on blur, not on debounce.

---

## Priority Matrix

| # | Severity | Fix | Effort |
|---|----------|-----|--------|
| 1 | 🔴 Critical | "Configure" → open ConnectionPicker pre-filtered | 30min |
| 2 | 🔴 Critical | Topbar model prompt → clickable link to Settings/Providers | 15min |
| 3 | 🔴 Critical | Settings MCP tab reads consoleStore + mcpStore status | 2h |
| 5 | 🟡 Medium | Unwire old ConnectorPicker/McpPicker from App.tsx | 15min |
| 4 | 🟡 Medium | Delete 15 orphan components | 15min |
| 7 | 🟡 Medium | Drop connector direction concept | 1h |
| 9 | 🟡 Medium | Marketplace MCP → redirect to ConnectionPicker | 30min |
| 6 | 🟡 Medium | Fix agent export to merge connectors+MCP | 1h |
| 10 | 🔵 Low | Remove connector OAuth, keep MCP OAuth only | 2h |
| 11 | 🔵 Low | Provider sync on blur | 30min |
