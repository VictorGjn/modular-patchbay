# Claude Code Integration

This guide shows how to integrate modular-mcp-server with Claude Code for codebase-aware coding with knowledge classification.

## Setup

1. **Install the server**:
   ```bash
   npm install modular-studio
   ```

2. **Configure Claude Code MCP**:
   Create or update `~/.claude/mcp.json`:

   ```json
   {
     "mcpServers": {
       "modular": {
         "command": "npx",
         "args": ["modular-mcp-server"],
         "cwd": "/path/to/your/project"
       }
     }
   }
   ```

3. **Restart Claude Code** to load the new MCP server.

## Configuration

### Project-Specific Configuration

For each project, create a `.claude/mcp.json` file:

```json
{
  "mcpServers": {
    "modular": {
      "command": "npx",
      "args": ["modular-mcp-server"],
      "cwd": ".",
      "env": {
        "MODULAR_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Global Configuration

For system-wide access, add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "modular": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/modular-studio/dist-server/bin/modular-mcp.js"],
      "env": {
        "MODULAR_LOG_LEVEL": "warn"
      }
    }
  }
}
```

## Usage in Development

### Codebase-Aware Coding

Get intelligent context for development tasks:

```typescript
// In Claude Code, the MCP tools are available directly

// Get comprehensive context for a feature
const context = await modular_context({
  sources: [
    { path: "./README.md", name: "Project Overview" },
    { path: "./docs/CONTRIBUTING.md", name: "Development Guidelines", type: "guideline" },
    { path: "./src/types.ts", name: "Core Types", type: "ground-truth" },
    { path: "./src/components/UserProfile.tsx", name: "User Profile Component" },
    { path: "./src/hooks/useAuth.ts", name: "Auth Hook" }
  ],
  task: "Add a new user preferences feature to the profile component",
  tokenBudget: 24000
});
```

### Architectural Guidance

Understand project structure and patterns:

```typescript
// Analyze project architecture
const archTree = await modular_tree({
  path: "./docs/ARCHITECTURE.md"
});

// Classify new documentation
const docClassification = await modular_classify({
  path: "./docs/new-api-spec.md"
});

console.log(`Document type: ${docClassification.knowledgeType}`);
console.log(`Should get ${docClassification.budgetWeight * 100}% of context budget`);
```

### Code Quality & Patterns

Extract and learn from existing patterns:

```typescript
// Extract patterns from existing code
const codePatterns = await modular_facts({
  text: `
    // User noticed this pattern in the codebase:
    // All API hooks follow the pattern: useApi{EntityName}
    // They return { data, loading, error, refetch }
    // They use SWR internally for caching

    I decided to follow this pattern for the new useApiPreferences hook
  `,
  agentId: "claude-code-session"
});

console.log("Extracted patterns:", codePatterns);
```

## Common Workflows

### 1. Feature Development

```typescript
// Step 1: Get context for the feature area
const featureContext = await modular_context({
  sources: [
    { path: "./docs/FEATURES.md", name: "Feature Docs", type: "framework" },
    { path: "./src/features/auth/", name: "Auth Feature", type: "evidence" },
    { path: "./src/types/user.ts", name: "User Types", type: "ground-truth" }
  ],
  task: "Implement user role management feature",
  tokenBudget: 20000
});

// Step 2: Classify related files to understand their importance
const typeClassification = await modular_classify({
  path: "./src/types/permissions.ts"
});
```

### 2. Bug Investigation

```typescript
// Get context for debugging
const debugContext = await modular_context({
  sources: [
    { path: "./docs/TROUBLESHOOTING.md", name: "Known Issues", type: "evidence" },
    { path: "./src/components/BuggyComponent.tsx", name: "Problem Component" },
    { path: "./src/utils/helpers.ts", name: "Helper Functions" },
    { path: "./tests/BuggyComponent.test.tsx", name: "Tests", type: "evidence" }
  ],
  task: "Debug component rendering issue in production",
  tokenBudget: 16000
});
```

### 3. Code Review Preparation

```typescript
// Prepare comprehensive context for review
const reviewContext = await modular_context({
  sources: [
    { path: "./CONTRIBUTING.md", name: "Guidelines", type: "guideline" },
    { path: "./docs/CODE_STANDARDS.md", name: "Standards", type: "guideline" },
    { path: "./src/modified-file.ts", name: "Changed File" },
    { path: "./tests/modified-file.test.ts", name: "Tests" }
  ],
  task: "Review code changes for quality and consistency",
  tokenBudget: 18000
});
```

### 4. Documentation Writing

```typescript
// Get context for writing docs
const docContext = await modular_context({
  sources: [
    { path: "./src/api/", name: "API Implementation", type: "evidence" },
    { path: "./docs/existing-api-docs.md", name: "Existing Docs", type: "framework" },
    { path: "./examples/api-usage.ts", name: "Usage Examples", type: "evidence" }
  ],
  task: "Write comprehensive API documentation",
  tokenBudget: 22000
});
```

## Advanced Features

### Memory Consolidation

Use the consolidation feature to maintain project knowledge:

```typescript
// Extract facts from conversation history
const sessionFacts = await modular_facts({
  text: `
    During this session, I learned:
    - The project uses Zustand for state management
    - API calls are centralized in src/api/
    - Components follow atomic design principles
    - Tests use vitest instead of jest

    I decided to create a new store for user preferences using Zustand
  `,
  agentId: "claude-code-learning"
});

// Consolidate with existing knowledge
const consolidatedMemory = await modular_consolidate({
  facts: [...existingFacts, ...sessionFacts]
});

console.log("Consolidated memory:", consolidatedMemory);
```

### Project Scaffolding

Use context to understand and replicate project patterns:

```typescript
// Understand existing component structure
const componentContext = await modular_context({
  sources: [
    { path: "./src/components/", name: "Component Library", type: "evidence" },
    { path: "./docs/COMPONENT_GUIDE.md", name: "Component Guidelines", type: "guideline" }
  ],
  task: "Create new components following project conventions",
  tokenBudget: 15000
});
```

## Benefits for Claude Code

- **Deep Codebase Understanding**: Know which files are specs vs implementation vs opinions
- **Intelligent Context Loading**: Most important information gets priority in limited context
- **Pattern Recognition**: Extract and reuse established code patterns
- **Architectural Consistency**: Ensure new code follows project guidelines
- **Efficient Learning**: Quickly understand large codebases through structured analysis

## CLAUDE.md Integration

You can also add modular-mcp tools to your project's CLAUDE.md instructions:

```markdown
# Project Instructions for Claude

## MCP Tools Available

This project has modular-mcp-server configured. Use these tools for context-aware development:

- `modular_context`: Get epistemic-weighted context for any task
- `modular_classify`: Understand the knowledge type of any file
- `modular_tree`: Get structured view of documents
- `modular_facts`: Extract learnable patterns from text
- `modular_consolidate`: Manage project knowledge

## Development Patterns

Always use `modular_context` when:
- Starting work on a new feature
- Investigating bugs
- Writing documentation
- Reviewing code

Include these source types:
- Ground truth: specs, types, schemas (type: "ground-truth")
- Guidelines: coding standards, contributing guides (type: "guideline")
- Framework: architecture docs, patterns (type: "framework")
- Evidence: implementation files, tests, examples (type: "evidence")
```

## Troubleshooting

### MCP Server Not Loading

1. Check Claude Code logs: `~/.claude/logs/`
2. Verify node modules: `npm list modular-studio`
3. Test standalone: `npx modular-mcp-server --help`

### Context Quality Issues

1. Use `modular_classify` to understand file importance first
2. Adjust `tokenBudget` based on task complexity
3. Be specific about the `task` parameter for better context

### Performance Optimization

1. Cache frequently used contexts
2. Use smaller token budgets for exploratory queries
3. Classify files once and reuse the knowledge type

## Configuration Reference

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MODULAR_CONFIG_PATH` | `./config.json` | Configuration file path |
| `MODULAR_LOG_LEVEL` | `info` | Logging verbosity |

## Next Steps

- See [generic MCP integration](./generic.md) for other tools
- Check [Vibe Kanban integration](./vibe-kanban.md) for code review
- Explore [Google ADK integration](./google-adk.md) for agent development