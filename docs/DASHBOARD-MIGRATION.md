# Dashboard Migration — Feature Inventory

## Every feature that must survive the migration

### Topbar
- [x] Logo "MODULAR"
- [x] Agent name display
- [x] Version indicator (v2.1.4)
- [x] Design/Test mode toggle (Pencil/Flask)
- [x] Model selector dropdown (provider + model)
- [x] Output format selector (Markdown, JSON, etc.)
- [x] Preset selector dropdown
- [x] Load Demo Preset button
- [x] Marketplace button → opens Marketplace modal
- [x] Settings button → opens SettingsPage
- [x] Theme toggle (dark/light)
- [x] Import agent button (file input)
- [x] Export agent button

### Left Panel (Sources) — replaces: KnowledgeNode, McpNode, SkillsNode, MemoryNode, GeneratorNode

#### Knowledge Section (from KnowledgeNode)
- Channel list with: name, enabled toggle, knowledge type color dot, depth bar, depth label, token estimate
- Type legend (Ground Truth, Signal, Evidence, Framework, Hypothesis, Artifact)
- Depth control per channel (0=Full to 4=Mention, left/right arrows)
- Knowledge type selector per channel
- Two tabs: Local Files, External Sources
- Local Files: directory path input, Scan button, file tree with checkboxes
- External Sources: URL input, Add button
- Add Files button (opens FilePicker)
- Context allocation breakdown bar (by knowledge type)

#### MCP Servers Section (from McpNode)
- Server list with: name, status dot (ok/warn/err/off), type tag (stdio/sse/http), tool count
- Library button → opens LibraryPicker modal (114 pre-built servers)
- Collapse/expand per server showing tools
- Grid/list view toggle

#### Skills Section (from SkillsNode)
- Skill list with: name, enabled toggle, version, update status
- Library button → opens LibraryPicker modal
- Grid/list view toggle

#### Memory Section (from MemoryNode)
- Session memory config: maxMessages slider, summarizeAfter, summarizeEnabled toggle
- Long-term memory: fact list with add/remove
- Working memory: scratchpad textarea
- Generate ✨ button

#### Generator (from GeneratorNode)
- Brain dump textarea
- Generate button → hydrates ALL stores (agentMeta, instructions, workflow, skills, mcpServers, channels)
- Loading spinner during generation

### Center Panel (Agent Builder) — replaces: AgentNode

#### Identity
- Avatar picker (20 Lucide SVG icons)
- Agent name (inline editable)
- Description textarea
- Tags input (comma-separated)

#### Persona
- Persona textarea
- Tone selector (Formal/Neutral/Casual)
- Expertise selector (Junior/Mid/Senior → maps to 1-5)
- Generate ✨ button (refines persona via LLM)

#### Constraints
- Toggle: Never make up data
- Toggle: Ask before actions
- Toggle: Stay in scope
- Toggle: Use only provided tools
- Toggle: Limit words (with word limit input)
- Custom constraints textarea
- Scope definition textarea
- Generate ✨ button

#### Objectives
- Primary objective textarea
- Success criteria list (add/remove)
- Failure modes list (add/remove)
- Generate ✨ button

#### System Prompt
- Raw prompt textarea (auto-synced or manual)
- Auto-sync toggle

#### Workflow (from WorkflowNode)
- Step list with: number, label, action, tool selector, condition, loop toggle, max iterations
- Drag-to-reorder steps
- Add Step button
- Remove step (X button)
- Visual connectors between steps
- Generate ✨ button
- Error handling config: onStepFailure, retryCount, fallbackAction
- Checkpoint toggle, timeout, graceful degradation

#### Context Budget
- Total token budget display
- Budget bar with fill percentage
- Breakdown by category (Knowledge, Instructions, Workflow, Memory)
- Budget track from TokenBudget component

### Right Panel (Test & Export) — replaces: PromptNode, OutputNode, ResponseNode, AgentPreviewNode

#### Prompt Section (from PromptNode)
- Prompt textarea with auto-grow
- Char count and token estimate
- Output format auto-detection tag
- Advanced settings (collapsible): model dropdown, thinking depth, max output tokens slider
- Preview/Run button
- Save As Agent button

#### Response Section (from ResponseNode)
- Streaming response display with markdown rendering
- Status indicator (running/complete/empty)
- Copy button
- Expand to fullscreen button
- Knowledge source chips (what was used)

#### Output Section (from OutputNode)
- Output format tabs
- Template config per format (Notion, HTML Slides, Slack/Email)
- Generate ✨ for output templates
- View mode: Formatted / Raw / Config

#### Agent Preview (from AgentPreviewNode)
- 3 viz styles: Card (radar chart), Circuit, Layers
- View switcher toggle
- Radar chart SVG (5-axis)
- Completeness ring
- Knowledge/Skills/MCP counts
- Model badge
- Workflow step summary

#### Conversation Tester (from ConversationTester)
- Chat messages (user/assistant)
- Message input
- Send button
- Streaming responses
- Test cases tab: define input + expected behavior
- Run all tests button
- History tab

#### Export
- Export targets: Claude Code (.md), OpenClaw (.yaml), Vibe Kanban (.json)
- Export button per target
- YAML export (agentExportYaml.ts)
- MD export (agentExport.ts)

### Modals/Overlays (unchanged)
- SettingsPage (providers, MCP, skills tabs)
- Marketplace (skills, MCP, presets tabs with search/filter)
- SaveAgentModal
- FilePicker
- McpPicker → LibraryPicker
- SkillPicker → LibraryPicker
- ConnectorPicker
- PickerModal (portal)

### Design/Test Mode
- Design mode: shows the 3-panel dashboard
- Test mode: TestMode component with TestPromptNode → TestAgentNode → TestResponseNode (keep as-is)

### Stores (ALL preserved, no changes)
- consoleStore (agentMeta, instructionState, workflowSteps, channels, mcpServers, skills, etc.)
- providerStore (providers, models, selectedProviderId)
- conversationStore (chat messages, test cases, panel state)
- memoryStore (session config, long-term facts, working memory)
- modeStore (design/test)
- themeStore (dark/light)
- versionStore (agent versions)
- knowledgeStore (file tree, scanning)
- mcpStore (server states, tools)
- skillsStore (installed skills)

### Services (ALL preserved)
- llmService.ts (streamCompletion, fetchCompletion, streamAgentSdk, fetchAgentSdkCompletion)
- contextAssembler.ts (assembleContext)

### Utils (ALL preserved)
- agentExport.ts, agentExportYaml.ts, agentImport.ts
- generateAgent.ts, generateSection.ts
- refineInstruction.ts, refineOutputTemplate.ts
- formatTokens.ts, ghostSuggestions.ts

### Backend (unchanged)
- All routes: /api/providers, /api/mcp, /api/llm/chat, /api/agent-sdk/chat, /api/skills/search, /api/knowledge, /api/claude-config

### DS Components (ALL preserved)
- Avatar, Badge, Button, Card, Chip, Divider, EmptyState, IconButton, Input, Modal, Progress, Select, Spinner, StatusDot, Tabs, TextArea, Toggle, Tooltip

## Architecture Change

### Before (Canvas)
- ReactFlow canvas with 11 node types + 2 edge types
- Nodes as independent React components with Handles
- App.tsx manages nodes/edges state

### After (Dashboard)
- 3-panel layout (CSS grid: 320px | 1fr | 380px)
- Left: collapsible sections (Knowledge, MCP, Skills, Memory, Generator)
- Center: scrollable agent document builder
- Right: tabbed panel (Test, Preview, Export)
- No ReactFlow in design mode (keep for test mode only)
- Reuse ALL existing node component internals — extract the body content, discard Handle/wrapper
