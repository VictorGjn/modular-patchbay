# Dogfood Architecture Review

Can Modular Studio build agents to improve itself? This review evaluates whether the platform can execute its own improvement plan using 3 specialized agents (Pipeline Agent, Memory Agent, Navigation Agent) working as a team.

---

## The Self-Improvement Scenario

**Goal**: Use Modular Studio to create a team of 3 agents that analyze the Modular Studio codebase and propose improvements to the pipeline, memory, and navigation systems.

**Agents**:
1. **Pipeline Agent** — Analyze `src/services/budgetAllocator.ts`, `contextAssembler.ts`, `contradictionDetector.ts`, `compress.ts` and propose pipeline optimizations
2. **Memory Agent** — Analyze `server/services/memoryScorer.ts`, `factExtractor.ts` and propose memory system improvements
3. **Navigation Agent** — Analyze `src/services/treeNavigator.ts`, `knowledgePipeline.ts` and propose navigation enhancements

---

## Dimension 1: Agent Builder

**Can the Agent Builder create the 3 agents with the right knowledge sources?**

### :yellow_circle: Partial

**What works**:
- The Agent Builder (`src/panels/AgentBuilder.tsx`) supports full agent configuration: identity, persona, constraints, objectives, workflow steps
- Knowledge sources can be added via the Sources Panel (`src/panels/SourcesPanel.tsx`) — file paths, directories, repositories
- Each source can be assigned a knowledge type (ground-truth for the codebase, framework for design docs, hypothesis for improvement proposals)
- The agent definition format (YAML) supports all required fields

**What's missing**:
- **No self-referential source**: The Agent Builder cannot add "this project's own codebase" as a source without specifying the absolute file path. There's no introspective "index yourself" button.
  - **Workaround**: Use the Repository Indexer (`server/services/githubIndexer.ts`) to scan the modular-patchbay directory and add it as a knowledge source manually.

- **Knowledge type assignment for code**: Code files default to `guideline` type via the extension fallback in `src/store/knowledgeBase.ts:line ~classification rules`. For self-improvement, the codebase should be `ground-truth` (it's the canonical implementation). Users must manually override.

- **Source count limits**: With 149 source files in `src/`, the Sources Panel would need to handle a large number of indexed files. The tree indexer (`src/services/treeIndexer.ts`) processes them individually — no bulk "index entire project" flow in the UI.

**Code references**:
- Agent save/load: `server/routes/agents.ts` — GET/PUT/DELETE `/api/agents/:id`
- Source configuration: `src/store/knowledgeBase.ts` — `ChannelConfig` interface
- Repo indexer: `server/services/githubIndexer.ts` — `indexLocalRepo()`

---

## Dimension 2: Team Runner with Claude Agent SDK

**Can the team runner execute 3 agents in parallel with Claude Agent SDK?**

### :white_check_mark: Ready

**What works**:
- `server/services/teamRunner.ts:runTeam()` executes all agents via `Promise.allSettled` — handles partial failures gracefully
- Per-agent model override: each agent can use a different model (`agent.model || config.model` at line 212)
- Per-agent `maxTurns` support
- SSE streaming for real-time progress monitoring
- Worktree preparation: each agent gets its own git worktree if a repo is specified (`server/services/worktreeManager.ts`)
- Repository indexing: each agent's repo is indexed before execution (`indexLocalRepo()`)
- Contract extraction from feature spec before agent execution
- Virtual `claude-agent-sdk` provider integration

**For self-improvement specifically**:
- All 3 agents would point to the same repo (modular-patchbay)
- Each would get a separate worktree branch via `prepareAgentWorktree()`
- The `featureSpec` would describe the improvement objectives
- Model override allows using Claude Opus for complex analysis agents and Sonnet for simpler ones

**Code references**:
- Team execution: `server/services/teamRunner.ts:141-274`
- Agent execution: `server/services/agentRunner.ts` — `runAgent()`
- Worktree manager: `server/services/worktreeManager.ts` — `prepareAgentWorktree()`
- Frontend client: `src/services/teamClient.ts` — `startTeamRun()`, `getTeamStatus()`, `stopTeamRun()`
- Runtime routes: `server/routes/runtime.ts` — POST `/run-team`

---

## Dimension 3: Fact Extraction

**Can fact extraction capture what each agent learned?**

### :white_check_mark: Ready

**What works**:
- `server/services/factExtractor.ts` extracts facts from every agent's output using both pattern-based and LLM-based extraction
- Epistemic types cover improvement-relevant categories: `observation` (what is), `inference` (what it means), `decision` (what to change), `hypothesis` (what might work)
- Confidence scoring (0.4-0.95) based on extraction pattern
- Facts include `key`, `value`, `epistemicType`, `confidence`, `source` (agent ID)

**Example extracted facts from a Pipeline Agent run**:

| Key | Value | Type | Confidence |
|---|---|---|---|
| `budget_redistribution_limit` | "Budget allocator caps at 3 rounds — insufficient for 20+ source scenarios" | observation | 0.85 |
| `attention_ordering_gap` | "Signal sources should be placed before hypothesis for maritime use cases" | inference | 0.7 |
| `add_weighted_redistribution` | "Replace round-robin redistribution with weighted redistribution" | hypothesis | 0.6 |

**Limitations**:
- Pattern-based extraction may miss code-specific insights (e.g., "function X has O(n²) complexity")
- LLM-based extraction requires a configured provider with available credits

**Code references**:
- Fact extraction: `server/services/factExtractor.ts`
- Fact types: `ExtractedFact` interface — `key`, `value`, `epistemicType`, `confidence`, `source`
- Per-agent fact collection: `server/services/teamRunner.ts:250` — `validatedResults.flatMap(r => r.facts)`

---

## Dimension 4: Cross-Agent Coordination via Shared Facts

**Can shared facts enable cross-agent coordination?**

### :yellow_circle: Partial

**What works**:
- `server/services/teamRunner.ts:251` merges all agent facts: `deduplicateFacts([...contractFacts, ...allFacts])`
- Contract facts (extracted from `featureSpec` before agent execution) are injected into every agent's context via `teamFacts` (line 213)
- Fact deduplication by key + confidence keeps the shared fact store clean (line 87-96)
- Memory validation (`validateAgentMemoryExchange`) checks that backend/frontend agents publish expected fact patterns (line 115-139)

**What's missing**:
- **No mid-run fact sharing**: Agents execute in parallel (`Promise.allSettled`). Facts extracted from Agent A's output are NOT available to Agent B during its run. They're only merged *after all agents complete*.
  - **Impact for self-improvement**: The Memory Agent can't build on the Pipeline Agent's findings in real-time. All coordination happens post-hoc.
  - **Workaround**: Run the team twice. First run extracts facts; second run injects all facts from run 1 into `teamFacts`.

- **No fact filtering by relevance**: All contract facts are injected into every agent regardless of relevance. The Pipeline Agent receives memory-related facts it doesn't need, consuming context window.

- **No dependency graph**: `teamRunner.ts` has no concept of agent ordering. There's no way to say "run Weather Monitor first, then Route Optimizer." This limits coordination patterns.

**Code references**:
- Fact injection: `server/services/teamRunner.ts:213` — `teamFacts: [...(agent.teamFacts ?? []), ...contractFacts]`
- Deduplication: `server/services/teamRunner.ts:87-96` — `deduplicateFacts()`
- Validation: `server/services/teamRunner.ts:115-139` — `validateAgentMemoryExchange()`

---

## Dimension 5: Full Self-Improvement Capability

**What's missing for Modular Studio to fully improve itself?**

### :red_circle: Missing (requires 3 capabilities)

#### 5a. Code Modification
Agents can analyze code and propose changes, but cannot directly edit files. The current architecture extracts *facts* from agent output, not *code changes*.

**What's needed**:
- MCP tool integration for file editing (e.g., `@modelcontextprotocol/server-filesystem` with write access)
- Or: export agent proposals as git patches that can be reviewed and applied
- The `prepareAgentWorktree()` creates isolated branches — agents could write to these branches if given file system tools

#### 5b. Validation Loop
No mechanism to verify that proposed improvements actually work:
- No test runner integration (can't run `npm test` after making changes)
- No CI pipeline trigger
- No before/after comparison of pipeline performance

**What's needed**:
- MCP tool for running tests: `{ tool: "run_tests", args: { command: "npm test" } }`
- Performance benchmarking before/after changes
- Rollback mechanism if tests fail

#### 5c. Iterative Refinement
No feedback loop from validation back to agents:
- Agent runs are one-shot (complete, extract facts, done)
- No mechanism to say "your proposal broke 3 tests, revise it"
- The corrective re-navigation concept exists for knowledge gaps, but not for agent output refinement

**What's needed**:
- Multi-turn team execution with intermediate validation gates
- Agent re-invocation with failure context
- Convergence criteria (stop when all tests pass, or after N iterations)

---

## Scorecard

| Dimension | Status | Score |
|---|---|---|
| 1. Agent Builder — create 3 agents with knowledge sources | :yellow_circle: Partial | 70% |
| 2. Team Runner — parallel execution with Claude Agent SDK | :white_check_mark: Ready | 95% |
| 3. Fact Extraction — capture agent learnings | :white_check_mark: Ready | 90% |
| 4. Shared Facts — cross-agent coordination | :yellow_circle: Partial | 50% |
| 5. Full Self-Improvement — autonomous code improvement | :red_circle: Missing | 15% |

**Overall**: Modular Studio can **design** its own improvement agents and **execute** them in parallel with fact extraction. It cannot yet **coordinate** agents in real-time or **apply** their proposals automatically. The gap is between "analyze and propose" (ready) and "implement and validate" (missing).

---

## Roadmap to Self-Improvement

### Phase 1: Sequential Agent Dependencies (v0.3.0)
Add `dependsOn` field to `TeamRunConfig.agents[]`. Agents wait for dependencies to complete and receive their facts before starting.

```typescript
agents: [
  { agentId: 'pipeline', dependsOn: [] },
  { agentId: 'memory', dependsOn: ['pipeline'] },
  { agentId: 'navigation', dependsOn: ['pipeline', 'memory'] },
]
```

### Phase 2: MCP Tool Integration for Code Editing (v0.3.0)
Enable agents to use filesystem MCP tools within their worktrees. Each agent writes changes to its isolated branch.

### Phase 3: Validation Gates (v0.4.0)
Add test runner MCP tool. After each agent completes, run `npm test` in the worktree. If tests fail, re-invoke agent with error context.

### Phase 4: Autonomous Loop (v0.5.0)
Combine Phases 1-3 into a self-improvement cycle:
```
Analyze → Propose → Apply → Test → (if fail, re-propose) → Merge
```

---

*Modular Studio is 60% of the way to dogfooding. The core pipeline and team execution work. The gap is in closing the loop from analysis to automated code changes with validation.*
