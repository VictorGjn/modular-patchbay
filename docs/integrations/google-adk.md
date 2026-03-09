# Google Agent Development Kit (ADK) Integration

This guide shows how to integrate modular-mcp-server with Google's Agent Development Kit for grounded agents with epistemic awareness.

## Setup

1. **Install the server**:
   ```bash
   npm install modular-studio
   ```

2. **Configure ADK MCP Integration**:
   In your ADK project, add the MCP client configuration:

   ```typescript
   // adk-config.ts
   import { McpClient } from '@modelcontextprotocol/client';

   export const mcpConfig = {
     modular: {
       command: 'npx',
       args: ['modular-mcp-server'],
       cwd: process.cwd()
     }
   };
   ```

## ADK Tool Wrapper Pattern

Create ADK-compatible wrappers for the MCP tools:

### Context Tool

```typescript
// tools/modular-context.ts
import { tool } from '@google-labs/agent-development-kit';
import { z } from 'zod';
import { mcpClient } from '../lib/mcp-client.js';

const ContextInputSchema = z.object({
  sources: z.array(z.object({
    path: z.string(),
    name: z.string(),
    type: z.enum(['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline']).optional()
  })),
  task: z.string(),
  tokenBudget: z.number().default(32000)
});

export const modularContextTool = tool({
  name: 'modular_context',
  description: 'Get epistemic-aware context from multiple sources with budget allocation and attention ordering',
  schema: ContextInputSchema,

  async invoke({ sources, task, tokenBudget }) {
    const result = await mcpClient.call('modular_context', {
      sources,
      task,
      tokenBudget
    });

    return {
      context: result.context,
      metadata: result.metadata,
      // ADK-specific formatting
      sources_processed: result.metadata.sources.length,
      total_tokens: result.metadata.totalTokens,
      contradictions_found: result.metadata.contradictions
    };
  }
});
```

### Classification Tool

```typescript
// tools/modular-classify.ts
import { tool } from '@google-labs/agent-development-kit';
import { z } from 'zod';
import { mcpClient } from '../lib/mcp-client.js';

const ClassifyInputSchema = z.object({
  path: z.string().optional(),
  content: z.string().optional()
}).refine(data => data.path || data.content, {
  message: "Either path or content must be provided"
});

export const modularClassifyTool = tool({
  name: 'modular_classify',
  description: 'Classify content by epistemic knowledge type with confidence scoring',
  schema: ClassifyInputSchema,

  async invoke({ path, content }) {
    const result = await mcpClient.call('modular_classify', {
      path,
      content
    });

    return {
      knowledge_type: result.knowledgeType,
      suggested_depth: result.suggestedDepth,
      budget_weight: result.budgetWeight,
      confidence: result.confidence,
      reasoning: result.reason,
      instruction: result.instruction
    };
  }
});
```

### Facts Extraction Tool

```typescript
// tools/modular-facts.ts
import { tool } from '@google-labs/agent-development-kit';
import { z } from 'zod';
import { mcpClient } from '../lib/mcp-client.js';

const FactsInputSchema = z.object({
  text: z.string(),
  agentId: z.string().default('adk-agent')
});

export const modularFactsTool = tool({
  name: 'modular_facts',
  description: 'Extract structured epistemic facts from text content',
  schema: FactsInputSchema,

  async invoke({ text, agentId }) {
    const facts = await mcpClient.call('modular_facts', {
      text,
      agentId
    });

    return {
      facts,
      facts_count: facts.length,
      epistemic_distribution: getEpistemicDistribution(facts)
    };
  }
});

function getEpistemicDistribution(facts: any[]) {
  const distribution: Record<string, number> = {};
  facts.forEach(fact => {
    distribution[fact.epistemicType] = (distribution[fact.epistemicType] || 0) + 1;
  });
  return distribution;
}
```

## MCP Client Setup

```typescript
// lib/mcp-client.ts
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio.js';

class ModularMcpClient {
  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client({
      name: 'adk-modular-client',
      version: '1.0.0'
    });
  }

  async connect() {
    if (this.connected) return;

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['modular-mcp-server']
    });

    await this.client.connect(transport);
    this.connected = true;
  }

  async call(tool: string, args: any) {
    await this.connect();

    const result = await this.client.request({
      method: 'tools/call',
      params: {
        name: tool,
        arguments: args
      }
    });

    return JSON.parse(result.content[0].text);
  }

  async disconnect() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}

export const mcpClient = new ModularMcpClient();

// Cleanup on process exit
process.on('exit', () => mcpClient.disconnect());
```

## Agent Implementation

### Knowledge-Aware Research Agent

```typescript
// agents/research-agent.ts
import { Agent } from '@google-labs/agent-development-kit';
import { modularContextTool, modularClassifyTool, modularFactsTool } from '../tools/index.js';

export const researchAgent = new Agent({
  name: 'Knowledge Research Agent',
  description: 'Research agent with epistemic awareness and context engineering',

  tools: [
    modularContextTool,
    modularClassifyTool,
    modularFactsTool
  ],

  async run({ query, sources = [] }: { query: string; sources?: string[] }) {
    // Step 1: Classify available sources
    const classifiedSources = [];

    for (const sourcePath of sources) {
      const classification = await this.call('modular_classify', {
        path: sourcePath
      });

      classifiedSources.push({
        path: sourcePath,
        name: sourcePath.split('/').pop() || sourcePath,
        type: classification.knowledge_type,
        confidence: classification.confidence
      });
    }

    // Step 2: Get epistemic-weighted context
    const context = await this.call('modular_context', {
      sources: classifiedSources,
      task: query,
      tokenBudget: 28000
    });

    // Step 3: Extract learnable facts from the research
    const facts = await this.call('modular_facts', {
      text: `Research query: ${query}\nFindings: ${context.context}`,
      agentId: 'research-agent'
    });

    return {
      research_context: context.context,
      source_breakdown: context.metadata.sources,
      extracted_knowledge: facts.facts,
      epistemic_distribution: facts.epistemic_distribution,
      total_tokens_used: context.total_tokens,
      quality_indicators: {
        sources_processed: context.sources_processed,
        contradictions_found: context.contradictions_found,
        confidence_distribution: classifiedSources.map(s => ({
          source: s.name,
          confidence: s.confidence
        }))
      }
    };
  }
});
```

### Code Analysis Agent

```typescript
// agents/code-analysis-agent.ts
import { Agent } from '@google-labs/agent-development-kit';
import { modularContextTool, modularClassifyTool } from '../tools/index.js';

export const codeAnalysisAgent = new Agent({
  name: 'Code Analysis Agent',
  description: 'Analyze codebases with knowledge type awareness',

  tools: [modularContextTool, modularClassifyTool],

  async run({
    codeFiles,
    documentationFiles = [],
    analysisType = 'general'
  }: {
    codeFiles: string[];
    documentationFiles?: string[];
    analysisType?: 'security' | 'performance' | 'architecture' | 'general';
  }) {

    // Classify all files to understand their epistemic types
    const allFiles = [...codeFiles, ...documentationFiles];
    const classifications = await Promise.all(
      allFiles.map(async (file) => {
        const classification = await this.call('modular_classify', { path: file });
        return {
          path: file,
          name: file.split('/').pop() || file,
          type: classification.knowledge_type,
          isDocumentation: documentationFiles.includes(file)
        };
      })
    );

    // Get context optimized for code analysis
    const context = await this.call('modular_context', {
      sources: classifications,
      task: `Perform ${analysisType} analysis of the codebase`,
      tokenBudget: 40000
    });

    return {
      analysis_context: context.context,
      file_classifications: classifications,
      analysis_metadata: {
        files_analyzed: allFiles.length,
        documentation_files: documentationFiles.length,
        code_files: codeFiles.length,
        total_tokens: context.total_tokens,
        epistemic_distribution: getFileDistribution(classifications)
      }
    };
  }
});

function getFileDistribution(classifications: any[]) {
  const distribution: Record<string, number> = {};
  classifications.forEach(file => {
    distribution[file.type] = (distribution[file.type] || 0) + 1;
  });
  return distribution;
}
```

## Use Cases

### 1. Technical Documentation Generation

```typescript
// Generate docs with proper knowledge hierarchy
const docAgent = new Agent({
  name: 'Documentation Agent',
  tools: [modularContextTool],

  async run({ codebase, existingDocs }: { codebase: string[]; existingDocs: string[] }) {
    const context = await this.call('modular_context', {
      sources: [
        ...codebase.map(file => ({ path: file, name: file, type: 'evidence' })),
        ...existingDocs.map(doc => ({ path: doc, name: doc, type: 'framework' }))
      ],
      task: 'Generate comprehensive technical documentation',
      tokenBudget: 50000
    });

    return generateDocumentation(context.context);
  }
});
```

### 2. Requirement Analysis

```typescript
// Analyze requirements with epistemic classification
const requirementAgent = new Agent({
  name: 'Requirement Analyst',
  tools: [modularContextTool, modularClassifyTool],

  async run({ requirements, specifications }: { requirements: string[]; specifications: string[] }) {
    const sources = [
      ...requirements.map(req => ({ path: req, name: req, type: 'signal' as const })),
      ...specifications.map(spec => ({ path: spec, name: spec, type: 'ground-truth' as const }))
    ];

    const analysis = await this.call('modular_context', {
      sources,
      task: 'Analyze requirements for completeness and conflicts',
      tokenBudget: 35000
    });

    return {
      analysis: analysis.context,
      conflicts: analysis.contradictions_found,
      coverage: analysis.metadata.sources
    };
  }
});
```

### 3. Grounded Q&A System

```typescript
// Question answering with source attribution
const qaAgent = new Agent({
  name: 'Grounded QA Agent',
  tools: [modularContextTool, modularFactsTool],

  async run({ question, knowledgeBase }: { question: string; knowledgeBase: string[] }) {
    // Classify knowledge sources
    const sources = await Promise.all(
      knowledgeBase.map(async (kb) => {
        const classification = await this.call('modular_classify', { path: kb });
        return {
          path: kb,
          name: kb,
          type: classification.knowledge_type
        };
      })
    );

    // Get relevant context
    const context = await this.call('modular_context', {
      sources,
      task: question,
      tokenBudget: 25000
    });

    // Extract facts for verification
    const facts = await this.call('modular_facts', {
      text: context.context,
      agentId: 'qa-agent'
    });

    return {
      answer: generateAnswer(question, context.context),
      sources_used: context.metadata.sources,
      confidence_score: calculateConfidence(facts.facts),
      verification_facts: facts.facts
    };
  }
});
```

## Benefits for Google ADK

- **Epistemic Grounding**: Agents understand the reliability of their knowledge sources
- **Context Optimization**: Smart token allocation for large knowledge bases
- **Source Attribution**: Track where information comes from with confidence scores
- **Contradiction Detection**: Automatic identification of conflicting information
- **Scalable Knowledge**: Handle large documentation sets efficiently

## Best Practices

### 1. Knowledge Type Strategy

```typescript
// Map your domain to epistemic types
const domainMapping = {
  'API specifications': 'ground-truth',
  'User feedback': 'signal',
  'Performance metrics': 'evidence',
  'Design patterns': 'framework',
  'Feature requests': 'hypothesis',
  'Coding standards': 'guideline'
};
```

### 2. Context Budget Management

```typescript
// Adjust budget based on agent complexity
const budgetStrategy = {
  simple_qa: 15000,
  code_analysis: 30000,
  research_synthesis: 45000,
  full_codebase_review: 60000
};
```

### 3. Error Handling

```typescript
// Graceful degradation for MCP failures
async function safeModularCall(tool: string, args: any, fallback: any) {
  try {
    return await mcpClient.call(tool, args);
  } catch (error) {
    console.warn(`MCP call failed for ${tool}:`, error);
    return fallback;
  }
}
```

## Troubleshooting

### MCP Connection Issues

1. Check ADK process permissions
2. Verify Node.js version compatibility
3. Test MCP server standalone: `npx modular-mcp-server --help`

### Context Quality

1. Use appropriate knowledge types for your domain
2. Monitor contradiction counts
3. Adjust token budgets based on source complexity

### Performance Optimization

1. Cache classification results
2. Reuse context for related queries
3. Use background MCP connections

## Configuration Reference

| ADK Environment Variable | Default | Description |
|-------------------------|---------|-------------|
| `MODULAR_MCP_TIMEOUT` | `30000` | MCP call timeout in ms |
| `MODULAR_MCP_RETRIES` | `3` | Number of retry attempts |
| `MODULAR_CACHE_TTL` | `3600` | Cache TTL in seconds |

## Next Steps

- See [generic integration guide](./generic.md) for other frameworks
- Check [Claude Code integration](./claude-code.md) for development workflows
- Explore [Vibe Kanban integration](./vibe-kanban.md) for code review