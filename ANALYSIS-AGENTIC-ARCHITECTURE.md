# Agentic AI Architecture → MODULAR: Gap Analysis

## 1. Mapping: What Already Exists

| Diagram Layer | Modular Equivalent | Coverage |
|---|---|---|
| **Data Storage/Retrieval** (Vector Stores, Knowledge Graph, Diverse Repos) | **KnowledgeNode** — file/doc sources with Knowledge Type System (Ground Truth, Signal, Evidence, etc.) | ~60%. The type system is sophisticated, but there's no explicit vector store or knowledge graph node — it's flat document injection, not semantic retrieval. |
| **AI Agents** (Planning, Reflection, Tool Use, Model rotation) | **PromptNode** + **SkillsNode** + **McpNode** — the prompt defines intent, skills add capabilities, MCP adds tool access | ~40%. Tool Use maps to McpNode. But there's no multi-model selection, no planning/reflection loop, no self-learning. The "agent" is implicit (whatever LLM runs the prompt), not a first-class configurable object. |
| **Output Layer** (Customised Results, Knowledge Update, Augmented Info) | **OutputNode** (format selection) + **ResponseNode** (display) | ~50%. Format selection is there. But "Knowledge Update" (feeding results back into the knowledge base) and "Augmented Information" (enriched/structured output) aren't supported. Output is terminal — it doesn't loop back. |
| **Input Layer** (Input Sources, Live Data Streams, Interaction Logs) | Partially **PromptNode** (user types a need) | ~20%. Only manual text input. No live data streams, no webhook triggers, no interaction log ingestion. |
| **Agent Orchestration** (Multi-Agent Coordination, Supervision) | **Nothing.** | 0%. No multi-agent support, no supervision layer, no coordination between agents. |
| **Service Layer** (Guardrails, Compliance, Multi-channel delivery, Recommendations) | **Nothing.** | 0%. No guardrails, no validation, no multi-channel output routing. |

## 2. What's Missing

Three major gaps, in order of severity:

**Gap 1: The Agent is invisible.** Modular has tools (McpNode), knowledge (KnowledgeNode), and skills (SkillsNode) — but no explicit **AgentNode** where you configure the model, set its behavior (planning depth, reflection, temperature), or wire multiple models together. The diagram's center is "AI Agents" with rotation arrows between models. Modular skips this entirely — the LLM is a black box behind the prompt.

**Gap 2: No feedback loops.** The diagram shows bidirectional arrows (Data ↔ Agents, Output → Knowledge Update). Modular is strictly left-to-right: knowledge flows in, response flows out. There's no way for output to update the knowledge base, no iterative refinement, no reflection cycle.

**Gap 3: No orchestration or guardrails.** The diagram's top-right (Orchestration) and bottom (Service Layer) are completely absent. No multi-agent coordination, no output validation, no compliance checks, no multi-channel delivery.

## 3. Integration Proposals

### AgentNode (HIGH PRIORITY)
A new center node replacing PromptNode's implicit role as "the agent." Configure: model selection (GPT-4, Claude, Llama — with rotation/fallback), temperature, system prompt, planning mode (single-shot vs chain-of-thought vs ReAct). KnowledgeNode, SkillsNode, and McpNode plug into its left ports. OutputNode plugs into its right port. PromptNode becomes purely "user input" feeding into AgentNode.

### InputNode (MEDIUM PRIORITY)
Extends beyond manual prompts. Sub-types: **Webhook** (receive HTTP triggers), **Schedule** (cron-based), **FileWatch** (monitor a folder), **Stream** (SSE/WebSocket). This covers the diagram's "Input Sources" and "Live Data Streams." Wires into AgentNode just like PromptNode does.

### OrchestratorNode (MEDIUM PRIORITY)
A special node that coordinates multiple AgentNodes. Drop two AgentNodes on the canvas, wire them through an OrchestratorNode that defines: execution order (sequential/parallel), handoff conditions, shared context. This maps directly to "Multi Agent Coordination."

### GuardrailNode (LOWER PRIORITY)
Sits between AgentNode and OutputNode. Configurable checks: content filtering, PII detection, format validation, token budget enforcement. Maps to the diagram's "Guardrails" and "Iterative Validation." If a check fails, it loops back to the agent with feedback — introducing the first feedback loop.

### FeedbackEdge (LOWER PRIORITY)
A new edge type (visually distinct — dashed line, different color) that connects OutputNode back to KnowledgeNode or AgentNode. Enables "Knowledge Update" from the diagram: agent output gets stored as new knowledge for future runs.

## 4. Priority Roadmap

| Phase | What | Why |
|---|---|---|
| **Now** | **AgentNode** — make the model explicit and configurable | Foundation for everything else. Without this, Modular is a prompt template, not an agent builder. |
| **Next** | **InputNode** — webhook/schedule triggers | Unlocks automation. Agents that run without a human typing a prompt. |
| **Then** | **GuardrailNode** + **FeedbackEdge** | Adds safety and iteration — two things that separate toys from production tools. |
| **Later** | **OrchestratorNode** — multi-agent coordination | Only matters once single-agent flows are solid. Complex, but it's the endgame differentiator. |

## Bottom Line

Modular has strong coverage on the **data/tools/output** axis (left-to-right). What it lacks is **depth**: the agent itself as a configurable entity, feedback loops, orchestration, and guardrails. The AgentNode is the single highest-leverage addition — it turns Modular from "a nice way to assemble prompts" into "a visual agent builder."
