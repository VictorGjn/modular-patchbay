# Feature Audit Report — Modular Studio
**Date:** 2026-03-11  
**Auditor:** Claw (manual trace through codebase)

## Executive Summary

The knowledge pipeline and memory system are **fully wired and functional in the Chat tab**. They are **NOT used by the Team Runner**. The Team Runner only gets `buildSystemFrame()` (identity, constraints, workflow) — no knowledge sources, no contrastive retrieval, no provenance, no memory.

This means:
- An agent designed with 7 knowledge sources and careful depth settings → **loses all that context in Team mode**
- Contrastive retrieval, provenance chains → **only active in Chat**
- Memory recall/write → **only active in Chat**

---

## Feature Status Matrix

### Pipeline Features

| Feature | Frontend Button/Control | Chat Tab | Team Runner | Notes |
|---------|------------------------|----------|-------------|-------|
| **Tree Index** | ✅ "Index" button per source in SourcesPanel | ✅ Used in `compressKnowledge()` | ❌ Not used | Tree index builds heading tree, agent navigates branches |
| **Knowledge Types** | ✅ Drag-drop classification in SourcesPanel | ✅ Used for budget allocation | ❌ Not used | 6 types with epistemic weights |
| **Depth Control** | ✅ Depth carousel per source | ✅ Used in budget allocator | ❌ Not used | Summary→Key→Details→Full→Verbatim |
| **Contrastive Retrieval** | ❌ No toggle — auto-activates on analytical queries | ✅ Active when query matches patterns | ❌ Not used | Finds supporting + contradicting chunks |
| **Provenance Tags** | ❌ No UI — auto-generated | ✅ Added to system prompt as `<context_provenance>` | ❌ Not used | Source→section→type→depth→method |
| **Conflict Resolution** | ❌ No UI — automatic | ✅ Weights: ground-truth > evidence > signal > hypothesis | ❌ Not used | LLM gets resolution instructions |
| **Agent Navigation** | ✅ Navigation mode selector in Chat tab | ✅ LLM reads tree headlines, selects branches | ❌ Not used | Manual or agent-driven |
| **Budget Allocator** | ❌ No direct UI — driven by type weights | ✅ Distributes tokens across sources by type | ❌ Not used | Epistemic priority weights |
| **Framework Extractor** | ❌ Automatic on guideline-type sources | ✅ Extracts MUST/NEVER/convention patterns | ❌ Not used | Creates `<framework>` block |
| **HyDE Navigation** | ❌ Automatic for complex queries | ✅ Generates hypothetical answer for better matching | ❌ Not used | Activated by `shouldUseHyDE()` |
| **Connectors** | ✅ ConnectorPicker in SourcesPanel | ✅ Added as `<connectors>` block | ❌ Not used | Notion, Slack, etc. |

### Memory Features

| Feature | Frontend Control | Chat Tab | Team Runner | Notes |
|---------|-----------------|----------|-------------|-------|
| **Memory Recall** | ✅ Memory settings (enable/disable) | ✅ `preRecall()` before LLM call | ❌ Not used | Retrieves relevant past facts |
| **Memory Write** | ❌ Automatic after response | ✅ `postProcess()` extracts + stores facts | ❌ Not used | Facts written after each turn |
| **Sandbox Isolation** | ✅ Toggle in memory settings | ✅ `reset_each_run` clears scratchpad | ❌ Not used | Run-level fact isolation |
| **Ebbinghaus Decay** | ❌ Automatic | ✅ Strength decays over time | ❌ Not used | Half-life extends with access |

### Agent Builder Features

| Feature | Frontend Control | Chat Tab | Team Runner | Notes |
|---------|-----------------|----------|-------------|-------|
| **Identity** (name, desc) | ✅ Agent Builder inputs | ✅ `<identity>` in system prompt | ✅ Via `buildSystemFrame()` | Works in both |
| **Persona** | ✅ Persona textarea | ✅ In `<instructions>` | ✅ Via `buildSystemFrame()` | Works in both |
| **Constraints** | ✅ Constraint modal + pills | ✅ In `<constraints>` | ✅ Via `buildSystemFrame()` | Works in both |
| **Objectives** | ✅ Objective fields | ✅ In `<instructions>` | ✅ Via `buildSystemFrame()` | Works in both |
| **Workflow** | ✅ Workflow modal | ✅ In `<workflow>` | ✅ Via `buildSystemFrame()` | Works in both |
| **Safety Profile** | ✅ 3 pills (Autonomous/Balanced/Careful) | ✅ Maps to constraint toggles | ✅ Via constraints | Works in both |
| **Tool Guide** | ❌ Auto-generated from MCP | ✅ `<tool_guide>` block | ✅ Via `buildSystemFrame()` | Works in both |

### Runtime Features

| Feature | Frontend Control | Chat Tab | Team Runner | Notes |
|---------|-----------------|----------|-------------|-------|
| **Single Agent Chat** | ✅ Chat input + Send | ✅ Full pipeline | N/A | Full pipeline path |
| **Team Execution** | ✅ Agent slots + Run Team | N/A | ✅ Parallel agents via SSE | Only gets system frame |
| **Agent SDK** | ✅ Provider in Settings | ✅ Via `executeChat()` | ✅ Via `callAgentSdk()` | Both paths work |
| **Raw API** (Anthropic/OpenAI) | ✅ Provider in Settings | ✅ Via `executeChat()` | ✅ Via `callLlm()` | Both paths work |
| **Fact Extraction** | ❌ Automatic | ❌ Only in memory system | ✅ `extractFacts()` in agentRunner | Team extracts facts from output |
| **Shared Facts** | ✅ Displayed in results | N/A | ✅ Deduplicated across agents | Team-only feature |
| **Maximizable Results** | ✅ ↗ button | N/A | ✅ Full-screen overlay | New feature |
| **Copy Output** | ✅ Copy button | N/A | ✅ Per-agent output | New feature |

### Export/Import Features

| Feature | Frontend Control | Status | Notes |
|---------|-----------------|--------|-------|
| **Agent Directory Export** | ✅ Orange button in Export tab | ✅ Working | ZIP with 6 files |
| **Agent Directory Import** | ✅ Import button + drag-drop | ✅ Working | ZIP → restore state |
| **Legacy Export** (MD/YAML/JSON) | ✅ Buttons in Export tab | ✅ Working | Single-file formats |
| **Save to Library** | ✅ Save button in Agent Builder | ✅ Working | `~/.modular-studio/agents/` |
| **Load from Library** | ✅ Load button in Agent Builder | ✅ Working | Restores full state |

---

## Critical Gap: Team Runner Missing Knowledge Pipeline

### What happens today:

**Chat tab flow:**
```
User message
  → resolveProviderAndModel()
  → routeSources() — index files, extract frameworks
  → compressKnowledge() — tree navigation, depth filtering, contrastive retrieval, provenance
  → preRecall() — memory retrieval
  → assemblePipelineContext() — combine frame + knowledge + memory + connectors
  → executeChat() — LLM call with full context
  → postProcess() — memory write, heatmap, stats
```

**Team tab flow:**
```
User task
  → resolveProviderAndModel()
  → buildSystemFrame() — identity, instructions, constraints, workflow only
  → POST /api/runtime/run-team — sends systemPrompt + task to backend
  → agentRunner.callLlm() — raw LLM call with NO knowledge sources
```

### Impact:
- A carefully curated set of knowledge sources (ground-truth docs, evidence, signals) → **completely ignored in team mode**
- Contrastive retrieval (the unique differentiator) → **never activated in team mode**
- Memory recall → **agents start with blank memory in team mode**
- Provenance-weighted conflict resolution → **not available in team mode**

### Recommendation:
Run the knowledge pipeline on the frontend before sending to the team runner. The `compressKnowledge()` result should be included in the `systemPrompt` sent to each team agent.

---

## Saved Agents Audit

### Senior Frontend Engineer
- **Channels:** 2 (both likely file paths)
- **MCP:** 0
- **Skills:** 0
- **Workflow:** 6 steps
- **Model:** claude-opus-4
- **Verdict:** Would work in Chat (knowledge pipeline runs on 2 channels). In Team mode, loses both channels.

### Syroco Backend Engineer
- **Channels:** 7 (likely Syroco codebase files)
- **MCP:** 2 servers configured
- **Skills:** 0
- **Workflow:** 6 steps
- **Model:** claude-opus-4-20250514
- **Verdict:** Richest agent config. 7 knowledge sources + 2 MCP servers. Would work great in Chat. In Team mode, loses all 7 knowledge channels (MCP tools may still be available if servers are connected).

---

## Features with No Frontend Control

These pipeline features run automatically but have no explicit UI toggle:

1. **Contrastive Retrieval** — Auto-activates on analytical queries. No way to force it on/off.
2. **Provenance Tags** — Always generated when pipeline runs. No visibility in UI.
3. **Conflict Resolution** — Automatic. No way to see which conflicts were detected.
4. **HyDE Navigation** — Auto-activates for complex queries. No toggle.
5. **Budget Allocator** — Weights are hardcoded by knowledge type. No per-source weight override.
6. **Framework Extraction** — Auto-runs on guideline-type sources. No toggle.

### Recommendation:
Add a "Pipeline Debug" panel in TestPanel that shows:
- Which sources contributed chunks
- Token allocation per source
- Whether contrastive retrieval activated
- What provenance chain was built
- Any conflicts detected and how they were resolved

This exists partially in the trace store but isn't surfaced in the UI.

---

## Summary

| Category | Working | Partially Working | Not Working |
|----------|---------|-------------------|-------------|
| Knowledge Pipeline (Chat) | ✅ 11 features | — | — |
| Knowledge Pipeline (Team) | — | — | ❌ 11 features |
| Memory (Chat) | ✅ 4 features | — | — |
| Memory (Team) | — | — | ❌ 4 features |
| Agent Builder | ✅ 6 features | — | — |
| Runtime | ✅ 7 features | — | — |
| Export/Import | ✅ 5 features | — | — |

**Bottom line:** The Chat tab is a fully functional context engineering pipeline. The Team Runner is a raw LLM caller with a good system prompt but zero knowledge context. Bridging this gap is the highest-priority next step.
