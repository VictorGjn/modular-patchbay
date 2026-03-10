# MCP Server & Skills Integration Audit

**Date**: March 10, 2026  
**Version**: 1.0  
**Auditor**: Modular Patchbay Audit Agent

## Executive Summary

This audit reveals significant **state fragmentation issues** across MCP server and skills integration flows. While basic functionality works, the system suffers from unclear data ownership, inconsistent synchronization, and potential race conditions that could lead to user confusion and data loss.

### Key Issues Found
- ❌ **Critical**: MCP state split across multiple stores without proper synchronization  
- ❌ **Critical**: OAuth flow does not consistently update all state stores
- ⚠️ **Major**: Agent loading may not restore complete MCP/skills state
- ⚠️ **Major**: Multiple entry points can lead to duplicate server additions
- ❌ **Critical**: Skills suffer from similar fragmentation issues

---

## 1. MCP Server Lifecycle — All Entry Points

### Entry Point Analysis

| Entry Point | Storage Target | Auto-Connect | Persistence | Duplicates |
|-------------|---------------|--------------|-------------|------------|
| **Marketplace** | ✅ Both stores | ✅ Yes | ✅ Yes | ❌ Possible |
| **Settings → McpServersTab** | ✅ Both stores | 🔧 Manual | ✅ Yes | ❌ Possible |
| **McpPicker** | ⚠️ consoleStore only | ❌ No | ⚠️ Partial | ❌ Possible |
| **ConnectorPicker → OAuth** | ⚠️ Inconsistent | ⚠️ Sometimes | ⚠️ Fragile | ❌ Possible |
| **Agent load** | ✅ consoleStore | ❌ No | ✅ Yes | ❌ Possible |

### Detailed Flow Analysis

#### ✅ **Marketplace → MCP Install**
```typescript
// In Marketplace.tsx handleMcpInstall()
const added = await useMcpStore.getState().addServer({...});
if (added) await useMcpStore.getState().connectServer(added.id);
installRegistryMcp(mcpId); // Updates consoleStore
```
**Status**: ✅ Working correctly - properly updates both stores

#### ⚠️ **Settings → McpServersTab**
```typescript
// Explicit sync logic in McpServersTab
useEffect(() => {
  for (const server of servers) {
    upsertMcpServer({...}); // Syncs mcpStore → consoleStore
  }
}, [servers, upsertMcpServer]);
```
**Status**: ⚠️ Partial/fragile - relies on useEffect side-effects for sync

#### ❌ **McpPicker**
```typescript
// Only updates consoleStore
const addMcp = useConsoleStore((s) => s.addMcp);
```
**Status**: ❌ Broken - no runtime connection, only UI state

#### ❌ **ConnectorPicker → OAuth Flow**
```typescript
// Auto-adds connector but MCP server state unclear
addConnector({
  id: `conn-${entry.id}-oauth-${Date.now()}`,
  service: svc,
  mcpServerId: entry.id,
  // ... but where's the MCP server?
});
```
**Status**: ❌ Broken - creates connectors without ensuring MCP servers exist

#### ⚠️ **Agent Load**
```typescript
// Only restores consoleStore state
if (state.mcpServers) patch.mcpServers = state.mcpServers as McpServer[];
```
**Status**: ⚠️ Fragile - doesn't restore runtime connections

---

## 2. OAuth Flow Audit

### Flow Trace

1. **ConnectorPicker "Connect" button**
   ```typescript
   await startMcpOAuth(entry.url);  // ✅ Works
   ```

2. **mcpOAuthClient.ts → startMcpOAuth()**
   ```typescript
   const { authUrl } = await fetch(`${API_BASE}/mcp/oauth/start`, {
     method: 'POST',
     body: JSON.stringify({ serverUrl }),
   });
   // ✅ Opens popup correctly
   ```

3. **Backend → /api/mcp/oauth/start**
   ```typescript
   const result = await startOAuthFlow(serverUrl, redirectUri(), clientId);
   // ✅ Handles OAuth discovery, PKCE, dynamic client registration
   ```

4. **Callback Processing**
   ```html
   <!-- ✅ Popup correctly postMessages success/error -->
   window.opener?.postMessage({type: 'mcp-oauth-success'}, '*');
   ```

5. **ConnectorPicker Detection**
   ```typescript
   // ⚠️ Adds connector but may not sync MCP server state
   addConnector({...});
   ```

### Issues Found

| Component | Issue | Impact |
|-----------|-------|---------|
| **Popup handling** | ✅ Works correctly | None |
| **Token storage** | ✅ Persistent in backend | None |
| **State sync** | ❌ Inconsistent | High |
| **Error handling** | ✅ Good coverage | None |

### 🔧 **Recommended Fixes**

1. **Ensure MCP server creation**: When OAuth succeeds, ConnectorPicker should:
   ```typescript
   // Add to mcpStore for runtime connection
   await useMcpStore.getState().addServer({
     id: entry.id,
     name: entry.name,
     type: 'streamable-http',
     url: entry.url,
     command: '', args: [], env: {}
   });
   
   // Then add connector
   addConnector({...});
   ```

2. **Check connection status**: Verify MCP server is actually connectable before adding connector

---

## 3. MCP State Fragmentation

### Current Architecture

```
┌─ Frontend ─────────────────────────┐   ┌─ Backend ──────┐
│                                    │   │                │
│  mcpStore.ts                      │◄──┤ mcpManager.ts  │
│  ├─ Runtime connection state      │   │ ├─ Connections │
│  ├─ Health polling               │   │ ├─ Tool calls  │
│  └─ Tool inventory               │   │ └─ Process mgmt│
│                                    │   │                │
│  consoleStore.ts                  │   │                │
│  ├─ Persisted config             │   │                │
│  ├─ Agent state                  │   │                │
│  └─ UI state                     │   │                │
└────────────────────────────────────┘   └────────────────┘
```

### State Synchronization Issues

| Scenario | mcpStore | consoleStore | Sync Status |
|----------|----------|--------------|-------------|
| **Marketplace install** | ✅ Updated | ✅ Updated | ✅ Synced |
| **Settings manual add** | ✅ Updated | ✅ Updated | ✅ Synced |
| **McpPicker add** | ❌ Not updated | ✅ Updated | ❌ Out of sync |
| **OAuth connect** | ⚠️ Maybe | ✅ Updated | ⚠️ Inconsistent |
| **Agent load** | ❌ Not restored | ✅ Restored | ❌ Out of sync |
| **Page reload** | ❌ Lost | ✅ Persisted | ❌ Out of sync |

### 🔧 **Critical Fixes Needed**

1. **Single Source of Truth**: Designate consoleStore as the authoritative config store
2. **Runtime State Sync**: On page load, restore mcpStore connections from consoleStore
3. **Consistent Updates**: All MCP operations must update both stores
4. **Connection Recovery**: Auto-reconnect enabled MCP servers on startup

---

## 4. Skills Integration Audit

### Skills Entry Points

| Entry Point | Storage | Persistence | Sync Issues |
|-------------|---------|-------------|-------------|
| **Marketplace install** | ✅ consoleStore | ✅ Yes | ✅ Good |
| **SkillPicker** | ✅ consoleStore | ✅ Yes | ✅ Good |
| **Remote skills.sh** | ✅ consoleStore | ✅ Yes | ✅ Good |
| **Agent load** | ✅ consoleStore | ✅ Yes | ✅ Good |

### Skills State Management

**Status**: ✅ **Working correctly** - Skills are better architected than MCP servers

Skills use a simpler, more consistent pattern:
```typescript
// Single store, consistent updates
upsertSkill({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  // ...
});
```

### Skills vs MCP Servers Comparison

| Aspect | Skills | MCP Servers | 
|--------|--------|-------------|
| **State stores** | ✅ One (consoleStore) | ❌ Two (mcpStore + consoleStore) |
| **Persistence** | ✅ Automatic | ⚠️ Manual sync required |
| **Entry points** | ✅ Consistent | ❌ Fragmented |
| **Agent portability** | ✅ Full | ⚠️ Config only |

**Lesson**: Skills architecture should be the model for MCP servers

---

## 5. Agent Portability

### Save Process Analysis

```typescript
// In collectFullState()
return {
  id, version: '1.0.0',
  agentMeta: { ...s.agentMeta },          // ✅ Included
  instructionState: { ...s.instructionState }, // ✅ Included
  workflowSteps: s.workflowSteps.map(...), // ✅ Included
  channels: s.channels.map(...),          // ✅ Included
  mcpServers: s.mcpServers.map(...),      // ✅ Included
  skills: s.skills.map(...),              // ✅ Included
  connectors: s.connectors.map(...),      // ✅ Included
  agentConfig: { ...s.agentConfig },      // ✅ Included
  // ...
};
```

### Load Process Analysis

```typescript
// In restoreFullState()
if (state.mcpServers) patch.mcpServers = state.mcpServers as McpServer[];
if (state.skills) patch.skills = state.skills as Skill[];
if (state.connectors) patch.connectors = state.connectors as Connector[];
```

### Portability Assessment

| Component | Saved | Restored | Runtime Recovery |
|-----------|-------|----------|------------------|
| **Agent metadata** | ✅ Yes | ✅ Yes | N/A |
| **Instructions** | ✅ Yes | ✅ Yes | N/A |
| **Workflow steps** | ✅ Yes | ✅ Yes | N/A |
| **Knowledge channels** | ✅ Yes | ✅ Yes | N/A |
| **MCP server configs** | ✅ Yes | ✅ Yes | ❌ No auto-connect |
| **Skills configs** | ✅ Yes | ✅ Yes | ✅ Available |
| **Connectors** | ✅ Yes | ✅ Yes | ⚠️ Depends on MCP |
| **Memory/knowledge content** | ❌ No | ❌ No | N/A |

### 🔧 **Portability Fixes**

1. **Auto-reconnect MCP servers**: After agent load, attempt to connect enabled MCP servers
2. **Validate dependencies**: Check that required MCP servers/skills are available
3. **Graceful degradation**: Handle missing dependencies gracefully
4. **Save knowledge content**: Consider including actual knowledge content in exports

---

## Recommendations

### 🚨 Critical (Fix Immediately)

1. **Unify MCP State Management**
   - Refactor to use consoleStore as single source of truth
   - Make mcpStore a runtime cache that syncs from consoleStore
   - Add automatic connection recovery on page load

2. **Fix OAuth Integration**
   - Ensure OAuth success creates both connector AND MCP server
   - Add validation that MCP server is actually connectable
   - Handle OAuth token refresh transparently

3. **Prevent Duplicate Servers**
   - Add ID-based deduplication across all entry points
   - Show clear indicators when servers are already added
   - Merge conflicting configurations intelligently

### ⚠️ Major (Fix Soon)

4. **Improve Agent Portability**
   - Auto-connect MCP servers after agent load
   - Add dependency validation and missing component warnings
   - Consider bundling knowledge content in agent exports

5. **Enhance Error Handling**
   - Add better error messages for state sync failures
   - Implement retry logic for failed connections
   - Show clear status indicators for all components

### 🔧 Minor (Nice to Have)

6. **Better User Experience**
   - Unified MCP server management UI
   - Clear dependency visualization
   - Better onboarding for OAuth flows

---

## Conclusion

The Modular Patchbay MCP and skills integration suffers from **fundamental architectural inconsistencies**. While skills are well-architected with a single store and consistent patterns, MCP servers are fragmented across multiple stores with unclear synchronization boundaries.

**Priority**: Fix state fragmentation immediately to prevent user data loss and confusion.

**Success Metrics**:
- Zero MCP server state inconsistencies
- 100% agent portability (save/load cycles preserve all functionality)
- Clear error messages for all failure modes
- OAuth flows that consistently update all relevant state

The system has good bones but needs architectural consolidation to reach production quality.