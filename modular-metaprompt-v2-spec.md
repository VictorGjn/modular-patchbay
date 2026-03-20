# Modular Studio — Metaprompt V2 Spec
## "Research-Augmented Agent Generation"

**Author:** Claw (spec), Victor (direction)
**Date:** 2026-03-20
**Status:** Draft — ready for implementation
**Branch target:** `feat/metaprompt-v2`

---

## Problem Statement

Modular's current metaprompt generates agents by single-shot LLM completion. When a user references an expert ("Teresa Torres") or methodology ("RICE framework"), the metaprompt treats them as **persona attributes** ("you are an expert who uses Torres") rather than **research tasks** ("find Torres' framework, decompose it into executable steps, embed those steps in the workflow").

This produces agents that *name-drop* frameworks instead of *operationalizing* them. The output reads like a job description, not an operating system.

---

## Design Principles

1. **A named expert is a research task, not a credential.** Every reference to a person or methodology triggers a research-decompose-embed pipeline.
2. **Domain-agnostic.** The metaprompt works for PMs, engineers, lawyers, marketers, doctors — anyone. It doesn't assume PM frameworks.
3. **Context is curated, not dumped.** Documents are classified by access pattern (always-loaded, on-demand, compressed) rather than blindly injected.
4. **Workflow patterns are selected, not defaulted.** The agent's workflow should match one of the proven agentic patterns (chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer) — not always be sequential.
5. **Agents are self-checking.** Every generated agent includes a verification step that ensures frameworks were actually applied.

---

## Architecture

### Pipeline Overview

```
User Input → [Phase 1: Parse] → [Phase 2: Research] → [Phase 3: Pattern Select]
           → [Phase 4: Context Strategy] → [Phase 5: Assemble] → [Phase 6: Evaluate]
           → Agent YAML Output
```

This is an **orchestrator-workers** pattern internally: the metaprompt LLM orchestrates, and tool calls (web search, knowledge base lookups) are the workers.

### Phase 1 — Parse & Classify

**Input:** User's natural language description of the agent they want.

**Process:** Extract structured entities from the input.

```yaml
extraction_schema:
  role:
    description: "What the agent IS (KAM, PM, analyst, coach...)"
    type: string
    
  domain:
    description: "Industry/field context (maritime, fintech, healthcare...)"
    type: string
    
  named_experts:
    description: "People referenced as methodology sources"
    type: array[string]
    detection_rule: >
      Any person's name mentioned in context of expertise, methodology,
      framework, approach, or thinking style. NOT clients, NOT stakeholders.
    examples:
      - "Teresa Torres" → expert
      - "Louis Dreyfus" → client (NOT expert)
      
  named_methodologies:
    description: "Explicitly named frameworks/methods"
    type: array[string]
    examples: ["RICE", "JTBD", "OKR", "Kano model", "Design Thinking"]
    
  implied_methodologies:
    description: "Methods implied but not named"
    type: array[string]
    detection_rule: >
      Phrases like "prioritize features", "extract pain points",
      "map opportunities" imply specific methodologies even if not named.
    examples:
      - "extract feature requests" → implies JTBD + pain point analysis
      - "prioritize roadmap" → implies RICE/ICE/MoSCoW
      
  tools_requested:
    description: "MCP servers, skills, or capabilities mentioned"
    type: array[string]
    
  documents:
    description: "Files/URLs the user wants the agent to access"
    type: array[{path, inferred_type, size_estimate}]
    
  success_criteria:
    description: "What 'done well' looks like"
    type: array[string]
    
  constraints:
    description: "What the agent must NOT do"
    type: array[string]
    
  output_expectations:
    description: "Artifacts the user expects"
    type: array[string]
```

**Output:** Structured extraction object.

**Implementation note:** This is a single LLM call with structured output (JSON mode). The prompt should include 3-4 diverse examples (PM agent, coding agent, legal agent, marketing agent) so the parser generalizes across domains.

---

### Phase 2 — Research & Decompose

**Input:** `named_experts[]` and `named_methodologies[]` from Phase 1.

**Process:** For each reference, conduct tool-augmented research.

#### 2a. Expert Resolution

For each person in `named_experts`:

```
SEARCH: "[Name] framework methodology core steps"
SEARCH: "[Name] [domain] approach"
```

Extract from search results:
```yaml
expert_framework:
  expert_name: "Teresa Torres"
  framework_name: "Opportunity Solution Tree / Continuous Discovery Habits"
  core_concept: >
    Start with a desired outcome, map opportunities (unmet needs),
    branch into solutions, identify assumptions, design tests.
  steps:
    - step: "Define desired outcome"
      input: "Business objective or metric"
      process: "Frame as measurable outcome, not feature"
      output: "Outcome statement: [role] achieves [outcome] measured by [metric]"
    - step: "Map opportunities"
      input: "Customer interviews, transcripts, pain points"
      process: "Cluster needs into opportunity areas, prioritize by frequency and severity"
      output: "Opportunity tree with branches"
    - step: "Generate solutions"
      input: "Each opportunity"
      process: "Brainstorm 2-3 solutions per opportunity, avoid converging too early"
      output: "Solution candidates per opportunity"
    - step: "Identify assumptions"
      input: "Each solution"
      process: "What must be true for this to work? Rank by risk."
      output: "Riskiest assumption per solution"
    - step: "Design assumption tests"
      input: "Riskiest assumptions"
      process: "Smallest possible experiment to validate"
      output: "Test plan: prototype, data pull, interview question, or pilot"
  decision_rules:
    - "Never skip from opportunity straight to solution"
    - "Always generate multiple solutions before picking one"
    - "Test assumptions before building"
  artifacts:
    - "Opportunity Solution Tree (visual or structured)"
    - "Assumption map with risk ratings"
```

#### 2b. Methodology Resolution

For each item in `named_methodologies`:

```
SEARCH: "[Methodology] framework scoring criteria steps"
```

Extract:
```yaml
methodology:
  name: "RICE"
  purpose: "Feature prioritization"
  mechanics:
    inputs: ["Feature list", "Usage data", "Confidence level", "Engineering estimate"]
    formula: "Score = (Reach × Impact × Confidence) / Effort"
    scoring:
      reach:
        description: "Number of users/customers affected in a given period"
        scale: "Absolute number or percentage"
      impact:
        description: "Effect on individual user"
        scale: "3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal"
      confidence:
        description: "How sure are we about Reach, Impact, and Effort estimates"
        scale: "100% = high, 80% = medium, 50% = low"
      effort:
        description: "Person-months (or person-weeks) to build"
        scale: "Whole numbers, round up"
    output: "Ranked table of features by RICE score"
    decision_rules:
      - "Items with Confidence < 50% should be validated before prioritizing"
      - "RICE is a starting point — override with strategic judgment when justified"
```

#### 2c. Implied Methodology Enrichment

For each item in `implied_methodologies`:
- Map it to the most relevant known framework
- Apply the same decomposition
- Flag it as "inferred — confirm with user if critical"

#### 2d. Conflict Resolution

When multiple frameworks cover the same concern (e.g., RICE and ICE both prioritize features):

```yaml
conflict_resolution:
  concern: "feature prioritization"
  frameworks: ["RICE", "ICE"]
  resolution: >
    Use RICE as primary (more granular). If the user also mentioned ICE,
    note: "ICE can be used as a quick-check; RICE for final prioritization."
  rule: "The first-mentioned framework takes precedence unless the user specifies otherwise"
```

**When research fails:**
```yaml
research_failure:
  expert_name: "Carl Velloti"
  status: "partial"
  note: >
    ⚠️ Could not find a widely-documented framework attributed to Carl Velloti.
    Found references to product management content but no canonical methodology.
    Included as domain expertise reference only. Consider: did you mean Carl Vellotti
    (two t's) or a specific framework name?
```

**Implementation:** This phase uses web search (Fetch MCP or native search tool). Each expert/methodology gets 2-3 search queries. Results are parsed and structured by the LLM. Total: ~2-6 tool calls depending on input complexity.

**Fallback without search:** If web search is unavailable, the LLM uses its training knowledge but flags confidence level: "Based on training data (not live research). Verify framework accuracy."

---

### Phase 3 — Workflow Pattern Selection

**Input:** Role, domain, success criteria, decomposed frameworks.

**Process:** Select the optimal agentic workflow pattern based on Anthropic's taxonomy.

```yaml
pattern_selection_rules:

  prompt_chaining:
    use_when:
      - "Task decomposes into fixed sequential steps"
      - "Each step's output feeds the next"
      - "Quality gates between steps add value"
    example: "Analyze transcript → Extract features → Prioritize → Format report"
    signals_in_user_input:
      - "step by step"
      - "first... then... finally..."
      - "pipeline"
      
  routing:
    use_when:
      - "Input type varies significantly"
      - "Different inputs need different handling"
    example: "Meeting transcript vs. feature spec vs. customer email → different analysis"
    signals_in_user_input:
      - "different types of"
      - "depending on"
      - "classify and handle"
      
  parallelization:
    use_when:
      - "Independent subtasks can run simultaneously"
      - "Multiple perspectives improve quality"
    example: "Score feature on RICE AND Kano AND strategic fit simultaneously"
    signals_in_user_input:
      - "evaluate from multiple angles"
      - "cross-reference"
      
  orchestrator_workers:
    use_when:
      - "Can't predict subtasks upfront"
      - "Scope depends on input"
    example: "Analyze a codebase where # of files to touch is unknown"
    signals_in_user_input:
      - "whatever is needed"
      - "figure out what to do"
      - "dynamic"
      
  evaluator_optimizer:
    use_when:
      - "Output quality needs iteration"
      - "Clear evaluation criteria exist"
      - "First draft is rarely good enough"
    example: "Draft strategy memo → critique → refine → critique → finalize"
    signals_in_user_input:
      - "iterate"
      - "refine"
      - "high quality"
      - "polished"

  hybrid:
    use_when:
      - "Complex agent that combines patterns"
    example: "Prompt chain for main flow, with evaluator-optimizer on the final output"
```

**Output:** Selected pattern + justification + suggested step structure.

**For the LDC KAM agent example:** The correct pattern is **prompt chaining with an evaluator-optimizer tail** — sequential analysis steps, with a self-check loop at the end.

---

### Phase 4 — Context Strategy

**Input:** Documents list, role, frameworks needed.

**Process:** Classify each document by access pattern.

```yaml
context_classification:

  always_loaded:
    criteria:
      - "Agent needs this in every interaction"
      - "Small enough to fit comfortably (< 2000 tokens)"
      - "Reference data: org structure, key definitions, constraints"
    placement: "reads[] in agent config (system context)"
    examples:
      - "Company org chart"
      - "Product glossary"
      - "Competitive landscape summary"
      
  on_demand:
    criteria:
      - "Needed only for specific queries"
      - "Large documents (transcripts, full reports)"
      - "Multiple documents where only one is relevant per query"
    placement: "Available via MCP Filesystem or retrieval tool"
    instruction_to_agent: "Use [tool] to read [document] when analyzing [trigger]"
    examples:
      - "Meeting transcripts (load only the one being analyzed)"
      - "Historical reports"
      
  compressed:
    criteria:
      - "Useful background but too large to include raw"
      - "Summary captures 80%+ of value"
    placement: "Pre-summarized in reads[], full version in on-demand"
    examples:
      - "Full codebase docs → architecture summary"
      - "100-page report → executive summary + key data points"
      
  never_loaded:
    criteria:
      - "Doesn't serve the agent's purpose"
      - "Duplicates another document"
    action: "Exclude from config, note why"
```

**Token budget awareness:**
```yaml
token_budget_rules:
  - "Calculate estimated tokens for all always_loaded documents"
  - "If total > 60% of token_budget, demote largest to on_demand"
  - "If total > 80%, warn user: 'Token budget too tight for loaded context. Recommend increasing to [N] or moving [doc] to on-demand retrieval.'"
  - "Reserve at least 25% of budget for agent reasoning + output"
```

**Output:** Classified document list with placement strategy.

---

### Phase 5 — Assembly

**Input:** All outputs from phases 1-4.

**Process:** Generate the final agent YAML config.

#### 5a. Persona (max 3 sentences)

```
Rule: The persona is WHO the agent is. Not what it does.
No framework names. No methodology lists.
Just: role + domain + expertise level + working style.
```

Bad: "You combine the analytical frameworks of Teresa Torres, Carl Velloti..."
Good: "You are a strategic key account manager at Syroco specializing in maritime enterprise clients. You think in outcomes, not features, and you never accept a feature request at face value."

#### 5b. Workflow (the core)

Each decomposed framework becomes one or more workflow steps.

```yaml
workflow_step_template:
  number: N
  name: "[Framework]: [Action verb]"
  pattern: "chaining | routing | parallel | orchestrator | evaluator"
  input: "What feeds this step (output of step N-1, or raw document)"
  process: >
    Exact procedure. Scoring criteria with scales.
    Decision trees. Not vibes.
  output: "Specific artifact with defined format"
  decision_rules:
    - "If [condition], then [action]"
    - "Override rule: [what takes precedence]"
  tools_used: ["search", "filesystem", "memory"]
```

Assembly rules:
```yaml
assembly_rules:
  - "Every entry in named_experts MUST produce at least one workflow step with concrete mechanics"
  - "Every entry in named_methodologies MUST produce at least one workflow step with scoring/criteria"
  - "Steps must reference their inputs explicitly (not 'the data' but 'the pain point table from step 2')"
  - "No duplicate content between Persona and Role sections"
  - "No step can be just 'Apply [framework]' — it must say HOW"
  - "If a framework couldn't be researched, include a ⚠️ warning in the step"
```

#### 5c. Agentic Pillars

Every generated agent includes these three instructions (adapted from OpenAI's agentic guidance):

```yaml
agentic_pillars:
  persistence: >
    Continue working until the task is fully complete. Do not stop at an intermediate
    step or ask the user to continue unless you are genuinely blocked.
    
  tool_discipline: >
    Use available tools to verify information. Do not guess, hallucinate, or 
    assume data you could look up. If a tool call fails, report the failure
    rather than making up a result.
    
  planning: >
    Before each major step, briefly state what you're about to do and why.
    After completing a step, reflect: did it produce what was expected?
    If not, adjust before proceeding.
```

#### 5d. Self-Check Block

Every agent gets a self-check as the final workflow step:

```yaml
self_check:
  name: "Self-Check (before delivering output)"
  questions:
    - "Does every recommendation trace to specific evidence (quote, data, observation)?"
    - "Did I apply each framework as concrete steps, not just mention it?"
    - "Are there any claims I made without tool verification?"
    - "Is the output actionable by someone who has no prior context?"
    - "Did I flag uncertainties and assumptions explicitly?"
  action: "If any answer is 'no', fix it before delivering."
```

#### 5e. Output Schema

Don't just say "markdown." Define the shape:

```yaml
output_schema_template:
  primary_artifact:
    name: "[What the main deliverable is]"
    format: "Table | Tree | Narrative | Scorecard"
    required_fields: ["list of columns/sections"]
  secondary_artifacts:
    - name: "[Supporting deliverable]"
      format: "..."
  meta:
    confidence_flags: "Required — tag uncertain items"
    source_citations: "Required — link claims to evidence"
```

---

### Phase 6 — Evaluate

**Input:** The generated agent YAML.

**Process:** Run a verification pass (LLM-as-judge).

```yaml
evaluation_criteria:

  framework_coverage:
    check: "For each named_expert and named_methodology from Phase 1, verify it appears as an operationalized workflow step"
    pass: "All frameworks have concrete steps with inputs/outputs/criteria"
    fail: "Framework only mentioned in persona or as a list item"
    action_on_fail: "Regenerate the missing workflow step"
    
  specificity:
    check: "Could a different LLM follow this workflow without ambiguity?"
    test: "Read each step. If it contains phrases like 'apply best practices', 'use appropriate methods', 'leverage expertise' — it fails"
    action_on_fail: "Replace vague phrases with specific procedures"
    
  persona_duplication:
    check: "Is any sentence in Persona repeated verbatim or near-verbatim in Role, Workflow, or Default Prompt?"
    action_on_fail: "Deduplicate. Persona = who. Workflow = how."
    
  context_efficiency:
    check: "Are all reads[] documents justified? Is total estimated tokens < 60% of budget?"
    action_on_fail: "Demote or compress documents"
    
  agentic_completeness:
    check: "Does the config include persistence, tool discipline, and planning instructions?"
    action_on_fail: "Inject missing pillars"
    
  output_specificity:
    check: "Is the output format defined with specific fields/columns, not just 'markdown'?"
    action_on_fail: "Generate output schema from workflow artifacts"
```

**Output:** Pass/fail with specific fixes applied. Final YAML.

---

## Example: LDC KAM Agent (Before → After)

### Before (current metaprompt output)

```yaml
persona: >
  You are a strategic key account manager for Louis Dreyfus Company
  at Syroco with deep product management expertise. You combine the
  analytical frameworks of top PMs like Teresa Torres, Carl Velloti,
  Akash Gupta, and Lenny Rachitsky...

workflow:
  1. Client Context Analysis
  2. Meeting Transcript Processing
  3. Pain Point Mapping
  4. Business Impact Assessment
  5. Feature Prioritization
  6. Stakeholder Alignment
```

### After (V2 metaprompt output)

```yaml
persona: >
  You are a key account manager for LDC at Syroco. You think in outcomes,
  not features. You never accept a request at face value — you dig for the
  underlying need and test assumptions before recommending action.

workflow:
  1:
    name: "Transcript Mining — Extract & Classify"
    input: "Meeting transcript (loaded via Filesystem tool)"
    process: >
      For every client statement, classify:
      - Explicit request ("We need X") → capture verbatim
      - Implicit pain (frustration, workaround) → infer unmet need
      - Assumption (belief that may not be true) → flag for testing
      - Opportunity signal (expansion, upsell hint) → flag for strategy
    output: "Table: Quote | Type | Underlying Need | Confidence (High/Med/Low)"
    tools: ["Filesystem"]

  2:
    name: "Opportunity Solution Tree (Torres)"
    input: "Underlying needs from step 1"
    process: >
      For each need:
      a) Frame as outcome: "[Role] achieves [outcome] measured by [metric]"
      b) Branch 2-3 possible solutions (not just the one client asked for)
      c) For each solution, identify the riskiest assumption
      d) Propose smallest assumption test (prototype, data pull, pilot)
    output: "Opportunity tree with branches: Outcome → Solutions → Assumptions → Tests"
    decision_rules:
      - "Never skip from need straight to solution"
      - "Always generate multiple solutions before selecting"

  3:
    name: "Jobs-to-Be-Done Mapping"
    input: "Pain points from step 1"
    process: >
      For each pain point, write JTBD statement:
      "When [situation], I want to [motivation], so I can [outcome]"
      Identify:
      - Functional job (what they need to accomplish)
      - Emotional job (how they want to feel)
      - Consumption chain friction (where in workflow does product create friction)
    output: "JTBD table: Situation | Motivation | Outcome | Job Type"

  4:
    name: "RICE Prioritization"
    input: "Solutions from step 2 + JTBD from step 3"
    process: >
      Score each feature/solution:
      - Reach: users/vessels affected (1=single user, 2=one team, 3=multi-team, 4=fleet)
      - Impact: (3=game-changer, 2=noticeable, 1=nice-to-have, 0.5=minimal)
      - Confidence: (100%=said+validated, 80%=said not validated, 50%=inferred, 20%=guess)
      - Effort: person-weeks (ask Product if unsure, flag as TBD)
      Formula: (Reach × Impact × Confidence) / Effort
    output: "Ranked table with score breakdown"
    decision_rules:
      - "Confidence < 50% → flag as 'validate before building'"
      - "Must-be items (Kano) override RICE ranking"

  5:
    name: "Kano Classification"
    input: "Ranked features from step 4"
    process: >
      Tag each:
      - Must-be: client expects it, absence = churn risk.
        Signal: mentioned as blocker or compared to competitor
      - Performance: more = better, linear satisfaction.
        Signal: "it would be great if..."
      - Delighter: unexpected wow factor.
        Signal: inferred from workflow gaps they didn't articulate
    output: "Features tagged with Kano type"
    decision_rules:
      - "All must-be items go top of list regardless of RICE"
      - "Must-be + Confidence < 80% → escalate immediately (churn risk we're unsure about)"

  6:
    name: "Self-Check"
    process: >
      Before delivering:
      - Does every feature trace to a specific client quote or observation?
      - Did I propose at least one solution the client didn't ask for?
      - Are must-be items at the top?
      - Are assumptions flagged rather than treated as facts?
      - Could a PM who wasn't in the meeting act on this?
      Fix any failures before outputting.

output_schema:
  primary: "Feature Request Brief (per feature)"
  fields: ["Feature", "Client Quote", "JTBD", "Opportunity (Torres)", "RICE Score",
           "Kano Type", "Riskiest Assumption", "Validation Method", "LDC Stakeholder"]
  secondary:
    - "Priority Matrix: Do Now | Plan Next | Validate First | Park"
    - "Relationship Risk Summary: churn signals, competitive threats, 30-day actions"
```

---

## Implementation Plan

### Files to Create/Modify

```
src/
  metaprompt/
    v2/
      index.ts              — Orchestrator: runs the 6-phase pipeline
      parser.ts             — Phase 1: structured extraction from user input
      researcher.ts         — Phase 2: web search + decomposition
      pattern-selector.ts   — Phase 3: workflow pattern matching
      context-strategist.ts — Phase 4: document classification
      assembler.ts          — Phase 5: YAML generation
      evaluator.ts          — Phase 6: LLM-as-judge verification
      types.ts              — Shared types for all phases
      examples/             — Few-shot examples for parser (4 diverse domains)
        pm-agent.yaml
        legal-agent.yaml
        engineering-agent.yaml
        marketing-agent.yaml
```

### Dependencies

- **Web search:** Fetch MCP server (already available) or native web_search tool
- **LLM calls:** 3-4 calls total per generation:
  1. Parse (structured output)
  2. Research (tool-augmented, 2-6 search calls)
  3. Assemble (main generation)
  4. Evaluate (judge pass)
- **Estimated latency:** 15-30 seconds total (vs ~5s for current single-shot)
- **Estimated cost:** ~$0.15-0.30 per agent generation (Sonnet for parse/evaluate, Opus for assemble)

### Model Strategy

```yaml
model_allocation:
  phase_1_parse: "claude-sonnet-4"      # Structured extraction, fast
  phase_2_research: "claude-sonnet-4"   # Search + summarize, fast
  phase_3_pattern: "claude-sonnet-4"    # Classification, fast
  phase_4_context: "claude-sonnet-4"    # Document analysis, fast
  phase_5_assemble: "claude-opus-4"     # Core generation, needs depth
  phase_6_evaluate: "claude-sonnet-4"   # Verification, fast
```

### Fallback Behavior

```yaml
fallbacks:
  web_search_unavailable:
    action: "Use LLM training knowledge"
    flag: "⚠️ Frameworks based on training data, not live research. Verify accuracy."
    
  expert_not_found:
    action: "Include as domain reference, not operationalized steps"
    flag: "⚠️ Could not find canonical framework for [name]. Included as expertise reference."
    
  token_budget_exceeded:
    action: "Demote largest always-loaded doc to on-demand"
    warn: "Document [X] moved to on-demand retrieval. Agent will fetch it when needed."
    
  evaluation_fails:
    action: "Auto-fix specific failures, re-evaluate once"
    max_retries: 1
    escalate: "If still failing after retry, output with warnings attached"
```

---

## Success Metrics

How do we know V2 is better than V1?

### Quantitative
1. **Framework operationalization rate:** % of named experts/methodologies that appear as executable workflow steps (target: >90%, current: ~0%)
2. **Step specificity score:** LLM-as-judge rates each workflow step on "could a different LLM follow this without ambiguity?" (target: >80% pass)
3. **Persona-workflow duplication:** % of persona text that overlaps with workflow text (target: <10%, current: ~60%)
4. **Context efficiency:** always-loaded tokens / token_budget (target: <60%)

### Qualitative
1. Generated agents produce different outputs than a "blank" agent would (the frameworks actually change behavior)
2. Users report that agents "feel like they know the methodology" not "feel like they read about it"
3. Cross-domain agents (legal, engineering, marketing) are as good as PM agents

---

## Open Questions

1. **Framework library vs live research?** Option C (pre-decomposed library of 30 frameworks) would be deterministic and faster. Should we build this as a knowledge base AND do live research as fallback? Probably yes — library for common frameworks, search for obscure ones.

2. **User confirmation step?** After Phase 2, should we show the user what we found and ask "is this the right framework?" before generating? Adds friction but prevents wrong decompositions. Maybe: show a summary, auto-continue after 10s.

3. **Caching research results?** If someone builds a Torres-based agent, cache the decomposition so the next user gets it instantly. This builds the framework library organically.

4. **V2 metaprompt for agent TEAMS?** This spec covers single agents. Multi-agent teams need pattern selection at the team level (which agent does what, how they communicate). Defer to V3.

5. **How does this interact with Qualification (#29)?** The Qualification system should test whether the generated agent actually follows the workflow steps. If RICE scoring is in the workflow but the agent's output doesn't contain RICE scores, qualification should flag it.

---

## Appendix A — The Metaprompt Itself (System Prompt for the Orchestrator)

This is what runs inside Modular when the user clicks "Generate Agent."

```
You are Modular Studio's agent architect. Your job is to transform a user's
description of an AI agent into a production-quality agent configuration.

You do NOT generate agents by describing expertise. You generate agents by
OPERATIONALIZING expertise into executable procedures.

## Your Pipeline

You will execute 6 phases in sequence. Each phase produces structured output
that feeds the next.

### Phase 1: Parse
Extract from the user's input:
- Role, domain, named experts, named methodologies, implied methodologies,
  tools, documents, success criteria, constraints, expected outputs.
- A named expert is someone referenced for their METHODOLOGY, not a client
  or stakeholder.
- An implied methodology is a framework suggested by the task even if not
  named (e.g., "prioritize features" implies RICE/ICE).

### Phase 2: Research
For EACH named expert and methodology:
1. Search the web for their core framework (2 queries per reference)
2. Extract: framework name, core concept, step-by-step mechanics,
   inputs/outputs per step, decision rules, artifacts produced
3. Structure as executable procedure, not description
4. If search fails: flag it, use training knowledge, mark confidence level

A framework is NOT operationalized until it has:
- Specific INPUTS (what data goes in)
- Specific PROCESS (scoring scales, classification criteria, decision trees)
- Specific OUTPUTS (named artifacts with defined format)
- Specific DECISION RULES (if X then Y, overrides, thresholds)

If you can't get to this level of specificity, the framework is not ready
to embed. Flag it and move on.

### Phase 3: Pattern Selection
Based on the task, select the workflow pattern:
- Prompt chaining: fixed sequential steps with quality gates
- Routing: input classification → specialized handling
- Parallelization: independent subtasks run simultaneously
- Orchestrator-workers: dynamic subtask delegation
- Evaluator-optimizer: generate → critique → refine loop
- Hybrid: combination of patterns

Justify your selection in one sentence.

### Phase 4: Context Strategy
For each document the user provided:
- always_loaded: needed every time, small, reference data → reads[]
- on_demand: large, needed sometimes → tool-retrievable
- compressed: useful but too large → summarize for reads[], full via tool
- exclude: not relevant or duplicate → drop with note

Calculate estimated token usage. If always_loaded > 60% of token_budget,
demote the largest document.

### Phase 5: Assembly
Generate the agent YAML with these rules:
- Persona: max 3 sentences. WHO the agent is. No framework names.
- Workflow: each decomposed framework = one or more steps. Each step has:
  name, input, process (specific), output (specific), decision_rules, tools.
- Include the 3 agentic pillars: persistence, tool discipline, planning.
- Include self-check as final workflow step.
- Define output schema with specific fields, not just "markdown."
- NEVER duplicate content between persona and workflow.

### Phase 6: Evaluate
Review your generated config:
- Every named expert/methodology from Phase 1 has operationalized steps? 
- Every step is specific enough for a different LLM to follow?
- No vague phrases ("apply best practices", "leverage expertise")?
- No persona/workflow duplication?
- Context fits within token budget?
- All 3 agentic pillars present?

Fix any failures. Output the final YAML.

## Critical Rules
- A named expert is a RESEARCH TASK, not a CREDENTIAL
- "Use RICE" is not a workflow step. The RICE scoring formula with scales IS.
- If you can't operationalize something, say so. Don't fake it.
- The output must be domain-agnostic in structure — works for PMs, lawyers,
  engineers, anyone. Only the CONTENT is domain-specific.
```

---

## Appendix B — Competitive Positioning

What this gives Modular that nobody else has:

| Capability | Dify | Langflow | Flowise | Wordware | **Modular V2** |
|---|---|---|---|---|---|
| Visual agent builder | ✅ | ✅ | ✅ | ✅ | ✅ |
| Framework-aware generation | ❌ | ❌ | ❌ | ❌ | ✅ |
| Research-augmented prompts | ❌ | ❌ | ❌ | ❌ | ✅ |
| Workflow pattern selection | ❌ | ❌ | ❌ | ❌ | ✅ |
| Context strategy (not just dump) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Self-evaluating generation | ❌ | ❌ | ❌ | Partial | ✅ |
| Methodology operationalization | ❌ | ❌ | ❌ | ❌ | ✅ |

**The moat:** No competitor turns "Teresa Torres" into executable Opportunity Solution Tree steps. They all just pass the name to the LLM and hope for the best.
