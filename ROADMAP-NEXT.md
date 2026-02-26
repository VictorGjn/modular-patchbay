# Modular — Next Sprint Roadmap

## Current State (commit 51b3c19, branch feat/ui-modernization)
- React Flow canvas with 6 nodes: Prompt, Knowledge, Skills, MCP, Output, Response
- SmoothStep cables, JackPort chrome rings, IN/OUT labels
- Light/dark theme with 50+ tokens, Sun/Moon toggle
- 10 presets from .claude/agents/, multi-select output formats
- Knowledge Type System (6 types, auto-classification)
- Ghost channel suggestions, contextual hints
- Build passes clean

## Sprint Priorities (ordered)

### 1. AgentNode — Make the Model Explicit
**WHY:** Currently the LLM is invisible. PromptNode = user input, but there's no node where you configure the agent itself. This is the #1 gap from the architecture analysis.

**WHAT:**
- New `AgentNode` at canvas center (between inputs and outputs)
- Configurable: model selector (dropdown), temperature slider, system prompt field
- Planning mode toggle: single-shot / chain-of-thought / ReAct
- Visual: brain icon, model badge, status indicator (idle/thinking/done)
- PromptNode wires INTO AgentNode (left port)
- KnowledgeNode, SkillsNode, McpNode wire into AgentNode (top/bottom ports)
- AgentNode wires OUT to OutputNode (right port)
- ResponseNode reads from AgentNode output

**STORE CHANGES:**
- Add `agentConfig: { model, temperature, systemPrompt, planningMode }` to consoleStore
- AgentNode reads/writes this config

### 2. Test Run — Connect to Real LLM
**WHY:** Currently "TEST RUN" button does nothing. This is the moment Modular becomes real.

**WHAT:**
- Click TEST RUN → assembles context from all connected nodes
- Context assembly order: system prompt → Ground Truth → Signals → Evidence → Framework → user prompt
- Calls OpenClaw API or direct LLM API (configurable)
- Streams response into ResponseNode with typewriter effect
- Token usage displayed in bottom bar (actual vs budget)
- Error handling: API errors show in ResponseNode with retry button

**IMPLEMENTATION:**
- New `src/services/llmService.ts` — abstract LLM call (OpenAI-compatible endpoint)
- API key input in Settings (gear icon in Topbar) → stored in localStorage
- Streaming via fetch + ReadableStream

### 3. Save as Agent — Export Canvas Config
**WHY:** The killer feature. A PM builds an agent visually, exports it as a portable config file.

**WHAT:**
- Click SAVE AS AGENT → modal with name, description, emoji
- Exports current canvas state as `.claude/agents/*.md` (YAML frontmatter + markdown)
- Maps: channels → reads, model → model, skills → tools, mcp → mcp_servers, output → output_format
- Also supports JSON export for non-Claude consumers
- Import button in Topbar loads any agent .md file back into canvas

**ALREADY HAVE:** `utils/agentExport.ts` and `utils/agentImport.ts` — extend these

### 4. Marketplace Phase 1 — Local Install
**WHY:** Skills and MCPs need to be discoverable, not just hard-coded mocks.

**WHAT:**
- SkillPicker reads from `~/.agents/skills/` (real filesystem via API)
- McpPicker reads from `openclaw.yaml` mcp.servers
- Show real installed items, not MOCK_SKILLS/MOCK_MCP_SERVERS
- + ADD button opens picker with search
- Phase 2 (later): remote registry browse + one-click install

### 5. Cable Override — Click to Detach/Reconnect
**WHY:** Users need control over which nodes are connected.

**WHAT:**
- Click a cable → highlight + delete button
- Drag from any output port to any input port to create new connection
- React Flow handles most of this natively — just enable `onConnect` and `onEdgeClick`
- Visual feedback: port glow on hover, cable preview while dragging

### 6. Clean Up Legacy Files
- Delete `CableLayer.tsx` (replaced by React Flow edges)
- Delete `Section.tsx` (replaced by individual node components)
- Keep `components/controls/` (Knob, Scope, Screw, Toggle, LEDIndicator) — these power an "Analog" view mode toggle (future)
- Remove MOCK data from knowledgeBase.ts once real data sources connected

## Architecture After Sprint
```
[InputNode*] ─┐
[KnowledgeNode] ─→ [AgentNode] ─→ [OutputNode] ─→ [ResponseNode]
[SkillsNode] ──┘       ↑
[McpNode] ─────────────┘
                        ↑
              [GuardrailNode*]  (future)
              [OrchestratorNode*]  (future)
```
*InputNode, GuardrailNode, OrchestratorNode = future phases

## Queued (Next Sprint)

### 7. Feedback Edges — Bidirectional Knowledge & Skills
**WHY:** Certain flows enrich the knowledge base (analysis results become new knowledge). Skills discovery (find-skills) can propose installing new skills from within a run.

**Knowledge as Output:**
- AgentNode gets a secondary output port: "KNOWLEDGE OUT"
- FeedbackEdge (dashed, distinct color e.g. cyan) connects Agent → Knowledge
- When agent run produces structured output tagged as "new knowledge", it appears as a pending tile in KnowledgeNode with "Add to base?" action
- Knowledge types auto-classified on ingestion

**Skills as Output:**
- If `find-skills` skill is active, agent can suggest new skills during a run
- Suggestions appear in SkillsNode as ghost tiles with "Install?" action
- One-click install triggers `npx openclaw skill install <repo>`
- After install, skill tile goes from ghost → solid

**Visual:** Feedback edges are visually distinct from forward edges — dashed stroke, different color, animated flow direction indicator (dots moving backward)

## Non-Goals This Sprint
- Multi-agent orchestration (needs solid single-agent first)
- Webhook/schedule triggers (InputNode)
- Guardrails/compliance (GuardrailNode)
- Feedback loops (FeedbackEdge)
- Vercel deploy (do after Test Run works)
