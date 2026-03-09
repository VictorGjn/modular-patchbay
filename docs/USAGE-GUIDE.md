# Modular Studio Usage Guide

Comprehensive guide for designing AI agent context pipelines with Modular Studio.

---

## Getting Started

### Installation

```bash
# Quick start
npx modular-studio

# Or install globally
npm install -g modular-studio
modular-studio

# Development mode
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay
npm install --legacy-peer-deps
npm run dev          # Frontend :5173, Backend :4800
```

### Configure a Provider

Before building agents, connect at least one LLM provider:

1. Open Modular Studio in your browser (`http://localhost:5173`)
2. Click the **Provider** section in the left panel
3. Add a provider:
   - **Anthropic**: Paste your API key. Models are fetched via `/models` endpoint.
   - **OpenAI**: Paste your API key. Models listed from `/models`.
   - **OpenRouter**: Paste your API key. Aggregated model catalog.
   - **Google**: Paste your API key.
4. Click **Test** to verify connectivity. A green indicator confirms access.

API endpoint: `POST /api/providers/:id/test`

### Your First Agent

1. In the **center panel** (Agent Builder), enter:
   - **Name**: e.g., `code-reviewer`
   - **Description**: e.g., `Reviews pull requests for security and style issues`
2. Write a **Persona** (who the agent is)
3. Set a **Primary Objective** (what it does)
4. Add **Constraints** (what it must not do)
5. Click **Generate** to have the LLM flesh out the configuration from your description
6. Test with the **Chat** panel on the right

---

## Knowledge Source Setup

### Adding Sources

Sources are added from the **left panel** under Knowledge:

1. Click **+ Add Source**
2. Choose a source type:
   - **File**: Local markdown, text, YAML, JSON files
   - **Directory**: Scan a folder tree (max depth 5, max 1000 files)
   - **Repository**: Git repo with automatic feature-level documentation
3. The source is automatically indexed using the appropriate connector

### Source Connectors

Every source is normalized into a tree structure through one of four connectors (`src/services/treeIndexer.ts`):

| Connector | Input | How it works |
|---|---|---|
| `indexMarkdown()` | `.md`, `.txt` | Heading hierarchy (h1-h6) creates depth levels |
| `indexStructured()` | HubSpot, Notion, APIs | Field groups at depth 1, key-value pairs |
| `indexChronological()` | Slack, transcripts, logs | Groups by time gaps (default 10 min) |
| `indexFlat()` | Plain text, code | Single root node wrapper |

### Knowledge Types

Each source must be assigned a knowledge type. This determines its epistemic weight in the budget allocator:

| Type | Icon | Weight | Instruction to Agent |
|---|---|---|---|
| Ground Truth | :red_circle: | 30% | Do not contradict this |
| Evidence | :blue_circle: | 20% | Cite and weigh against other evidence |
| Guideline | :straight_ruler: | 15% | Extract and enforce as constraints |
| Framework | :green_circle: | 15% | Use to structure thinking |
| Signal | :yellow_circle: | 12% | Interpret — look for underlying need |
| Hypothesis | :purple_circle: | 8% | Help validate or invalidate |

**Classification rules** (`src/store/knowledgeBase.ts`):

1. **Path-based** (highest confidence): Folder names like `signal/`, `guidelines/`, `products/` trigger automatic classification
2. **Content-based** (scored): Pattern matching for keywords like MUST/SHALL (ground-truth), user quotes (signal), RFC/proposal (hypothesis)
3. **Extension fallback**: `.json`/`.yaml` → ground-truth, `.csv` → evidence, `.py`/`.ts` → guideline

### Understanding the Budget System

The budget allocator (`src/services/budgetAllocator.ts`) distributes your total token budget:

1. **Group** sources by knowledge type
2. **Weight** each source: `TYPE_WEIGHT / group_size × depth_multiplier`
3. **Floor** at 3% minimum per source
4. **Normalize** weights to sum = 1.0
5. **Allocate** tokens proportionally
6. **Cap** by actual content size — redistribute excess (max 3 rounds)

**Example**: 50,000 token budget with 5 sources:

| Source | Type | Depth | Multiplier | Allocated |
|---|---|---|---|---|
| API Spec | Ground Truth | 0 (Full) | 1.5x | ~18,000 |
| User Feedback | Signal | 0 (Full) | 1.5x | ~7,200 |
| Research Paper | Evidence | 2 (Summary) | 1.0x | ~10,000 |
| Coding Standards | Guideline | 0 (Full) | 1.5x | ~9,000 |
| New Proposal | Hypothesis | 1 (Detail) | 1.2x | ~5,800 |

---

## Agent Builder

The center panel provides structured agent configuration:

### Identity
- **Name**: Machine-friendly identifier (e.g., `fleet-monitor`)
- **Display Name**: Human-readable label
- **Description**: One-line purpose statement
- **Tags**: Categorization labels
- **Avatar**: Visual identifier

### Instructions
- **Persona**: Who the agent is and how it behaves
- **Tone**: neutral, formal, casual, technical, friendly
- **Expertise**: 1-5 scale (Beginner to Expert)
- **Primary Objective**: The agent's main goal
- **Success Criteria**: Measurable outcomes
- **Failure Modes**: Things to avoid

### Constraints
Toggle-based constraint system:
- Never fabricate information
- Ask before taking actions
- Stay within defined scope
- Only use provided tools
- Limit response word count
- Custom constraints (free text)

### Workflow
Ordered steps the agent follows:

```yaml
steps:
  - id: ingest
    action: Read latest data
    condition: always
  - id: analyze
    action: Compare against baseline
  - id: report
    action: Generate findings with recommendations
```

### Tools
- **MCP Servers**: Browse 100+ pre-configured servers from the registry (`src/store/mcp-registry.ts`). One-click add with health monitoring.
- **Skills**: Install from the marketplace or add custom skills. Security badges (GEN, SOC, SNK) show audit status.

---

## Pipeline Configuration

### How Budget Allocation Works

The pipeline flow:

```
Sources → Tree Index → Budget Allocator → Agent Navigator → Compressor → Context Assembly
```

1. **Tree Indexing**: Each source is parsed into a `TreeIndex` with nodes containing `{ nodeId, title, depth, text, tokens, children }`
2. **Budget Allocation**: Epistemic weights + depth multipliers determine how many tokens each source gets
3. **Agent Navigation**: The LLM reads tree headlines and selects branches at specific depths
4. **Compression**: Selected content is compressed (semantic dedup, filler removal, code compression)
5. **Assembly**: Compressed content is packed into `<source>` XML tags within `<knowledge>` blocks

### What the Depth Slider Does

The depth slider is a **budget multiplier**, not a content filter:

| Slider Position | Multiplier | Meaning |
|---|---|---|
| Full (0) | 1.5x | Source gets 50% more budget than baseline |
| Detail (1) | 1.2x | Slightly above baseline |
| Summary (2) | 1.0x | Baseline budget |
| Headlines (3) | 0.6x | 40% less budget |
| Mention (4) | 0.2x | Minimal budget — awareness only |

The tree index is always complete. The agent navigator decides which branches to include.

### Attention Ordering

Within the `<knowledge>` block, sources are reordered to exploit LLM attention patterns (`src/services/contextAssembler.ts:402-490`):

```
Ground Truth → Guideline → Framework → Hypothesis → Signal → Evidence
```

- **First position** (primacy): Ground truth gets highest attention
- **Middle positions**: Hypotheses placed where attention loss is acceptable
- **Last position** (recency): Evidence benefits from end-of-context boost

### Contradiction Detection

When sources discuss the same entities (`src/services/contradictionDetector.ts`):

1. Entities are extracted via capitalized multi-word phrase matching
2. If the same entity appears in sources of different types, the higher-priority type wins
3. If same type, the larger source (by content length) is kept
4. Resolution annotations are generated for transparency

### Corrective Re-Navigation

After initial assembly, a critique pass fills information gaps:

1. LLM rates context completeness
2. Identifies up to 3 gaps
3. Re-navigates with 20% of total budget
4. Merges supplementary context with initial assembly

### HyDE Navigation

For queries ≥10 words, a hypothetical ideal answer is generated before tree navigation. This enriches the navigation query for better heading matching.

---

## Team Execution

### Creating a Team

A team is a group of agents that execute in parallel against a shared feature spec:

```typescript
const config: TeamRunConfig = {
  teamId: 'hurricane-response',
  featureSpec: 'Monitor hurricanes and optimize vessel routes',
  agents: [
    {
      agentId: 'weather-monitor',
      name: 'Weather Monitor',
      systemPrompt: '...',
      task: 'Track active hurricanes and generate forecasts',
      model: 'claude-sonnet-4-20250514',  // per-agent override
      maxTurns: 50,
    },
    {
      agentId: 'route-optimizer',
      name: 'Route Optimizer',
      systemPrompt: '...',
      task: 'Calculate safe vessel routes avoiding storm paths',
    },
  ],
  providerId: 'anthropic',
  model: 'claude-sonnet-4-20250514',  // default model
  extractContracts: true,
};
```

### Launching via API

```bash
curl -X POST http://localhost:4800/api/runtime/team \
  -H 'Content-Type: application/json' \
  -d '{"teamId":"my-team","agents":[...],"providerId":"anthropic","model":"claude-sonnet-4-20250514"}'
```

The response is an SSE stream (`text/event-stream`).

### Monitoring the SSE Stream

Events follow the `TeamProgressEvent` interface (`src/services/teamClient.ts`):

```typescript
interface TeamProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  teamId?: string;
  agentId?: string;
  turn?: number;
  message?: string;
  fact?: ExtractedFact;
  tool?: string;
  args?: unknown;
  result?: unknown;
  error?: string;
}
```

Frontend usage:

```typescript
import { startTeamRun, getTeamStatus, stopTeamRun } from './services/teamClient';

const handle = startTeamRun(config, (event) => {
  switch (event.type) {
    case 'start': console.log('Team started');
    case 'progress': console.log(`Agent ${event.agentId} turn ${event.turn}`);
    case 'complete': console.log('Team finished', event.result);
    case 'error': console.error(event.error);
  }
});

// To stop:
handle.abort();
// Or: await stopTeamRun(config.teamId);
```

### Cross-Agent Memory

Facts extracted by one agent are available to others via `teamFacts`. The team runner deduplicates facts by confidence level and validates against shared patterns.

---

## Memory System

### Fact Extraction

After each LLM response, facts are extracted automatically (`server/services/factExtractor.ts`):

- **Pattern-based**: Regex rules detect observations, decisions, inferences, hypotheses, contracts
- **LLM-based**: The configured provider extracts structured facts from output text
- **Confidence**: Each fact gets an initial confidence score (0.4-0.95 based on pattern)

### Epistemic Types

| Type | Description |
|---|---|
| observation | Something directly observed or measured |
| inference | Conclusion drawn from evidence |
| decision | A choice that was made |
| hypothesis | Unverified proposal |
| contract | Formal agreement or API contract |

### Three-Factor Retrieval

When the agent needs context from memory (`server/services/memoryScorer.ts`):

```
score = relevance + 0.5 × recency + 0.5 × importance
```

- **Relevance**: Word-level Jaccard similarity between query and fact
- **Recency**: `0.99^hours` — exponential decay from creation time
- **Importance**: `confidence × 0.8` or explicit importance value

Facts retrieved are ranked by score, with configurable limits based on intent:
- Specific queries: 3 facts (k=3)
- Summary queries: 5 facts (k=5)
- Exploratory queries: 8 facts (k=8)

### Temporal Decay

Fact strength follows Ebbinghaus-inspired decay:

```
strength = importance × e^(-daysSince / halfLife)
halfLife = 30 × (1 + log₂(1 + accessCount))
```

Frequently accessed facts decay slower. A fact accessed 7 times has a half-life of 90 days vs 30 days for never-accessed facts.

### Consolidation

Periodic consolidation (`server/services/memoryScorer.ts:96-187`):

1. **Prune**: Facts with strength < 0.05 are removed
2. **Merge**: Facts with Jaccard text similarity > 0.7 are combined (strongest kept, confidence boosted)
3. **Promote**: Hypotheses with `access_count > 3` and `confidence > 0.7` become observations

### Fact Promotion

Facts can be promoted into agent components (`src/utils/analyzeFactsForPromotion.ts`):

| Promotion Target | What it becomes |
|---|---|
| instruction | Added to persona |
| constraint | Added to rules |
| workflow | Added to steps |
| knowledge | Added to sources |
| mcp | Added to tools |
| skill | Added to capabilities |

Promotion requires confidence ≥ 0.6 and LLM analysis of fit.

---

## Export Formats

### Claude Code (`AGENTS.md`)
Markdown with YAML frontmatter. Direct integration with Claude Code CLI.

### Amp (YAML)
Sourcegraph agent definition format.

### Codex (JSON)
OpenAI-compatible agent configuration.

### Vibe Kanban (JSON)
BloopAI task automation format.

### OpenClaw (YAML)
Open-source agent runtime definition.

### Generic JSON
Raw JSON export for custom integrations.

All exports are generated via `src/utils/agentExport.ts` and `src/utils/agentExportYaml.ts`. Export from the right panel's **Export** section or via `SaveAgentModal` (`src/components/SaveAgentModal.tsx`).

---

## Troubleshooting

### Provider Connection Fails

- Verify your API key is correct
- Check the provider test endpoint: `POST /api/providers/:id/test`
- Anthropic: Requires valid key with `/messages` access
- OpenRouter: Ensure your account has credits

### No Sources Appear After Adding

- Files must be in an allowed directory. Check: `GET /api/knowledge/allowed-dirs`
- Maximum file size: 1 MB (`GET /api/knowledge/read?path=...`)
- Directory scan limits: depth 5, max 1000 files

### Agent Navigation Produces Empty Context

- Ensure at least one source has content (not just a file path)
- Check that the tree index was built: sources need `indexFiles()` call
- Verify token budget is >0

### Team Run Hangs

- Default `maxTurns` is 100. Long-running agents may hit this limit.
- Check SSE connection: the browser may disconnect after timeout
- Use `stopTeamRun(teamId)` to force-stop
- Check server logs at `localhost:4800`

### Memory Not Persisting

- Memory is currently in-process only. Facts are lost on server restart.
- Run consolidation manually to prune stale facts
- Fact extraction requires a configured LLM provider

### MCP Server Shows Red Health

- Run a health probe: `GET /api/health/mcp/:id`
- Check that the MCP server command is installed (`npx` packages may need first-run install)
- Verify environment variables (e.g., `GITHUB_TOKEN`)

---

## API Reference

### Runtime

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/runtime/run-agent` | Execute single agent (SSE stream) |
| POST | `/api/runtime/run-team` | Execute team (SSE stream) |
| GET | `/api/runtime/status/:runId` | Get run status |
| POST | `/api/runtime/team/:id/stop` | Stop team run |
| GET | `/api/runtime/team/:id/status` | Team status |

### Agents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Load agent |
| PUT | `/api/agents/:id` | Save agent |
| DELETE | `/api/agents/:id` | Delete agent |

### Knowledge

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/knowledge/scan?dir=path` | Scan directory tree |
| GET | `/api/knowledge/read?path=file` | Read file content |
| POST | `/api/knowledge/index` | Index file to tree |
| POST | `/api/knowledge/filter` | Apply depth filter |
| GET | `/api/knowledge/content` | List stored content |
| DELETE | `/api/knowledge/content/:id` | Remove content |

### Providers

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/providers` | List providers (keys redacted) |
| POST | `/api/providers` | Create provider |
| POST | `/api/providers/:id/test` | Test connectivity |

### MCP

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/mcp` | List MCP servers |
| POST | `/api/mcp` | Register server |
| POST | `/api/mcp/:id/call` | Invoke tool |
| GET | `/api/mcp/:id/health` | Health probe |

### Skills

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/skills/search?q=query` | Search marketplace |
| GET | `/api/skills/audit/:owner/:repo/:skill` | Security audit |
| POST | `/api/skills/install` | Install skill |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health/mcp/:id` | Single MCP health check |
| POST | `/api/health/mcp/probe-all` | Batch health probes |

---

*For architecture details, see [AGENT-ARCHITECTURE.md](AGENT-ARCHITECTURE.md). For release notes, see [RELEASE-v0.2.0.md](RELEASE-v0.2.0.md).*
