# Vibe Kanban Integration

This guide shows how to integrate modular-mcp-server with Vibe Kanban for enhanced code review with knowledge-typed context.

## Setup

1. **Install the server**:
   ```bash
   npm install modular-studio
   ```

2. **Configure Vibe Kanban MCP**:
   Create or update `.vibe/mcp.json`:

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

3. **Restart Vibe Kanban** to load the new MCP server.

## Configuration

### Basic Configuration

```json
{
  "mcpServers": {
    "modular": {
      "command": "npx",
      "args": ["modular-mcp-server"],
      "cwd": "/path/to/your/project",
      "env": {
        "MODULAR_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Advanced Configuration

For projects with multiple repositories or complex structure:

```json
{
  "mcpServers": {
    "modular": {
      "command": "node",
      "args": [
        "/path/to/modular-studio/dist-server/bin/modular-mcp.js"
      ],
      "cwd": "/path/to/your/project",
      "env": {
        "MODULAR_CONFIG_PATH": "/path/to/config.json",
        "MODULAR_LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Usage in Code Review

### Enhanced PR Context

Use the `modular_context` tool to get epistemic-aware context for code reviews:

```javascript
// Example Vibe Kanban automation
const reviewContext = await tools.modular_context({
  sources: [
    { path: "./README.md", name: "Project Overview" },
    { path: "./docs/ARCHITECTURE.md", name: "Architecture Guide", type: "framework" },
    { path: "./CHANGELOG.md", name: "Recent Changes", type: "evidence" },
    { path: "./src/components/Button.tsx", name: "Modified Component" }
  ],
  task: "Review this Pull Request for architectural consistency and best practices",
  tokenBudget: 20000
});

console.log("Context for PR review:", reviewContext.context);
```

### Knowledge Classification

Automatically classify files in your PR:

```javascript
const classification = await tools.modular_classify({
  path: "./docs/new-feature.md"
});

console.log(`File type: ${classification.knowledgeType}`);
console.log(`Suggested depth: ${classification.suggestedDepth}`);
console.log(`Budget weight: ${classification.budgetWeight}`);
```

### Document Tree Analysis

Get structured view of documentation:

```javascript
const treeAnalysis = await tools.modular_tree({
  path: "./docs/API_GUIDE.md"
});

console.log("Document structure:", treeAnalysis.headlines);
console.log("Full tree:", JSON.stringify(treeAnalysis.tree, null, 2));
```

## Use Cases

### 1. Architecture-Aware Code Review

```javascript
// Review component changes against architecture docs
const context = await tools.modular_context({
  sources: [
    { path: "./docs/ARCHITECTURE.md", name: "Architecture", type: "framework" },
    { path: "./docs/COMPONENT_GUIDELINES.md", name: "Component Rules", type: "guideline" },
    { path: "./src/components/NewComponent.tsx", name: "New Component" }
  ],
  task: "Ensure this component follows our architecture and guidelines"
});
```

### 2. API Consistency Check

```javascript
// Check API changes against existing patterns
const context = await tools.modular_context({
  sources: [
    { path: "./docs/API.md", name: "API Spec", type: "ground-truth" },
    { path: "./src/api/routes/*.ts", name: "Existing Routes", type: "evidence" },
    { path: "./src/api/routes/new-endpoint.ts", name: "New Endpoint" }
  ],
  task: "Verify new API endpoint follows existing patterns and specification"
});
```

### 3. Feature Documentation Review

```javascript
// Ensure feature docs match implementation
const context = await tools.modular_context({
  sources: [
    { path: "./docs/features/user-auth.md", name: "Auth Docs" },
    { path: "./src/auth/*.ts", name: "Auth Implementation", type: "evidence" },
    { path: "./tests/auth.test.ts", name: "Auth Tests", type: "evidence" }
  ],
  task: "Check if documentation accurately reflects the implementation"
});
```

## Benefits

- **Epistemic Awareness**: Different types of knowledge (specs vs implementation vs opinions) are weighted appropriately
- **Context Budget**: Smart token allocation ensures most important information is included
- **Attention Ordering**: Critical information (ground truth, guidelines) comes first
- **Contradiction Detection**: Automatic detection of conflicting information across sources

## Troubleshooting

### Server Won't Start

1. Check that `modular-studio` is installed: `npm list modular-studio`
2. Verify the working directory in MCP config
3. Check logs: Set `MODULAR_LOG_LEVEL=debug` in env

### Context Too Large

1. Reduce `tokenBudget` in `modular_context` calls
2. Be more selective about which sources to include
3. Use `modular_classify` to understand document sizes first

### Memory Issues

1. Restart Vibe Kanban periodically for long sessions
2. Use `modular_consolidate` to clean up extracted facts
3. Limit the number of concurrent `modular_context` calls

## Configuration Reference

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MODULAR_CONFIG_PATH` | `./config.json` | Path to configuration file |
| `MODULAR_LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

## Next Steps

- Explore [generic MCP integration](./generic.md) for other tools
- Check out [Claude Code integration](./claude-code.md) for development workflow
- See [Google ADK integration](./google-adk.md) for agent development