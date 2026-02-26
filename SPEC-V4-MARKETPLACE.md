# SPEC V4 — In-Canvas Marketplace

## Core Concept
Skills and MCP servers are installable directly from the Modular canvas.
No terminal, no config files. Browse → Install → Use.

## Skills Marketplace

### Flow
1. User clicks **+ ADD** on SkillsNode
2. **SkillPicker modal** opens with two tabs:
   - **Installed** — skills already available locally
   - **Browse** — fetch from registry (clawhub.com / skills.sh)
3. Search bar with fuzzy match + category filters
4. Each skill card shows: name, description, author, install count
5. Click **Install** → runs `npx openclaw skill install <repo>` in background
6. Progress bar / spinner in the card
7. On success: skill tile appears in the node, ready to connect via cable
8. On failure: error toast with retry option

### Registry API
```
GET https://clawhub.com/api/skills?q=<query>&category=<cat>
→ [{ name, repo, description, author, downloads, categories }]
```

### Install Command
```bash
npx openclaw skill install <repo-url>
# or
npx skills install <package-name>
```

### Categories
- Coding & Development
- Research & Analysis  
- Content & Writing
- Data & Integration
- Design & Visual
- Domain-Specific (maritime, finance, etc.)

## MCP Server Marketplace

### Flow
Same pattern as Skills:
1. **+ ADD** on McpNode → McpPicker modal
2. **Browse** tab fetches available MCP servers
3. One-click install + auto-configure
4. Server appears as tile with connection status indicator

### MCP Registry
```
GET https://clawhub.com/api/mcp-servers?q=<query>
→ [{ name, transport, description, tools[], config_schema }]
```

### Install
```bash
npx openclaw mcp install <server-name>
# Auto-generates config entry in openclaw.yaml
```

### Auto-Configuration
After install, Modular reads the MCP server's config schema and:
- Pre-fills defaults
- Shows required env vars (API keys) with input fields
- Tests connection with a ping

## UX Details

### Loading States
- Skeleton cards while fetching registry
- Progress bar during `npx install` (indeterminate if no progress events)
- Success animation: tile slides into the node with a brief glow

### Offline Mode
- Show only installed skills/MCPs when offline
- "Browse" tab shows "No connection" state
- Cache last-fetched registry for 24h

### Version Management
- Show update badge on tiles when newer version available
- "Update All" button in picker header
- Lock icon for pinned versions

## Implementation Priority

### Phase 1 (MVP)
- Installed skills/MCPs picker (read from local filesystem)
- Manual install via terminal command (show the command to copy)

### Phase 2
- Registry API integration (browse + search)
- One-click install with progress

### Phase 3
- Auto-configuration for MCP servers
- Version management + updates
- Usage analytics (most popular in your workspace)

## Technical Notes
- Registry calls go through a proxy to handle CORS
- Install runs in a sandboxed shell (no sudo)
- Skills are stored in `~/.agents/skills/` 
- MCP configs in `openclaw.yaml` under `mcp.servers`
- Hot-reload: new skills/MCPs appear without page refresh (watch filesystem)
