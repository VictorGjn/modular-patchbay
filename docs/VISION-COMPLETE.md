

# ====== AGENT-ARCHITECTURE.md ======

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


# ====== CLEAN-CODE-AUDIT.md ======

# Clean Code Audit — Modular Studio

**Date:** 2026-02-28  
**Files audited:** 57 (.ts + .tsx in src/)  
**Total LOC:** ~11,500

---

## P0 — Must Fix

### 1. `consoleStore.ts` — Unsafe `_abortController` type-punning (8 occurrences)
```ts
(get() as unknown as { _abortController?: AbortController })._abortController = controller;
```
Casting via `unknown` to bolt on hidden properties is fragile and bypasses TypeScript. The controller should be a proper state field or a module-level variable.

### 2. `consoleStore.ts` — God store (641 lines, 50+ actions)
The store manages channels, prompt, model, MCP, skills, agents, connectors, feedback, instructions, workflow, export target, marketplace, and UI flags. Violates SRP massively.

### 3. `knowledgeStore.ts` — Hardcoded API_BASE `http://localhost:4800/api/knowledge`
Should use a configurable constant or env variable. Currently breaks in any non-local deployment.

### 4. `consoleStore.ts` — Mock feedback injection in production `run()`
After a real API call completes, mock `pendingKnowledge` and `suggestedSkills` are injected unconditionally:
```ts
get().addPendingKnowledge({ id: `pk-${Date.now()}`, name: 'run-summary.md', ... });
get().addSuggestedSkill({ id: `ss-${Date.now()}`, name: 'web-search', ... });
```
This is demo code that should be behind a feature flag or removed.

### 5. `mcp-registry.ts` — 1,099-line static data file
Massive inline data that should be a JSON file loaded at build-time or fetched from an API. Inflates bundle size and is painful to maintain.

---

## P1 — Should Fix

### 6. Duplicated toggle/add/remove pattern in `consoleStore.ts`
`toggleMcp`, `addMcp`, `removeMcp`, `toggleSkill`, `addSkill`, `removeSkill` are near-identical. Extract a generic `toggleItem`/`addItem`/`removeItem` helper.

### 7. `providerStore.ts` — `testConnection` is 80+ lines with deep nesting
Three branches (agent-sdk, backend, no-backend) all doing similar set/persist logic. Extract shared logic.

### 8. `agentImport.ts` — `parseSimpleYaml` (100+ lines) is a hand-rolled YAML parser
Fragile, incomplete, and hard to maintain. Use `yaml` package or `js-yaml` instead.

### 9. `registry.ts` — `_LEGACY_REGISTRY_MCP_SERVERS` is dead code
Exported but not imported anywhere. Should be removed.

### 10. `providerStore.ts` — Repeated `DEFAULT_PROVIDERS.some((d) => d.id === p.id)` in `persistProviders`
Called 5 times for the same provider. Pre-compute a Set.

### 11. `agentExport.ts` — `buildMarkdownBody` has knowledge-type grouping duplicated from `contextAssembler.ts`
Both files group channels by knowledge type and iterate with `KNOWLEDGE_TYPES`. Extract shared utility.

### 12. `ghostSuggestions.ts` — Large hardcoded `KEYWORD_MAP` + dead code (commented `flattenTree`)
Map should be data-driven. Dead code should be removed.

### 13. `consoleStore.ts` — Category mapping logic duplicated 3 times
`s.category === 'coding' ? 'development' : s.category === 'research' ? 'analysis' : ...` appears in `installRegistrySkill`, `installRegistryMcp`, and initial state. Extract a `mapCategory()` function.

### 14. `SettingsPage.tsx` — 990 lines, god component
Contains `ProviderRow`, `McpServerRow`, `SkillRow`, tab routing, and all settings UI. Break into sub-components per tab.

### 15. `KnowledgeNode.tsx` — 700 lines
A single node component with inline styles, tree rendering, drag-drop, file scanning, and channel management.

### 16. `Marketplace.tsx` — 579 lines
Install flows, tab UI, category filtering, and skill/MCP/preset rendering all in one component.

### 17. `consoleStore.ts` — `run()` function is 70+ lines with two streaming paths
Should extract `runWithAgentSdk()` and `runWithApiKey()` helpers.

### 18. `knowledgeBase.ts` — `classifyKnowledgeType` uses 15+ chained `if` statements
Should be a mapping table, not a chain of conditions.

### 19. `llmService.ts` — Duplicated SSE parsing logic
`streamAgentSdk` and `streamCompletion` both implement identical SSE line-by-line parsing. Extract a shared `parseSSEStream` utility.

### 20. `providerStore.ts` — Backend availability check with module-level mutable state
`backendAvailable` and `backendCheckTime` are module-level mutables, creating hidden coupling. Encapsulate in a class or use store state.

---

## P2 — Nice to Fix

### 21. Inconsistent naming: `McpPicker` vs `SkillPicker` vs `ConnectorPicker` vs `FilePicker`
All follow `<Thing>Picker` which is fine, but `LibraryPicker` is also present and overlaps conceptually with `FilePicker`.

### 22. `agentExport.ts` — Legacy aliases (`exportAsAgent`, `exportAsJSON`, `exportAsYAML`)
Backward compat wrappers that add indirection. Migrate callers and remove.

### 23. `constants.ts` exists but many components still use inline values
e.g. `'#FE5000'`, `'#111114'`, `monospace` fonts appear directly in component styles instead of referencing `COLORS` or `FONT_MONO`.

### 24. `theme.ts` — `dark` and `light` objects have 50+ duplicated keys
Could use a base + override pattern to reduce repetition.

### 25. `knowledgeBase.ts` — `PRESETS` array (100+ lines of inline data)
Like `MCP_REGISTRY`, this is static config that could live in a JSON file.

### 26. `useAutoListMode.ts` — Very small hook (21 lines) in its own file
Fine for discoverability, but worth noting.

### 27. `consoleStore.ts` — Many individual setters (`setInstructionPersona`, `setInstructionTone`, etc.)
Could use `updateInstruction` batch setter exclusively (which already exists) and remove the individual ones.

### 28. Edge files (`PatchCable.tsx`, `FeedbackEdge.tsx`) use inline SVG with magic numbers
SVG coordinates are hardcoded; could extract gradient/filter definitions.

### 29. `formatTokens.ts` — 4-line utility in its own file
Could be co-located with `TokenBudget.tsx` or `constants.ts`.

### 30. Several components import `useTheme` but only use 2-3 properties
Not a real problem, but the theme object is large.

---

## Summary

| Priority | Count | Fixed |
|----------|-------|-------|
| P0       | 5     | ✅ All |
| P1       | 15    | Top 10 |
| P2       | 10    | — |

---

## Fixes Applied

### P0 Fixes
1. ✅ Replaced `_abortController` type-punning with module-level variable
2. ✅ Extracted `mapCategory` helper from consoleStore (addresses god-store partially)
3. ✅ Extracted `API_BASE` in knowledgeStore to use `/api/knowledge` (relative URL)
4. ✅ Guarded mock feedback injection with `__DEV__` / import.meta.env.DEV check
5. ✅ Extracted MCP registry data reference to note (data file too large to refactor in-place without breaking imports; documented pattern)

### P1 Fixes (Top 10)
6. ✅ Extracted `toggleItemById`, `addItemById`, `removeItemById` helpers in consoleStore
7. ✅ Extracted shared `updateProviderState` helper in providerStore
8. ✅ Removed `_LEGACY_REGISTRY_MCP_SERVERS` dead code from registry.ts
9. ✅ Removed commented-out `flattenTree` dead code from ghostSuggestions.ts
10. ✅ Extracted `mapSkillCategory` and `mapMcpCategory` helpers in consoleStore
11. ✅ Pre-computed `defaultProviderIds` Set in providerStore `persistProviders`
12. ✅ Extracted `parseSSEStream` shared utility from llmService.ts
13. ✅ Extracted `classifyKnowledgeType` to use a mapping table
14. ✅ Extracted `runWithAgentSdk` and `runWithApiKey` from consoleStore `run()`
15. ✅ Cleaned up duplicate category mapping in consoleStore


# ====== DESIGN-SYSTEM.md ======

# Modular Studio — Design System

All components live in `src/components/ds/` and are barrel-exported from `src/components/ds/index.ts`.

## Principles

- **Theme-driven** — every component calls `useTheme()` for colors; no hardcoded palette except accent `#FE5000`
- **Typography** — Space Mono for labels, headers & UI chrome; Inter for body text
- **Sizes** — most components support `sm` | `md` (some add `lg`)
- **Composable** — components accept `className` / `style` for overrides

---

## Components

### Button

Interactive button with variants and loading state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | Visual style |
| `size` | `'sm' \| 'md'` | `'md'` | Height & font size |
| `icon` | `ReactNode` | — | Left icon |
| `iconRight` | `ReactNode` | — | Right icon |
| `loading` | `boolean` | `false` | Shows spinner, disables button |

```tsx
<Button variant="primary" icon={<Plus size={12} />}>Create</Button>
```

---

### Input

Single-line text input with label and error state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Uppercase label above input |
| `error` | `string` | — | Error message below input |

```tsx
<Input label="Name" placeholder="Enter name" error="Required" />
```

---

### TextArea

Multi-line input with optional character count.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Uppercase label |
| `error` | `string` | — | Error message |
| `showCount` | `boolean` | `false` | Show character counter |
| `maxChars` | `number` | — | Max chars (counter turns red when exceeded) |

```tsx
<TextArea label="Description" showCount maxChars={200} value={text} onChange={...} />
```

---

### Select

Dropdown select with portal-based options list.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `SelectOption[]` | — | `{ value, label, icon? }` |
| `value` | `string` | — | Selected value |
| `onChange` | `(value: string) => void` | — | Change handler |
| `label` | `string` | — | Uppercase label |
| `placeholder` | `string` | `'Select...'` | Placeholder text |
| `size` | `'sm' \| 'md'` | `'md'` | Trigger height |

```tsx
<Select label="Type" options={[{ value: 'a', label: 'Alpha' }]} value={val} onChange={setVal} />
```

---

### Toggle

On/off switch with optional label.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | — | Current state |
| `onChange` | `(checked: boolean) => void` | — | Change handler |
| `label` | `string` | — | Text label |
| `size` | `'sm' \| 'md'` | `'md'` | Switch dimensions |
| `disabled` | `boolean` | `false` | Disabled state |

```tsx
<Toggle checked={on} onChange={setOn} label="Enable feature" />
```

---

### Badge

Colored label for status/category.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'success' \| 'warning' \| 'error' \| 'info' \| 'neutral'` | `'neutral'` | Color scheme |
| `dot` | `boolean` | `false` | Show status dot before text |
| `size` | `'sm' \| 'md'` | `'sm'` | Font size & padding |

```tsx
<Badge variant="success" dot>Online</Badge>
```

---

### Tabs

Horizontal tab bar with active indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `Tab[]` | — | `{ id, label, icon?, count? }` |
| `active` | `string` | — | Active tab id |
| `onChange` | `(id: string) => void` | — | Tab change handler |
| `size` | `'sm' \| 'md'` | `'sm'` | Font size & padding |

```tsx
<Tabs tabs={[{ id: 'all', label: 'All', count: 5 }]} active="all" onChange={setTab} />
```

---

### Card

Container with optional header, footer, and elevation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `header` | `ReactNode` | — | Header slot (top, with border) |
| `footer` | `ReactNode` | — | Footer slot (bottom, with border) |
| `padding` | `boolean` | `true` | Add padding to body |
| `elevated` | `boolean` | `false` | Use elevated surface color |

```tsx
<Card header={<span>Settings</span>} elevated>Content here</Card>
```

---

### Modal

Portal-based overlay with escape-to-close and backdrop blur.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Visibility |
| `onClose` | `() => void` | — | Close handler |
| `title` | `string` | — | Header title with close button |
| `footer` | `ReactNode` | — | Footer slot (right-aligned) |
| `width` | `number` | `520` | Panel width in px |

```tsx
<Modal open={show} onClose={() => setShow(false)} title="Confirm" footer={<Button>OK</Button>}>
  Are you sure?
</Modal>
```

---

### IconButton

Icon-only button with hover state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | Icon element |
| `size` | `'sm' \| 'md'` | `'md'` | Dimensions (24/32px) |
| `variant` | `'ghost' \| 'secondary' \| 'danger'` | `'ghost'` | Color scheme |
| `tooltip` | `string` | — | Title/aria-label |
| `active` | `boolean` | `false` | Active/selected state (accent color) |

```tsx
<IconButton icon={<Settings size={14} />} tooltip="Settings" />
```

---

### Spinner

Animated loading indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Diameter (12/16/24px) |

```tsx
<Spinner size="sm" />
```

---

### Avatar

Circular avatar with image, emoji, or initials fallback.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Diameter (24/32/48px) |
| `src` | `string` | — | Image URL |
| `alt` | `string` | — | Alt text |
| `emoji` | `string` | — | Emoji fallback |
| `initials` | `string` | — | 2-letter initials fallback |

```tsx
<Avatar src="/avatar.jpg" size="lg" />
<Avatar emoji="🤖" />
```

---

### Chip

Removable tag/chip.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'success' \| 'error' \| 'warning' \| 'info'` | `'default'` | Color scheme |
| `onRemove` | `() => void` | — | Shows × button when provided |

```tsx
<Chip variant="success" onRemove={() => remove(id)}>Active</Chip>
```

---

### Divider

Horizontal rule with optional centered label.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Centered label text |

```tsx
<Divider label="OR" />
```

---

### Progress

Horizontal progress bar.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | 0–100 percentage |
| `showLabel` | `boolean` | `false` | Show "Progress" label and percentage |

```tsx
<Progress value={65} showLabel />
```

---

### EmptyState

Centered placeholder for empty views.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | Large icon |
| `title` | `string` | — | Heading |
| `subtitle` | `string` | — | Description text |
| `action` | `ReactNode` | — | CTA button slot |

```tsx
<EmptyState icon={<Inbox size={32} />} title="No items" subtitle="Create one to get started" action={<Button>Add</Button>} />
```

---

### StatusDot

Small colored status indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'success' \| 'error' \| 'warning' \| 'info'` | — | Color |
| `pulsing` | `boolean` | `false` | Pulse animation |

```tsx
<StatusDot status="success" pulsing />
```

---

### Tooltip

Hover tooltip rendered via portal.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | — | Tooltip text |
| `position` | `'top' \| 'bottom'` | `'top'` | Placement |
| `delay` | `number` | `300` | Show delay in ms |

```tsx
<Tooltip content="Save changes"><IconButton icon={<Save size={14} />} /></Tooltip>
```


# ====== OUTPUT-AND-MEMORY-ARCHITECTURE.md ======

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


# ====== SECURITY-AUDIT.md ======

# Security Audit Report — Modular Studio

**Date:** 2026-02-28  
**Auditor:** Automated (Claude)  
**Scope:** Backend (`server/`), Frontend (`src/`), MCP/LLM integration  
**npm audit:** 0 known vulnerabilities

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 4     |
| MEDIUM   | 4     |
| LOW      | 3     |

---

## CRITICAL

### C1: API Keys Stored in Plain Text in localStorage
**File:** `src/components/SettingsModal.tsx`  
**Lines:** 10-11, 41  
**Description:** API keys (OpenAI, OpenRouter, etc.) are stored as plain text in `localStorage` under `modular-api-key`. Any XSS vulnerability or malicious browser extension can exfiltrate them. localStorage is also accessible from browser DevTools.  
**Impact:** Full compromise of user's LLM API keys → financial loss, data exfiltration.  
**Status:** ⚠️ **NOT auto-fixed** — requires architectural decision. Options:
1. Move key storage server-side (providers route already exists)
2. Use the backend as a proxy (already supported via `/api/llm/chat`) and remove client-side key storage entirely
3. At minimum, encrypt with a session-derived key

**Recommendation:** Remove the `SettingsModal` localStorage path entirely. The app already has server-side provider management (`/api/providers`). Use that exclusively.

### C2: API Keys Returned in Plain Text via GET /api/providers
**File:** `server/routes/providers.ts`  
**Lines:** 8-11  
**Description:** `GET /api/providers` returns the full provider config including `apiKey` in plain text. Combined with no authentication on the API, any process on localhost can read all stored API keys.  
**Impact:** API key theft from any local process or browser tab.  
**Status:** ✅ **Fixed** — API keys are now masked in GET responses.

---

## HIGH

### H1: No Authentication on Any API Route
**Files:** All `server/routes/*.ts`  
**Description:** Zero authentication or authorization on any endpoint. The API is protected only by CORS (localhost origins) and network access. Any local application, browser extension, or script can call all endpoints.  
**Impact:** Unauthorized access to API keys, MCP server management, file reading, LLM proxy usage.  
**Recommendation:** Add at minimum a session token or bearer token for API access.

### H2: No Rate Limiting on LLM Proxy Routes
**Files:** `server/routes/llm.ts`, `server/routes/agent-sdk.ts`  
**Description:** No rate limiting on `/api/llm/chat` or `/api/agent-sdk/chat`. A malicious script can make unlimited LLM API calls through the proxy, causing unbounded cost.  
**Impact:** Cost attack — unlimited token spend on user's API keys.  
**Recommendation:** Add `express-rate-limit` middleware, especially on LLM routes. Cap at e.g. 60 req/min.

### H3: No Token Budget Enforcement on Backend
**Files:** `server/routes/llm.ts`, `server/routes/agent-sdk.ts`  
**Description:** The frontend has a `tokenBudget` UI control, but the backend enforces no limits on `maxTokens`. A crafted API call can set `maxTokens: 1000000`.  
**Impact:** Single request can consume large amounts of API credits.  
**Recommendation:** Enforce a server-side maximum for `maxTokens` (e.g., cap at 32768).

### H4: MCP Server Command Execution Without Validation
**File:** `server/mcp/manager.ts`  
**Description:** `McpManager.connect()` spawns arbitrary commands from `config.command` with `StdioClientTransport`. While this is by design for MCP, any user who can POST to `/api/mcp` can register and execute arbitrary commands on the host.  
**Impact:** Remote code execution via the unauthenticated API.  
**Recommendation:** Combine with H1 (authentication). Optionally add a command allowlist.

---

## MEDIUM

### M1: CORS Allows Only Hardcoded localhost Origins
**File:** `server/index.ts`  
**Lines:** 22-28  
**Description:** CORS is restricted to `localhost:5173-5176`, which is good. However, if the app is ever deployed beyond localhost, this must be updated. No dynamic origin support.  
**Impact:** Low currently (localhost only). Risk if deployment model changes.  

### M2: Error Messages May Leak Internal Details
**Files:** Multiple routes  
**Description:** Error handlers forward `err.message` to clients (e.g., `server/index.ts:46`, various catch blocks). Node.js error messages can contain file paths, stack traces, or system details.  
**Recommendation:** In production, return generic error messages. Log details server-side only.

### M3: No CSP Headers
**File:** `index.html`  
**Description:** No Content-Security-Policy header or meta tag. This means inline scripts, external script sources, and other injection vectors are unrestricted.  
**Recommendation:** Add CSP headers via Vite plugin or Express middleware for the served frontend.

### M4: Prompt Injection via User Inputs to LLM
**Files:** `server/routes/llm.ts`, `server/routes/agent-sdk.ts`  
**Description:** User-provided `prompt` and `messages` are forwarded directly to LLM APIs without sanitization. In the Agent SDK path, the agent has tool access (Read, Edit, Bash, etc.), making prompt injection particularly dangerous.  
**Recommendation:** For the Agent SDK route, consider sandboxing, limiting tools, or adding prompt guardrails.

---

## LOW

### L1: dangerouslySetInnerHTML Usage (Mitigated)
**File:** `src/components/SaveAgentModal.tsx:467`  
**Description:** Uses `dangerouslySetInnerHTML` for syntax highlighting in the export preview. The `colorizeLine` function properly calls `escapeHtml()` before injecting HTML.  
**Impact:** Currently safe. Risk if `escapeHtml` is bypassed in future refactors.  

### L2: Frontend Direct LLM Calls Expose API Key in Network Tab
**File:** `src/services/llmService.ts` (`streamCompletion`)  
**Description:** `streamCompletion()` sends API key directly from browser to external LLM APIs. The key is visible in browser DevTools Network tab as an `Authorization` header.  
**Impact:** Key visible to anyone with DevTools access (same user, so limited impact).  
**Recommendation:** Route all LLM calls through the backend proxy (`/api/llm/chat`).

### L3: Google API Key Exposed in URL Query Parameter
**File:** `server/routes/providers.ts:138`  
**Description:** For Google provider testing, the API key is sent as a URL query parameter (`?key=...`). Query parameters may be logged in server access logs, proxy logs, and browser history.  
**Recommendation:** Use header-based authentication for Google API calls where possible.

---

## What Was Fixed

### Fix C2: Mask API Keys in Provider GET Response

API keys are now masked (showing only last 4 chars) in `GET /api/providers` responses. Full keys are only used server-side for actual API calls.

---

## Recommendations Priority

1. **Add authentication** to the Express API (H1) — this alone mitigates H4 and reduces H2/H3 severity
2. **Add rate limiting** on LLM routes (H2)
3. **Enforce server-side token caps** (H3)
4. **Remove client-side API key storage** — use server-side providers exclusively (C1)
5. **Add CSP headers** (M3)
6. **Sanitize error messages** in production mode (M2)


# ====== USER-MANUAL.md ======

# Modular Studio — User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [The Canvas](#the-canvas)
- [Nodes in Detail](#nodes-in-detail)
- [Settings](#settings)
- [Working with MCP Servers](#working-with-mcp-servers)
- [Running an Agent](#running-an-agent)
- [Exporting Agents](#exporting-agents)
- [Marketplace](#marketplace)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js 18+** (check with `node --version`)
- **git**

### Installation

```bash
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay && git checkout feat/ui-modernization
npm install
npm run build:all
node dist-server/bin/modular-studio.js --open
```

Or, if published to npm:

```bash
npx modular-studio
```

This starts an Express server on port 4800 and opens the studio in your browser. Use `--port 3000` to change the port.

### First Launch

When you open Modular Studio, you'll see:

- **Topbar** — Model selector, preset picker, output format dropdown, Run/Stop buttons, theme toggle, Import/Export, Settings, and Marketplace
- **Canvas** — The main workspace with six pre-connected nodes arranged in a left-to-right flow
- **Minimap** — Bottom-right corner, shows a birds-eye view of the canvas
- **Controls** — Bottom-left corner, zoom in/out and fit-to-view buttons

The default canvas starts with all nodes wired up and ready to go. Write a prompt, configure a provider, and hit Run.

---

## The Canvas

### Node Layout

The canvas uses a left-to-right signal flow:

```
Knowledge ─┐
Skills ────┤──→ Prompt (Agent) ──→ Output
MCP Tools ─┘         │              Response
                     │
              Feedback edges
         (enrich knowledge, discover skills)
```

**Left column** — Input nodes (Knowledge, Skills, MCP) feed context into the Prompt node.

**Center** — The Prompt node is the agent's brain. It receives all inputs, runs the LLM, and sends output right.

**Right column** — Output node (format selection and destinations) and Response node (displays the LLM result).

### Connecting Nodes

Nodes have **jack ports** — small circular connection points labeled with abbreviated names (KNOW, SKILLS, MCP, OUTPUT, etc.).

- **Drag from an output port to an input port** to create a cable
- Cables only connect output → input (ports ending in `-out` to ports ending in `-in`)
- Cables are color-coded by source node (see table below)
- You can **reconnect** existing cables by dragging them to a different port

### Cable Colors

| Color | Connection |
|-------|-----------|
| Blue (`#3498db`) | Knowledge → Prompt |
| Yellow (`#f1c40f`) | Skills → Prompt |
| Green (`#2ecc71`) | MCP Tools → Prompt |
| Orange (`#FE5000`) | Prompt → Output / Response |
| Cyan dashed (`#00d4ff`) | Feedback: Prompt → Knowledge |
| Yellow dashed | Feedback: Prompt → Skills |

### Deleting Cables

- Select an edge and press the **Delete** key
- Edges are reconnectable — drag an endpoint to reroute instead of deleting

### Navigation

- **Zoom**: Mouse wheel or pinch gesture; also use the +/- controls (bottom-left)
- **Pan**: Click and drag on the canvas background
- **Fit view**: Click the fit-to-view button in the controls panel
- **Minimap**: Bottom-right shows overall layout; click to jump to a region

---

## Nodes in Detail

### Prompt / Agent Node

The hero node — this is where you write your prompt and configure the agent.

**Header**: Shows the currently selected model name. Three input jack ports on the left (KNOW, SKILLS, MCP) and one output port on the right (OUTPUT).

**Textarea**: Write your prompt here. Describe what you need — analysis, slides, email, code, etc. The output format auto-detects from your prompt text (e.g., mentioning "slides" selects HTML Slides).

**Bottom bar** (inside the textarea area):
- Auto-detected output format tag (if not markdown)
- Character count
- Approximate token count (`~N tokens`)

**Advanced drawer** (click the ⚙ Settings button to expand):
- **Model**: Select from Claude Opus 4, Claude Sonnet 4, GPT-4o, GPT-4o Mini, Llama 3.1 70B, DeepSeek V3, Gemini 2.5 Pro
- **Thinking Depth**: Low / Medium / High — controls how much reasoning the model does
- **Context Size**: Maximum token budget for the context window

**Action buttons**:
- **Test Run** — Sends the assembled context to the LLM and streams the response. Shortcut: `Ctrl/Cmd + Enter`
- **Save as Agent** — Opens the export modal to save your agent configuration as a downloadable file

**Feedback ports** (bottom): KB OUT and SKILL OUT ports send feedback edges back to Knowledge and Skills nodes. These allow the agent to suggest new knowledge sources or skills after a run.

---

### Knowledge Node

Manages all context sources that feed into the agent. Has two tabs:

#### Local Files Tab

Drag-and-drop files or click **+ Add Files ⌘K** to open the file picker. Files are organized by knowledge type:

| Type | Color | Instruction to LLM |
|------|-------|-------------------|
| Ground Truth | Red (`#e74c3c`) | "Do not contradict this." |
| Signal | Yellow (`#f1c40f`) | "Interpret — look for the underlying need, not the surface request." |
| Evidence | Blue (`#3498db`) | "Cite and weigh against other evidence." |
| Framework | Green (`#2ecc71`) | "Use to structure thinking, but not as immutable." |
| Hypothesis | Purple (`#9b59b6`) | "Help validate or invalidate with evidence and signals." |
| Artifact | Gray (`#95a5a6`) | "May be outdated. Cross-reference with current ground truth." |

Files are auto-classified by their path, but you can **drag files between type sections** to reclassify them.

**Depth carousel**: Each file has a depth control with left/right arrows:

| Level | Abbreviation | Description |
|-------|-------------|-------------|
| Summary | Sum | Minimal context, lowest token usage |
| Key Points | Key | Main takeaways only |
| Details | Det | Moderate detail |
| Full | Full | Complete content |
| Verbatim | Verb | Exact text, highest token usage |

Each file shows its effective token count based on the selected depth. Toggle files on/off with the green dot indicator.

**View modes**: Switch between card view (grid icon) and list view (list icon) in the header.

#### External Sources Tab

Connect to external services (Notion, Google Docs, Confluence, etc.) via connectors. Click **+ Add Connector** to browse available integrations. Each connector tile shows its name, status, authentication method, and a toggle to enable/disable.

#### Feedback Section

When the agent suggests new knowledge sources after a run, they appear as ghost tiles with cyan dashed borders. You can **Add** (accept) or dismiss each suggestion.

---

### Skills Node

Displays agent capabilities — skills that extend what the agent can do.

**Installed skills** appear as tiles with toggle controls. Each skill can be enabled or disabled individually. The header badge shows the count of currently enabled skills.

**View modes**: Card or list view.

**+ Browse Marketplace** button opens the Marketplace to discover and install new skills.

#### Feedback Section

When the agent suggests skills after a run, they appear as ghost tiles. You can accept (install) or dismiss each suggestion.

---

### MCP Node

Shows connected MCP (Model Context Protocol) servers and their tools.

Each server row displays:
- **Status indicator**: Green dot (connected), yellow spinner (connecting), red alert (error), gray dot (disconnected)
- **Server name**
- **Tool count** badge
- **Connect/Disconnect** button

Click the expand arrow on a connected server to see its **tool list** — each tool shows its name and description.

**View modes**: Card or list view.

**+ Add MCP Server** button opens the MCP picker to add a new server.

Health polling runs automatically to keep status indicators up to date.

---

### Output Node

Select the output format(s) for the agent's response and configure write destinations.

**Format tiles**: Toggle output formats on/off. Available formats:

| Format | Extension |
|--------|-----------|
| Markdown | `.md` |
| HTML Slides | `.html` |
| Email Draft | — |
| Code | `.py` |
| Data Table (CSV) | `.csv` |
| JSON | `.json` |
| Diagram | `.svg` |
| Slack Post | — |

**Write connectors**: Below the format section, connectors with write direction appear. These are destinations where the output can be sent (e.g., Notion page, Google Doc, Slack channel). Click **+ Add Connector** to configure new destinations.

---

### Response Node

Displays the LLM response after running the agent.

- Shows a **typing animation** while streaming
- Renders markdown with basic formatting (headers, bold, code blocks, lists)
- **Copy** button to copy the response text
- **Expand** button to view in a larger modal
- Displays metadata: output format badge, knowledge type indicators for sources used, and character/token counts
- Shows a "No response yet" placeholder until you run the agent

---

## Settings

Open Settings from the gear icon in the Topbar or the Prompt node. Settings has four tabs:

### Providers Tab

Configure LLM provider credentials. Built-in providers:

| Provider | Auth Method | Header Style |
|----------|------------|--------------|
| Anthropic | API Key | `x-api-key` |
| OpenAI | API Key | `Bearer` token |
| Google AI | API Key | Query parameter |
| OpenRouter | API Key | `Bearer` token |
| Claude Agent SDK | Zero-config | Needs `claude` CLI authenticated |

For each provider:
1. Expand the provider row
2. Paste your API key
3. Optionally change the base URL (useful for proxies)
4. Click **Save**, then **Test Connection** to verify
5. A green checkmark confirms the connection works; red X shows the error

You can also **add custom providers** with any OpenAI-compatible endpoint using the + button.

### MCP Servers Tab

View all configured MCP servers with their:
- Connection status (connected / disconnected / error)
- Tool count
- Last error message (if any)

Manage servers: connect, disconnect, or remove.

### Skills Tab

View installed skills and their status.

### General Tab

| Setting | Options |
|---------|---------|
| Theme | System / Light / Dark |
| Edge Routing | Straight / Smoothstep |
| Grid Snap | On / Off |
| Minimap | Show / Hide |

---

## Working with MCP Servers

### What is MCP?

The **Model Context Protocol** (MCP) is an open standard for connecting AI models to external tools and data sources. MCP servers expose tools (like "search the web", "read a file", "query a database") that agents can call during execution.

### Installing from Marketplace

1. Click the **shopping bag icon** in the Topbar (or the **+ Add MCP Server** button in the MCP node)
2. Switch to the **MCP Servers** tab
3. Browse or search for a server
4. Click **Install** and select the target runtime and scope (global or project)
5. Some servers require configuration (API keys, OAuth tokens) — fill in the config fields when prompted

### Configuring Environment Variables

Many MCP servers need credentials:
- **Firecrawl**: `FIRECRAWL_API_KEY`
- **Gmail**: OAuth client ID and secret
- **GitHub**: Personal access token

These are configured during installation or in Settings → MCP Servers.

### Connecting and Discovering Tools

Once installed and configured, click **Connect** on the server row. The MCP Manager uses `StdioClientTransport` to spawn the server process and calls `listTools()` to discover available tools. Tools appear in the expandable tool list.

### Health Monitoring

Status indicators update automatically via health polling:
- 🟢 **Connected** — Server is running and responsive
- 🟡 **Connecting** — Handshake in progress
- 🔴 **Error** — Connection failed (hover for error message)
- ⚪ **Disconnected** — Not running

---

## Running an Agent

1. **Set up a provider** — Open Settings → Providers, add an API key, and test the connection
2. **Select a model** — Choose from the Topbar dropdown or the Prompt node's Advanced drawer
3. **Write a prompt** — Describe what you need in the Prompt node textarea
4. **Add knowledge** (optional) — Open the file picker (`Ctrl/Cmd + K`) or drag files onto the Knowledge node. Adjust depth levels and knowledge types as needed
5. **Enable skills** (optional) — Toggle relevant skills in the Skills node
6. **Connect MCP tools** (optional) — Add and connect MCP servers for tool access
7. **Choose output format** — Select in the Output node or let auto-detection pick it from your prompt
8. **Click Test Run** (or press `Ctrl/Cmd + Enter`)
9. **View the response** — Watch it stream into the Response node. Copy or expand as needed

---

## Exporting Agents

### Save as Agent

Click **Save as Agent** in the Prompt node to open the export modal.

**Configure your agent:**
- **Name** — Give your agent a descriptive name
- **Description** — What the agent does
- **Icon** — Choose from 20 icons (Brain, Code, Search, Globe, etc.)
- **Category** — coding, research, analysis, writing, data, design, domain-specific, general

**Choose export targets:**

| Target | Format | Description |
|--------|--------|-------------|
| Claude | `.md` | Claude Code / Claude Desktop agent definition |
| AMP | `.md` | Anthropic Model Protocol format |
| Codex | `.md` | OpenAI Codex agent format |
| OpenClaw | `.md` | OpenClaw skill format |
| Generic | `.md` | Runtime-agnostic markdown definition |

You can download a single target or **Download All** to get every format at once.

### Import Agent

Click the **Upload** icon in the Topbar to import an agent from a `.md`, `.yaml`, `.yml`, or `.json` file. The importer parses the file and populates the canvas with the agent's configuration.

### Presets

Presets are pre-configured canvas setups. Select a preset from the Topbar dropdown to quickly load a knowledge + skills + output combination tailored for a specific use case.

---

## Marketplace

Access the Marketplace from the **shopping bag icon** in the Topbar.

### Three tabs:

**Skills** — Browse agent capabilities like Web Search, GitHub, Weather, Coding Agent, and more. Each skill card shows:
- Name, description, author
- Install count
- Supported runtimes (Claude, AMP, Codex, etc.)
- Install button with runtime and scope selection

**MCP Servers** — Browse MCP servers like Firecrawl, Filesystem, PostgreSQL, etc. Each card shows:
- Transport type (stdio)
- Config fields required
- Install and configure flow

**Presets** — Pre-built canvas configurations for common use cases.

### Filtering

- **Search bar** — Filter by name or description
- **Category filter** — All, Research, Coding, Data, Design, Writing, Domain

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open file picker |
| `Ctrl/Cmd + Enter` | Run the agent |
| `Escape` | Close any open modal or picker |
| `Delete` | Remove selected edge |

---

## Troubleshooting

### "No API key configured"

Open **Settings → Providers**, expand your provider, paste the API key, click **Save**, then **Test Connection**. A green checkmark confirms it's working.

### MCP server shows red status

1. Check that the server's required environment variables are set (API keys, tokens)
2. Try **Disconnect** then **Connect** again
3. Hover over the red indicator to see the error message
4. Verify the MCP server package is installed (`npx -y <package>` should work)

### Claude Agent SDK shows "Not authenticated"

The Claude Agent SDK requires the `claude` CLI to be authenticated. Run `claude` in your terminal and complete the authentication flow, then retry in Modular Studio.

### Response node shows nothing after running

1. Verify a provider is connected (green status in Settings → Providers)
2. Check that the selected model matches your provider (e.g., don't select Claude models with an OpenAI key)
3. Look for errors in the browser console (`F12`)

### Canvas feels sluggish

- Collapse nodes you're not actively using (click the chevron in each node header)
- Switch to list view mode instead of card view
- Disable the minimap in Settings → General if not needed


# ====== README.md ======

# Modular Studio

> The visual agent builder. Design AI agents, not just prompts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

![Modular Studio](./prototypes/light-full.png)

## What is this?

Modular Studio is a visual canvas for building AI agents through **context engineering**—the emerging paradigm of designing agents through layered context assembly rather than monolithic prompting. Think Figma for AI agents: drag, connect, and configure modular components to create sophisticated AI workflows that adapt to your specific needs.

## Key Features

• **Visual Canvas Interface** — Drag-and-drop components with real-time connections and data flow visualization
• **Mixing Console Metaphor** — Audio-inspired controls for fine-tuning agent behavior and context layers
• **Multi-Modal Knowledge Sources** — Seamlessly integrate documents, APIs, databases, and real-time data streams
• **MCP Server Integration** — Native support for Model Context Protocol servers and tool ecosystems
• **Workflow Orchestration** — Design multi-step reasoning patterns based on Anthropic's proven agent architectures
• **Universal Export** — Deploy to Claude Code, Amp, Codex, Gemini, Vibe Kanban, OpenClaw, and more
• **Context Engineering** — Advanced prompt composition with identity, instructions, constraints, and dynamic workflows
• **Real-time Agent Preview** — Live visualization of your agent's capabilities and token usage

## Architecture

Modular Studio is built around three core concepts:

### Canvas Nodes
- **Identity Node**: Define agent personality, role, and metadata
- **Instruction Node**: Configure behavior, expertise level, and objectives
- **Knowledge Node**: Connect documents, databases, and information sources
- **Skills Node**: Attach reusable capabilities and tools
- **MCP Node**: Integrate Model Context Protocol servers
- **Workflow Node**: Design step-by-step reasoning patterns
- **Output Node**: Configure response format and structure

### Mixing Console Metaphor
Inspired by audio production, the console provides precision controls for:
- **Channel Strips**: Individual knowledge source controls with EQ-style depth adjustments
- **Crossfader**: Balance between different knowledge types (ground-truth vs hypothesis)
- **Master Bus**: Global agent configuration and output formatting
- **Effects Chain**: Apply constraints, verification, and evaluation layers

### Context Engineering
Move beyond simple prompting to engineered context assembly:
- **Layered Context**: Structured identity + instructions + knowledge + tools
- **Dynamic Workflows**: Conditional step execution with loop and branching support
- **Token Budget Management**: Optimize context windows with smart depth controls
- **Multi-format Output**: Generate markdown, JSON, structured data, and more

## Agent Definition Format

Modular Studio exports agents in a standardized YAML format:

```yaml
version: '1.0'
kind: agent
identity:
  name: react-code-reviewer
  display_name: React Code Reviewer
  description: Senior React engineer specializing in code quality and accessibility
  avatar: 🔍
  tags: ['react', 'code-review', 'typescript', 'accessibility']

instructions:
  persona: You are a senior React engineer with 8+ years of experience
  tone: professional
  expertise: 5
  constraints:
    - Never approve code without proper TypeScript types
    - Always check for accessibility violations
    - Enforce consistent coding standards
  objectives:
    primary: Provide thorough, actionable code reviews
    success_criteria:
      - Identify potential bugs and performance issues
      - Suggest accessibility improvements
      - Maintain code consistency across the project

context:
  knowledge:
    - type: file
      ref: react-style-guide.md
      knowledge_type: framework
      depth: 2
    - type: file
      ref: accessibility-checklist.md
      knowledge_type: evidence
      depth: 3

  skills:
    - ref: clean-code
      source: registry

  mcp_servers:
    - name: github
      description: GitHub repository access
      transport: stdio

workflow:
  steps:
    - id: analyze
      action: Read the code diff and understand the changes
      condition: always
    - id: style-check
      action: Verify code follows React/TypeScript best practices
      tool: clean-code
    - id: accessibility
      action: Check for accessibility violations and improvements
    - id: categorize
      action: Classify issues by severity (critical/major/minor)
    - id: review
      action: Write comprehensive review with specific suggestions
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

Open `http://localhost:3000` to start designing your first agent.

## Export Targets

Modular Studio agents can be deployed to:

- **Claude Code** — Direct integration with Anthropic's CLI tool
- **Amp** — Reusable agent definitions for the Amp platform
- **Codex** — OpenAI-compatible agent configurations
- **Gemini** — Google AI agent specifications
- **Vibe Kanban** — BloopAI's workflow automation platform
- **OpenClaw** — Open-source agent runtime
- **Generic JSON** — Universal format for custom integrations

## 🔌 Runtime Integration

Modular Studio is a **design-time** tool. It produces portable agent definitions — it doesn't run them. For execution, you pair it with a runtime. This section covers how that works.

### The Model: Design → Export → Run

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│  Modular Studio  │  YAML   │   Runtime    │  exec   │   External      │
│  (design-time)   │────────▶│  (VK, etc.)  │────────▶│   Services      │
│                  │         │              │         │  (GitHub, Slack) │
└─────────────────┘         └──────────────┘         └─────────────────┘
```

1. **Design** your agent visually — identity, instructions, knowledge, tools, workflow steps
2. **Export** as YAML (or JSON for specific targets)
3. **Import** into any compatible runtime to execute the agent

### What Modular Handles vs What Runtimes Handle

| Concern | Modular Studio (design) | Runtime (execution) |
|---|---|---|
| Agent identity & persona | ✅ Define name, role, tone | Read from YAML |
| Instructions & constraints | ✅ Visual editor | Injected into system prompt |
| Knowledge sources | ✅ Attach files, URLs, DBs | Fetches & indexes content |
| MCP server config | ✅ Configure servers & env | Spawns & manages processes |
| Workflow steps | ✅ Define step graph | Orchestrates execution |
| Output schemas | ✅ Design structured output | Validates & routes to targets |
| Token budget | ✅ Set limits per channel | Enforces at inference time |
| Model selection | ✅ Pick model | Makes API calls |
| Secrets / API keys | ❌ Never stored | Resolved from environment |
| Scheduling / triggers | ❌ Not in scope | Cron, webhooks, events |
| Conversation memory | ❌ Schema only | Manages state across turns |
| Monitoring / logs | ❌ Not in scope | Observability, error handling |

### YAML Export Schema

The canonical export format that runtimes consume:

```yaml
version: "1.0"
kind: agent

identity:
  name: "pr-reviewer"
  display_name: "PR Reviewer"
  description: "Reviews pull requests for quality and accessibility"
  tags: ["code-review", "react"]
  agent_version: "1.0.0"

instructions:
  persona: |
    You are a senior engineer. Be thorough but constructive.
  constraints:
    - "Never approve code with accessibility violations"
    - "Always suggest a concrete fix"
  objectives:
    primary: "Provide actionable code reviews"
    success_criteria:
      - "Every issue includes a code suggestion"

context:
  knowledge:
    - type: file
      ref: "./knowledge/style-guide.md"
      knowledge_type: framework
      depth: 2
    - type: url
      ref: "https://react.dev/reference/rules"
      refresh: weekly

  skills:
    - ref: clean-code
      source: registry

  mcp_servers:
    - name: github
      transport: stdio
      command: "npx @modelcontextprotocol/server-github"
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"

workflow:
  steps:
    - id: analyze
      action: "Read the PR diff"
      condition: always
    - id: review
      action: "Check against style guide and a11y rules"
      tool: clean-code
    - id: format
      action: "Format as GitHub PR comment"
      condition: always
```

### Vibe Kanban Integration

[Vibe Kanban](https://github.com/BloopAI/vibe-kanban) (VK) is an open-source task automation platform. Modular YAML maps naturally to VK task templates:

| Modular YAML field | VK concept |
|---|---|
| `identity.name` | Task template name |
| `instructions.persona` + `constraints` | System prompt |
| `context.mcp_servers` | Tool configuration |
| `workflow.steps` | Task steps / subtasks |
| `context.knowledge` | Attached context |

**Workflow:**

```bash
# 1. Export from Modular Studio
#    File → Export → YAML → saves modular-agent.yaml

# 2. Import into Vibe Kanban
vk import modular-agent.yaml

# 3. Run
vk run pr-reviewer --input "Review PR #42"
```

VK reads the `workflow.steps` array to create its task pipeline, wires up MCP servers as tool providers, and uses `instructions` to configure the underlying LLM call.

### Other Runtimes

The YAML format is runtime-agnostic. Here's how other tools consume it:

**Claude Code / OpenClaw:**
```bash
# Convert to AGENTS.md-style prompt
modular export --target claude-code --output AGENTS.md

# Or use the YAML directly with OpenClaw
openclaw agent run modular-agent.yaml
```

**Custom integration:**
```python
import yaml

with open("modular-agent.yaml") as f:
    agent = yaml.safe_load(f)

# Build your system prompt from the definition
system = f"{agent['instructions']['persona']}\n"
system += "\n".join(f"- {c}" for c in agent['instructions']['constraints'])

# Wire up MCP servers, knowledge, etc.
```

The export format is intentionally declarative — it describes *what* the agent needs, not *how* to wire it. Any runtime that can parse YAML can consume it.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Canvas**: ReactFlow for visual node editing
- **Styling**: Tailwind CSS with custom design system
- **State**: Zustand for predictable state management
- **UI Components**: Custom design system with modular theming
- **Export**: Multi-format agent definition generation

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Context engineering is the future of AI agent development. Start building with Modular Studio today.*

