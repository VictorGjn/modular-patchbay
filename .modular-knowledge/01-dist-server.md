# Feature: Dist Server

## Architecture
This feature spans 10 key files across 5 module(s).

## Key Files
### dist-server/bin/modular-studio.d.ts
- Category: type
- Size: 75 bytes (~19 tokens)

### dist-server/bin/modular-studio.js
- Category: script
- Size: 1303 bytes (~326 tokens)
- Exports: `parseArgs`, `main`

### dist-server/server/config.d.ts
- Category: type
- Size: 192 bytes (~48 tokens)
- Exports: `readConfig`, `writeConfig`

### dist-server/server/index.d.ts
- Category: type
- Size: 269 bytes (~68 tokens)
- Exports: `createApp`, `startServer`

### dist-server/server/index.js
- Category: other
- Size: 3620 bytes (~905 tokens)
- Exports: `createApp`, `startServer`, `createApp`, `loadSavedServers`, `startServer`

### dist-server/server/mcp/manager.d.ts
- Category: type
- Size: 1381 bytes (~346 tokens)
- Classes: `McpManager`
- Types: `McpConnection`

### dist-server/server/mcp/manager.js
- Category: other
- Size: 4385 bytes (~1097 tokens)
- Exports: `McpManager`, `mcpManager`
- Classes: `McpManager`

### dist-server/server/routes/agent-sdk.d.ts
- Category: type
- Size: 128 bytes (~32 tokens)

### dist-server/server/routes/agent-sdk.js
- Category: route
- Size: 3734 bytes (~934 tokens)

### dist-server/server/routes/claude-config.d.ts
- Category: type
- Size: 132 bytes (~33 tokens)

## Data Flow
Internal import relationships:

- `dist-server/bin/modular-studio.js` → `../server/index.js`
- `dist-server/server/index.js` → `./config.js`, `./mcp/manager.js`, `./routes/providers.js`, `./routes/mcp.js`, `./routes/llm.js`, `./routes/agent-sdk.js`, `./routes/knowledge.js`, `./routes/claude-config.js`, `./routes/skills-search.js`, `./routes/repo-index.js`
- `dist-server/server/routes/llm.js` → `../config.js`
- `dist-server/server/routes/mcp.js` → `../mcp/manager.js`, `../config.js`
- `dist-server/server/routes/providers.js` → `../config.js`

## State Management
### repoIndexer.js
- Path: dist-server/server/services/repoIndexer.js
- Actions/Selectors: `scanRepository`, `generateOverviewDoc`, `generateFeatureDoc`, `generateKnowledgeBase`
