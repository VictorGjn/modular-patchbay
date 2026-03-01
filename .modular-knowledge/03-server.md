# Feature: Server

## Architecture
This feature spans 10 key files across 2 module(s).

## Key Files
### server/index.ts
- Category: other
- Size: 3617 bytes (~905 tokens)
- Exports: `createApp`, `startServer`, `createApp`, `loadSavedServers`, `startServer`

### server/mcp/manager.ts
- Category: other
- Size: 4681 bytes (~1171 tokens)
- Exports: `McpManager`, `mcpManager`
- Classes: `McpManager`
- Types: `McpConnection`

### server/routes/agent-sdk.ts
- Category: route
- Size: 3802 bytes (~951 tokens)

### server/routes/knowledge.ts
- Category: route
- Size: 14831 bytes (~3708 tokens)
- Exports: `loadAllowedDirs`, `isPathSafe`, `isTextFile`, `classifyKnowledgeType`, `scanDirectory`
- Types: `FileNode`, `FileContent`, `KnowledgeConfig`, `TreeNode`, `TreeIndex`

### server/routes/llm.ts
- Category: route
- Size: 3687 bytes (~922 tokens)
- Types: `ChatRequest`

### server/routes/mcp.ts
- Category: route
- Size: 4758 bytes (~1190 tokens)
- Exports: `getClaudeConfigServer`

### server/routes/providers.ts
- Category: route
- Size: 5421 bytes (~1356 tokens)
- Exports: `maskApiKey`
- Types: `from`, `field`

### server/routes/repo-index.ts
- Category: route
- Size: 3307 bytes (~827 tokens)
- Exports: `repoPath`

### server/routes/skills-search.ts
- Category: route
- Size: 2747 bytes (~687 tokens)
- Exports: `query`, `nextLine`
- Types: `SkillResult`

### server/services/repoIndexer.ts
- Category: store
- Size: 20890 bytes (~5223 tokens)
- Exports: `RepoFile`, `FileCategory`, `RepoModule`, `RepoFeature`, `RepoScan`, `RepoConvention`, `StackInfo`, `scanRepository`
- Classes: `names`
- Types: `RepoFile`, `names`, `FileCategory`, `definitions`, `RepoModule`, `RepoFeature`, `RepoScan`, `RepoConvention`, `StackInfo`

## Data Flow
Internal import relationships:

- `server/index.ts` → `./config.js`, `./mcp/manager.js`, `./routes/providers.js`, `./routes/mcp.js`, `./routes/llm.js`, `./routes/agent-sdk.js`, `./routes/knowledge.js`, `./routes/claude-config.js`, `./routes/skills-search.js`, `./routes/repo-index.js`
- `server/routes/llm.ts` → `../config.js`
- `server/routes/mcp.ts` → `../mcp/manager.js`, `../config.js`
- `server/routes/providers.ts` → `../config.js`

## State Management
### repoIndexer.ts
- Path: server/services/repoIndexer.ts
- Actions/Selectors: `RepoFile`, `FileCategory`, `RepoModule`, `RepoFeature`, `RepoScan`, `RepoConvention`, `StackInfo`, `scanRepository`, `generateOverviewDoc`, `generateFeatureDoc`, `generateKnowledgeBase`
