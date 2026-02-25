<p align="center">
  <img src="https://img.shields.io/badge/MODULAR-Context%20Mixing%20Console-FE5000?style=for-the-badge&labelColor=1e1a17" />
</p>

<p align="center">
  <strong>The AI Studio for Knowledge Work</strong><br/>
  Control what your AI knows. See what it costs. Trust what it produces.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#knowledge-types">Knowledge Types</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#vision">Vision</a>
</p>

---

## What is Modular?

Modular is a **context mixing console** for AI — a visual interface that gives you complete control over what knowledge goes into an LLM, how it's weighted, and what comes out.

Think of it like an audio mixing console, but instead of sound sources, you're mixing **knowledge sources**. Each source gets a channel strip with:

- **ON/OFF toggle** — include or exclude
- **DEPTH knob** — Full, Detail, Summary, Headlines, Mention
- **Knowledge Type** — how the AI should treat this source
- **Token count** — how much context budget it uses
- **VU meter** — visual representation of contribution

## Why?

Every AI tool treats all input the same. A customer complaint gets the same authority as your product roadmap. A six-month-old transcript overrides your latest strategy.

**This is the #1 failure mode of AI in knowledge work.**

Modular fixes it by making **epistemic weight visible and adjustable**.

## Features

### 🎛️ Channel Strips
Each knowledge source is a channel strip with analog-inspired controls. Toggle, adjust depth, see token cost — all at a glance.

### 🔴🟡🔵🟢🟣⚪ Knowledge Type System
Not all knowledge is equal. Modular classifies every source:

| Type | Badge | AI Behavior |
|------|-------|-------------|
| **Ground Truth** | 🔴 | Never contradict (contracts, shipped features, physics) |
| **Signal** | 🟡 | Interpret, don't parrot — unpack the underlying need |
| **Evidence** | 🔵 | Cite and weigh against other evidence |
| **Framework** | 🟢 | Use to structure thinking, not as immutable |
| **Hypothesis** | 🟣 | Help validate or invalidate |
| **Artifact** | ⚪ | May be outdated — cross-reference |

Auto-classified from file paths. Click to override.

### 📊 Token Budget Bar
Real-time visualization of context window usage. Green/yellow/red gradient. Adjust channel depths to stay in budget.

### 👻 Ghost Channels
Prompt-aware suggestions. "You mentioned Odfjell — add their feedback?" One click to materialize.

### 🎯 10 Pre-Built Presets
Senior PM · Competitive Intel · Company Intel · Feedback Manager · Odfjell Deep Dive · Voyage Prep Dev · Event Prep · Maritime Intel · Discovery · All Knowledge

### 📤 Output Formats
Auto-detected from your prompt: Markdown · HTML Slides · Email Draft · Code · Data Table · JSON · Diagram · Slack Post

### 💡 Contextual Hints
Smart tips based on your behavior: "All channels at FULL — try Summary on background sources" · "All Signal, no Ground Truth — add Products?"

### 🔄 Signal Flow *(coming soon)*
Visual pipeline: Sources → Process → Model → Output. Add stages. Override routing.

### 🤖 Agent Teams *(coming soon)*
Multi-agent orchestration: Researcher → Analyst → Writer → Editor. Auto-suggested from prompt complexity.

### 🛡️ Expert Mode *(coming soon)*
Confidence scoring. Source attribution. Contradiction detection. Hallucination heat map.

## Quick Start

```bash
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 7 |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Controls | Custom analog components (Knob, Toggle, LED, VU, Screw) |
| Fonts | Space Mono + Inter |

## Design Language

Inspired by vintage analog synthesizers and mixing consoles:

- **Background:** `#0f0f0f` (near black)
- **Panels:** `#1e1a17` (warm walnut)
- **Accent:** `#FE5000` (signal orange)
- **Typography:** Space Mono for labels, Inter for body
- **Controls:** Skeuomorphic knobs with radial gradients, LED glow effects, VU meters with green-yellow-red segments

## Vision

See [VISION.md](./VISION.md) for the expanded concept.
See [EXPLORATION.md](./EXPLORATION.md) for the full possibility space.
See [SPEC-V3.md](./SPEC-V3.md) for the implementation roadmap.
See [COMPETITIVE-LANDSCAPE.md](./COMPETITIVE-LANDSCAPE.md) for market analysis.
See [AGENT-TEAMS.md](./AGENT-TEAMS.md) for multi-agent interaction patterns.

## The Big Idea

> "Context engineering is the new prompt engineering" — Tobi Lutke, CEO Shopify

Current tools: ChatGPT, Claude, Cursor, Langflow — all treat context as invisible plumbing. You can't see it, you can't control it, you can't trust it.

Modular makes context **the interface**. Not hidden behind a chat. Not abstracted into nodes and edges. Visible, tangible, controllable — like faders on a mixing console.

**Nobody has built this. The market is asking for it. The window is open.**

## License

MIT

---

<p align="center">
  <strong>MODULAR</strong> — Control the mix. Trust the output.<br/>
  Built with 🦀 by <a href="https://github.com/VictorGjn">Victor Grosjean</a>
</p>
