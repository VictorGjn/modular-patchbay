# SPEC V3 — The Context Mixing Console

*Incorporating all of Victor's vision from Feb 25-26 2026 session*

---

## Design Principles

1. **3 clicks from question to answer** — not 15
2. **Everything auto-wires** — cables exist but are pre-connected
3. **Simple by default, powerful on demand** — progressive disclosure at every level
4. **The analog aesthetic IS the interface** — not decoration, but affordance
5. **Knowledge has weight** — not all context is equal

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR                                                  │
│  [MODULAR] [Model ▼] [Preset ▼] [Output ▼]    [▶ RUN]  │
├─────────────────────────────────────────────────────────┤
│  PROMPT BAR                                              │
│  ┌─────────────────────────────────────┐  ┌──────────┐  │
│  │ Ask anything...                     │  │ 142 tok  │  │
│  └─────────────────────────────────────┘  └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  CHANNEL STRIPS                              + ADD  🔍   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌ ─ ─ ┐           │
│  │    │ │    │ │    │ │    │ │    │ │ghost│           │
│  │ 🔴 │ │ 🟡 │ │ 🔵 │ │ 🟢 │ │ 🟣 │ │     │           │
│  │ ON │ │ ON │ │ ON │ │ OFF│ │ ON │ │     │           │
│  │ ◉  │ │ ◉  │ │ ◉  │ │ ◉  │ │ ◉  │ │  ?  │           │
│  │Full│ │Sum │ │Det │ │Hdl │ │Mnt │ │     │           │
│  │4.2K│ │1.8K│ │3.1K│ │  0 │ │0.3K│ │     │           │
│  │▓▓▓ │ │▓▓░ │ │▓▓▓ │ │░░░ │ │▓░░ │ │ ░░░ │           │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └ ─ ─ ┘           │
├─────────────────────────────────────────────────────────┤
│  SIGNAL FLOW (collapsible — auto-wired by default)       │
│  [Sources] ──→ [Process] ──→ [Model] ──→ [Output]       │
│       ↑            ↑           ↑           ↑             │
│    (channels)  (summarize)  (opus-4)    (markdown)       │
│                (websearch)              (slides)          │
│                (verify)                 (email)           │
├─────────────────────────────────────────────────────────┤
│  RESPONSE AREA                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Response content...                    [🟢 92% grounded] │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  TOKEN BUDGET  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  32.4K / 200K     │
└─────────────────────────────────────────────────────────┘
│  TOOL RACK (collapsible bottom drawer)                   │
│  [MCP: Gmail ✓] [MCP: Slack ✓] [Skill: slides ✓]       │
│  [MCP: Notion ○] [MCP: HubSpot ○]  [+ Find tools...]   │
└─────────────────────────────────────────────────────────┘
```

---

## I. CHANNEL STRIPS (Enhanced)

### Knowledge Type Badge

Every channel has a colored badge indicating its epistemic weight:

| Badge | Type | Color | Behavior |
|-------|------|-------|----------|
| 🔴 | Ground Truth | `#e74c3c` | "Do not contradict this" |
| 🟡 | Signal | `#f1c40f` | "Interpret, don't parrot — run Insight Ladder" |
| 🔵 | Evidence | `#3498db` | "Cite and weigh against other evidence" |
| 🟢 | Framework | `#2ecc71` | "Use to structure thinking, not as immutable" |
| 🟣 | Hypothesis | `#9b59b6` | "Help validate or invalidate" |
| ⚪ | Artifact | `#95a5a6` | "May be outdated — cross-reference" |

**Auto-classification:** Based on path + content heuristics:
- `07 - Signals/` → 🟡 Signal
- `00 - Knowledge/Products/` → 🔴 Ground Truth (shipped features)
- `01 - Discovery/` → 🟣 Hypothesis
- `05 - Intel/` → 🔵 Evidence
- `00 - Knowledge/Competitors/` → 🔵 Evidence
- `03 - Roadmap/` → 🟢 Framework
- `plans/` → 🟢 Framework
- `CMO-Handoff/` → ⚪ Artifact

**User override:** Click the badge to cycle through types.

### Freshness Indicator

Small dot next to channel name:
- 🟢 Fresh (< 30 days since last update)
- 🟡 Recent (30-90 days)
- 🟠 Aging (90-180 days)
- 🔴 Stale (> 180 days)

### Ghost Channels

Dimmed, dashed-border channel strips that appear as suggestions:
- Based on prompt analysis: "You mentioned Odfjell — add Odfjell feedback?"
- Based on active channels: "You have competitors ON but no products — add Products?"
- Based on knowledge type gaps: "All Signal, no Ground Truth — add Products?"

Click a ghost to materialize it as a real channel.

---

## II. OUTPUT FORMAT SELECTOR

Dropdown in Topbar, next to model selector:

| Format | Icon | Extension | Notes |
|--------|------|-----------|-------|
| Markdown | 📝 | .md | Default for docs, analyses, notes |
| HTML Slides | 🎯 | .html | Uses frontend-slides skill |
| Rich Document | 📄 | .docx | Via pandoc |
| Email Draft | ✉️ | — | Subject + body, ready to send |
| Code | 💻 | .py/.ts/.sql | Language auto-detected from prompt |
| Data Table | 📊 | .csv | Structured extraction |
| Presentation | 📽️ | .pptx | If python-pptx available |
| Slack Post | 💬 | — | Formatted for Slack markdown |
| JSON | {} | .json | Machine-readable output |
| Diagram | 🔀 | .svg | Mermaid/PlantUML rendered |

**Smart default:** Auto-selects based on prompt:
- "Write a PRD" → Markdown
- "Prepare slides for" → HTML Slides
- "Draft an email to" → Email Draft
- "Build a chart of" → Data Table + Diagram
- "Create a script that" → Code

---

## III. SIGNAL FLOW VIEW (Collapsible)

A horizontal pipeline visualization below the channel strips. Hidden by default (click "▼ Signal Flow" to reveal).

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│ SOURCES  │───→│ PROCESS   │───→│ MODEL    │───→│ OUTPUT   │
│          │    │           │    │          │    │          │
│ 5 active │    │ Summarize │    │ Opus 4   │    │ Markdown │
│ channels │    │ WebSearch │    │ temp 0.3 │    │          │
│          │    │ ───       │    │          │    │          │
└──────────┘    └───────────┘    └──────────┘    └──────────┘
```

**Auto-wired:** The pipeline connects automatically based on:
- Active channels → summarization insert (if total tokens > budget) → model → output format

**Cable override:** Click a connection to rewire:
- Route specific channels through a different processing stage
- Use a different model for summarization vs synthesis
- Split output to multiple formats simultaneously

**Add processing stages:** Click `+` between stages to insert:
- WebSearch enrichment
- Verification (fact-check against ground truth channels)
- Translation
- Code execution (run code blocks)
- Insight Ladder (for Signal-type channels)

---

## IV. AGENT TEAM ORCHESTRATION

### The Session Bus — Multi-Agent View

When you need more than one model pass, toggle from "Solo" to "Team" mode in Topbar.

```
┌─ TEAM VIEW ──────────────────────────────────────────────┐
│                                                           │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐         │
│  │ RESEARCH │     │ ANALYSIS │     │ EDITOR   │         │
│  │ Sonnet 4 │────→│ Opus 4   │────→│ Haiku    │         │
│  │          │     │          │     │          │         │
│  │ WebSearch│     │ All ctx  │     │ Tone +   │         │
│  │ 5 sources│     │ + research│    │ Format   │         │
│  │          │     │ output   │     │          │         │
│  │ ● Running│     │ ○ Waiting│     │ ○ Waiting│         │
│  └──────────┘     └──────────┘     └──────────┘         │
│        ↑                                                  │
│   ┌──────────┐                                           │
│   │ VERIFY   │                                           │
│   │ Sonnet 4 │ (sidechain — checks facts)                │
│   │ GT only  │                                           │
│   │ ○ Waiting│                                           │
│   └──────────┘                                           │
│                                                           │
│  [+ Add Agent]  [Team Presets ▼]                          │
└───────────────────────────────────────────────────────────┘
```

### Agent Node Configuration

Each agent in the team is a mini mixing console:
- **Model selector** — which LLM runs this agent
- **Context filter** — which channels this agent sees (inherit from main, or subset)
- **Instructions** — custom system prompt for this agent's role
- **Input** — what feeds this agent (channels, or output from another agent)
- **Output routing** — where does this agent's output go (next agent, or final output)

### Team Presets

Pre-built multi-agent workflows:

| Preset | Agents | Flow |
|--------|--------|------|
| **Deep Research** | Lead + 3-5 Researchers + Synthesizer | Parallel search → merge → synthesize |
| **Content Pipeline** | Researcher → Writer → Editor → Formatter | Sequential refinement |
| **Competitive Intel** | Scraper + Analyst + Strategist | Parallel gather → analyze → recommend |
| **Code Review** | Reader → Reviewer → Security Auditor | Sequential analysis |
| **Discovery** | Signal Analyst → User Researcher → PM Strategist | Ladder: signal → need → feature |
| **Meeting Prep** | Context Assembler → Agenda Builder → Profiler | Parallel prep → merge |
| **Due Diligence** | Company Intel → Financial → Risk → Synthesizer | Parallel deep-dive → merge |
| **Feedback Sprint** | Classifier → Analyzer → Prioritizer | Sequential triage |

### Agent-to-Agent Cables

This is where cables make sense again — but between AGENTS, not between knowledge sources.

- **Auto-wired by default** based on team preset
- **Rewirable** by dragging cable endpoints
- **Conditional routing:** "If Research agent finds competitor mention, also route to Competitive agent"
- **Human-in-the-loop:** Insert a "pause" node that shows intermediate output for approval before continuing

### New Interaction: Prompt → Auto-Team

Type a complex prompt. The system analyzes it and suggests a team:

```
Prompt: "Prepare a competitive analysis of StormGeo for the Odfjell pitch next Tuesday"

SUGGESTED TEAM:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ COMPETITOR    │    │ CLIENT       │    │ SYNTHESIZER  │
│ RESEARCHER    │    │ CONTEXT      │    │              │
│ Sonnet 4     │───→│ Opus 4       │───→│ Opus 4       │
│              │    │              │    │              │
│ WebSearch +  │    │ Odfjell docs │    │ Merge into   │
│ StormGeo     │    │ + feedback   │    │ slide deck   │
│ features     │    │ + savings    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘

Output: HTML Slides (auto-detected from "pitch")

[Accept] [Modify] [Solo Mode Instead]
```

**Accept** runs the team as suggested.
**Modify** opens the team view for adjustments.
**Solo Mode** collapses to single-model with all context mixed.

---

## V. TOOL RACK

### Bottom Drawer (Pull-up Panel)

A collapsible panel at the very bottom showing available tools.

```
┌─ TOOL RACK ─────────────────────────────────────────────┐
│                                                          │
│  CONNECTED                                               │
│  [Gmail ✓ 📧] [GitHub ✓ 🔧] [Firecrawl ✓ 🕷️]          │
│                                                          │
│  AVAILABLE                                               │
│  [Notion ○] [Slack ○] [HubSpot ○] [Supabase ○]         │
│                                                          │
│  SKILLS                                                  │
│  [frontend-slides ✓ 🎯] [weather ✓ 🌤️] [whisper ✓ 🎤]  │
│  [coding-agent ○] [feedback-analyzer ○]                  │
│                                                          │
│  [🔍 Find new tools on ClawhHub...]                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tool Effects on Console

When a tool is enabled, new options light up across the console:

| Tool | Unlocks |
|------|---------|
| Gmail MCP | New input: "Email channel" (OnWatch label). New output: "Email draft" |
| Slack MCP | New output: "Slack post". New input: "Slack channel monitor" |
| Firecrawl | New processing: "Web scrape enrichment". New input: URL as channel |
| frontend-slides | New output: "HTML Slides" |
| whisper | New input: "Voice memo" (audio file → transcription) |
| GitHub | New input: "Repo diff". New output: "PR comment" |
| Notion | New input: "Notion database". New output: "Notion page" |
| HubSpot | New input: "Deal pipeline". New output: "CRM update" |

### Tool Discovery

"Find new tools" opens a search panel:
- Search ClawhHub / npm for MCP servers
- Filter by category (communication, data, code, productivity)
- One-click install + configure
- Each tool shows: name, description, what it unlocks (inputs/outputs/processing)
- Rating + install count from community

---

## VI. DISCOVERABLE UX — Progressive Disclosure

### Level 0: Blank Slate
- Open app → see empty console with prompt bar
- Type a question → hit RUN → get answer (default model, no context)
- **Tooltip:** "Add context to get better answers →"

### Level 1: Add Context
- Click "+ ADD" or select a preset
- Channel strips appear
- Toggle ON/OFF, adjust depth
- **Tooltip:** "Knowledge types affect how the AI treats your sources. Click a badge to learn more."

### Level 2: Knowledge Types
- Badge appears on each channel
- Click to learn what it means
- Adjust type if auto-classification is wrong
- **Tooltip:** "Signals are interpreted, not parroted. Ground Truth is never contradicted."

### Level 3: Output Formats
- Notice the output dropdown
- Select different formats
- See output change accordingly
- **Tooltip:** "Different outputs for different audiences. Slides for meetings, docs for deep work."

### Level 4: Signal Flow
- Click "▼ Signal Flow" to reveal pipeline
- See auto-wired flow
- Add processing stages
- **Tooltip:** "Add WebSearch to enrich your context. Add Verify to fact-check output."

### Level 5: Agent Teams
- Toggle "Team" mode
- See multi-agent orchestration
- Configure per-agent models and context
- **Tooltip:** "Complex questions benefit from multiple specialized agents."

### Level 6: Tool Rack
- Pull up Tool Rack
- Browse available tools
- Enable new capabilities
- Find new tools on ClawhHub

### Contextual Hints

Non-intrusive tips that appear based on behavior:

| Trigger | Hint |
|---------|------|
| All channels at FULL depth | "Tip: Lower depth on background channels to focus the AI on key sources" |
| Total tokens > 80% budget | "Running hot! Consider Summary depth on less critical channels" |
| Prompt mentions entity not in channels | "Ghost channel: '{entity}' found in your knowledge base — add it?" |
| All channels same knowledge type | "One-note mix: adding different knowledge types produces richer output" |
| Running Solo with complex prompt | "This looks like a multi-step task. Try Team mode?" |
| First time using a preset | "This preset loads context for {workflow}. Customize by toggling channels." |
| Output seems hallucinated (low grounding) | "⚠️ Low grounding score. Enable Expert Mode to see source attribution." |

---

## VII. EXPERT MODE — Confidence & Verification

Toggle in Topbar: `[Expert Mode: OFF]`

When ON:

### Confidence Meter on Response
- VU-style meter: 🟢 0-60% → 🟡 60-80% → 🔴 80-100%
- Shows ratio of grounded vs generated content

### Inline Annotations
- Every paragraph gets a small badge:
  - 🟢 Well-grounded (multiple source channels agree)
  - 🟡 Single-source (one channel supports this)
  - 🔴 Generated (no direct source in any active channel)

### Source Attribution Panel
- Side drawer showing which channels contributed to which parts
- Click any sentence → highlights the source passage in the relevant channel
- Hover → tooltip shows: "Source: 00-Knowledge/Clients/Odfjell, line 42, confidence: high"

### Contradiction Alerts
- Red pulse on channel strips when their content conflicts with the output
- "⚠️ Channel 'Odfjell Feedback' says X, but output says Y"
- Option to re-run with contradiction resolved

---

## VIII. IMPLEMENTATION PRIORITY

### Phase 1 (v2.1) — Quick Wins
- [ ] Knowledge type badges (auto-classified by path)
- [ ] Output format dropdown (Markdown/HTML/Email/Code)
- [ ] Ghost channels (prompt analysis → suggestions)
- [ ] Contextual hints (first 3-4 most common)
- [ ] Freshness indicators (mock for now)

### Phase 2 (v2.5) — Signal Flow
- [ ] Collapsible signal flow pipeline view
- [ ] Processing stage inserts (summarize, websearch, verify)
- [ ] Cable override between stages
- [ ] Smart auto-select for output format
- [ ] Temperature knob on master section

### Phase 3 (v3.0) — Agent Teams
- [ ] Solo/Team mode toggle
- [ ] Team presets (Deep Research, Content Pipeline, etc.)
- [ ] Agent nodes with per-agent config
- [ ] Agent-to-agent cables (auto-wired)
- [ ] Prompt → auto-team suggestion
- [ ] Human-in-the-loop pause nodes

### Phase 4 (v3.5) — Tool Ecosystem
- [ ] Tool Rack drawer
- [ ] MCP server integration (list, enable, configure)
- [ ] Skill discovery (ClawhHub search)
- [ ] Tool → capability mapping (unlock inputs/outputs)
- [ ] Live data channels (email, Slack, RSS)

### Phase 5 (v4.0) — Expert Mode
- [ ] Confidence meter
- [ ] Inline source annotations
- [ ] Source attribution panel
- [ ] Contradiction detection
- [ ] Insight Ladder for Signal channels

### Phase 6 (v5.0) — Production
- [ ] Real LLM API integration
- [ ] Real file system scanning (Documents/Product/)
- [ ] Real token counting (tiktoken)
- [ ] Console chaining
- [ ] Time travel (run history + diff)
- [ ] Collaborative consoles
- [ ] Live console mode

---

## IX. TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 7 |
| State | Zustand |
| Styling | Tailwind CSS v4 + CSS modules for analog components |
| Controls | Custom (Knob, Toggle, LED, VU, Screw — from v1) |
| Flow visualization | @xyflow/react v12 (ONLY for agent team view, not main UI) |
| Fonts | Space Mono (labels), Inter (body) |
| LLM Integration | OpenAI + Anthropic SDKs |
| Token Counting | tiktoken (WASM) |
| File System | Electron or Tauri (future — for real FS access) |
| MCP | @modelcontextprotocol/sdk |

---

*This spec is the roadmap. Phase 1 starts tonight.*

*— Claw 🦀, 01:00 CET*
