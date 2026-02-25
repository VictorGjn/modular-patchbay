# MODULAR — The Analog Context Manager

## The Elevator Pitch
**Every document in your knowledge base is a module. Every connection is a patch cable. You physically plug and unplug context into your prompts like a Moog synthesizer.**

This is not a workflow builder. This is how you think.

## Why This Exists

Victor has 200+ files across:
```
Documents/Product/
├── 00 - Knowledge/          (Clients, Competitors, Products, Market intel)
│   ├── Competitors/Features/ (8 competitors × screenshots + raw data)
│   ├── Clients/              (Odfjell, KCC, DHT, G2Ocean...)
│   └── Products/NR/          (Navigation Reports, feedback)
├── 01 - Discovery/           (40+ feature discovery docs)
├── 02 - Demo/                (Presentations, demo assets)
├── 03 - Roadmap/             (Quarterly plans, cycle plans)
├── 04 - Release/             (Release notes, user comms)
├── 05 - Intel/               (Competitive, maritime, research, feedback, signals)
├── 06 - Sales Prep/          (Event prep, executive profiles)
├── 07 - Signals/             (User feedback: Odfjell, KCC, Baru)
├── CMO-Handoff/              (70+ company profiles, charter structures)
├── voyage-preparation/       (Python app + templates)
├── odfjell-savings-analysis/ (Client deliverables)
├── plans/                    (50+ plan documents)
└── navarea-map/              (Maritime warning system)
```

When Victor asks a question like "How should we position our EU ETS cost layer against StormGeo?", the answer requires patching together:
- `01 - Discovery/EU ETS Cost Layer/` (our feature spec)
- `00 - Knowledge/Competitors/Features/stormgeo/` (their capabilities)
- `odfjell-savings-analysis/regulatory-cost-analysis.md` (our financial model)
- `00 - Knowledge/Clients/odfjell/` (customer context)
- `07 - Signals/User feedback/odfjell/` (what they actually want)

Today, you either dump everything in (token explosion) or manually cherry-pick (tedious). 

**Modular makes it physical. Visual. Analog.**

---

## Core Concepts

### 1. Knowledge Modules (The Rack)
Every folder/document becomes a module on the rack:

**Auto-scanned from filesystem:**
- Each top-level folder = a **module group** (visual section on sidebar)
- Each document = a **patchable module** with metadata
- Files are indexed on startup (file name, size, last modified, first 500 chars for summary)

**Module faceplate shows:**
- Document/folder name (engraved label)
- File size / token estimate (VU meter)
- Last modified date
- Summary preview (first 2 lines)
- **OUTPUT JACK** — plug a cable from here into the Context Mixer

### 2. The Context Mixer (Center of the Rack)
A big mixer module with:
- **N input jacks** — plug knowledge modules here
- **DEPTH knob per channel** — Full text / Summary / Headings only / Key facts
- **WEIGHT knob per channel** — How much this context matters (affects prompt ordering)
- **RELEVANCE knob per channel** — Semantic filter threshold (only include sections matching the query)
- **VU meters per channel** — Live token count for each patched source
- **MASTER VU** — Total token count / context window budget (with red zone)

### 3. The Prompt Module (Input)
Where you type your question/instruction:
- Textarea input
- **OUTPUT JACK** → feeds into LLM
- Optional: preset prompt templates (dropdown)

### 4. The LLM Module (Processor)
- **INPUT JACKS**: System prompt, User prompt, Context (from mixer)
- **Knobs**: Temperature, Max tokens, Top P
- **Model selector**: claude-opus, claude-sonnet, gpt-4o, etc.
- **Scope display**: Live token usage, response streaming
- **OUTPUT JACK**: Response

### 5. The Output Module
- **INPUT JACK**: Response from LLM
- Routes to: Chat display / File writer / Clipboard / Message channel

---

## Killer Features

### 🎛 Patch Presets
Save cable configurations as named presets:
- **"Odfjell Deep Dive"** — Patches: Odfjell client profile + charter structure + user feedback + savings analysis + competitor comparison
- **"Competitive Intel"** — Patches: All 8 competitor feature docs + battlecards + latest competitive report
- **"Voyage Prep Dev"** — Patches: voyage_prep.py + templates + carbon_costs.py + API docs
- **"Weekly Newsletter"** — Patches: Maritime intel sources + newsletter archive + style guide

One click to load a preset → all cables auto-connect with saved knob positions.

### 📊 Token Budget Meter
A big analog VU meter at the top showing:
```
[░░░░░░░░░░░░░░░░░░░░] 0 / 200K tokens
[████████░░░░░░░░░░░░] 78K / 200K tokens  (39% — green)
[██████████████░░░░░░] 142K / 200K tokens (71% — yellow)
[████████████████████] 198K / 200K tokens (99% — RED ZONE)
```
As you plug in more modules, the meter fills. Depth knobs let you dial back without unplugging.

### 🔍 Smart Summarization Levels (DEPTH Knob)
For each patched module, the DEPTH knob controls how much context is included:
- **FULL** (100%) — Entire document verbatim
- **DETAILED** (75%) — Key sections, skip boilerplate
- **SUMMARY** (50%) — AI-generated summary (cached)
- **HEADLINES** (25%) — Just headings and key facts
- **MENTION** (10%) — Just the document title + 1-line description

This is how you fit 200K tokens of knowledge into a 200K window — you don't include everything at full depth.

### 🎯 Semantic Relevance Filter (per module)
Each knowledge module has a RELEVANCE knob:
- When connected to the Prompt module, it only includes sections that semantically match the query
- Low relevance = include everything from that doc
- High relevance = only include paragraphs that match the prompt
- This is RAG per module, but analog.

### 🔌 Quick Patch Bar
A row of toggle switches at the top — one per knowledge domain:
- `[ON] Odfjell  [ON] KCC  [OFF] DHT  [OFF] G2Ocean  [ON] Competitors  [OFF] Market...`
- Quick way to toggle entire knowledge domains without touching cables

### 📁 Folder as Module Group
Dragging a folder onto the rack creates a **group module**:
- All files in that folder appear as sub-jacks
- One master output that combines all
- Individual file toggles inside the module
- Example: dragging `CMO-Handoff/01 - Company Profiles/` creates a module with 70 company toggles

### 🎹 The Keyboard (Quick Actions)
Bottom of the screen — a piano keyboard metaphor:
- Each key = a saved preset
- Click to instantly load that context configuration
- Visual feedback: pressed keys glow
- C-D-E-F-G-A-B = 7 preset slots

### 📈 Context History / Audit Trail
Every prompt sent includes a "context receipt":
- Which modules were patched
- At what depth
- Total tokens used
- Which sections were actually included
- Replay any past configuration

---

## Module Types (Knowledge-Focused)

### Knowledge Sources (auto-scanned from Product/)
- **Document Module** — Single .md/.txt/.py file
- **Folder Module** — Directory with toggleable sub-files
- **Client Module** — Aggregated client context (profile + feedback + charter + emails)
- **Competitor Module** — Competitor features + battlecard + screenshots
- **Discovery Module** — Feature discovery doc with linked assets
- **Plan Module** — Plan document with status indicators
- **API Doc Module** — API reference docs

### Processors
- **LLM** — Language model with all knobs
- **Summarizer** — Takes full doc, outputs summary at configurable depth
- **Semantic Filter** — RAG-like: query + document → relevant sections only
- **Diff** — Compare two documents (e.g., our feature vs competitor)
- **Timeline** — Arrange context chronologically

### Routing
- **Context Mixer** — N inputs, 1 combined output, per-channel controls
- **Splitter** — 1 input, N outputs
- **Priority Queue** — Arrange context by importance (first = most important for prompt)
- **Token Budget Gate** — Passes through until token limit hit, then truncates

### Outputs
- **Chat** — Display response in-app
- **File Writer** — Save to workspace
- **Clipboard** — Copy to clipboard
- **Message** — Send to WhatsApp/Telegram/Discord

---

## Technical Implementation

### Auto-Index on Startup
```typescript
interface KnowledgeModule {
  id: string;
  path: string;                // Absolute file/folder path
  name: string;                // Display name
  type: 'file' | 'folder';
  category: string;            // Parent folder name
  size: number;                // Bytes
  tokenEstimate: number;       // ~4 chars per token
  lastModified: Date;
  summary: string;             // First 200 chars or AI summary (cached)
  children?: KnowledgeModule[]; // For folders
}
```

### Depth Processing Pipeline
When depth < 100%, the content passes through a summarization step:
1. **100% FULL** — Read file, include verbatim
2. **75% DETAILED** — Parse markdown headers, include all sections but trim redundant paragraphs  
3. **50% SUMMARY** — LLM one-shot summary (cached in .modular/summaries/)
4. **25% HEADLINES** — Extract ## headers + first sentence of each section
5. **10% MENTION** — Just filename + first line

### Storage
- Patches saved as JSON in `.modular/patches/`
- Summaries cached in `.modular/summaries/` (invalidated on file modification)
- Index rebuilt on startup, diff'd on heartbeat

### The Real Magic: When You Run It
1. Click ▶ RUN
2. System walks the patch graph
3. For each knowledge module: read file → apply depth → apply relevance filter → estimate tokens
4. Context Mixer combines all inputs respecting weights and priority
5. Token Budget Gate ensures total stays within model's window
6. Assembled prompt goes to LLM
7. Response flows to output
8. Cable animation shows signal flow in real-time

---

## What This Replaces

| Before | After |
|--------|-------|
| "Let me copy-paste 5 docs into Claude" | Plug 5 cables, twist depth knobs |
| "This is too long, Claude rejected it" | Watch VU meter, dial back depths |
| "I need the same context for every Odfjell question" | Load "Odfjell Deep Dive" preset |
| "Which docs did I include last time?" | Check context history |
| "I forgot to include the competitor analysis" | It's always visible on the rack — just plug it in |
| "The AI doesn't have enough context" | Plug in more modules, adjust depths |
| "The AI has too much irrelevant context" | Turn up RELEVANCE knobs |

---

## The Vibe
This should feel like walking up to a **wall of analog gear in a recording studio**. Warm wood panels. Glowing LEDs. Heavy patch cables with satisfying clicks. VU meters bouncing. You're not "configuring a tool" — you're **mixing a signal**. Your knowledge is the signal. The LLM is the amplifier. The response is the output.

The feeling when you pull a cable and see the token meter drop. When you twist a depth knob and watch the VU bounce. When you load a preset and 12 cables auto-connect with a cascade of click sounds. That's the product.
