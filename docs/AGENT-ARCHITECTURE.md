# Modular Studio: From Patchbay to Agent Platform

## Design Document — v1.0

---

## Executive Summary

Modular Studio has a solid foundation: a mixing-console metaphor that makes context assembly visual and intuitive. But right now it builds **prompts**, not **agents**. The gap between a well-assembled prompt and a useful agent is exactly what Victor identified: instructions, workflow, identity, and evaluation.

This document proposes evolving Modular Studio into two complementary products sharing a single interface, adds four missing layers to the console, defines a portable agent format, and lays out a marketplace strategy. The core thesis: **an agent is a program, not a prompt — and Modular Studio should be the IDE.**

---

## 1. What Makes an Agent (Not Just a Prompt)

The industry conflates "agent" with "system prompt + tools." That's like saying a program is just its imports and a main function. An agent has **five layers**, and Modular Studio currently covers only two of them.

### Layer 1: Context — What the agent knows

This is what Modular Studio does well today. Knowledge nodes (files, URLs, APIs), Skills (procedural SKILL.md files), and MCP servers (tools). Context is the agent's **memory and capabilities** at initialization time.

**Current coverage: ✅ Strong**

### Layer 2: Instructions — Who the agent is

The system prompt, but decomposed into meaningful parts:

- **Persona** — voice, tone, expertise level, personality traits
- **Constraints** — what the agent must NOT do, safety rails, scope limits
- **Objectives** — what the agent is trying to achieve (not just respond to)
- **Response format** — how outputs should be structured

Today, Modular Studio auto-generates a system prompt from the connected nodes. That's useful but passive — the user can't shape the agent's *character* or set behavioral boundaries. The auto-generated prompt is read-only, which means the most important part of agent design (the instructions) is a black box.

**Current coverage: ❌ Missing — this is the biggest gap**

### Layer 3: Workflow — How the agent thinks

An agent without a workflow is reactive — it waits for input and responds. An agent *with* a workflow has a plan:

- **Step sequences** — "First analyze the data, then identify anomalies, then propose fixes"
- **Conditionals** — "If the user provides a URL, scrape it first; if they paste text, skip to analysis"
- **Tool routing** — "Use the search tool for factual questions, the code tool for implementation"
- **Iteration loops** — "Generate, evaluate against criteria, refine until passing"

This is where agents diverge from prompts entirely. A prompt says "you are a code reviewer." A workflow says "1. Read the diff. 2. Check each file against the style guide (use lint tool). 3. Categorize issues by severity. 4. If critical issues found, generate a blocking review. 5. Otherwise, approve with suggestions."

**Current coverage: ❌ Missing**

### Layer 4: Evaluation — How you know it works

Without evaluation, agent building is vibes-based. You assemble a prompt, try it once, and hope. Real agent development needs:

- **Test conversations** — saved input/output pairs that should produce expected behavior
- **A/B comparison** — try two instruction sets against the same inputs
- **Output scoring** — rate responses on criteria (accuracy, tone, completeness)
- **Regression testing** — ensure changes don't break existing behavior

**Current coverage: ❌ Missing**

### Layer 5: Identity — How the agent exists in the world

An agent needs to be a *thing* people can reference, share, and trust:

- **Name and description** — what it does, in plain language
- **Avatar/branding** — visual identity
- **Version history** — what changed and when
- **Author and provenance** — who built it, what it's based on
- **Dependency manifest** — what skills, tools, and knowledge it requires

**Current coverage: ⚠️ Partial — "Save as Agent" exports YAML, but no versioning, identity, or dependency tracking**

### The Agent Equation

```
Agent = Context + Instructions + Workflow + Evaluation + Identity
```

Modular Studio currently builds: `Context + auto-generated prompt = enhanced prompt`

The product needs to build the full equation.

---

## 2. The Two Products

Victor identified two use cases. They're not the same product, but they share 80% of the interface.

### Product A: Agent Builder

**User:** Someone building a reusable agent — for themselves, a team, or a marketplace.

**Flow:**
1. Assemble context (knowledge, skills, MCP tools) — *existing*
2. Define instructions (persona, constraints, objectives) — *new*
3. Design workflow (step plan, conditionals, tool routing) — *new*
4. Test with conversations, iterate — *new*
5. Package with identity, publish — *new*

**Value proposition:** "Build agents visually, test them conversationally, share them instantly."

**Key metric:** Agents created and shared.

### Product B: Context Engineering Studio

**User:** Someone facing a complex one-shot task who needs to assemble the right context.

**Flow:**
1. Assemble context (knowledge, skills, MCP tools) — *existing*
2. Write a detailed prompt — *existing*
3. Select output format — *existing*
4. Get result, iterate on context/prompt — *partially existing*

**Value proposition:** "Assemble exactly the right context for any AI task."

**Key metric:** Tasks completed successfully.

### How They Relate

Product B is a subset of Product A. Context Engineering Studio is Agent Builder without the workflow, evaluation, and identity layers. The mixing console serves both — Product B users simply don't use the Workflow or Evaluation nodes.

**My recommendation: Build Product A. Product B falls out of it for free.**

Product B alone is a feature, not a product. "Assemble context and prompt an LLM" is what every AI playground does, just with worse UX. The differentiation is in the agent layers — that's where the moat is.

However, Product B is the **onboarding ramp** to Product A. New users start by assembling context for a task (Product B), realize they want to save and reuse it (bridge moment), and graduate to building full agents (Product A). The UI should make this graduation feel natural, not like switching modes.

### The Bridge Moment

When a Product B user has assembled context and gotten a good result, Modular Studio should say: "This worked well. Want to save it as an agent? Add a name, refine the instructions, and you've got something reusable."

This is the conversion moment. The console already has everything wired up — adding identity and instructions turns a one-shot context assembly into a persistent agent. No mode switch, no new screen. Just fill in two more nodes.

---

## 3. Concrete UX Proposals

Every new feature must fit the mixing-console metaphor. No flowcharts, no separate screens, no modal wizards. Everything is a node on the board, connected by cables.

### 3.1 Instruction Node

**What it replaces:** The current auto-generated system prompt (read-only).

**What it becomes:** The creative heart of agent design.

**UI Structure:**

The Instruction Node is a wide-format node (takes more horizontal space than others) with four tabbed sections:

**Tab 1: Persona**
- Text field: "You are..." — free-form persona description
- Tone slider: Formal ↔ Casual
- Expertise selector: Beginner-friendly ↔ Expert-level
- Quick templates: "Technical writer," "Code reviewer," "Creative assistant," "Customer support"
- "Speak as" field — name the persona (e.g., "Aria, senior DevOps engineer")

**Tab 2: Constraints**
- Checklist of common constraints with toggles:
  - ☐ Never make up information — cite sources
  - ☐ Ask before taking external actions
  - ☐ Stay within topic scope (define scope below)
  - ☐ Use only provided tools — don't suggest manual steps
  - ☐ Keep responses under N words
- Free-text area for custom constraints
- Scope definition: "This agent handles: ___. It does NOT handle: ___."

**Tab 3: Objectives**
- Primary objective (one sentence): "Help users debug React applications"
- Success criteria (bullet list): What does a good output look like?
- Failure modes (bullet list): What should the agent never do?

**Tab 4: Raw Prompt**
- Full editable system prompt — auto-generated from the other three tabs, but fully editable
- Toggle: "Auto-sync from tabs" / "Manual mode"
- Diff view when tabs and raw prompt diverge

**Cables:**
- Knowledge → Instruction (context informs the prompt)
- Skills → Instruction (skill descriptions get injected)
- MCP → Instruction (tool descriptions get injected)
- Instruction → Workflow (instructions frame the execution plan)
- Instruction → Prompt (for Product B mode — direct to prompt)

**Why this works:** The tabs lower the barrier for non-prompt-engineers. The raw prompt tab respects power users. Auto-sync means you can start with tabs and graduate to raw editing. The node stays within the console metaphor — it's just a bigger channel strip.

### 3.2 Workflow Node

**The design challenge:** Workflows are inherently sequential/branching, which screams "flowchart." But flowcharts break the console metaphor and create a second paradigm users have to learn. The workflow node must stay flat.

**Solution: The Setlist**

Musicians use setlists — ordered lists of songs with annotations. The Workflow Node is a setlist for the agent's execution plan.

**UI Structure:**

A vertical list of steps, each step is a card:

```
┌─────────────────────────────────────┐
│ 1. [Analyze]                        │
│    Action: Read user input           │
│    Tool: —                           │
│    Output: Categorized request       │
│    Condition: Always                 │
├─────────────────────────────────────┤
│ 2. [Research]                        │
│    Action: Search for relevant info  │
│    Tool: web_search (MCP)            │
│    Output: Source list               │
│    Condition: If category = factual  │
├─────────────────────────────────────┤
│ 3. [Generate]                        │
│    Action: Write response            │
│    Tool: —                           │
│    Output: Draft response            │
│    Condition: Always                 │
├─────────────────────────────────────┤
│ 4. [Validate]                        │
│    Action: Check against constraints │
│    Tool: lint_check (MCP)            │
│    Output: Pass/fail + issues        │
│    Condition: If output = code       │
├─────────────────────────────────────┤
│ 5. [Refine]                          │
│    Action: Fix issues from step 4    │
│    Tool: —                           │
│    Output: Final response            │
│    Condition: If step 4 = fail       │
│    Loop: → Step 4 (max 3 times)     │
└─────────────────────────────────────┘
```

Each step card has:
- **Label** — human-readable name (drag to reorder)
- **Action** — what the agent does (free text, concise)
- **Tool** — optional, dropdown of connected MCP tools and skills
- **Output** — what this step produces (used by later steps)
- **Condition** — when this step runs (always, if X, unless Y)
- **Loop** — optional, jump to another step with max iterations

**Cables:**
- MCP → Workflow (tools available for steps)
- Skills → Workflow (skills available for steps)
- Workflow → Instruction (workflow gets compiled into the system prompt as a numbered plan)

**How it compiles:** The workflow doesn't create a DAG runtime. It compiles into structured instructions in the system prompt:

```
## Your Workflow
Follow these steps for every request:
1. **Analyze:** Read the user input and categorize...
2. **Research** (if factual): Use web_search to...
3. **Generate:** Write a response based on...
4. **Validate** (if code output): Run lint_check...
5. **Refine** (if validation fails, max 3 attempts): Fix...
```

This is the key insight: **the workflow is still prompt engineering, just structured.** The LLM follows the plan because it's in the system prompt. No execution engine needed. This keeps Modular Studio simple while adding massive value — structured workflows produce dramatically better results than freeform instructions.

**Advanced (Phase 2):** For agents running on runtimes that support tool-use loops (like OpenClaw, LangChain, CrewAI), the workflow can also export as an execution plan that the runtime orchestrates. But v1 is just better prompt engineering.

### 3.3 Evaluation Panel

**Not a node — a panel.** Evaluation is a mode, not a component in the signal chain. It's where you *use* what you've built.

**UI:** A split panel that slides up from the bottom (like a DAW's mixer view) or occupies the right third of the screen.

**Left side: Conversation Tester**
- Chat interface where you talk to the assembled agent
- Full context is loaded (knowledge, skills, MCP tools, instructions, workflow)
- Conversation history persists across tests
- "Reset" button clears conversation
- "Save as test case" pins an exchange for regression testing

**Right side: Evaluation Tools**

**Test Cases tab:**
- List of saved input → expected-behavior pairs
- "Run all" executes every test case and shows pass/fail
- Pass/fail is initially manual (user marks green/red) — later, automated via rubric

**A/B Compare tab:**
- Two instruction/workflow variants side by side
- Same input goes to both
- Outputs displayed in columns for comparison
- "Pick winner" — logs which variant performed better

**History tab:**
- Every conversation, every test run, timestamped
- Filter by date, by test case, by variant
- Export as dataset (for fine-tuning or analysis)

**Scoring (Phase 2):**
- Define rubric: "Accuracy (1-5), Tone (1-5), Completeness (1-5)"
- Rate each response
- Track scores over time as you iterate on instructions/workflow
- Optional: LLM-as-judge auto-scoring

### 3.4 Agent Identity

**Where it lives:** A compact node in the top-left of the console, always visible. Think of it as the "master channel" — the project header.

**UI Structure:**

```
┌──────────────────────────┐
│  [Avatar]  Agent Name    │
│           v1.2.0         │
│                          │
│  One-line description    │
│                          │
│  Tags: #code #review     │
│  Author: victor          │
│  Status: Draft / Published│
│                          │
│  [Save] [Publish] [Fork] │
└──────────────────────────┘
```

Fields:
- **Avatar** — upload or generate (integrate with an image gen API for fun)
- **Name** — required, URL-safe slug auto-generated
- **Version** — semver, auto-incremented on save, manual bump for major changes
- **Description** — one paragraph, shown in marketplace
- **Tags** — freeform, used for marketplace search
- **Author** — from user profile
- **Status** — Draft (local only), Published (in marketplace), Archived
- **README** — expandable markdown area for longer documentation

**Cables:** None — Identity doesn't flow into the signal chain. It wraps it.

---

## 4. Agent Definition Format

The agent definition is what gets saved, shared, and loaded. It must be:
- **Human-readable** — YAML, editable by hand if needed
- **Portable** — no absolute paths, no embedded secrets
- **Declarative** — describes what the agent needs, not how to wire it up
- **Versionable** — works in git

### Schema (YAML)

```yaml
# modular-agent.yaml
version: "1.0"
kind: agent

identity:
  name: "react-code-reviewer"
  display_name: "React Code Reviewer"
  description: "Reviews React/TypeScript PRs with focus on performance, accessibility, and best practices."
  avatar: "./assets/avatar.png"       # relative path, bundled
  author: "victor"
  tags: ["code-review", "react", "typescript"]
  license: "MIT"
  agent_version: "1.2.0"

instructions:
  persona: |
    You are Aria, a senior React engineer with 8 years of experience.
    You're thorough but kind — you explain why something matters, not just what's wrong.
    You prefer functional components, hooks, and composition over inheritance.
  constraints:
    - "Never approve code with accessibility violations"
    - "Flag but don't block stylistic preferences"
    - "Always suggest a concrete fix, not just identify the problem"
    - "Stay within React/TypeScript scope — don't review backend code"
  objectives:
    primary: "Help developers write better React code through constructive review"
    success_criteria:
      - "Every issue includes a code suggestion"
      - "Critical vs minor issues are clearly separated"
      - "Review can be directly posted as a PR comment"
  response_format: "markdown"
  raw_prompt: null  # If set, overrides structured fields above

context:
  knowledge:
    - type: "file"
      ref: "./knowledge/react-style-guide.md"
    - type: "file"
      ref: "./knowledge/a11y-checklist.md"
    - type: "url"
      ref: "https://react.dev/reference/rules"
      refresh: "weekly"
  skills:
    - ref: "clean-code"
      source: "skills.sh"            # marketplace reference
    - ref: "./skills/react-patterns"  # local/bundled skill
  mcp_servers:
    - name: "github"
      description: "GitHub API access for PR diffs and comments"
      transport: "stdio"
      command: "npx @modelcontextprotocol/server-github"
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"   # resolved from env at runtime
    - name: "eslint"
      description: "Run ESLint on code snippets"
      transport: "stdio"
      command: "npx @mcp/eslint-server"

workflow:
  steps:
    - id: "analyze"
      action: "Read the PR diff and identify changed files"
      condition: "always"
    - id: "categorize"
      action: "Categorize each change: new feature, refactor, bug fix, style"
      condition: "always"
    - id: "review-a11y"
      action: "Check all JSX changes against accessibility checklist"
      tool: "eslint"
      condition: "if jsx files changed"
    - id: "review-perf"
      action: "Identify performance issues: unnecessary re-renders, missing memoization, large bundles"
      condition: "always"
    - id: "review-patterns"
      action: "Check against React style guide and patterns skill"
      condition: "always"
    - id: "synthesize"
      action: "Compile findings into structured review with critical/major/minor categories"
      condition: "always"
    - id: "format"
      action: "Format as GitHub PR review comment with inline code suggestions"
      condition: "always"

evaluation:
  test_cases:
    - name: "catches-missing-key-prop"
      input: |
        Review this diff:
        + {items.map(item => <Item name={item.name} />)}
      expected_behavior: "Should flag missing key prop on mapped elements"
    - name: "approves-clean-code"
      input: |
        Review this diff:
        + const UserCard: React.FC<UserCardProps> = memo(({ user }) => {
        +   return <article aria-label={`Profile for ${user.name}`}>...
      expected_behavior: "Should approve with minor or no suggestions"
  rubric:
    - criterion: "Accuracy"
      weight: 3
    - criterion: "Actionability"
      weight: 2
    - criterion: "Tone"
      weight: 1

# Dependency resolution
requirements:
  skills:
    - name: "clean-code"
      source: "skills.sh"
      version: ">=1.0.0"
  mcp_servers:
    - name: "github"
      package: "@modelcontextprotocol/server-github"
      version: ">=0.5.0"
  models:
    recommended: "claude-sonnet-4-20250514"
    minimum_context: 100000
```

### What's Portable vs Local

| Layer | Portable | Local |
|-------|----------|-------|
| Identity | ✅ Name, description, version, avatar | Author profile link |
| Instructions | ✅ Everything | — |
| Knowledge (files) | ✅ Bundled in package | Absolute paths |
| Knowledge (URLs) | ✅ URL references | — |
| Knowledge (APIs) | ⚠️ API schema, not keys | API keys, tokens |
| Skills (marketplace) | ✅ Reference by name+version | — |
| Skills (local) | ✅ Bundle in package | — |
| MCP servers | ✅ Package name, config schema | Env vars, API keys |
| Workflow | ✅ Everything | — |
| Evaluation | ✅ Test cases, rubric | Historical scores |

**Packaging:** An agent is distributed as a `.modular` file (just a zip):
```
react-code-reviewer.modular
├── modular-agent.yaml
├── assets/
│   └── avatar.png
├── knowledge/
│   ├── react-style-guide.md
│   └── a11y-checklist.md
└── skills/
    └── react-patterns/
        └── SKILL.md
```

### Environment Variables

Secrets are NEVER in the agent definition. MCP servers reference `${ENV_VAR}` which the runtime resolves. When importing an agent, Modular Studio prompts: "This agent needs GITHUB_TOKEN. Set it in your environment or paste it here (stored locally, never shared)."

---

## 5. Marketplace Evolution

### Core Concept

The marketplace is a **registry of agent definitions** — not a runtime. Users browse, install, and customize agents locally. Think npm for agents.

### Browse Experience

```
┌────────────────────────────────────────────────────────────┐
│  🔍 Search agents...                    [Filter ▾] [Sort ▾]│
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ [Avatar]     │ │ [Avatar]     │ │ [Avatar]     │      │
│  │ React        │ │ Email        │ │ Data         │      │
│  │ Reviewer     │ │ Drafter      │ │ Analyst      │      │
│  │              │ │              │ │              │      │
│  │ ★★★★☆ (47)  │ │ ★★★★★ (124) │ │ ★★★★☆ (89)  │      │
│  │ by victor    │ │ by sarah     │ │ by team-x    │      │
│  │              │ │              │ │              │      │
│  │ Skills: 2    │ │ Skills: 1    │ │ MCP: 3       │      │
│  │ MCP: 1       │ │ MCP: 0       │ │ Skills: 4    │      │
│  │              │ │              │ │              │      │
│  │ [Use] [Fork] │ │ [Use] [Fork] │ │ [Use] [Fork] │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Key Actions

**Use** — Loads the agent into your console. If it requires skills or MCP servers you don't have, prompts to install them. Immediate — you can start chatting with the agent in seconds.

**Fork** — Copies the agent definition to your workspace. You now own a variant. Your changes don't affect the original. The fork retains a link to the parent for provenance.

**Publish** — Upload your agent to the marketplace. Requires: name, description, at least one test case. Free tier: 5 agents. Pro tier: unlimited + analytics.

**Rate** — Star rating (1-5) + optional text review. Only users who've actually used the agent can rate it (tracked via "Use" action).

### Dependency Resolution

When an agent references external dependencies:

```yaml
requirements:
  skills:
    - name: "clean-code"
      source: "skills.sh"
```

The marketplace checks if the user has the skill installed. If not:
- **Auto-install:** Skills from skills.sh are free and open — install automatically with a confirmation
- **MCP servers:** Show install command, link to docs, prompt for required env vars
- **Missing knowledge:** If bundled, extract. If URL, fetch. If API, prompt for credentials

### Marketplace Revenue Model (Opinion)

Don't charge for agents. Charge for:
1. **Pro features** — unlimited agents, analytics (views, uses, forks), priority listing
2. **Teams** — shared agent libraries, collaborative editing, private marketplace
3. **Runtime** — if Modular Studio offers hosted agent execution (API endpoints for agents), charge per-call

Free marketplace with premium creator tools. The marketplace's value scales with agent count — keep the barrier to publishing at zero.

### Agent Composition

Phase 3 feature: agents that reference other agents. A "Full PR Review" agent might compose:
- React Code Reviewer (for frontend)
- Python Linter (for backend)
- Security Scanner (for all files)

This creates a dependency graph of agents. The marketplace tracks these dependencies. When you fork a composite agent, you get the full tree.

---

## 6. Implementation Roadmap

### Phase 1: Foundation (4-6 weeks)
**Goal:** Make the current product useful enough that people save agents and come back.

**Build:**
1. **Instruction Node** — persona, constraints, objectives tabs + raw prompt editor. This is the highest-leverage feature. Today, the most important part of agent design is auto-generated and read-only. Fixing this alone transforms the product.

2. **Agent Identity Node** — name, description, version, avatar. Minimal viable identity so agents feel like *things*, not configurations.

3. **Conversation Tester** — the left panel of the Evaluation Panel. Just a chat interface that uses the assembled agent context. This is also Product B's main output — users can immediately interact with what they've built.

4. **Improved "Save as Agent"** — save the full definition (including new instruction fields) as YAML in the proposed schema.

**Validate:** Can users build an agent that feels meaningfully different from just typing a prompt into ChatGPT? If yes, Phase 1 worked.

**Key metrics:**
- % of sessions that reach the "Save" action
- Return rate (users who load a saved agent in a later session)
- Time from open to first test conversation

### Phase 2: Core Value (6-10 weeks)
**Goal:** Make agents reusable, testable, and shareable. This is where Modular Studio becomes defensible.

**Build:**
1. **Workflow Node** — the setlist UI. Steps, conditions, tool references. Compiles to structured system prompt instructions.

2. **Test Cases** — save input/expected-behavior pairs. "Run all" for regression testing. Manual pass/fail marking.

3. **A/B Comparison** — two instruction variants, same input, side-by-side output. This is a killer feature for iterative agent design.

4. **Export/Import** — `.modular` package format. Export an agent as a file, share it, import someone else's.

5. **Fork flow** — open someone's exported agent, modify it, save as your own variant with provenance link.

**Validate:** Are users iterating on agents? Are they sharing `.modular` files? Is the workflow node actually improving output quality vs. freeform prompts?

**Key metrics:**
- Average iterations per agent (saves after first save)
- Number of test cases per agent
- Export/import volume
- A/B comparison usage

### Phase 3: Marketplace (8-12 weeks)
**Goal:** Network effects. Other people's agents become your acquisition channel.

**Build:**
1. **Marketplace backend** — agent registry, search, ratings, user profiles
2. **Publish flow** — from console to marketplace in two clicks
3. **Browse and install** — search, filter, one-click "Use" with dependency resolution
4. **Fork on marketplace** — fork directly from browse, shows fork count
5. **Analytics for creators** — views, uses, forks, ratings dashboard
6. **Agent composition** — reference other marketplace agents as sub-agents

**Validate:** Is the marketplace generating organic discovery? Are users finding and using agents they didn't create?

**Key metrics:**
- Marketplace agents published
- Organic installs (not from the creator)
- Fork rate (high fork rate = agents are useful but customizable)
- Creator retention (do publishers keep updating?)

### What NOT to Build

- **Visual flowchart editor** — breaks the metaphor, adds complexity, and LLM-based agents don't need DAG execution engines. The setlist approach is better.
- **Agent runtime/hosting** — not yet. Focus on the authoring experience. Let runtimes (OpenClaw, LangChain, etc.) consume the `.modular` format. Build a runtime only if Phase 3 validates demand.
- **Fine-tuning integration** — too early, too complex, and the evaluation data needs to exist first. Phase 3 evaluation data could feed into this as a Phase 4 feature.
- **Multi-agent orchestration UI** — agent composition in Phase 3 is enough. A full multi-agent graph editor is a different product.

---

## Closing: The Opinionated Take

Modular Studio's mixing-console metaphor is genuinely good. Most agent builders either look like Zapier (boring flowcharts) or look like a chatbot playground (no structure). The console is creative, visual, and different.

But the metaphor only works if every piece of agent design can be a node or a panel on the console. The moment you add a separate "workflow editor" screen or a "prompt engineering wizard," you've lost the magic.

The path forward:
1. **Instruction Node makes agents feel intentional** (not auto-generated)
2. **Workflow Node makes agents feel structured** (not freeform)
3. **Evaluation Panel makes agent design feel rigorous** (not vibes-based)
4. **Identity makes agents feel real** (not disposable)
5. **Marketplace makes agents feel valuable** (not isolated)

Each layer multiplies the value of the others. An agent with good instructions but no workflow is a chatbot. An agent with a workflow but no evaluation is untested. An agent with everything but no marketplace is solo. The full stack is where the product becomes defensible.

Build the Instruction Node first. It's the biggest gap, the highest leverage, and it's something users will feel immediately. Everything else follows from there.

---

*Document by Claw, for Victor. Modular Studio design v1.0 — February 2026.*
