# THE INSIGHT — Modular is an Agent Builder

*Feb 26, 2026 — after reading AGENTS.md*

---

## The Realization

Victor's `.claude/agents/` files have this structure:

```yaml
---
name: senior-pm
description: Discovery & strategy specialist
tools: [Read, Write, Edit, Bash, WebSearch, WebFetch]
model: sonnet
---

# Role
You are a Senior PM specializing in discovery...

# Context Sources
- 00-Knowledge/Products/*
- 01-Discovery/*
- 07-Signals/User feedback/*

# Output Format
- Discovery summaries in structured markdown
- Knowledge type: synthesis + recommendation
```

**This IS a mixing console preset.** Every field maps:

| Agent YAML | Modular Console |
|------------|----------------|
| `name` | Preset name |
| `description` | Preset description |
| `tools` | Tool rack configuration |
| `model` | Model selector |
| Context Sources (in markdown) | Channel strip configuration |
| Output Format (in markdown) | Output format selector |
| Role instructions | System prompt in signal flow |
| Knowledge type guidance | Knowledge type badges |

**A preset IS an agent definition. An agent definition IS a preset.**

---

## What This Means

### Modular doesn't just QUERY with agents. It BUILDS them.

Current flow (manual):
1. Write YAML frontmatter by hand
2. Write markdown instructions by hand
3. Guess which context sources are needed
4. Hope the model/tools are right
5. Run, fail, iterate in text

Modular flow (visual):
1. Open console, type what you need
2. System suggests channels + model + output
3. Tweak the mix visually
4. Run, see results with confidence scoring
5. **Click "Save as Agent"** → exports the configuration as a `.claude/agents/*.md` file

### The export is a YAML frontmatter file

The mixing console configuration serializes perfectly to the agent format Victor already uses. No new format needed.

### The import works too

Drop any existing `.claude/agents/*.md` file onto the console → it becomes a preset with:
- Channels pre-loaded from the context sources in the instructions
- Model set from the frontmatter
- Tools enabled from the tools list
- Output format inferred from the output section

### This is bidirectional

```
Console Config ←→ Agent Definition
     ↕                    ↕
  Visual editing      Text editing
     ↕                    ↕
  Run interactively   Run scheduled
```

---

## The Revolution

Traditional agent building:
- Write YAML + markdown by hand
- Trial and error on context
- No visibility into token usage
- No knowledge type awareness
- No confidence scoring
- Skilled engineer required

Modular agent building:
- Visual composition through mixing console
- See exactly what context goes in
- Token budget visible in real-time
- Knowledge types guide the AI's behavior
- Confidence scoring validates output
- ANY PM can build agents

**Victor's 42 commands and 16 agents took weeks to build by hand. With Modular, a PM could build them in an afternoon.**

---

## The Lighter Approach

Victor's right — the current analog aesthetic might be too heavy for rapid iteration. The insight changes priorities:

### Keep:
- Warm dark palette (#1e1a17, #0f0f0f, #FE5000)
- Space Mono font
- Channel strip concept
- Knowledge type badges
- Token budget bar

### Simplify:
- Ditch the noise textures and screw decorations
- Simpler toggle switches (not skeuomorphic LEDs)
- Flat knobs (styled range inputs, not canvas-rendered)
- Less CSS animation (functional transitions only)
- Focus on SPEED of interaction, not visual fidelity

### Add:
- **"Save as Agent" button** — exports current mix as .claude/agents/*.md
- **"Import Agent" button** — loads .claude/agents/*.md as preset
- **Agent YAML preview** — live preview of the agent definition as you adjust the mix
- **Test runner** — run the agent against a sample prompt, see output + confidence

---

## Architecture: Agent Definition Format

What a Modular-exported agent looks like:

```yaml
---
name: odfjell-deep-dive
description: Deep analysis of Odfjell client context with competitive positioning
tools: [Read, Write, WebSearch, WebFetch]
model: opus
color: "#FE5000"
emoji: "🚢"
category: client-analysis
# Modular metadata (ignored by Claude Code, used by Modular for re-import)
modular:
  channels:
    - path: "odfjell-savings-analysis/*"
      type: ground-truth
      depth: full
    - path: "00-Knowledge/Clients/odfjell/*"
      type: ground-truth
      depth: full
    - path: "07-Signals/User feedback/odfjell/*"
      type: signal
      depth: detail
    - path: "00-Knowledge/Competitors/Features/stormgeo/*"
      type: evidence
      depth: summary
    - path: "CMO-Handoff/02-Charter Structures/*"
      type: evidence
      depth: headlines
  outputFormat: markdown
  tokenBudget: 200000
---

# Role
You are analyzing Odfjell's relationship with Syroco, combining savings methodology,
client feedback, and competitive positioning.

# Context Assembly
Load the following sources with indicated depth:
- **Ground Truth (do not contradict):** Odfjell savings analysis, client knowledge files
- **Signal (interpret, don't parrot):** Odfjell user feedback — look for underlying needs
- **Evidence (cite and weigh):** StormGeo competitive features, charter structures

# Output
Structured markdown analysis with:
- Executive summary
- Key findings with source attribution
- Recommendations with confidence indicators
- Next steps
```

This format is **backward-compatible** with Claude Code (the `modular:` key is just metadata it ignores) and **forward-compatible** with Modular (which reads the metadata to reconstruct the console state).

---

## Testing Strategy: What Makes Good Context Assembly?

To answer "which inputs and prompt outputs the best result," we need empirical testing.

### Test Matrix

| Variable | Options to Test |
|----------|----------------|
| **Context order** | Ground truth first vs. signals first vs. interleaved |
| **Depth strategy** | All full vs. graduated (GT full, signals summary) vs. budget-optimized |
| **Knowledge type instructions** | Inline per-source vs. global system prompt vs. none |
| **System prompt style** | Role-first vs. task-first vs. context-first |
| **Temperature** | 0.0 vs 0.3 vs 0.7 for different output types |

### Hypothesis

Based on how transformer attention works:
1. **Ground truth should come first** — early tokens get more attention in long contexts
2. **Signals should be explicitly marked** — without labels, the model treats customer quotes as facts
3. **Graduated depth saves tokens without losing quality** — headlines for background, full for focus
4. **Knowledge type instructions in system prompt** — more effective than per-source labels
5. **Temperature 0.0-0.3 for analysis, 0.5-0.7 for creative** — standard but worth validating

### Test Protocol
1. Pick 3 real prompts from Victor's daily work
2. Assemble context 5 ways (varying the test matrix)
3. Run each through Opus 4.6
4. Score outputs on: accuracy, insight depth, grounding, actionability
5. Document winning patterns in the agent export template

---

*This changes Modular from "a context viewer" to "the visual IDE for AI agents."*
*Nobody has this. Not even close.*

*— Claw 🦀*
