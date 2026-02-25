# AGENT TEAMS — New Interaction Patterns for Multi-Agent Orchestration

*"Create new ways to interact with a multiple team of agents to make it longer but efficient." — Victor*

---

## The Problem with Current Multi-Agent UX

Today's multi-agent interfaces all share the same failing: they either show you a wall of text (sequential chat logs) or a complex node graph (LangGraph). Neither maps to how humans naturally think about delegation and collaboration.

**Humans think about teams as:**
- People with roles
- Conversations between them
- Work products they hand off
- A leader who coordinates

**Not as:**
- Nodes and edges
- Sequential message queues
- JSON configuration files

---

## The Studio Metaphor

In a recording studio:
- The **producer** (you) sits at the mixing console
- **Session musicians** (agents) play their parts
- The **engineer** (the system) handles routing and levels
- Everyone can hear each other through **monitor mixes** (shared context)
- The producer can **solo** any musician to hear their part alone
- Parts are recorded on **separate tracks** and mixed later

This maps perfectly to multi-agent work.

---

## I. THE TEAM BAR — Agent Strip View

Below the channel strips, a second row appears when Team mode is ON:

```
┌─ AGENTS ────────────────────────────────────────────────┐
│                                                          │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│ │🔍RESEARCH│─→│📊ANALYZE │─→│✏️ WRITE  │─→│📋OUTPUT │  │
│ │ Sonnet 4 │  │ Opus 4   │  │ Haiku 3.5│  │  (you)  │  │
│ │          │  │          │  │          │  │         │  │
│ │ Web + 3  │  │ All ctx  │  │ Analysis │  │ Slides  │  │
│ │ sources  │  │+ research│  │ + tone   │  │         │  │
│ │          │  │          │  │          │  │         │  │
│ │ ● 45s    │  │ ○ wait   │  │ ○ wait   │  │ ○ wait  │  │
│ │ ▓▓▓▓░░░░ │  │ ░░░░░░░░ │  │ ░░░░░░░░ │  │ ░░░░░░░ │  │
│ └──────────┘  └──────────┘  └──────────┘  └─────────┘  │
│                                                          │
│ [+ Add Agent]  [Team: Deep Research ▼]  [SOLO: off ▼]   │
└──────────────────────────────────────────────────────────┘
```

### Agent Strip Controls

Each agent strip mirrors the channel strip aesthetic but for an agent:

| Control | Function |
|---------|----------|
| **Role label** | 🔍 RESEARCH, 📊 ANALYZE, ✏️ WRITE, 🔎 VERIFY |
| **Model selector** | Dropdown: which LLM runs this agent |
| **Context filter** | Which channels feed this agent (click to configure) |
| **Input label** | What feeds in: "Web + 3 sources" or "Previous agent output" |
| **Status LED** | ● Running (green pulse), ○ Waiting (dim), ✓ Done (solid green), ✕ Failed (red) |
| **Progress bar** | VU-style showing progress |
| **Time indicator** | How long this agent has been running |
| **SOLO button** | Monitor only this agent's output (mutes others) |
| **MUTE button** | Skip this agent in the chain |

### Agent-to-Agent Flow

Arrows between agent strips show data flow. These are the "cables" — but between agents, not knowledge sources.

**Default flow:** Linear chain (Research → Analyze → Write → Output)

**Configurable:**
- **Parallel split:** Research fans out to 3 parallel researchers, merge back
- **Conditional:** "If Research finds competitor mention → also run Competitive Intel agent"
- **Loop:** "If Verify fails → send back to Research with correction notes"
- **Human gate:** Pause between agents for your approval

---

## II. TEAM PRESETS — One-Click Workflows

### Pre-Built Teams

Each team preset loads a set of agents with pre-configured roles, models, and routing.

#### 1. 📚 Deep Research
```
[RESEARCHER 1] ─┐
[RESEARCHER 2] ─┼→ [SYNTHESIZER] → [OUTPUT]
[RESEARCHER 3] ─┘
                    Opus 4
Researchers: Sonnet 4 (parallel, each with different search angles)
Synthesizer: Opus 4 (merges, deduplicates, produces comprehensive brief)
```

#### 2. 📝 Content Pipeline
```
[RESEARCHER] → [WRITER] → [EDITOR] → [FORMATTER]
  Sonnet 4      Opus 4     Haiku       Haiku
  
Researcher: Gathers facts and context
Writer: Drafts the document
Editor: Refines tone, fixes errors, tightens prose
Formatter: Applies output format (slides, email, doc)
```

#### 3. 🔍 Competitive Intelligence
```
[WEB SCRAPER] ─┐
[DOC ANALYST] ─┼→ [STRATEGIST] → [OUTPUT]
[FEATURE MAP] ─┘
   Sonnet 4       Opus 4

Scraper: Fetches latest competitor info from web
Doc Analyst: Processes internal competitive docs
Feature Map: Creates feature comparison matrix
Strategist: Synthesizes positioning and recommendations
```

#### 4. 🛡️ Verified Output (Expert Mode)
```
[MAIN AGENT] → [VERIFIER] → [RECONCILER] → [OUTPUT]
   Opus 4        Sonnet 4      Opus 4

Main: Produces the primary output
Verifier: Fact-checks every claim against Ground Truth channels
Reconciler: Resolves discrepancies, adds confidence scores
```

#### 5. 🔬 Discovery Sprint
```
[SIGNAL ANALYST] → [USER RESEARCHER] → [PM STRATEGIST] → [OUTPUT]
    Sonnet 4           Opus 4              Opus 4

Signal: Runs Insight Ladder on all Signal-type channels
User Researcher: Maps signals to jobs-to-be-done
PM Strategist: Prioritizes opportunities, suggests features
```

#### 6. 🎤 Meeting Prep
```
[CONTEXT BUILDER] ─┐
[PROFILER]        ─┼→ [AGENDA BUILDER] → [OUTPUT]
[ACTION TRACKER]  ─┘
   Sonnet 4           Opus 4

Context: Assembles relevant docs for the meeting topic
Profiler: Research attendees (LinkedIn, internal notes)
Action: Reviews past meeting notes for open items
Agenda: Produces meeting brief + talking points
```

#### 7. 🐛 Bug Triage
```
[REPRODUCER] → [ROOT CAUSE] → [FIX PROPOSAL] → [OUTPUT]
   Haiku         Sonnet 4        Opus 4

Reproducer: Analyzes bug report, identifies steps
Root Cause: Traces through codebase for likely cause
Fix Proposal: Suggests code changes and test cases
```

#### 8. 📊 Quarterly Review
```
[METRICS GATHERER] ─┐
[FEEDBACK DIGEST] ──┼→ [SYNTHESIZER] → [SLIDE BUILDER] → [OUTPUT]
[ROADMAP STATUS] ───┘
    Sonnet 4            Opus 4          Haiku

Metrics: Pulls KPIs, usage data, financial summaries
Feedback: Summarizes customer feedback from the quarter  
Roadmap: Status update on planned vs delivered
Synthesizer: Weaves into narrative
Slide Builder: Formats as presentation
```

---

## III. PROMPT → AUTO-TEAM

The most powerful feature: type a natural language prompt, and the system suggests a team configuration.

### How It Works

1. **Prompt analysis** — NLP on the prompt to detect:
   - Complexity (simple question vs multi-step task)
   - Required capabilities (search, code, design, analysis)
   - Output type (doc, slides, email, code)
   - Domain (competitive, client, technical, strategic)

2. **Team suggestion** — Based on analysis, propose:
   - Number of agents
   - Roles and models
   - Which channels feed which agent
   - Output format
   - Estimated time and cost

3. **One-click accept** or modify

### Examples

**Prompt:** "What's our competitive positioning vs StormGeo?"

```
SUGGESTED: Solo Mode (simple question)
Model: Claude Opus 4
Channels: [Competitors/StormGeo] + [Products]
Output: Markdown
Est: 15s, ~$0.08

[▶ RUN]
```

**Prompt:** "Prepare a comprehensive pitch deck for the Odfjell fleet expansion meeting next Tuesday, covering our savings methodology, competitive advantages, and regulatory cost benefits"

```
SUGGESTED: Team Mode (complex, multi-step)

┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│RESEARCH  │  │ANALYSIS  │  │WRITER    │  │FORMATTER │
│Sonnet 4  │→ │Opus 4    │→ │Opus 4    │→ │Haiku 3.5 │
│          │  │          │  │          │  │          │
│Web: Storm│  │Compare   │  │Narrative │  │HTML      │
│Geo latest│  │+position │  │+slides   │  │Slides    │
└──────────┘  └──────────┘  └──────────┘  └──────────┘

Channels auto-loaded:
  🔴 Odfjell savings analysis (Ground Truth)
  🔴 Products/NR (Ground Truth)
  🔵 Competitors/StormGeo (Evidence)
  🔵 Intel/Competitive (Evidence)
  🟡 Signals/Odfjell (Signal)
  🟢 Roadmap (Framework)

Output: HTML Slides
Est: 3min, ~$1.20

[Accept] [Modify Team] [Solo Instead]
```

**Prompt:** "Check if Michelle's feedback about the speed/power display aligns with what we know from the KCC meeting and our product roadmap"

```
SUGGESTED: Team Mode (verification task)

┌──────────┐  ┌──────────┐  ┌──────────┐
│SIGNAL    │  │CROSS-REF │  │SYNTHESIS │
│ANALYZER  │→ │CHECKER   │→ │          │
│Sonnet 4  │  │Opus 4    │  │Opus 4    │
│          │  │          │  │          │
│Unpack    │  │Compare   │  │Report    │
│Michelle's│  │KCC+Road  │  │alignment │
│feedback  │  │map match │  │+ gaps    │
└──────────┘  └──────────┘  └──────────┘

Channels:
  🟡 Signals/Odfjell (Signal) — Michelle's feedback
  🔴 Clients/KCC (Ground Truth) — KCC meeting notes
  🟢 Roadmap (Framework) — planned features
  🔴 Products (Ground Truth) — current capabilities

Output: Markdown
Est: 90s, ~$0.45

[Accept] [Modify Team] [Solo Instead]
```

---

## IV. LIVE TEAM MONITORING

### During Execution

When agents are running, the UI transforms:

```
┌─ LIVE ──────────────────────────────────────────────────┐
│                                                          │
│  RESEARCH          ANALYSIS         WRITER               │
│  ● Running 23s     ○ Waiting        ○ Waiting            │
│  ▓▓▓▓▓▓░░░░░       ░░░░░░░░░░░      ░░░░░░░░░░░          │
│                                                          │
│  ┌─ Research Output (live stream) ─────────────────────┐ │
│  │ Found 3 relevant competitor updates from StormGeo:  │ │
│  │ 1. New API announced Q4 2025...                     │ │
│  │ 2. Partnership with DNV...                          │ │
│  │ 3. Price increase for weather routing...            │ │
│  │ ▌ (streaming...)                                    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [SOLO: Research ▼]  [⏸ Pause]  [⏹ Stop]  [💬 Steer]    │
└──────────────────────────────────────────────────────────┘
```

### SOLO Mode

Click SOLO on any agent to see only its output in real-time. Like soloing a track in a DAW — you hear only that instrument.

When an agent finishes, its output shows a completion indicator and the next agent starts. You can see the "signal" flowing through the chain.

### Steer (Mid-Run Intervention)

The 💬 STEER button lets you inject instructions into a running agent:

```
┌─ STEER: Research Agent ──────────────────┐
│                                           │
│ "Focus more on StormGeo's pricing model,  │
│  less on their tech stack"                │
│                                           │
│ [Send] [Cancel]                           │
└───────────────────────────────────────────┘
```

The agent receives your instruction as a mid-conversation message and adjusts its approach.

### Breakpoints

Insert a "⏸ GATE" between any two agents. When the upstream agent finishes, execution pauses and you see the intermediate output:

```
┌─ GATE: Review Research Output ──────────────────────┐
│                                                      │
│ Research agent produced:                             │
│ - 3 competitor updates                               │
│ - 2 market trends                                    │
│ - 1 regulatory change                                │
│                                                      │
│ [✓ Approve & Continue]  [✏️ Edit & Continue]  [✕ Stop] │
└──────────────────────────────────────────────────────┘
```

---

## V. AGENT CONFIGURATION — The Deep Panel

Click on any agent strip to expand its configuration:

```
┌─ CONFIGURE: Research Agent ──────────────────────────┐
│                                                       │
│  ROLE        [Research & Information Gathering     ▼]  │
│  MODEL       [Claude Sonnet 4                      ▼]  │
│  TEMPERATURE  ◉─────────── 0.3                        │
│                                                       │
│  INSTRUCTIONS                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ You are a research agent. Search the web and      │ │
│  │ analyze provided documents to gather comprehensive│ │
│  │ information about the topic. Focus on recent data.│ │
│  └───────────────────────────────────────────────────┘ │
│                                                       │
│  CONTEXT (which channels this agent sees)              │
│  [✓] Competitors/StormGeo                              │
│  [✓] Intel/Competitive                                 │
│  [ ] Products (filtered out — not needed for research) │
│  [✓] 🌐 Web Search (tool)                             │
│                                                       │
│  INPUT                                                │
│  ○ From prompt (first agent in chain)                  │
│  ● From previous agent output                          │
│                                                       │
│  OUTPUT ROUTING                                       │
│  ○ → Next agent in chain                               │
│  ○ → Final output                                      │
│  ● → Specific agent: [Analysis ▼]                      │
│  ○ → Multiple agents (fan out)                         │
│                                                       │
│  [Save] [Reset to Default]                             │
└───────────────────────────────────────────────────────┘
```

---

## VI. SAVED TEAM CONFIGURATIONS

### Export/Import

Teams can be saved as presets:
- Name, description, icon
- Agent definitions (role, model, instructions)
- Routing configuration
- Channel filter patterns
- Output format

### Share

Export as JSON → share with team → import into their console.

### Team Library

Over time, build a library of team configurations:
- Personal favorites
- Team-shared configurations
- Community templates (from ClawhHub)

---

## VII. COST & TIME ESTIMATION

Before running a team, show estimated:
- **Time:** Based on model speeds and parallelism
- **Cost:** Based on token estimates per agent
- **Token breakdown:** Per-agent context size

```
┌─ ESTIMATE ──────────────────────────────┐
│                                          │
│  Research: ~15K tokens × Sonnet = $0.05  │
│  Analysis: ~25K tokens × Opus  = $0.38   │
│  Writer:   ~20K tokens × Opus  = $0.30   │
│  Formatter: ~8K tokens × Haiku = $0.01   │
│                                          │
│  TOTAL: ~68K tokens, ~$0.74, ~2.5min     │
│                                          │
│  [▶ RUN]                                 │
└──────────────────────────────────────────┘
```

---

## VIII. UNIQUE INTERACTION: THE ROUND TABLE

A new interaction pattern for exploratory work — inspired by how real teams brainstorm.

### How It Works

Instead of a linear pipeline, agents sit "around a table" and take turns contributing:

```
Round 1: Each agent gives their initial perspective
Round 2: Each agent responds to others' points  
Round 3: Agents converge toward consensus
Final: Synthesizer produces the output
```

### Visualization

```
        ┌──────────┐
        │SYNTHESIZE│
        │  Opus 4  │
        └────┬─────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───┴──┐ ┌──┴───┐ ┌──┴───┐
│ PM   │ │ ENG  │ │ USER │
│Opus 4│ │Son 4 │ │Son 4 │
└──────┘ └──────┘ └──────┘

Round: 2/3  Topic: "Should we build fleet dashboard?"
```

Each agent has a different persona and context:
- **PM Agent:** Sees roadmap, strategy, business metrics
- **Engineering Agent:** Sees technical constraints, architecture, effort estimates
- **User Research Agent:** Sees feedback, signals, user interviews

They debate. They disagree. They find the insight that no single perspective would produce.

### Use Cases

- **Feature prioritization** — PM vs Eng vs User perspectives
- **Strategy validation** — Bulls vs Bears on a market move
- **Architecture decisions** — Tradeoff analysis from multiple angles
- **Risk assessment** — Optimist vs Pessimist vs Realist

---

## IX. THE RECORDING — Run History

Every team run is saved as a "recording":

- Full transcript of each agent's work
- Input/output at every stage
- Token usage per agent
- Time taken
- Configuration used

### Playback

Scrub through a past run like an audio timeline:
- See each agent's contribution
- Compare runs with different team configs
- Identify which agent added the most value
- Find the exact moment an insight emerged

### Diff

Compare two runs side by side:
- Same prompt, different teams → which team worked better?
- Same team, different channels → how did context affect output?
- Same everything, different models → model comparison

---

*These patterns turn the mixing console from a context manager into a full AI production studio. The metaphor holds all the way through — from solo recording to full orchestral production.*

*— Claw 🦀, 01:30 CET*
