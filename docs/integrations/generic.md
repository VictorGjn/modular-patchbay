# Generic MCP Integration Guide

This guide shows how to integrate modular-mcp-server with any MCP-compatible runtime or application.

## Overview

The modular-mcp-server implements the Model Context Protocol (MCP) specification, making it compatible with any MCP client. This includes:

- Claude Code
- Vibe Kanban
- Google Agent Development Kit (ADK)
- OpenFang
- LangGraph with MCP support
- Custom applications using MCP SDK

## Basic Setup

### 1. Install the Server

```bash
npm install modular-studio
```

### 2. Test Standalone

```bash
# Test basic functionality
npx modular-mcp-server --help

# Quick test with sample files
npx modular-mcp-server --sources ./README.md,./docs/guide.md --task "Summarize the project"
```

### 3. Configure Your MCP Client

The exact configuration depends on your client, but generally follows this pattern:

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

## Available Tools

### modular_context

**Purpose**: Full context engineering pipeline with epistemic weighting

**Input**:
```json
{
  "sources": [
    {
      "path": "./README.md",
      "name": "Project Overview",
      "type": "framework"
    }
  ],
  "task": "What you want to accomplish",
  "tokenBudget": 32000
}
```

**Output**:
```json
{
  "context": "XML-tagged context with attention ordering",
  "metadata": {
    "totalTokens": 28500,
    "sources": [...],
    "budgetAllocation": [...],
    "contradictions": 0
  }
}
```

**Knowledge Types**:
- `ground-truth`: Specs, schemas, contracts (highest priority)
- `guideline`: Rules, standards, policies
- `framework`: Patterns, methodologies, architectures
- `evidence`: Data, metrics, test results
- `signal`: User feedback, requests, observations
- `hypothesis`: Ideas, proposals, experiments (lowest priority)

### modular_tree

**Purpose**: Index documents into tree structure

**Input**:
```json
{
  "path": "./docs/architecture.md"
}
```

**Output**:
```json
{
  "tree": {
    "source": "./docs/architecture.md",
    "root": { ... },
    "totalTokens": 4250,
    "nodeCount": 15
  },
  "headlines": "# Architecture\n## Core Components\n### Database Layer"
}
```

### modular_classify

**Purpose**: Auto-classify content by epistemic type

**Input**:
```json
{
  "path": "./docs/api-spec.md"
}
```

**Output**:
```json
{
  "knowledgeType": "ground-truth",
  "suggestedDepth": 0,
  "budgetWeight": 0.30,
  "confidence": "high",
  "reason": "Content analysis: API specification patterns",
  "instruction": "Do not contradict this."
}
```

### modular_facts

**Purpose**: Extract structured facts with epistemic classification

**Input**:
```json
{
  "text": "I decided to use React for the frontend. The API returns user objects with id, name, email fields.",
  "agentId": "my-agent"
}
```

**Output**:
```json
[
  {
    "key": "decision_0_use_react_frontend",
    "value": "use React for the frontend",
    "epistemicType": "decision",
    "confidence": 0.8,
    "source": "my-agent"
  }
]
```

### modular_consolidate

**Purpose**: Consolidate facts through ranking and deduplication

**Input**:
```json
{
  "facts": [...]
}
```

**Output**:
```json
{
  "kept": [...],
  "pruned": [...],
  "merged": [...],
  "promoted": [...]
}
```

## Integration Patterns

### 1. Node.js/JavaScript

```javascript
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio.js';

const client = new Client({
  name: 'my-app',
  version: '1.0.0'
});

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['modular-mcp-server']
});

await client.connect(transport);

// Get context for a task
const result = await client.request({
  method: 'tools/call',
  params: {
    name: 'modular_context',
    arguments: {
      sources: [
        { path: './README.md', name: 'Overview' },
        { path: './docs/api.md', name: 'API Docs', type: 'ground-truth' }
      ],
      task: 'Explain how to use the API',
      tokenBudget: 20000
    }
  }
});

console.log(JSON.parse(result.content[0].text));
```

### 2. Python

```python
import asyncio
import json
from mcp.client import ClientSession
from mcp.client.stdio import StdioClientTransport

async def use_modular_mcp():
    async with StdioClientTransport(
        command="npx",
        args=["modular-mcp-server"]
    ) as transport:
        async with ClientSession(transport) as session:
            # Call modular_context tool
            result = await session.call_tool(
                "modular_context",
                {
                    "sources": [
                        {"path": "./README.md", "name": "Overview"},
                        {"path": "./docs/guide.md", "name": "Guide", "type": "framework"}
                    ],
                    "task": "Create onboarding documentation",
                    "tokenBudget": 25000
                }
            )

            context_data = json.loads(result.content[0].text)
            print(context_data["context"])

asyncio.run(use_modular_mcp())
```

### 3. HTTP/REST Integration

For applications that can't use stdio, run the server in HTTP mode:

```bash
# Start HTTP server
npx modular-mcp-server --transport sse --port 3000
```

Then integrate via HTTP (requires custom wrapper since MCP over HTTP uses SSE):

```javascript
// Custom HTTP wrapper (simplified)
async function callModularMcp(tool, args) {
  const response = await fetch('http://localhost:3000/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'tools/call',
      params: { name: tool, arguments: args }
    })
  });

  return await response.json();
}
```

## Common Use Cases

### 1. Documentation Assistant

```javascript
async function createDocumentation(codeFiles, existingDocs) {
  const sources = [
    ...codeFiles.map(file => ({ path: file, name: file, type: 'evidence' })),
    ...existingDocs.map(doc => ({ path: doc, name: doc, type: 'framework' }))
  ];

  const context = await client.request({
    method: 'tools/call',
    params: {
      name: 'modular_context',
      arguments: {
        sources,
        task: 'Generate comprehensive API documentation',
        tokenBudget: 40000
      }
    }
  });

  return context;
}
```

### 2. Code Review Assistant

```javascript
async function reviewCodeChanges(changedFiles, guidelines, specs) {
  const sources = [
    ...guidelines.map(g => ({ path: g, name: g, type: 'guideline' })),
    ...specs.map(s => ({ path: s, name: s, type: 'ground-truth' })),
    ...changedFiles.map(f => ({ path: f, name: f, type: 'evidence' }))
  ];

  const context = await client.request({
    method: 'tools/call',
    params: {
      name: 'modular_context',
      arguments: {
        sources,
        task: 'Review these code changes for compliance and quality',
        tokenBudget: 30000
      }
    }
  });

  return context;
}
```

### 3. Learning System

```javascript
async function extractLearnings(sessionTranscript) {
  // Extract facts from learning session
  const facts = await client.request({
    method: 'tools/call',
    params: {
      name: 'modular_facts',
      arguments: {
        text: sessionTranscript,
        agentId: 'learning-session'
      }
    }
  });

  // Consolidate with existing knowledge
  const consolidated = await client.request({
    method: 'tools/call',
    params: {
      name: 'modular_consolidate',
      arguments: {
        facts: [...existingFacts, ...facts]
      }
    }
  });

  return consolidated;
}
```

### 4. Smart Search

```javascript
async function smartSearch(query, knowledgeBase) {
  // Classify knowledge sources first
  const classifiedSources = await Promise.all(
    knowledgeBase.map(async (kb) => {
      const classification = await client.request({
        method: 'tools/call',
        params: {
          name: 'modular_classify',
          arguments: { path: kb }
        }
      });

      return {
        path: kb,
        name: kb,
        type: JSON.parse(classification.content[0].text).knowledgeType
      };
    })
  );

  // Get relevant context
  const context = await client.request({
    method: 'tools/call',
    params: {
      name: 'modular_context',
      arguments: {
        sources: classifiedSources,
        task: query,
        tokenBudget: 35000
      }
    }
  });

  return context;
}
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODULAR_CONFIG_PATH` | `./config.json` | Configuration file location |
| `MODULAR_LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

### Transport Options

```bash
# Stdio (default) - for direct process communication
npx modular-mcp-server

# HTTP/SSE - for web applications
npx modular-mcp-server --transport sse --port 3000 --host localhost
```

### Configuration File

Create `config.json` in your project:

```json
{
  "server": {
    "name": "my-project-modular",
    "version": "1.0.0"
  },
  "logging": {
    "level": "info",
    "file": "./logs/modular-mcp.log"
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 100
  }
}
```

## Best Practices

### 1. Knowledge Type Mapping

Map your domain concepts to epistemic types:

```javascript
const domainMapping = {
  // Highest priority - don't contradict these
  'API schemas': 'ground-truth',
  'Database schemas': 'ground-truth',
  'Legal requirements': 'ground-truth',

  // High priority - follow these rules
  'Coding standards': 'guideline',
  'Security policies': 'guideline',
  'Style guides': 'guideline',

  // Medium-high priority - use these patterns
  'Architecture docs': 'framework',
  'Design patterns': 'framework',
  'Best practices': 'framework',

  // Medium priority - consider this data
  'Performance metrics': 'evidence',
  'Test results': 'evidence',
  'Usage analytics': 'evidence',

  // Lower priority - listen to users
  'User feedback': 'signal',
  'Feature requests': 'signal',
  'Bug reports': 'signal',

  // Lowest priority - ideas to explore
  'Proposals': 'hypothesis',
  'Experiments': 'hypothesis',
  'Brainstorming': 'hypothesis'
};
```

### 2. Token Budget Strategy

```javascript
const budgetStrategy = {
  quick_lookup: 10000,
  standard_context: 25000,
  comprehensive_analysis: 40000,
  full_codebase_review: 60000
};
```

### 3. Error Handling

```javascript
async function safeModularCall(tool, args, fallback = null) {
  try {
    const result = await client.request({
      method: 'tools/call',
      params: { name: tool, arguments: args }
    });

    return JSON.parse(result.content[0].text);
  } catch (error) {
    console.warn(`Modular MCP call failed for ${tool}:`, error.message);
    return fallback;
  }
}
```

### 4. Context Caching

```javascript
const contextCache = new Map();

async function getCachedContext(sources, task, tokenBudget) {
  const key = JSON.stringify({ sources, task, tokenBudget });

  if (contextCache.has(key)) {
    return contextCache.get(key);
  }

  const context = await client.request({
    method: 'tools/call',
    params: {
      name: 'modular_context',
      arguments: { sources, task, tokenBudget }
    }
  });

  contextCache.set(key, context);
  return context;
}
```

## Troubleshooting

### Common Issues

1. **Server Won't Start**
   - Check Node.js version (requires 16+)
   - Verify npm package installation
   - Test with `--help` flag first

2. **Context Quality Issues**
   - Use `modular_classify` to understand source types
   - Adjust token budget for task complexity
   - Check for contradictions in metadata

3. **Performance Problems**
   - Cache classification results
   - Use appropriate token budgets
   - Consider running server in HTTP mode

4. **Integration Problems**
   - Verify MCP client compatibility
   - Check transport configuration
   - Test with minimal example first

### Debug Mode

```bash
# Enable detailed logging
MODULAR_LOG_LEVEL=debug npx modular-mcp-server
```

### Health Check

```bash
# Test server health (HTTP mode)
curl http://localhost:3000/health
```

## Next Steps

- Choose your specific integration guide:
  - [Claude Code Integration](./claude-code.md)
  - [Vibe Kanban Integration](./vibe-kanban.md)
  - [Google ADK Integration](./google-adk.md)
- Read the [MCP Protocol Specification](https://modelcontextprotocol.io/)
- Explore advanced configuration options
- Join the community for support and examples