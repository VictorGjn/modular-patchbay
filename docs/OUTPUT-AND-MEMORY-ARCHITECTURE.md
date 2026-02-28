# Output Connectors & Memory Architecture

*Addendum to AGENT-ARCHITECTURE.md — February 2026*

---

## The Problem

The current architecture treats output as a formless blob: agent produces text, text goes somewhere. But real-world agent outputs are **structured and target-specific**:

- A HubSpot agent doesn't output "text" — it creates a Contact with `firstname`, `email`, `lifecyclestage`, and associates it to a Deal.
- A Notion agent doesn't dump markdown — it creates a page from a template, populating properties that match the database schema.
- A GitHub agent doesn't just "write code" — it branches, commits, opens a PR, and requests review.
- A Slack agent formats Block Kit messages with sections, buttons, and metadata.

**Output is not an afterthought. Output is the product.**

Similarly, **memory** is absent from the architecture. Without memory, every conversation starts from zero. Agents can't learn, can't reference past work, can't build on previous interactions. Memory is what separates a useful tool from a capable assistant.

---

## 1. Output Architecture

### 1.1 Design Principle: Output Schemas

Every output connector defines a **schema** — the structured shape of what the agent produces. The agent's system prompt includes this schema so the LLM knows what format to return. The runtime then validates and routes the structured output to the target.

This is NOT about the agent calling APIs directly. It's about:
1. **Design-time:** Define what shape the output takes (schema)
2. **Prompt-time:** Include the schema in the system prompt so the LLM outputs structured data
3. **Runtime:** The runtime validates the LLM output against the schema and routes it

### 1.2 Output Connector Types

#### Category A: Structured Record Targets
These create/update structured records in external systems.

| Target | Schema Concept | Key Fields |
|--------|---------------|------------|
| **HubSpot** | CRM Object | `objectType` (contact/deal/company/ticket/custom), `properties` (key-value), `associations` (link to other objects) |
| **Salesforce** | SObject | `objectType`, `fields`, `relationships` |
| **Airtable** | Record | `table`, `fields` (typed: text/number/select/date) |
| **Linear** | Issue | `title`, `description`, `teamId`, `priority`, `labels`, `assigneeId`, `projectId` |
| **Jira** | Issue | `project`, `issueType`, `summary`, `description`, `priority`, `assignee`, `labels`, `components` |

**UI Pattern:** Object Mapper
```
┌─ Output: HubSpot ──────────────────────────────┐
│                                                  │
│  Object Type: [Contact ▾]                        │
│                                                  │
│  Property Mapping:                               │
│  ┌────────────────┬────────────────────────────┐ │
│  │ firstname      │ ← agent extracts           │ │
│  │ lastname       │ ← agent extracts           │ │
│  │ email          │ ← agent extracts           │ │
│  │ lifecyclestage │ ← "lead" (fixed)           │ │
│  │ company        │ ← agent extracts           │ │
│  └────────────────┴────────────────────────────┘ │
│                                                  │
│  Associations:                                   │
│  [+ Associate to Deal] [+ Associate to Company]  │
│                                                  │
│  On Duplicate: [Update existing ▾]               │
│  Dedup Key: email                                │
└──────────────────────────────────────────────────┘
```

**YAML Schema:**
```yaml
output:
  target: hubspot
  object_type: contact
  properties:
    firstname: { source: agent, required: true }
    lastname: { source: agent, required: true }
    email: { source: agent, required: true }
    lifecyclestage: { source: fixed, value: "lead" }
  associations:
    - object_type: company
      match_by: domain
    - object_type: deal
      match_by: name
  on_duplicate: update
  dedup_key: email
```

#### Category B: Template-Based Targets
These create content from templates — the structure is predefined, the agent fills slots.

| Target | Template Concept | Key Fields |
|--------|-----------------|------------|
| **Notion** | Database Template | `database_id`, `template_id`, `properties` (match DB schema), content blocks |
| **Slack** | Block Kit Layout | `channel`, `blocks[]` (section/header/divider/actions), `metadata` |
| **Email** | Email Template | `to`, `subject`, `template_id`, `variables` (merge fields) |
| **Google Docs** | Doc Template | `template_id`, `variables` (placeholder replacement) |

**UI Pattern:** Template Picker + Slot Mapper
```
┌─ Output: Notion ────────────────────────────────┐
│                                                  │
│  Database: [Product Feedback ▾]                  │
│  Template: [Bug Report ▾]  [Preview →]           │
│                                                  │
│  Properties (from DB schema):                    │
│  ┌────────────────┬────────────────────────────┐ │
│  │ Title          │ ← agent generates          │ │
│  │ Status         │ ← "New" (fixed)            │ │
│  │ Priority       │ ← agent classifies (P0-P3) │ │
│  │ Reporter       │ ← from context             │ │
│  │ Tags           │ ← agent extracts (multi)   │ │
│  └────────────────┴────────────────────────────┘ │
│                                                  │
│  Content: [Use template body ●] [Agent writes ○] │
└──────────────────────────────────────────────────┘
```

**YAML Schema:**
```yaml
output:
  target: notion
  database_id: "${NOTION_DB_ID}"
  template:
    type: template_id
    id: "${NOTION_TEMPLATE_ID}"
  properties:
    Title: { source: agent }
    Status: { source: fixed, value: "New" }
    Priority: { source: agent, format: "select", options: ["P0", "P1", "P2", "P3"] }
    Reporter: { source: context, field: "user.name" }
    Tags: { source: agent, format: "multi_select" }
  content: template  # or "agent" if agent writes the body
```

**Slack YAML:**
```yaml
output:
  target: slack
  channel: "${SLACK_CHANNEL}"
  format: blocks  # or "text" for simple messages
  template: |
    - type: header
      text: "{{title}}"
    - type: section
      text: "{{summary}}"
      accessory:
        type: button
        text: "View Details"
        url: "{{link}}"
    - type: context
      elements:
        - "Priority: {{priority}}"
        - "Reporter: {{reporter}}"
  metadata:
    event_type: "{{event_type}}"
```

#### Category C: Code/Workflow Targets
These perform multi-step operations in developer tools.

| Target | Workflow Concept | Steps |
|--------|-----------------|-------|
| **GitHub** | Git Workflow | branch strategy, commit convention, PR template, review assignment, merge method |
| **GitLab** | MR Workflow | similar to GitHub + CI pipeline triggers |
| **Vercel/Netlify** | Deploy | branch → build → preview URL → promote |

**UI Pattern:** Workflow Configurator
```
┌─ Output: GitHub ────────────────────────────────┐
│                                                  │
│  Repository: [owner/repo ▾]                      │
│                                                  │
│  Git Strategy:                                   │
│  ┌──────────────────────────────────────────────┐│
│  │ 1. Create branch from: [main ▾]             ││
│  │    Naming: [feat/{{slug}} ▾]                 ││
│  │                                              ││
│  │ 2. Commit changes                            ││
│  │    Convention: [conventional ▾]              ││
│  │    Message: agent generates                  ││
│  │                                              ││
│  │ 3. Open Pull Request                         ││
│  │    Template: [.github/PULL_REQUEST_TEMPLATE] ││
│  │    Title: agent generates                    ││
│  │    Labels: [auto-detect ▾]                   ││
│  │    Reviewers: [@team-frontend ▾]             ││
│  │                                              ││
│  │ 4. Merge method: [Squash ▾]                  ││
│  │    Auto-merge: [When CI passes ●]            ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

**YAML Schema:**
```yaml
output:
  target: github
  repository: "${GITHUB_REPO}"
  git_workflow:
    base_branch: main
    branch_naming: "feat/{{slug}}"
    commit_convention: conventional  # conventional | angular | none
    pr:
      template: ".github/PULL_REQUEST_TEMPLATE.md"
      title: { source: agent }
      body: { source: agent }
      labels: auto_detect  # or explicit list
      reviewers: ["@team-frontend"]
      draft: false
    merge:
      method: squash  # merge | squash | rebase
      auto_merge: on_ci_pass  # manual | on_ci_pass | on_approval
    on_conflict: notify  # notify | auto_resolve | fail
```

#### Category D: Plain Output
Simple text/markdown output — the default today.

| Target | Format |
|--------|--------|
| **Chat** | Markdown text (current behavior) |
| **File** | Write to local file (path + format) |
| **Clipboard** | Copy to clipboard |
| **Webhook** | POST JSON to URL |
| **stdout** | CLI pipe output |

These don't need complex schemas — they're the "unstructured" fallback.

### 1.3 Multi-Output

An agent can have **multiple output targets**. The workflow's final step can fan out:

```yaml
output:
  - target: github
    # ... PR workflow
  - target: slack
    # ... notification
  - target: notion
    # ... documentation page
```

In the UI, this shows as multiple OutputNode tiles on the right side of the canvas, each with its own configuration.

### 1.4 Output in the System Prompt

The context assembler generates an `<output>` section that tells the LLM exactly what structure to produce:

```xml
<output>
  You must return a JSON object matching this schema:
  {
    "hubspot_contact": {
      "firstname": "string (required)",
      "lastname": "string (required)",
      "email": "string (required)",
      "company": "string (optional)"
    },
    "slack_notification": {
      "title": "string",
      "summary": "string (max 300 chars)",
      "priority": "P0 | P1 | P2 | P3"
    }
  }
</output>
```

The runtime parses this structured response and routes each piece to its target connector.

### 1.5 Property Source Types

Each field in an output schema has a **source**:

| Source | Meaning |
|--------|---------|
| `agent` | LLM generates this value from context |
| `fixed` | Hardcoded value set at design time |
| `context` | Pulled from input context (user info, trigger data) |
| `input` | From the user's message or trigger payload |
| `computed` | Derived from other fields (e.g., slug from title) |

---

## 2. Memory Architecture

### 2.1 Why Memory Matters

Without memory, an agent:
- Can't reference previous conversations
- Can't learn user preferences over time
- Can't build on prior work
- Can't maintain state across sessions
- Restarts from zero every time

Memory transforms an agent from a **tool** into an **assistant**.

### 2.2 Memory Types

| Type | Scope | Persistence | Example |
|------|-------|-------------|---------|
| **Session** | Current conversation | Until session ends | Chat history, working context |
| **Episodic** | Per-user long-term | Persistent | "Last time we discussed X", "You prefer Y" |
| **Semantic** | Shared knowledge | Persistent | Learned facts, extracted patterns |
| **Procedural** | Skill refinement | Persistent | "This approach worked better than that" |
| **Working** | Active task | Until task completes | Intermediate results, scratchpad |

### 2.3 Memory Node

A new node type on the canvas — sits alongside Knowledge, represents what the agent remembers.

```
┌─ Memory ─────────────────────────────────────────┐
│                                                   │
│  Session Memory                                   │
│  ├─ Window: [Last 20 messages ▾]                  │
│  ├─ Summarize: [After 10 messages ●]              │
│  └─ Strategy: [Sliding window ▾]                  │
│      ○ Full history (expensive)                   │
│      ● Sliding window (last N)                    │
│      ○ Summarize + recent (best of both)          │
│      ○ RAG over history                           │
│                                                   │
│  Long-Term Memory                          [ON ●] │
│  ├─ Store: [Local SQLite ▾]                       │
│  ├─ Index: Vector (embeddings)                    │
│  ├─ Recall: Top-K relevant (k=5)                  │
│  ├─ Write: [Auto-extract key facts ●]             │
│  └─ Scope: [Per-user ▾]                           │
│      ○ Per-user (each user has own memory)        │
│      ○ Per-agent (shared across users)            │
│      ○ Global (shared across agents)              │
│                                                   │
│  Working Memory                                   │
│  ├─ Scratchpad: [Enabled ●]                       │
│  └─ Max size: [2000 tokens ▾]                     │
│                                                   │
│  Memory Stats                                     │
│  ├─ Entries: 147                                  │
│  ├─ Last write: 2h ago                            │
│  └─ [Browse →] [Clear All]                        │
└───────────────────────────────────────────────────┘
```

### 2.4 Memory Strategies

#### Session Memory (Conversation Context)
How the agent handles conversation history within a single session.

```yaml
memory:
  session:
    strategy: summarize_and_recent  # full | sliding_window | summarize_and_recent | rag
    window_size: 20                 # messages to keep in full
    summarize_after: 10             # trigger summarization after N messages
    summary_model: same             # same | fast (cheaper model for summaries)
```

**Strategies:**
- **full** — Keep entire conversation. Simple, expensive for long chats.
- **sliding_window** — Keep last N messages. Loses early context.
- **summarize_and_recent** — Summarize older messages, keep recent in full. Best balance.
- **rag** — Embed all messages, retrieve relevant ones. Best for very long sessions.

#### Long-Term Memory (Cross-Session)
Persistent memory that survives between sessions.

```yaml
memory:
  long_term:
    enabled: true
    store: local_sqlite        # local_sqlite | postgres | redis | custom
    embedding_model: default   # for vector search
    recall:
      strategy: top_k          # top_k | threshold | hybrid
      k: 5                     # number of memories to recall
      min_score: 0.7           # minimum similarity threshold
    write:
      mode: auto_extract       # auto_extract | explicit | both
      extract_types:
        - user_preferences     # "User prefers dark mode"
        - decisions            # "Decided to use React over Vue"
        - facts                # "User's company is Syroco"
        - feedback             # "User said the last summary was too long"
    scope: per_user            # per_user | per_agent | global
    max_entries: 1000
    ttl: null                  # null = forever, or "30d", "1y"
```

#### Working Memory (Task Scratchpad)
Temporary structured storage for multi-step tasks.

```yaml
memory:
  working:
    enabled: true
    max_tokens: 2000
    persist: false             # cleared after task completion
    format: json               # json | markdown | freeform
```

### 2.5 Memory in the System Prompt

The context assembler includes a `<memory>` section:

```xml
<memory>
  <long_term>
    <fact confidence="0.95">User works at Syroco as Head of Product</fact>
    <preference>Prefers concise responses with bullet points</preference>
    <decision date="2026-02-25">Chose React + TypeScript for the Direct Producteur app</decision>
  </long_term>
  <working>
    {"current_task": "reviewing PR #47", "files_reviewed": ["App.tsx", "utils.ts"], "issues_found": 3}
  </working>
</memory>
```

### 2.6 Memory Operations

The agent can perform memory operations via structured output:

```json
{
  "memory_ops": [
    { "op": "remember", "type": "preference", "content": "User prefers French for group communications" },
    { "op": "forget", "id": "mem_123", "reason": "User corrected: they no longer use Vue" },
    { "op": "update", "id": "mem_456", "content": "User's title changed to Head of Product" }
  ]
}
```

### 2.7 Memory vs Knowledge

| Dimension | Knowledge | Memory |
|-----------|-----------|--------|
| **When created** | Design-time (by agent creator) | Runtime (by agent during use) |
| **Who creates** | Human curator | Agent + human |
| **Mutability** | Read-only during sessions | Read-write during sessions |
| **Scope** | Shared across all users | Typically per-user |
| **Content** | Documents, guides, APIs | Facts, preferences, history |
| **Position in chain** | Left side of console (input) | Below/beside knowledge (feedback loop) |

---

## 3. Updated Agent Definition Format

Adding `output` and `memory` sections to `modular-agent.yaml`:

```yaml
version: "1.0"
kind: agent

identity:
  # ... existing fields

instructions:
  # ... existing fields

context:
  # ... existing knowledge, skills, mcp_servers

memory:
  session:
    strategy: summarize_and_recent
    window_size: 20
    summarize_after: 10
  long_term:
    enabled: true
    store: local_sqlite
    recall:
      strategy: top_k
      k: 5
    write:
      mode: auto_extract
      extract_types: [user_preferences, decisions, facts]
    scope: per_user
  working:
    enabled: true
    max_tokens: 2000

output:
  targets:
    - name: github_pr
      target: github
      repository: "${GITHUB_REPO}"
      git_workflow:
        base_branch: main
        branch_naming: "feat/{{slug}}"
        commit_convention: conventional
        pr:
          title: { source: agent }
          body: { source: agent }
          labels: auto_detect
          reviewers: ["${DEFAULT_REVIEWERS}"]
        merge:
          method: squash
          auto_merge: on_ci_pass

    - name: slack_notify
      target: slack
      channel: "${SLACK_CHANNEL}"
      format: blocks
      template: |
        - type: header
          text: "{{title}}"
        - type: section
          text: "{{summary}}"

    - name: notion_doc
      target: notion
      database_id: "${NOTION_DB_ID}"
      template:
        type: default
      properties:
        Title: { source: agent }
        Status: { source: fixed, value: "New" }

workflow:
  # ... existing steps

evaluation:
  # ... existing test_cases, rubric
```

---

## 4. Output Node UI (Canvas)

### Current State
One `ResponseNode` on the right — shows raw text output. No structure.

### Proposed State
Replace with typed `OutputNode`(s). Each output target gets its own node.

```
┌─ OutputNode: HubSpot Contact ─────────────────┐
│  Target: HubSpot  •  Object: Contact           │
│                                                 │
│  Mapped Fields: 5/8                             │
│  ├─ firstname ← agent  ✓                       │
│  ├─ lastname ← agent  ✓                        │
│  ├─ email ← agent  ✓                           │
│  ├─ lifecyclestage ← "lead"  ✓                 │
│  └─ company ← agent  ✓                         │
│                                                 │
│  Associations: 1 (→ Company by domain)          │
│  Dedup: email  •  On dup: Update                │
│                                                 │
│  [⚙ Configure] [▶ Test Output]                  │
└─────────────────────────────────────────────────┘
```

Multiple output nodes can coexist on the canvas (GitHub + Slack + Notion for a single agent).

### Output Test
"Test Output" runs the agent with a sample input and shows what the structured output would look like — validated against the schema, with field-by-field preview.

---

## 5. Connector Registry

Like the MCP registry, we need a **pre-built output connector registry** with schemas for common targets:

```typescript
export const OUTPUT_REGISTRY: Record<string, OutputConnectorDef> = {
  hubspot: {
    name: 'HubSpot',
    icon: '🟠',
    category: 'crm',
    objectTypes: ['contact', 'company', 'deal', 'ticket', 'custom'],
    auth: { type: 'oauth2', scopes: ['crm.objects.contacts.write'] },
    propertySchema: 'dynamic', // fetched from HubSpot API at design-time
  },
  notion: {
    name: 'Notion',
    icon: '📓',
    category: 'docs',
    auth: { type: 'oauth2', scopes: ['insert_content'] },
    supportsTemplates: true,
    propertySchema: 'dynamic', // fetched from Notion database schema
  },
  slack: {
    name: 'Slack',
    icon: '💬',
    category: 'messaging',
    auth: { type: 'oauth2', scopes: ['chat:write'] },
    formats: ['text', 'blocks', 'markdown_text'],
    supportsThreads: true,
    supportsMetadata: true,
  },
  github: {
    name: 'GitHub',
    icon: '🐙',
    category: 'development',
    auth: { type: 'token', env: 'GITHUB_TOKEN' },
    workflows: ['branch_pr', 'direct_commit', 'issue_create', 'comment'],
  },
  linear: {
    name: 'Linear',
    icon: '🔷',
    category: 'project',
    auth: { type: 'token', env: 'LINEAR_API_KEY' },
    objectTypes: ['issue', 'comment', 'project_update'],
  },
  email: {
    name: 'Email',
    icon: '📧',
    category: 'messaging',
    auth: { type: 'smtp' },
    supportsTemplates: true,
    formats: ['html', 'text'],
  },
  webhook: {
    name: 'Webhook',
    icon: '🔗',
    category: 'generic',
    auth: { type: 'none' },
    formats: ['json'],
  },
};
```

---

## 6. Implementation Priority

### Phase 1 (Now — with VK pitch)
1. **OutputNode component** — replaces ResponseNode, supports typed output schemas
2. **Output section in YAML export** — schema definition in `modular-agent.yaml`
3. **MemoryNode component** — session strategy picker (sliding window / summarize / full)
4. **Memory section in YAML export**

### Phase 2 (Post-pitch)
5. **Output connector registry** — pre-built schemas for top 10 targets
6. **Dynamic schema fetching** — connect to HubSpot/Notion APIs to pull real property schemas
7. **Long-term memory store** — local SQLite with vector embeddings
8. **Memory in context assembler** — `<memory>` XML section in system prompt

### Phase 3 (With runtime partner)
9. **Runtime execution** — actually route structured output to targets (this is where VK comes in)
10. **Memory persistence** — cross-session memory storage and retrieval
11. **Template preview** — render Notion/Slack/Email templates in-app

---

*Output is the product. Memory is the soul. Without both, agents are just fancy prompts.*
