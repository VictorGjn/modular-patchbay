# Modular Agent Directory Specification v1.0

A standardized directory format for AI agent configurations that are self-contained, portable, and composable.

## Overview

The Modular Agent Directory format creates a complete, exportable agent configuration as a directory of human-readable files. This format is designed to work with Claude Code, OpenClaw, Cursor, Amp, and custom runtimes while being git-friendly and easily editable by humans.

## Directory Structure

```
my-agent/
├── agent.yaml                 # Core agent configuration
├── SOUL.md                   # Identity and persona
├── INSTRUCTIONS.md           # System prompt, constraints, workflow  
├── KNOWLEDGE.md              # Knowledge sources configuration
├── TOOLS.md                  # MCP servers and skills configuration
├── MEMORY.md                 # Initial memory and memory structure
├── credentials/              # Sensitive data (gitignore this)
│   ├── .env                  # Environment variables for MCP servers
│   └── mcp-auth.json        # MCP server authentication configs
├── examples/                 # Usage examples (optional)
│   ├── input-example.md     # Example inputs
│   └── output-example.md    # Example outputs
└── .agentignore             # Files to ignore during import/export
```

## Core Files Specification

### 1. `agent.yaml` - Core Configuration

**Purpose:** Main agent metadata and runtime configuration
**Format:** YAML

```yaml
# Agent metadata
name: "Product Research Analyst"
description: "Analyzes product feedback and competitive intelligence to provide actionable insights"
version: "1.2.0" 
category: "business"
tags: ["research", "product", "analysis"]
icon: "📊"
avatar: "analyst"

# Runtime configuration
model: "claude-sonnet-4"
temperature: 0.7
planning_mode: "multi-step"  # single-shot | multi-step | chain-of-thought
token_budget: 50000

# Output configuration
output_formats: ["markdown", "json", "csv"]
default_output_format: "markdown"

# Export compatibility
created_by: "modular-patchbay"
created_at: "2024-03-10T15:30:00Z"
modular_version: "1.0.0"
```

### 2. `SOUL.md` - Identity & Persona

**Purpose:** Agent's personality, communication style, and core identity
**Format:** Markdown

```markdown
# Agent Identity

## Persona
You are a Senior Product Research Analyst with 10+ years of experience in both B2B and consumer products. You combine analytical rigor with strategic thinking to uncover actionable insights from complex data.

## Communication Style
- **Tone:** Professional but approachable
- **Style:** Data-driven with clear recommendations
- **Expertise Level:** 4/5 (Expert level)
- **Perspective:** Strategic and user-focused

## Core Values
- Accuracy over speed
- Context over raw data
- Actionable insights over analysis paralysis
- User empathy in all recommendations

## Personality Traits
- Naturally curious about user behavior
- Skeptical of vanity metrics
- Enjoys connecting seemingly unrelated data points
- Advocates for the user voice in business decisions
```

### 3. `INSTRUCTIONS.md` - System Prompt & Workflow

**Purpose:** Detailed instructions, constraints, and workflow definition
**Format:** Markdown

```markdown
# Agent Instructions

## Primary Objective
Analyze product feedback, market research, and competitive intelligence to provide actionable recommendations that drive product strategy and user satisfaction.

## Workflow
1. **Information Gathering**
   - Process all provided data sources
   - Identify patterns and anomalies
   - Cross-reference findings across sources

2. **Analysis Phase**
   - Categorize feedback by themes
   - Quantify impact and frequency
   - Assess competitive positioning

3. **Synthesis**
   - Prioritize findings by business impact
   - Develop recommendations with clear rationale
   - Identify implementation considerations

4. **Output Generation**
   - Structure findings for target audience
   - Include supporting data and methodology
   - Provide next steps and success metrics

## Success Criteria
- [ ] All major feedback themes identified and quantified
- [ ] Competitive gaps clearly articulated
- [ ] Recommendations prioritized by impact/effort matrix
- [ ] Implementation roadmap provided

## Constraints
- **Never make up data** - Only use provided sources
- **Ask before external actions** - No API calls without permission
- **Stay in scope** - Focus on product strategy, not technical implementation
- **Cite sources** - Always reference where insights come from
- **Be concise** - Maximum 2000 words unless specifically requested

## Failure Modes to Avoid
- Analysis paralysis (provide recommendations even with incomplete data)
- Feature laundry lists (prioritize, don't just list)
- Ignoring negative feedback (address pain points directly)
```

### 4. `KNOWLEDGE.md` - Knowledge Sources Configuration

**Purpose:** Configuration for all knowledge sources, connectors, and data processing
**Format:** Markdown with YAML blocks

```markdown
# Knowledge Sources Configuration

## Source Types

### Customer Feedback
```yaml
sources:
  - path: "/data/customer-feedback/**/*.json"
    type: "evidence"
    depth: "full"
    processing:
      sentiment_analysis: true
      theme_extraction: true
    weight: 0.8
  
  - path: "/data/support-tickets/**/*.csv" 
    type: "signal"
    depth: "summary"
    processing:
      category_mapping: true
    weight: 0.6
```

### Market Research
```yaml
sources:
  - path: "/data/market-reports/*.pdf"
    type: "framework"
    depth: "detail"
    processing:
      key_metrics_extraction: true
    weight: 0.7
```

### Competitive Intelligence
```yaml
sources:
  - path: "/data/competitor-analysis/**/*"
    type: "evidence"
    depth: "full"
    processing:
      feature_comparison: true
      pricing_analysis: true
    weight: 0.9
```

## Read Connectors

### Notion Database
```yaml
connector_id: "notion_feedback_db"
service: "notion"
direction: "read"
config:
  database_id: "${NOTION_DATABASE_ID}"
  properties: ["title", "category", "priority", "status"]
  filters:
    status: ["New", "In Review"]
enabled: true
```

### Slack Channels  
```yaml
connector_id: "slack_product_feedback"
service: "slack"
direction: "read"
config:
  channels: ["#product-feedback", "#customer-success"]
  date_range: "30d"
  include_threads: true
enabled: true
```

## Write Connectors

### Linear Issues
```yaml
connector_id: "linear_tasks"
service: "linear"
direction: "write"
config:
  team_id: "${LINEAR_TEAM_ID}"
  default_project: "Product Insights"
  labels: ["research", "user-feedback"]
enabled: false
```
```

### 5. `TOOLS.md` - MCP Servers & Skills Configuration

**Purpose:** Configuration for MCP servers, skills, and tool access
**Format:** Markdown with YAML blocks

```markdown
# Tools Configuration

## MCP Servers

### Data Analysis Suite
```yaml
server_id: "pandas_toolkit"
name: "Pandas Data Toolkit"
transport: "stdio"
command: "npx @pandas-toolkit/mcp"
description: "Advanced data analysis and visualization tools"
enabled: true
auth_required: false
```

### Research APIs
```yaml
server_id: "research_apis"
name: "Research API Collection" 
transport: "stdio"
command: "uvx research-mcp-server"
description: "Access to market research and competitive intelligence APIs"
enabled: true
auth_required: true
auth_config_ref: "research_apis"  # References credentials/mcp-auth.json
```

### Productivity Tools
```yaml
server_id: "productivity_suite"
name: "Productivity MCP Server"
transport: "stdio"
command: "npx @productivity/mcp-server"
description: "Task management, calendar, and communication tools"
enabled: true
auth_required: true
auth_config_ref: "productivity_suite"
```

## Skills (OpenClaw/Custom)

### Data Processing Skills
```yaml
skills:
  - name: "csv-processor"
    description: "Process and analyze CSV files"
    enabled: true
    version: "2.1.0"
    
  - name: "sentiment-analyzer" 
    description: "Analyze sentiment in text data"
    enabled: true
    version: "1.3.0"
    
  - name: "report-generator"
    description: "Generate formatted reports and visualizations"
    enabled: true
    version: "1.0.0"
```

## Tool Usage Guidelines

- **Primary Analysis**: Use pandas_toolkit for all data processing
- **External Research**: research_apis for market data when internal sources insufficient  
- **Task Creation**: productivity_suite for creating follow-up tasks in Linear/Asana
- **Report Generation**: report-generator skill for final deliverables

## Tool Fallbacks

If MCP servers unavailable:
1. Use built-in data analysis capabilities
2. Request manual data upload for processing
3. Generate text-based reports instead of rich visualizations
```

### 6. `MEMORY.md` - Memory Configuration

**Purpose:** Initial memory state and memory management configuration
**Format:** Markdown

```markdown
# Memory Configuration

## Initial Context

### Domain Knowledge
- Product is a B2B SaaS platform for project management
- Primary users are team leads and project managers
- Main competitors: Asana, Monday.com, ClickUp
- Current stage: Series B, 50K+ users, $10M ARR

### Historical Insights
- **Q3 2024**: Users consistently request better mobile experience
- **Q2 2024**: Integration with Slack drove 30% increase in daily active users
- **Q1 2024**: Onboarding drop-off at 65% correlates with complexity complaints

### Key Metrics Baseline
- Customer Satisfaction (CSAT): 7.2/10
- Net Promoter Score (NPS): 42
- Monthly Churn Rate: 3.2%
- Feature Adoption Rate: Average 45% within 30 days

## Memory Structure

### Session Memory (Current Analysis)
- Track all data sources processed this session
- Maintain running list of insights and patterns
- Record questions that arise during analysis
- Note data quality issues or gaps

### Working Memory (Current Project)
- Active hypotheses being tested
- Stakeholder requirements and constraints  
- Previous analysis results for this project
- Related findings from other recent projects

### Long-term Memory (Historical Knowledge)
- Past successful analysis frameworks
- Industry benchmarks and standards
- Company-specific context and terminology
- User persona insights and behavioral patterns

## Memory Management Rules

1. **Retention Policy**
   - Session data: Keep for duration of analysis
   - Project data: Retain for 90 days post-completion
   - Strategic insights: Permanent retention
   - Sensitive customer data: Purge according to data policy

2. **Update Triggers**
   - New baseline metrics → Update key metrics baseline
   - Successful analysis framework → Add to long-term patterns
   - Major product changes → Update domain knowledge
   - Quarterly reviews → Refresh historical insights

3. **Memory Sharing**
   - Share strategic insights across agent instances
   - Keep sensitive customer details private to session
   - Maintain confidentiality per data governance rules
```

### 7. `credentials/.env` - Environment Variables

**Purpose:** Environment variables for MCP servers (should be gitignored)
**Format:** Dotenv

```bash
# Research APIs
RESEARCH_API_KEY=sk_research_prod_abcd1234...
COMPETITIVE_INTEL_TOKEN=ci_token_xyz789...

# Productivity Tools  
LINEAR_API_TOKEN=lin_api_prod_def456...
NOTION_TOKEN=secret_notion_integration_ghi789...
SLACK_BOT_TOKEN=xoxb-slack-bot-token-jkl012...

# Database Connections
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:port/db

# External Services
OPENAI_API_KEY=sk-openai-key-for-embeddings...
ANTHROPIC_API_KEY=sk-ant-key-for-supplementary...
```

### 8. `credentials/mcp-auth.json` - MCP Authentication

**Purpose:** MCP server-specific authentication configurations (should be gitignored)
**Format:** JSON

```json
{
  "research_apis": {
    "auth_type": "bearer_token",
    "token": "${RESEARCH_API_KEY}",
    "additional_headers": {
      "X-Client-ID": "modular-agent"
    }
  },
  "productivity_suite": {
    "auth_type": "oauth2", 
    "client_id": "modular_productivity_client",
    "client_secret": "${PRODUCTIVITY_CLIENT_SECRET}",
    "scopes": ["tasks:read", "tasks:write", "calendar:read"]
  },
  "database_connector": {
    "auth_type": "connection_string",
    "connection_string": "${POSTGRES_CONNECTION_STRING}"
  }
}
```

### 9. `.agentignore` - Ignore Patterns

**Purpose:** Specify files to ignore during import/export operations
**Format:** Gitignore-style patterns

```
# Sensitive data
credentials/
*.env
*.key
*.pem

# Temporary files
.tmp/
*.log
.cache/

# Platform specific
.DS_Store
Thumbs.db

# Development artifacts
node_modules/
__pycache__/
*.pyc

# Large data files
data/
*.csv
*.parquet
*.db

# Personal notes (keep these local)
NOTES.md
scratch/
```

## Mapping to Current Modular Data Model

| Modular Field | Maps to File(s) | Notes |
|---------------|------------------|-------|
| `agentMeta` | `agent.yaml` | name, description, icon, category, tags, avatar |
| `instructionState.persona` | `SOUL.md` → Persona section | Communication style and personality |
| `instructionState.constraints` | `INSTRUCTIONS.md` → Constraints section | Behavioral limitations |
| `instructionState.objectives` | `INSTRUCTIONS.md` → Primary Objective | Main goals and success criteria |
| `workflowSteps` | `INSTRUCTIONS.md` → Workflow section | Step-by-step process |
| `channels` | `KNOWLEDGE.md` → sources blocks | Knowledge source configurations |
| `mcpServers` | `TOOLS.md` → MCP Servers section | Server configs (minus auth) |
| `skills` | `TOOLS.md` → Skills section | OpenClaw/custom skills |
| `connectors` | `KNOWLEDGE.md` → Connectors sections | Read/write data connections |
| `agentConfig` | `agent.yaml` | model, temperature, planning_mode |
| `outputFormat` | `agent.yaml` → output_formats | Supported output types |
| `tokenBudget` | `agent.yaml` → token_budget | Resource allocation |
| `prompt` | `INSTRUCTIONS.md` → entire content | Combined system prompt |

## Import/Export Implementation Plan

### Export Implementation

#### 1. Update `agentExport.ts`

```typescript
// Add new export target
export function exportAsAgentDirectory(config: ExportConfig): AgentDirectoryExport {
  return {
    'agent.yaml': generateAgentYaml(config),
    'SOUL.md': generateSoulMd(config),
    'INSTRUCTIONS.md': generateInstructionsMd(config),
    'KNOWLEDGE.md': generateKnowledgeMd(config),
    'TOOLS.md': generateToolsMd(config),
    'MEMORY.md': generateMemoryMd(config),
    'credentials/.env': generateEnvTemplate(config),
    'credentials/mcp-auth.json': generateMcpAuthTemplate(config),
    '.agentignore': generateAgentIgnore()
  };
}

interface AgentDirectoryExport {
  [filename: string]: string;
}
```

#### 2. New helper functions

```typescript
function generateAgentYaml(config: ExportConfig): string;
function generateSoulMd(config: ExportConfig): string;
function generateInstructionsMd(config: ExportConfig): string;
function generateKnowledgeMd(config: ExportConfig): string;
function generateToolsMd(config: ExportConfig): string;
function generateMemoryMd(config: ExportConfig): string;
function generateEnvTemplate(config: ExportConfig): string;
function generateMcpAuthTemplate(config: ExportConfig): string;
function generateAgentIgnore(): string;
```

### Import Implementation

#### 1. Update `agentImport.ts`

```typescript
export function importAgentDirectory(files: Record<string, string>): ImportResult {
  const result: ImportResult = {};
  
  // Parse core config
  if (files['agent.yaml']) {
    Object.assign(result, parseAgentYaml(files['agent.yaml']));
  }
  
  // Parse identity
  if (files['SOUL.md']) {
    result.instructionState = {
      ...result.instructionState,
      ...parseSoulMd(files['SOUL.md'])
    };
  }
  
  // Parse instructions
  if (files['INSTRUCTIONS.md']) {
    Object.assign(result, parseInstructionsMd(files['INSTRUCTIONS.md']));
  }
  
  // Parse knowledge config
  if (files['KNOWLEDGE.md']) {
    Object.assign(result, parseKnowledgeMd(files['KNOWLEDGE.md']));
  }
  
  // Parse tools config
  if (files['TOOLS.md']) {
    Object.assign(result, parseToolsMd(files['TOOLS.md']));
  }
  
  // Parse memory
  if (files['MEMORY.md']) {
    // Set initial memory state
    result.initialMemory = parseMemoryMd(files['MEMORY.md']);
  }
  
  result.detectedFormat = 'agent-directory';
  return result;
}
```

#### 2. Add directory detection

```typescript
export function detectAgentDirectory(files: Record<string, string>): boolean {
  const requiredFiles = ['agent.yaml', 'SOUL.md', 'INSTRUCTIONS.md'];
  return requiredFiles.every(file => files[file]);
}
```

### Backend Storage Updates

#### 1. Update `agentStore.ts`

```typescript
// Add directory export option
export function saveAgentAsDirectory(id: string, state: SavedAgentState): void {
  const dirPath = join(AGENTS_DIR, id);
  ensureDirExists(dirPath);
  
  const config = stateToExportConfig(state);
  const directory = exportAsAgentDirectory(config);
  
  for (const [filename, content] of Object.entries(directory)) {
    const filePath = join(dirPath, filename);
    ensureDirExists(dirname(filePath));
    writeFileSync(filePath, content, 'utf-8');
  }
}

export function loadAgentFromDirectory(id: string): SavedAgentState | null {
  const dirPath = join(AGENTS_DIR, id);
  if (!existsSync(dirPath)) return null;
  
  const files = loadDirectoryFiles(dirPath);
  const importResult = importAgentDirectory(files);
  return importResultToSavedState(importResult);
}
```

## Format Comparison

| Feature | Modular Directory | Claude/.claude | OpenClaw | CrewAI |
|---------|------------------|----------------|-----------|--------|
| **File Format** | Mixed (YAML+MD) | Markdown | Markdown | YAML |
| **Identity** | `SOUL.md` | Frontmatter + body | `SOUL.md` | `agents.yaml` |
| **Instructions** | `INSTRUCTIONS.md` | Body content | `USER.md` | `agents.yaml` |
| **Tools** | `TOOLS.md` | Frontmatter | `TOOLS.md` | `agents.yaml` |
| **Memory** | `MEMORY.md` | Not specified | `MEMORY.md` | Not specified |
| **Knowledge** | `KNOWLEDGE.md` | Frontmatter `reads:` | Context files | Not specified |
| **Credentials** | `credentials/` dir | Not specified | Not specified | Environment vars |
| **Git Friendly** | ✅ (separate files) | ✅ (single file) | ✅ (separate files) | ✅ (YAML) |
| **Human Readable** | ✅ | ✅ | ✅ | ✅ |
| **Sensitive Data** | ✅ (gitignored dir) | ❌ | ❌ | ❌ |
| **Composability** | ✅ (separate configs) | ❌ (monolithic) | ⚠️ (limited) | ⚠️ (limited) |
| **Portability** | ✅ (runtime agnostic) | ⚠️ (Claude specific) | ⚠️ (OpenClaw specific) | ⚠️ (CrewAI specific) |

## Advantages of Modular Directory Format

1. **Separation of Concerns**: Each file has a clear, single responsibility
2. **Security**: Sensitive data isolated and gitignored by default
3. **Collaboration**: Team members can edit different aspects independently
4. **Modularity**: Files can be reused across agents (e.g., shared `TOOLS.md`)
5. **Evolution**: Easy to add new files without breaking existing agents
6. **Debugging**: Issues isolated to specific configuration areas
7. **Documentation**: Built-in documentation through markdown structure
8. **Runtime Agnostic**: Works with any system that can read YAML/Markdown

## Migration Strategy

### Phase 1: Add Export Support
- Implement directory export in `agentExport.ts`
- Add UI option for "Export as Agent Directory"
- Create download as ZIP functionality

### Phase 2: Add Import Support  
- Implement directory import in `agentImport.ts`
- Support drag-and-drop of agent directories
- Add bulk import functionality

### Phase 3: Native Directory Storage
- Update backend to use directory format natively
- Migrate existing JSON agents to directories
- Deprecate single-file JSON format

### Phase 4: Enhanced Features
- Add agent templating system
- Implement agent inheritance (shared base configurations)
- Create agent marketplace with directory format

## Future Extensions

1. **Agent Inheritance**: `extends: ../base-analyst/` in `agent.yaml`
2. **Templating**: Variable substitution in configuration files  
3. **Validation**: JSON Schema validation for configuration files
4. **Packaging**: `.magent` compressed format for distribution
5. **Runtime Integration**: Direct execution by runtimes without import step
6. **Version Control**: Semantic versioning and migration scripts
7. **Dependencies**: Package manager for shared tools and knowledge sources

This specification provides a comprehensive, extensible foundation for agent configuration that balances human readability, security, and runtime requirements while supporting the diverse ecosystem of AI agent platforms.