# V2 UX Vision — Wizard Flow + Agent IDE

## The Problem
The current single-page 3-panel layout crams everything into one view. Every section fights for attention. The user sees 22 knowledge files with sliders, 8 agent config sections, MCP servers, skills, memory, and a test panel — all at once. There's no flow, no focus, no sense of progress.

## The Vision
**A wizard flow for creation → a full-page review → an IDE for testing.**

Three distinct modes, not three panels side by side.

---

## Reference Applications

### OpenAI Agent Builder (closest match)
- **What it does right:** Visual canvas with nodes, typed edges, preview/debug, publish/deploy workflow. 3 clear steps: Design → Publish → Deploy.
- **What we take:** The 3-step mental model. The idea of "publish" creating a snapshot. Preview as a distinct mode.
- **What we don't take:** Node-based canvas. Too engineer-y for our "describe in plain language" approach.

### Nimbalyst (agent-native workspace)
- **What it does right:** Session-centric view. Agent + files side by side. Session kanban for tracking. File edits sidebar.
- **What we take:** The IDE layout for the Test phase. Agent conversation with file/context sidebar. Session management.
- **What we don't take:** It's developer-focused (git, worktrees). Our users think in knowledge, not code.

### Dify (90K⭐ agent builder)
- **What it does right:** Separate pages for "Orchestrate" (build) vs "Monitor" (observe). Clean tab navigation. Simple prompt-first interface with knowledge config as a separate panel.
- **What we take:** Tab-based navigation between build phases. Knowledge as its own dedicated page. Clean separation of concerns.

### Cursor/Windsurf IDE pattern
- **What it does right:** Main editor area + chat sidebar + file tree. Context-aware chat. The chat knows about your files.
- **What we take:** The test phase should look like this — conversation is primary, context/trace is secondary.

### Wordware ("Sauna" — context lab)
- **What it does right:** "Compounding context" as a product concept. Learning taste, detecting patterns.
- **What we take:** The narrative around context engineering. Missing Sources and Insights ARE the product.

---

## Proposed Architecture: 4 Tabs

```
┌──────────────────────────────────────────────────────┐
│  🔴 MODULAR    [1.Describe] [2.Knowledge] [3.Tools]  │
│                [4.Configure] [5.Review] [6.Test]      │
│                                    ⚙ Settings  ▶ Run │
└──────────────────────────────────────────────────────┘
```

### Tab 1: DESCRIBE (the meta-prompt)
**Goal:** "Who is this agent and what does it do?"

```
┌─────────────────────────────────────────────┐
│                                             │
│   Describe your agent in plain language     │
│   ┌─────────────────────────────────────┐   │
│   │                                     │   │
│   │  (large textarea, hero element)     │   │
│   │                                     │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Quick presets: [Research] [Code Review]    │
│                  [Maritime] [Writing]        │
│                                             │
│              [ Next: Knowledge → ]          │
│                                             │
└─────────────────────────────────────────────┘
```

- Full-page focus on the prompt
- Nothing else visible — no sliders, no config
- Quick presets as inspiration
- "Next" advances to Knowledge tab

### Tab 2: KNOWLEDGE (the context engineering core)
**Goal:** "What does this agent know?"

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│  LOCAL FILES         │  KNOWLEDGE MAP       │
│  ─────────────       │  ─────────────       │
│  + Add files         │  22 sources          │
│  + Index repo        │  56K tokens total    │
│                      │                      │
│  ■ DESIGN.md    3K   │  ┌─── Ground Truth   │
│  ■ FEEDBACK.md  99   │  │    ██████░ 40%    │
│                      │  ├─── Signal          │
│  MCP KNOWLEDGE       │  │    ████░░░ 25%    │
│  ─────────────       │  ├─── Evidence        │
│  + Connect           │  │    ███░░░░ 20%    │
│  Notion, Confluence, │  └─── Other           │
│  Context7, Memory    │       ██░░░░░ 15%    │
│                      │                      │
│  Each source:        │  TOKEN BUDGET         │
│  - URL or hint       │  ████████░░ 42K/200K │
│  - Auto-classify     │                      │
│  - Depth slider      │  [ ◂ Describe ]      │
│                      │  [ Tools ▸ ]         │
└──────────────────────┴──────────────────────┘
```

- **Left:** Sources list (local files + MCP knowledge connectors)
- **Right:** Knowledge map visualization — type distribution, token budget, index status
- MCP connectors here are specifically for **knowledge sources** (Notion, Confluence, Context7, Google Drive)
- Each source: name, type badge, depth slider, token count
- "Index" button to run tree indexing
- This is where context engineering value lives — clean, focused, spacious

### Tab 3: TOOLS (skills + MCP tools)
**Goal:** "What can this agent do?"

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│  SKILLS              │  MCP TOOL SERVERS    │
│  ─────────────       │  ─────────────       │
│  + Add from library  │  + Connect           │
│                      │                      │
│  ◉ web-search        │  ● GitHub (26 tools) │
│  ◉ code-review       │  ● Filesystem (14)   │
│  ◉ maritime-expert   │  ○ Slack (disconn.)  │
│                      │                      │
│  Each skill:         │  Each server:        │
│  - SecurityBadges    │  - Status dot        │
│  - Toggle on/off     │  - Tool count        │
│  - Brief description │  - Reconnect button  │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

- Clean 2-column: Skills (left) and MCP Servers (right)
- Distinction is clear: Skills = prompt-based capabilities, MCP = tool endpoints
- SecurityBadges on each skill
- Status dots + health on each MCP server

### Tab 4: CONFIGURE (memory + advanced)
**Goal:** "Advanced settings for power users"

```
┌─────────────────────────────────────────────┐
│                                             │
│  MEMORY SETTINGS                            │
│  ─────────────                              │
│  Conversation window: [10] messages         │
│  Seed facts: [+ Add fact]                   │
│  Knowledge graph: [enabled/disabled]        │
│                                             │
│  ADVANCED                                   │
│  ─────────────                              │
│  Temperature: [0.7]                         │
│  Planning mode: [single-shot ▾]             │
│  Output format: [markdown ▾]               │
│  Output templates: [...]                    │
│                                             │
│  MODEL                                      │
│  ─────────────                              │
│  Provider: [Anthropic ▾]                    │
│  Model: [claude-sonnet-4 ▾]              │
│                                             │
└─────────────────────────────────────────────┘
```

- Settings that most users will skip
- Memory config, temperature, planning mode, model selection
- Full page, no clutter — just forms

### Tab 5: REVIEW (the generated agent)
**Goal:** "Here's what the AI built from your context"

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│  AGENT CARD          │  ⚠ MISSING SOURCES   │
│  ─────────────       │  ─────────────       │
│  🤖 Maritime         │  ■ Competitor data   │
│  Research Analyst    │    [+ Add source]    │
│                      │  ■ API docs          │
│  Description:        │    [+ Add source]    │
│  "Researches..."     │                      │
│                      │  💡 INSIGHTS (12)     │
│  Persona:            │  ─────────────       │
│  "You are a..."      │  ● "Rate limit 100"  │
│                      │  ● "Revenue $2M"     │
│  Constraints:        │  ● "Dark mode 3:1"   │
│  - Never make up     │                      │
│  - Stay in scope     │  🔴 3 ground-truth   │
│                      │  🟡 4 signals         │
│  System Prompt:      │  🔵 5 evidence       │
│  [full text, edit]   │                      │
│                      │  [ ← Regenerate ]    │
│  [ Export ▾ ]        │  [ Test Agent → ]    │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

- **Left:** Clean agent card — everything the AI generated, readable, editable
- **Right:** The two differentiators — Missing Sources + Insights
- This is where you review, tweak, and approve
- "Regenerate" sends back to Describe with refinements
- "Export" downloads for Claude/Codex/Amp/etc.
- "Test Agent" opens the IDE

### Tab 6: TEST (the agent IDE)
**Goal:** "Talk to your agent, observe its reasoning"

```
┌────────┬──────────────────────┬─────────────┐
│ TRACE  │    CONVERSATION      │  CONTEXT    │
│        │                      │             │
│ Step 1 │  You: "What are..."  │ Sources:    │
│ → read │                      │ DESIGN.md   │
│ → comp │  Agent: "Based on    │ FEEDBACK.md │
│ → rank │  my analysis..."     │             │
│        │                      │ Budget:     │
│ Step 2 │  You: "Compare..."   │ 42K / 200K  │
│ → tool │                      │             │
│ → resp │  Agent: "The main    │ Memory:     │
│        │  differences are..." │ 3 facts     │
│        │                      │             │
│ Stats  │  [Type here...]      │ Pipeline:   │
│ 1.2s   │                      │ 82% util    │
│ 42K tk │                      │             │
└────────┴──────────────────────┴─────────────┘
```

- **Inspired by Cursor/Windsurf:** Chat is primary, panels are secondary
- **Left panel:** Pipeline trace — every step the agent takes (retrieve, compress, rank, generate)
- **Center:** Conversation — markdown rendered, code blocks, etc.
- **Right panel:** Context inspector — which sources were used, budget utilization, memory state
- This is a proper IDE, not a chat widget in a corner

---

## Navigation Model

### Option A: Linear Wizard (recommended for v2)
```
[1] → [2] → [3] → [4] → [5] → [6]
 ↑______________________________|  (back to any step)
```
- Steps light up as completed
- Can jump to any completed step
- "Generate" transition between [4] Configure → [5] Review runs the LLM
- Step indicators in the top bar show progress

### Option B: Free Tabs
```
[Describe] [Knowledge] [Tools] [Configure] | [Review] [Test]
```
- Any tab accessible anytime
- Left 4 = creation, right 2 = results
- Separator between "build" and "use"
- Less guided, more power-user friendly

### Recommendation
**Start with Option A (wizard)** for the creation flow (tabs 1-4), then **switch to Option B (free tabs)** for Review and Test. The creation benefits from guidance; the review/test benefits from freedom.

---

## Migration Plan

### Phase A: Tab infrastructure (~3h)
- Replace 3-panel layout with tab-based router
- Each tab = a full-page component
- Shared state via existing zustand stores
- Top bar: step indicators + settings + run button

### Phase B: Describe tab (~1h)
- Extract brain dump from SourcesPanel into its own page
- Full-page focus, large textarea
- Presets as cards instead of tiny pills

### Phase C: Knowledge tab (~4h)
- Extract KnowledgeSection + MissingSources + file picker
- Add 2-column layout: sources list + knowledge map visualization
- Token budget bar
- MCP knowledge connectors (Notion, Confluence) moved here

### Phase D: Tools tab (~2h)
- Extract SkillsSection + McpSection
- 2-column: skills | MCP servers
- Clean card-based layout

### Phase E: Configure tab (~1h)
- Extract MemorySection + advanced config
- Simple form layout
- Model selector from Settings

### Phase F: Review tab (~3h)
- New component: agent card (clean, readable)
- Missing Sources + Insights as the right panel
- Editable system prompt
- Export button with target selector

### Phase G: Test tab / Agent IDE (~5h)
- Redesign TestPanel as a 3-panel IDE
- Left: pipeline trace (from InlineTraceView)
- Center: conversation (existing chat)
- Right: context inspector (sources used, budget, memory)
- Resize handles between panels

### Total estimate: ~19h across 7 phases

---

## Comparison: Current vs Proposed

| Aspect | Current (v1) | Proposed (v2) |
|--------|-------------|---------------|
| Layout | 3 panels, all visible | 6 tabs, one at a time |
| Knowledge | 22 files with sliders inline | Dedicated tab with map viz |
| Config | Scroll through 8 sections | Wizard steps, one focus |
| Missing Sources | Small banner | Half of Review tab |
| Test | Collapsed right panel | Full IDE with trace + context |
| First impression | "This is a lot" | "Describe your agent" |
| Cognitive load | High | Progressive |

---

## What This Unlocks
1. **Better onboarding** — new users see one thing: "Describe your agent"
2. **Context engineering as the product** — Knowledge tab is THE core, with space to breathe
3. **Agent IDE** — a real testing environment, not a chat widget
4. **Review as a moment** — Missing Sources + Insights get the spotlight they deserve
5. **Export becomes meaningful** — you've built something, now ship it

---

## Design Decisions (Resolved)

1. **Wizard order:** Linear from 1→4 (must complete each step), then free access to any tab including 5 (Review) and 6 (Test). Once generated, all tabs unlocked.
2. **Current layout:** Keep as "Compact Mode" toggle for power users. Don't delete the code — just add the wizard as default.
3. **Load agent:** Jumps directly to Review (tab 5). From there, user can navigate back into any tab to edit.
4. **Test persistence:** Test tab (conversation, trace, context state) persists until user clicks "New" agent. New agent resets everything back to Describe (tab 1).
