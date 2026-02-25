# EXPLORATION.md — The Full Possibility Space

*Written at 00:30 CET, Feb 26 2026. Victor said "dig deep." So here we go.*

---

## The Core Insight

The mixing console isn't a UI metaphor. It's a **computing paradigm**.

A mixing console takes N inputs, each with gain/EQ/routing, mixes them through a bus, applies master effects, and sends to outputs. That's not just "context management" — that's the entire lifecycle of an AI-assisted knowledge workflow.

Every channel strip isn't just "a document." It's **any signal source**. Every output bus isn't just "markdown." It's **any artifact the system can produce**. Every insert effect isn't just "summarize." It's **any transformation**.

The mixing console IS the operating system for AI work.

---

## I. INPUTS — Everything That Can Feed a Channel

### 1. Static Knowledge (Files)
- Markdown documents
- PDFs (parsed)
- Code files (.py, .ts, .sql, etc.)
- Spreadsheets (.csv, .xlsx → parsed to structured data)
- Images (with vision model description)
- Slide decks (.pptx → extracted text + structure)

### 2. Live Data Feeds
- **RSS/Atom feeds** — news, blog posts, industry updates
- **API endpoints** — REST/GraphQL responses, cached + refreshed
- **Database queries** — SQL results as structured input
- **Email inbox** — filtered by label/sender/subject (Gmail OnWatch)
- **Calendar** — upcoming events as context
- **Git diff** — current changes in a repo
- **CI/CD status** — build logs, test results
- **Slack/Discord channels** — conversation threads as input
- **Twitter/X lists** — curated social feeds
- **Stock/commodity prices** — real-time market data
- **Weather/metocean** — forecasts for maritime context
- **AIS vessel tracking** — live positions + ETA
- **Webhook listeners** — any system can push data in

### 3. Generated Context
- **Previous conversation** — chat history as a channel you can dial up/down
- **Memory files** — MEMORY.md, daily notes
- **Search results** — a websearch query that refreshes on each run
- **Scraped pages** — URL → markdown, cached with TTL
- **Embeddings/RAG** — semantic search over a corpus, top-K results as channel content
- **Another console's output** — chain consoles together (console-as-channel)

### 4. Human Input
- **Prompt** (the main one at top)
- **Voice memo** (Whisper transcription → text channel)
- **Photo/scan** (camera → OCR/vision → text channel)
- **Clipboard** — paste anything, it becomes a channel
- **Sketch/whiteboard** — drawn diagram → vision description

### 5. Agent Output as Input
- **Sub-agent results** — spawn a research agent, its output feeds back as a channel
- **Tool results** — MCP tool call results as structured data
- **Previous run output** — the last time you ran this preset, the output becomes available as a channel for iterative refinement

---

## II. CHANNEL PROCESSING — The Insert Effects

Each channel doesn't just have ON/OFF + DEPTH. It can have **insert effects** — transformations applied before mixing.

### Compression (Summarization)
- **Full** — raw content, all tokens
- **Detailed** — key sections preserved, boilerplate stripped
- **Summary** — AI-generated executive summary
- **Headlines** — bullet points only
- **Mention** — one-line reference ("this document exists and covers X")
- **Embedding** — not even text, just a vector for semantic matching

### EQ (Filtering)
- **Section filter** — only include specific headers/sections from a doc
- **Date filter** — only content from last N days
- **Relevance filter** — only paragraphs semantically related to the prompt
- **Entity filter** — only mentions of specific people/companies/products
- **Sentiment filter** — only positive/negative/neutral content
- **Diff filter** — only what changed since last run

### Gate (Conditional Inclusion)
- **If prompt mentions X** → include this channel
- **If another channel is ON** → auto-enable this one (dependencies)
- **If token budget allows** → include at reduced depth
- **If time of day is X** → include (morning briefing vs deep work)
- **If model is X** → include (some context only makes sense for certain models)

### Sidechain (Cross-referencing)
- **Contradiction detection** — flag when this channel's claims conflict with another
- **Citation linking** — auto-link claims to source channels
- **Freshness indicator** — show staleness (last updated 3 months ago → amber LED)

---

## III. THE BUS — Mixing & Routing

### Main Bus: The LLM
The mixed signal goes to the LLM. But WHICH LLM? And HOW?

- **Model selector per run** — Claude, GPT-4, Gemini, local models
- **Model selector per PHASE** — use fast model for summarization inserts, powerful model for final synthesis
- **Temperature knob** — literally a knob on the master section. Low = deterministic/factual. High = creative.
- **System prompt as a "master EQ"** — shapes the overall tone/approach
- **Multi-pass** — run through one model, then refine through another (like multiband compression)

### Sub-buses: Parallel Processing
- **Research bus** — channels routed here get sent to a search/RAG agent first
- **Verification bus** — channels routed here get fact-checked against other sources
- **Translation bus** — content gets translated before mixing
- **Code execution bus** — code blocks get executed, results replace the block

### Aux Sends: Side Outputs
- **Logging** — everything that went into the mix, saved for audit
- **Token accounting** — detailed breakdown of what went where
- **Confidence scoring** — how much of the output is grounded vs. generated
- **Source attribution** — which channels contributed to which parts of the output

---

## IV. OUTPUTS — Everything the System Can Produce

### Documents
- **Markdown** (.md) — default for knowledge docs, meeting notes, analyses
- **Rich text** (.docx) — for formal deliverables (pandoc conversion)
- **PDF** — for final/sealed documents
- **LaTeX** — for academic/technical papers
- **Plain text** — for maximum compatibility

### Presentations
- **HTML slides** — interactive, animated (your frontend-slides skill)
- **PowerPoint** (.pptx) — for corporate contexts (python-pptx)
- **Google Slides** — via API
- **PDF deck** — static slides

### Code & Technical
- **Source files** (.py, .ts, .sql, etc.) — generated code
- **Jupyter notebooks** (.ipynb) — for data analysis
- **Docker configs** — infrastructure as code
- **API specs** (OpenAPI/Swagger) — from natural language descriptions
- **Database schemas** (.sql) — from entity descriptions
- **Mermaid/PlantUML diagrams** — rendered to SVG

### Visual
- **Charts** (D3, Chart.js, Plotly) — data visualization
- **Infographics** — AI-generated visual summaries
- **Diagrams** — architecture, flow, entity-relationship
- **Maps** — Leaflet/Mapbox with data overlays
- **Screenshots** — automated browser capture of generated HTML

### Data
- **CSV/Excel** — structured data exports
- **JSON/YAML** — machine-readable output
- **SQL inserts** — ready-to-execute database imports
- **GraphQL schemas** — type definitions
- **Embeddings** — vector representations for downstream RAG

### Communication
- **Email draft** — formatted, with subject line and recipients
- **Slack message** — with proper formatting and @mentions
- **WhatsApp message** — formatted for mobile
- **Tweet/thread** — character-limited, punchy
- **LinkedIn post** — professional tone
- **Newsletter** (.html email) — styled, responsive
- **Calendar invite** — .ics file with agenda

### Interactive
- **Web app** — standalone HTML+JS (like the mixing console itself!)
- **Dashboard** — live data visualization
- **Form** — data collection interface
- **Survey** — structured feedback collection
- **Prototype** — clickable mockup

### Audio/Video
- **Voice narration** — TTS of the output (ElevenLabs)
- **Podcast script** — multi-voice dialogue format
- **Video script** — with shot descriptions and timing
- **Subtitles** (.srt) — from transcriptions

### Meta-Outputs
- **Another console preset** — the output is a NEW mixing configuration
- **Agent definition** — generate a new .claude/agent from a description
- **Skill file** — generate a new OpenClaw skill
- **Workflow definition** — n8n JSON, GitHub Actions YAML
- **Cron job** — scheduled task definition

---

## V. TOOLS — Capabilities That Plug In

### The Tool Rack

Tools aren't just "available." They're **modules on the rack** — each one lights up new capabilities across the entire console.

When you plug in a tool:
- New **input types** become available (Gmail tool → email channels)
- New **insert effects** become available (Search tool → relevance filtering)
- New **output types** become available (python-pptx → .pptx output)
- New **routing options** appear (Slack tool → direct-to-channel delivery)

### Core Tools (Always Available)
- **File system** — read/write local files
- **Web search** — Brave, Google, DuckDuckGo
- **Web fetch** — scrape any URL
- **Shell** — execute commands
- **Git** — version control operations

### MCP Servers (Pluggable)
- **Gmail** — email read/send/search
- **Slack** — message/channel operations
- **Notion** — page/database CRUD
- **GitHub** — issues/PRs/repos
- **HubSpot** — CRM operations
- **Firecrawl** — advanced web scraping
- **Puppeteer/Playwright** — browser automation
- **PostgreSQL/MySQL** — direct database access
- **S3/GCS** — cloud storage
- **Stripe** — payment/billing data
- **Twilio** — SMS/voice
- **OpenAI** — DALL-E, Whisper, embeddings
- **Anthropic** — Claude models
- **Google Calendar** — event management
- **Linear/Jira** — issue tracking
- **Figma** — design file access
- **Airtable** — structured data
- **Supabase** — backend as a service
- **Vercel** — deployment management

### Skills (Composable Capabilities)
- **frontend-slides** → unlocks HTML presentation output
- **openai-image-gen** → unlocks image generation
- **openai-whisper** → unlocks audio transcription input
- **weather** → unlocks weather data channels
- **github** → unlocks repo-aware workflows
- **coding-agent** → unlocks code generation/review
- **feedback-analyzer** → unlocks feedback processing inserts
- **maritime-expert** → unlocks domain-specific knowledge

### Tool Discovery UX
- **Marketplace panel** — browse available tools by category
- **Auto-suggest** — "You're working with emails but don't have Gmail connected. Enable?"
- **Capability badges** — each tool shows what it unlocks (inputs/outputs/effects)
- **One-click install** — `npm install` + configure in one action
- **Health indicators** — green/yellow/red per tool (connected/degraded/down)
- **Usage stats** — how often each tool is used, credit consumption

---

## VI. AGENT TEAMS — The Session Mixer

Beyond single runs, the console can orchestrate **teams of agents**.

### The Session Bus

Like a recording studio with multiple musicians, you can have:

- **Lead agent** — runs the main prompt with full context
- **Research agents** — parallel search/analysis (aux sends)
- **Verification agent** — fact-checks the lead's output (sidechain)
- **Editor agent** — refines tone/quality (mastering)
- **Specialist agents** — domain experts called as needed (session musicians)

### Team Presets

Pre-built agent teams, like mixing templates:

- **Deep Research** — 1 lead + 5 parallel researchers + 1 synthesizer
- **Content Pipeline** — researcher → writer → editor → formatter
- **Competitive Intel** — scraper + analyst + strategist
- **Code Review** — reader + reviewer + security auditor
- **Due Diligence** — company researcher + financial analyst + risk assessor
- **Meeting Prep** — agenda builder + participant profiler + context assembler

### Agent Routing

Visual routing of how agents connect:
- Agent A's output feeds Agent B's input (like patching a synth!)
- Parallel agents merge into a synthesis agent
- Conditional routing: if Agent A finds X, route to Agent B; else Agent C
- Human-in-the-loop breakpoints: pause for approval before routing

This is where the **cables come back** — but only between agents in a team, and they auto-wire based on the team preset. You CAN rewire them for custom flows.

---

## VII. EXPERT MODE — Hallucination & Confidence

### The Confidence Meter

A VU meter on every output, but instead of volume, it measures **grounding**.

- **Green zone (0-60%)** — output is well-supported by input channels
- **Yellow zone (60-80%)** — mix of grounded and generated content
- **Red zone (80-100%)** — mostly LLM generation, low source grounding

### How It Works

1. **Source tracking** — every claim in the output is traced to input channels
2. **Citation density** — ratio of cited vs. uncited claims
3. **Contradiction detection** — cross-channel consistency check
4. **Freshness scoring** — are sources current or stale?
5. **Confidence annotations** — inline markers in the output:
   - 🟢 Well-grounded (multiple sources agree)
   - 🟡 Partially grounded (single source or inference)
   - 🔴 Generated (no direct source support)

### Expert Panel (Toggle)

When you flip Expert Mode ON:
- Every paragraph gets a confidence badge
- Hover shows which channels contributed
- Click a claim to see the exact source passage
- Side-by-side: output + source alignment view
- "Hallucination heat map" — color-coded overlay

### Verification Workflow

- **Auto-verify** — toggle that runs a verification agent on every output
- **Spot-check** — highlight suspicious claims, verify just those
- **Source audit** — full provenance chain for any statement
- **Consensus mode** — run same prompt through 3 models, show agreement/disagreement

---

## VIII. DISCOVERABLE UX — Progressive Disclosure

### Level 0: Just Works
- Open the app
- Type a question in the prompt bar
- Hit RUN
- Get an answer
- (Behind the scenes: default preset loads relevant knowledge, picks best model, outputs markdown)

### Level 1: Pick Your Context
- See channel strips
- Toggle sources ON/OFF
- Adjust depth knobs
- Select a preset
- (User discovers they can control what the AI knows)

### Level 2: Choose Your Output
- Click the output selector
- Pick format: md / html / slides / email / etc.
- See output formatted accordingly
- (User discovers the system can produce different artifacts)

### Level 3: Add Tools & Sources
- Open the "+" panel
- Browse available tools and knowledge sources
- Enable new capabilities
- See new options appear
- (User discovers the system is extensible)

### Level 4: Build Workflows
- See the signal flow view
- Add processing stages
- Route between agents
- Set up conditional logic
- (User discovers they can build custom AI pipelines)

### Level 5: Expert Mode
- Toggle confidence meters
- See source attribution
- Run verification
- Audit provenance
- (User discovers they can trust/verify the output)

### Level 6: Create & Share
- Save custom presets
- Export console configurations
- Share presets with team
- Publish as templates
- (User becomes a power user who creates for others)

### How Discovery Works

- **Contextual hints** — subtle tooltips that appear based on behavior
  - "You've been running with all channels at FULL. Try adjusting DEPTH to focus the output."
  - "This prompt looks like it needs web search. Enable the Search tool? [+]"
  - "Your output is 12K tokens. Consider using Summary depth on background channels."
- **Achievement system** (subtle, not gamified)
  - First preset saved → "Your first mix. Nice."
  - First tool added → "New capabilities unlocked."
  - First team spawned → "You're running a studio now."
- **"Did you know?"** drawer — pull-out panel with tips relevant to current workflow
- **Ghost channels** — dimmed channel strips showing what COULD be added based on context

---

## IX. THE KILLER FEATURES

### 1. Prompt → Auto-Flow
Type: "Write a competitive analysis of StormGeo vs Syroco for the Odfjell pitch"

The console auto-generates:
```
CHANNELS:                          PIPELINE:
[ON] Competitors/StormGeo.md      ─┐
[ON] Competitors/Features/         │
[ON] Clients/Odfjell/             ─┼→ [RESEARCH] → [ANALYSIS] → [FORMAT]
[ON] Products/LIVE.md              │                                 │
[ON] Products/FLEET.md            ─┘                                 ↓
[dim] Sales Prep/battlecards       ← suggested              [Competitive Analysis.md]
[dim] Web: StormGeo.com/products   ← suggested                + [Slides.html]
```

You see the auto-wired flow. Tweak anything. Hit RUN. Or just trust it.

### 2. Console Chaining
One console's output feeds another:

```
[RESEARCH CONSOLE] → raw intel
        ↓
[ANALYSIS CONSOLE] → structured findings  
        ↓
[DELIVERY CONSOLE] → formatted output (slides + email + slack post)
```

Each console is a reusable stage. Mix and match.

### 3. Time Travel
Every run is saved with its full configuration:
- Which channels were ON
- What depth settings
- Which model
- The exact input content at that moment
- The output

Scrub through past runs like a timeline. See how the output changed as you adjusted channels. Diff between runs.

### 4. Live Console
A console that runs continuously:
- Channels are live feeds (email, Slack, RSS, AIS)
- Triggers fire when conditions are met
- Outputs auto-deliver (send email, post to Slack, update dashboard)
- Like leaving the mixing board running during a live performance

This is basically n8n/Zapier but with the mixing console UI and AI at every stage.

### 5. Collaborative Console
Multiple people on the same console:
- Each person sees the same channel strips
- Anyone can adjust levels
- Real-time sync (like Google Docs for AI workflows)
- Role-based access (some people can only see certain channels)

---

## X. WHY THIS IS MAJOR

The current AI tool landscape:
- **ChatGPT/Claude** — single input (prompt), single output (text), no context control
- **Cursor/Windsurf** — code-focused, file-aware, but no workflow orchestration
- **n8n/Zapier** — workflow automation, but no AI-native UX
- **Notion AI / Coda** — document-embedded AI, limited to their ecosystem
- **LangChain/LangGraph** — developer tools, no visual interface
- **Flowise/Langflow** — visual, but node-graph complexity (what v1 was)

**What's missing:** A visual, intuitive, non-developer-friendly way to:
1. Control exactly what context goes into an AI
2. Choose how that context is processed
3. Decide what form the output takes
4. Verify the output is grounded
5. Orchestrate multi-step AI workflows
6. Extend with new capabilities
7. All with an interface that's BEAUTIFUL and FEELS like making music

The mixing console metaphor works because:
- Musicians already understand gain staging (= token budgets)
- They understand EQ (= filtering)
- They understand routing (= agent pipelines)
- They understand presets (= saved configurations)
- They understand the difference between a quick mix and a mastered track (= quick answer vs. deep research)

**This isn't a feature. It's a category.**

Context Mixing Console. AI Studio. Knowledge Mixer. Whatever you call it — nobody has built this.

---

## XI. SIGNAL EPISTEMOLOGY — The Knowledge Type System

*"A transcript from a client would be taken as ground truth but it's just the current need from a client. We need to dig deep in it, understand what's behind it to uncover the killer feature they need." — Victor*

This is the deepest idea in this entire project. Every piece of knowledge has an **epistemic weight** — how much should it shape decisions? Current AI tools treat all input the same. A customer quote and a board-approved strategy get equal influence. That's insane.

### The Knowledge Type Taxonomy

Every channel has a **signal type** badge — a colored indicator showing what KIND of knowledge it carries.

#### 1. 🔴 GROUND TRUTH — What we know for certain
Things that are verified, decided, committed. Highest epistemic weight.
- **Signed contracts** — commercial terms, SLAs
- **Shipped features** — what the product ACTUALLY does today
- **Financial actuals** — real revenue, costs, metrics
- **Board decisions** — approved strategy, budget
- **Regulatory requirements** — laws, compliance mandates (EU ETS rates, IMO regulations)
- **Physics/math** — emission factors, conversion formulas
- **Published standards** — S-100, ISO specs

*On the console:* Red badge. These channels get priority in the mix. The LLM is told: "This is ground truth. Do not contradict."

#### 2. 🟡 SIGNAL — What we're hearing but haven't validated
Inputs that suggest direction but require interpretation. Medium epistemic weight.
- **Customer feedback** — what users SAY they want (≠ what they need)
- **Interview transcripts** — rich but biased by the interviewee's role + context
- **Support tickets** — symptoms, not root causes
- **Usage analytics** — what users DO (strong signal) vs. what they ask for
- **Sales call notes** — filtered through sales incentives
- **NPS/survey responses** — aggregated sentiment
- **Feature requests** — surface-level desires, not underlying jobs-to-be-done
- **Competitor announcements** — what they claim vs. what they've shipped

*On the console:* Yellow badge. The LLM is told: "This is signal. Interpret it, don't parrot it. Look for the underlying need."

#### 3. 🔵 EVIDENCE — Research and analysis that supports or challenges
Processed knowledge that builds understanding. Variable weight based on rigor.
- **User research reports** — synthesized from multiple signals
- **Competitive analyses** — structured comparison
- **Market research** — industry reports, TAM/SAM
- **A/B test results** — experimental evidence
- **Data analyses** — statistical findings
- **Case studies** — contextualized examples
- **Expert opinions** — domain authority perspectives
- **Academic papers** — peer-reviewed findings

*On the console:* Blue badge. The LLM is told: "This is evidence. Cite it, weigh it against other evidence, note the methodology."

#### 4. 🟢 FRAMEWORK — How we think about things
Mental models, methodologies, principles that shape interpretation. These are lenses, not facts.
- **Product strategy docs** — vision, principles, positioning
- **Prioritization frameworks** — RICE, ICE, value/effort
- **Personas** — user archetypes
- **Jobs-to-be-done maps** — outcome-driven models
- **Competitive positioning** — where we play, how we win
- **OKRs / KPIs** — what we're optimizing for
- **Design principles** — UX philosophy
- **Engineering standards** — technical constraints and patterns

*On the console:* Green badge. The LLM is told: "This is a framework. Use it to structure thinking, but don't treat it as immutable."

#### 5. 🟣 HYPOTHESIS — What we think might be true
Untested beliefs, bets, assumptions that need validation. Lowest initial weight, highest discovery potential.
- **Discovery docs** — early-stage problem exploration
- **Experiment proposals** — "we believe X because Y, we'll test by Z"
- **Roadmap items** — planned but unvalidated
- **Assumption logs** — explicit beliefs to test
- **Opportunity assessments** — sized but unproven
- **User stories (pre-research)** — assumed needs

*On the console:* Purple badge. The LLM is told: "This is a hypothesis. Help validate or invalidate it using evidence and signals."

#### 6. ⚪ ARTIFACT — Output from previous work
Generated documents, deliverables, specs. Weight depends on freshness and what they were built from.
- **PRDs** — requirements documents
- **Presentations** — slide decks (may be aspirational, not factual)
- **Meeting notes** — raw capture, may have errors
- **Emails sent** — commitments made
- **Release notes** — what was shipped
- **SOWs / proposals** — what was promised

*On the console:* White/gray badge. The LLM is told: "This is a prior artifact. It may be outdated. Cross-reference with current ground truth."

### The Discovery Engine

Here's where it gets powerful. The signal type doesn't just label — it **drives behavior**.

#### When you feed a SIGNAL (customer transcript) into a mix:

Instead of regurgitating "the customer said they want X," the system:

1. **Extracts the surface request** — "Customer wants a button to export to Excel"
2. **Identifies the job-to-be-done** — "Customer needs to share fleet data with shore management"
3. **Maps to existing capabilities** — "We have API access + Slack integration. Could that solve the underlying job?"
4. **Checks against other signals** — "3 other customers asked for similar export features. Pattern?"
5. **Generates hypothesis** — "H: Shore managers need asynchronous fleet performance summaries. Excel is a proxy for 'format I can forward to my boss.'"
6. **Suggests validation** — "Test: Would an auto-generated weekly email report satisfy this need?"

This is the **"5 Whys" built into the mixing console.** Every signal gets interrogated, not just included.

#### The Insight Ladder

```
SIGNAL:     "We need Excel export"           ← What they said
  ↓ Why?
NEED:       "Share data with management"     ← What they want to do
  ↓ Why?
JOB:        "Prove fleet is optimized"       ← What outcome they need
  ↓ Why?
MOTIVATION: "Justify fuel optimization spend" ← What drives the job
  ↓ So what?
FEATURE:    "Automated management dashboard   ← What would actually solve it
             with ROI proof"
```

The console can run this ladder automatically on any SIGNAL-typed channel. It shows the ladder as a **pull-out panel** — you see the raw signal AND the unpacked insight chain.

#### Signal Freshness & Decay

Signals aren't static. A customer transcript from 6 months ago may describe a problem that's since been solved or changed.

- **Fresh (< 30 days)** — full weight, bright badge
- **Recent (30-90 days)** — slight fade, "check if still valid" flag
- **Aging (90-180 days)** — dimmed badge, auto-reduced depth
- **Stale (> 180 days)** — nearly transparent, "archive or revalidate?" prompt

Ground truth decays slower (contracts are valid until expiration). Signals decay fastest (customer needs evolve). Frameworks decay slowest (principles are durable).

#### Contradiction Detection

When multiple channels are ON, the system watches for:

- **Signal vs. Ground Truth** — "Customer says X, but our data shows Y"
- **Signal vs. Signal** — "Customer A wants faster speeds, Customer B wants fuel savings"
- **Hypothesis vs. Evidence** — "We assumed X, but research shows Y"
- **Artifact vs. Ground Truth** — "The PRD says we support Z, but we actually don't"

Contradictions show as a **red pulse** on the conflicting channel strips, with a tooltip explaining the tension. In Expert Mode, you get a full contradiction report.

#### Auto-Classification

New files dragged into the console get auto-classified:
- Filename/path patterns ("interview" → SIGNAL, "strategy" → FRAMEWORK)
- Content analysis (quotes and "they said" → SIGNAL, "we will" → HYPOTHESIS)
- Metadata (creation date for freshness, author for authority)
- User override (you can always reclassify)

Over time, the system learns YOUR classification patterns. "Files from 07-Signals/ are always SIGNAL type" — learned, not coded.

### Why This Changes Everything

Current AI tools have ONE failure mode that kills product work:

**They treat a customer's feature request with the same authority as your product strategy.**

The result: AI becomes a feature-request parrot instead of a strategic tool. It tells you to build what customers asked for instead of what they need.

The Knowledge Type System fixes this by making epistemic weight VISIBLE and ADJUSTABLE. You can:
- Crank up EVIDENCE and FRAMEWORK, dim SIGNALS → strategic synthesis mode
- Crank up SIGNALS, dim everything else → voice-of-customer mode
- Enable only GROUND TRUTH + HYPOTHESIS → validation mode (test assumptions against facts)
- Enable all types with Expert Mode → full discovery mode with contradiction detection

**The mixing console metaphor was MADE for this.** You literally adjust the volume of different knowledge types and hear how the mix changes. That's product management.

---

## XII. COMPETITIVE MOAT

If this works:
1. **Presets are shareable** — community-built mixing configurations for specific workflows
2. **Tool ecosystem** — MCP servers + skills as the "plugin store"
3. **Domain templates** — maritime, legal, medical, finance — each with industry-specific channel sources and output formats
4. **Enterprise version** — team consoles with shared knowledge bases, compliance-grade confidence scoring, audit trails
5. **API** — headless console: define a mix via API, run it, get output. Powers other tools.

---

## XII. IMMEDIATE NEXT STEPS (v2.1)

For the current build, the highest-impact additions:

1. **Auto-suggest channels from prompt** — parse the prompt, light up relevant channels
2. **Output format selector** — dropdown in Topbar: Markdown / HTML / Slides / Email draft
3. **Tool rack panel** — right sidebar showing available/connected tools
4. **Confidence meter** on ResponseArea — simple green/yellow/red bar
5. **Ghost channels** — dimmed suggestions based on current prompt + enabled channels
6. **Preset descriptions** — hover a preset to see what it includes and why
7. **"Explain this mix"** — button that shows plain English description of current configuration

---

*This document is a living exploration. Victor, this is your mixing console. Let's build it.*

*— Claw 🦀, 00:45 CET*
