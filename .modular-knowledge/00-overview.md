# modular-studio

## Stack
- **Language:** TypeScript
- **Framework:** React
- **State:** Zustand
- **Styling:** Tailwind CSS
- **Testing:** Vitest
- **Build:** Vite
- **Package Manager:** npm

## Structure
- 220 files indexed
- ~391K tokens total
- 4 feature clusters detected
- 22 modules

## File Distribution
- component: 76 files
- test: 33 files
- store: 22 files
- type: 14 files
- route: 14 files
- config: 13 files
- doc: 13 files
- other: 12 files
- service: 11 files
- util: 10 files
- script: 2 files

## Conventions
### barrel exports
Uses index.ts barrel files for module exports
Examples: dist-server/server/index.js, server/index.ts, src/components/ds/index.ts

### co-located tests
Test files live alongside source files
Examples: src/nodes/test/TestAgentNode.tsx, src/nodes/test/TestPromptNode.tsx, src/nodes/test/TestResponseNode.tsx

## Features
### Dist Server
Key files: dist-server/bin/modular-studio.d.ts, dist-server/bin/modular-studio.js, dist-server/server/config.d.ts, dist-server/server/index.d.ts, dist-server/server/index.js
Stores: dist-server/server/services/repoIndexer.js
Routes: dist-server/server/routes/agent-sdk.js, dist-server/server/routes/knowledge.js, dist-server/server/routes/llm.js, dist-server/server/routes/mcp.js, dist-server/server/routes/providers.js, dist-server/server/routes/repo-index.js, dist-server/server/routes/skills-search.js

### Docs
Key files: docs/AGENT-ARCHITECTURE.md, docs/CLEAN-CODE-AUDIT.md, docs/CONTEXT-ENGINEERING-VISION.md, docs/DASHBOARD-MIGRATION.md, docs/DESIGN-SYSTEM.md

### Server
Key files: server/index.ts, server/mcp/manager.ts, server/routes/agent-sdk.ts, server/routes/knowledge.ts, server/routes/llm.ts
Stores: server/services/repoIndexer.ts
Routes: server/routes/agent-sdk.ts, server/routes/knowledge.ts, server/routes/llm.ts, server/routes/mcp.ts, server/routes/providers.ts, server/routes/repo-index.ts, server/routes/skills-search.ts

### Src
Key files: src/App.tsx, src/components/AgentCard.tsx, src/components/AgentPreview.tsx, src/components/AgentViz.tsx, src/components/AgentVizCircuit.tsx
Stores: src/store/consoleStore.ts, src/store/conversationStore.ts, src/store/demoPreset.ts, src/store/demoPresets.ts, src/store/healthStore.ts, src/store/knowledgeBase.ts, src/store/knowledgeStore.ts, src/store/mcp-registry.ts, src/store/mcpStore.ts, src/store/memoryStore.ts, src/store/modeStore.ts, src/store/outputTemplates.ts, src/store/providerStore.ts, src/store/registry.ts, src/store/skillsStore.ts, src/store/teamStore.ts, src/store/themeStore.ts, src/store/traceStore.ts, src/store/treeIndexStore.ts, src/store/versionStore.ts
Components: 76 files
