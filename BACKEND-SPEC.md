# Backend Spec — Modular Studio

## Architecture

```
npx modular-studio          ← CLI entry point
    │
    ├── Express server (port 4800)
    │   ├── Serves built React from dist/
    │   ├── /api/providers/*   — LLM provider CRUD + test
    │   ├── /api/mcp/*         — MCP server lifecycle + tools
    │   ├── /api/llm/chat      — streaming LLM proxy (SSE)
    │   └── /api/config        — persist server configs
    │
    └── MCP Manager
        ├── Uses @modelcontextprotocol/sdk v1.x (stable)
        ├── StdioClientTransport for each MCP server
        ├── client.listTools() → real tool discovery
        └── client.callTool()  → real tool execution
```

## SDK Choice

**Use `@modelcontextprotocol/sdk` v1.27.1** (the stable v1.x branch).
- v2 is pre-alpha, not recommended for production
- v1 has `Client`, `StdioClientTransport`, `listTools`, `callTool`
- Single package: `@modelcontextprotocol/sdk`
- Peer dep: `zod` (v3.25+ or v4)

### Client usage (v1 API):
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'firecrawl-mcp'],
  env: { FIRECRAWL_API_KEY: '...' }
});

const client = new Client({ name: 'modular-studio', version: '1.0.0' });
await client.connect(transport);

// List tools
const { tools } = await client.listTools();
// tools: [{ name: 'firecrawl_scrape', description: '...', inputSchema: {...} }, ...]

// Call a tool
const result = await client.callTool({
  name: 'firecrawl_scrape',
  arguments: { url: 'https://example.com' }
});
```

## Test MCP Servers

### 1. firecrawl-mcp (v3.9.0)
- Package: `firecrawl-mcp`
- Command: `npx -y firecrawl-mcp`
- Env: `FIRECRAWL_API_KEY=fc-0c33967a07e74a0eb35bf77916466658`
- Transport: stdio
- Expected tools: firecrawl_scrape, firecrawl_map, firecrawl_crawl, firecrawl_extract, firecrawl_search, etc.

### 2. @gongrzhe/server-gmail-autoauth-mcp (v1.1.11)
- Package: `@gongrzhe/server-gmail-autoauth-mcp`
- Command: `npx -y @gongrzhe/server-gmail-autoauth-mcp`
- Auth: OAuth2 (requires ~/.gmail-mcp/gcp-oauth.keys.json + credentials.json)
- Pre-auth: `npx @gongrzhe/server-gmail-autoauth-mcp auth` (opens browser)
- Transport: stdio
- Expected tools: send_email, create_draft, read_email, search_emails, list_emails, modify_email, delete_email, list_labels, create_label, update_label, delete_label, get_attachment, batch_modify_emails, batch_delete_emails

### 3. @modelcontextprotocol/server-filesystem (bundled test)
- Package: `@modelcontextprotocol/server-filesystem`  
- Command: `npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir`
- Env: none
- Transport: stdio
- Expected tools: read_file, write_file, list_directory, etc.

## API Contract

### Providers
```
GET    /api/providers              → ProviderConfig[]
POST   /api/providers              → create { id, name, type, apiKey, baseUrl }
PUT    /api/providers/:id          → update
POST   /api/providers/:id/test     → { status: 'ok'|'error', models?: string[], error?: string }
DELETE /api/providers/:id
```

Test connection logic:
- OpenAI/OpenRouter: GET `{baseUrl}/models` with Bearer token → parse model list
- Anthropic: POST `{baseUrl}/messages` with tiny prompt, check 200 vs 401
- Google: GET `{baseUrl}/models` with API key param
- Custom: GET `{baseUrl}/models` with Bearer token

### MCP Servers
```
GET    /api/mcp                    → McpServerConfig[] (includes status, tools)
POST   /api/mcp                    → add { id, name, command, args, env }
POST   /api/mcp/:id/connect        → spawn process, initialize, listTools → { status, tools }
POST   /api/mcp/:id/call           → { toolName, arguments } → tool result
POST   /api/mcp/:id/disconnect     → kill process
DELETE /api/mcp/:id                → disconnect + remove config
GET    /api/mcp/:id/health         → { status, tools, uptime, lastError }
```

### LLM Proxy
```
POST   /api/llm/chat               → SSE stream
  Body: { provider, model, messages, temperature?, maxTokens? }
  Response: SSE with OpenAI-compatible chunks
```

### Config Persistence
```
GET    /api/config                 → full config (providers + mcp servers)
```

Config stored in `~/.modular-studio/config.json`.

## File Structure (server/)

```
server/
  index.ts              — Express app, static serving, CORS
  config.ts             — Read/write ~/.modular-studio/config.json
  routes/
    providers.ts        — Provider CRUD + test
    mcp.ts              — MCP server lifecycle
    llm.ts              — LLM streaming proxy
  mcp/
    manager.ts          — McpManager class (spawn, connect, list, call, disconnect)
  types.ts              — Shared TypeScript types
bin/
  modular-studio.ts     — CLI entry: parse args, start server, open browser
```

## Package.json Updates

```json
{
  "name": "modular-studio",
  "bin": {
    "modular-studio": "./bin/modular-studio.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.0",
    "express": "^5.2.1",
    "cors": "^2.8.5",
    "zod": "^3.25.0"
  }
}
```

## Frontend Changes

1. **llmService.ts**: Add backend proxy mode — POST to /api/llm/chat, parse SSE
2. **providerStore.ts**: CRUD via /api/providers instead of localStorage
3. **New: mcpStore.ts**: Zustand store for MCP server state (configs, tools, status)
4. **MCP nodes**: Fetch real tools from store, show tool list with descriptions
5. **Settings page**: Full page with tabs (Providers, MCP Servers, Skills, General)
6. **Marketplace → Install**: POST /api/mcp to add server, then /connect to start
7. **Health indicators**: Real connection status from /api/mcp/:id/health
