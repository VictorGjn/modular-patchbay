# Modular Studio — User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [The Canvas](#the-canvas)
- [Nodes in Detail](#nodes-in-detail)
- [Settings](#settings)
- [Working with MCP Servers](#working-with-mcp-servers)
- [Running an Agent](#running-an-agent)
- [Exporting Agents](#exporting-agents)
- [Marketplace](#marketplace)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js 18+** (check with `node --version`)
- **git**

### Installation

```bash
git clone https://github.com/VictorGjn/modular-patchbay.git
cd modular-patchbay && git checkout feat/ui-modernization
npm install
npm run build:all
node dist-server/bin/modular-studio.js --open
```

Or, if published to npm:

```bash
npx modular-studio
```

This starts an Express server on port 4800 and opens the studio in your browser. Use `--port 3000` to change the port.

### First Launch

When you open Modular Studio, you'll see:

- **Topbar** — Model selector, preset picker, output format dropdown, Run/Stop buttons, theme toggle, Import/Export, Settings, and Marketplace
- **Canvas** — The main workspace with six pre-connected nodes arranged in a left-to-right flow
- **Minimap** — Bottom-right corner, shows a birds-eye view of the canvas
- **Controls** — Bottom-left corner, zoom in/out and fit-to-view buttons

The default canvas starts with all nodes wired up and ready to go. Write a prompt, configure a provider, and hit Run.

---

## The Canvas

### Node Layout

The canvas uses a left-to-right signal flow:

```
Knowledge ─┐
Skills ────┤──→ Prompt (Agent) ──→ Output
MCP Tools ─┘         │              Response
                     │
              Feedback edges
         (enrich knowledge, discover skills)
```

**Left column** — Input nodes (Knowledge, Skills, MCP) feed context into the Prompt node.

**Center** — The Prompt node is the agent's brain. It receives all inputs, runs the LLM, and sends output right.

**Right column** — Output node (format selection and destinations) and Response node (displays the LLM result).

### Connecting Nodes

Nodes have **jack ports** — small circular connection points labeled with abbreviated names (KNOW, SKILLS, MCP, OUTPUT, etc.).

- **Drag from an output port to an input port** to create a cable
- Cables only connect output → input (ports ending in `-out` to ports ending in `-in`)
- Cables are color-coded by source node (see table below)
- You can **reconnect** existing cables by dragging them to a different port

### Cable Colors

| Color | Connection |
|-------|-----------|
| Blue (`#3498db`) | Knowledge → Prompt |
| Yellow (`#f1c40f`) | Skills → Prompt |
| Green (`#2ecc71`) | MCP Tools → Prompt |
| Orange (`#FE5000`) | Prompt → Output / Response |
| Cyan dashed (`#00d4ff`) | Feedback: Prompt → Knowledge |
| Yellow dashed | Feedback: Prompt → Skills |

### Deleting Cables

- Select an edge and press the **Delete** key
- Edges are reconnectable — drag an endpoint to reroute instead of deleting

### Navigation

- **Zoom**: Mouse wheel or pinch gesture; also use the +/- controls (bottom-left)
- **Pan**: Click and drag on the canvas background
- **Fit view**: Click the fit-to-view button in the controls panel
- **Minimap**: Bottom-right shows overall layout; click to jump to a region

---

## Nodes in Detail

### Prompt / Agent Node

The hero node — this is where you write your prompt and configure the agent.

**Header**: Shows the currently selected model name. Three input jack ports on the left (KNOW, SKILLS, MCP) and one output port on the right (OUTPUT).

**Textarea**: Write your prompt here. Describe what you need — analysis, slides, email, code, etc. The output format auto-detects from your prompt text (e.g., mentioning "slides" selects HTML Slides).

**Bottom bar** (inside the textarea area):
- Auto-detected output format tag (if not markdown)
- Character count
- Approximate token count (`~N tokens`)

**Advanced drawer** (click the ⚙ Settings button to expand):
- **Model**: Select from Claude Opus 4, Claude Sonnet 4, GPT-4o, GPT-4o Mini, Llama 3.1 70B, DeepSeek V3, Gemini 2.5 Pro
- **Thinking Depth**: Low / Medium / High — controls how much reasoning the model does
- **Context Size**: Maximum token budget for the context window

**Action buttons**:
- **Test Run** — Sends the assembled context to the LLM and streams the response. Shortcut: `Ctrl/Cmd + Enter`
- **Save as Agent** — Opens the export modal to save your agent configuration as a downloadable file

**Feedback ports** (bottom): KB OUT and SKILL OUT ports send feedback edges back to Knowledge and Skills nodes. These allow the agent to suggest new knowledge sources or skills after a run.

---

### Knowledge Node

Manages all context sources that feed into the agent. Has two tabs:

#### Local Files Tab

Drag-and-drop files or click **+ Add Files ⌘K** to open the file picker. Files are organized by knowledge type:

| Type | Color | Instruction to LLM |
|------|-------|-------------------|
| Ground Truth | Red (`#e74c3c`) | "Do not contradict this." |
| Signal | Yellow (`#f1c40f`) | "Interpret — look for the underlying need, not the surface request." |
| Evidence | Blue (`#3498db`) | "Cite and weigh against other evidence." |
| Framework | Green (`#2ecc71`) | "Use to structure thinking, but not as immutable." |
| Hypothesis | Purple (`#9b59b6`) | "Help validate or invalidate with evidence and signals." |
| Artifact | Gray (`#95a5a6`) | "May be outdated. Cross-reference with current ground truth." |

Files are auto-classified by their path, but you can **drag files between type sections** to reclassify them.

**Depth carousel**: Each file has a depth control with left/right arrows:

| Level | Abbreviation | Description |
|-------|-------------|-------------|
| Summary | Sum | Minimal context, lowest token usage |
| Key Points | Key | Main takeaways only |
| Details | Det | Moderate detail |
| Full | Full | Complete content |
| Verbatim | Verb | Exact text, highest token usage |

Each file shows its effective token count based on the selected depth. Toggle files on/off with the green dot indicator.

**View modes**: Switch between card view (grid icon) and list view (list icon) in the header.

#### External Sources Tab

Connect to external services (Notion, Google Docs, Confluence, etc.) via connectors. Click **+ Add Connector** to browse available integrations. Each connector tile shows its name, status, authentication method, and a toggle to enable/disable.

#### Feedback Section

When the agent suggests new knowledge sources after a run, they appear as ghost tiles with cyan dashed borders. You can **Add** (accept) or dismiss each suggestion.

---

### Skills Node

Displays agent capabilities — skills that extend what the agent can do.

**Installed skills** appear as tiles with toggle controls. Each skill can be enabled or disabled individually. The header badge shows the count of currently enabled skills.

**View modes**: Card or list view.

**+ Browse Marketplace** button opens the Marketplace to discover and install new skills.

#### Feedback Section

When the agent suggests skills after a run, they appear as ghost tiles. You can accept (install) or dismiss each suggestion.

---

### MCP Node

Shows connected MCP (Model Context Protocol) servers and their tools.

Each server row displays:
- **Status indicator**: Green dot (connected), yellow spinner (connecting), red alert (error), gray dot (disconnected)
- **Server name**
- **Tool count** badge
- **Connect/Disconnect** button

Click the expand arrow on a connected server to see its **tool list** — each tool shows its name and description.

**View modes**: Card or list view.

**+ Add MCP Server** button opens the MCP picker to add a new server.

Health polling runs automatically to keep status indicators up to date.

---

### Output Node

Select the output format(s) for the agent's response and configure write destinations.

**Format tiles**: Toggle output formats on/off. Available formats:

| Format | Extension |
|--------|-----------|
| Markdown | `.md` |
| HTML Slides | `.html` |
| Email Draft | — |
| Code | `.py` |
| Data Table (CSV) | `.csv` |
| JSON | `.json` |
| Diagram | `.svg` |
| Slack Post | — |

**Write connectors**: Below the format section, connectors with write direction appear. These are destinations where the output can be sent (e.g., Notion page, Google Doc, Slack channel). Click **+ Add Connector** to configure new destinations.

---

### Response Node

Displays the LLM response after running the agent.

- Shows a **typing animation** while streaming
- Renders markdown with basic formatting (headers, bold, code blocks, lists)
- **Copy** button to copy the response text
- **Expand** button to view in a larger modal
- Displays metadata: output format badge, knowledge type indicators for sources used, and character/token counts
- Shows a "No response yet" placeholder until you run the agent

---

## Settings

Open Settings from the gear icon in the Topbar or the Prompt node. Settings has four tabs:

### Providers Tab

Configure LLM provider credentials. Built-in providers:

| Provider | Auth Method | Header Style |
|----------|------------|--------------|
| Anthropic | API Key | `x-api-key` |
| OpenAI | API Key | `Bearer` token |
| Google AI | API Key | Query parameter |
| OpenRouter | API Key | `Bearer` token |
| Claude Agent SDK | Zero-config | Needs `claude` CLI authenticated |

For each provider:
1. Expand the provider row
2. Paste your API key
3. Optionally change the base URL (useful for proxies)
4. Click **Save**, then **Test Connection** to verify
5. A green checkmark confirms the connection works; red X shows the error

You can also **add custom providers** with any OpenAI-compatible endpoint using the + button.

### MCP Servers Tab

View all configured MCP servers with their:
- Connection status (connected / disconnected / error)
- Tool count
- Last error message (if any)

Manage servers: connect, disconnect, or remove.

### Skills Tab

View installed skills and their status.

### General Tab

| Setting | Options |
|---------|---------|
| Theme | System / Light / Dark |
| Edge Routing | Straight / Smoothstep |
| Grid Snap | On / Off |
| Minimap | Show / Hide |

---

## Working with MCP Servers

### What is MCP?

The **Model Context Protocol** (MCP) is an open standard for connecting AI models to external tools and data sources. MCP servers expose tools (like "search the web", "read a file", "query a database") that agents can call during execution.

### Installing from Marketplace

1. Click the **shopping bag icon** in the Topbar (or the **+ Add MCP Server** button in the MCP node)
2. Switch to the **MCP Servers** tab
3. Browse or search for a server
4. Click **Install** and select the target runtime and scope (global or project)
5. Some servers require configuration (API keys, OAuth tokens) — fill in the config fields when prompted

### Configuring Environment Variables

Many MCP servers need credentials:
- **Firecrawl**: `FIRECRAWL_API_KEY`
- **Gmail**: OAuth client ID and secret
- **GitHub**: Personal access token

These are configured during installation or in Settings → MCP Servers.

### Connecting and Discovering Tools

Once installed and configured, click **Connect** on the server row. The MCP Manager uses `StdioClientTransport` to spawn the server process and calls `listTools()` to discover available tools. Tools appear in the expandable tool list.

### Health Monitoring

Status indicators update automatically via health polling:
- 🟢 **Connected** — Server is running and responsive
- 🟡 **Connecting** — Handshake in progress
- 🔴 **Error** — Connection failed (hover for error message)
- ⚪ **Disconnected** — Not running

---

## Running an Agent

1. **Set up a provider** — Open Settings → Providers, add an API key, and test the connection
2. **Select a model** — Choose from the Topbar dropdown or the Prompt node's Advanced drawer
3. **Write a prompt** — Describe what you need in the Prompt node textarea
4. **Add knowledge** (optional) — Open the file picker (`Ctrl/Cmd + K`) or drag files onto the Knowledge node. Adjust depth levels and knowledge types as needed
5. **Enable skills** (optional) — Toggle relevant skills in the Skills node
6. **Connect MCP tools** (optional) — Add and connect MCP servers for tool access
7. **Choose output format** — Select in the Output node or let auto-detection pick it from your prompt
8. **Click Test Run** (or press `Ctrl/Cmd + Enter`)
9. **View the response** — Watch it stream into the Response node. Copy or expand as needed

---

## Exporting Agents

### Save as Agent

Click **Save as Agent** in the Prompt node to open the export modal.

**Configure your agent:**
- **Name** — Give your agent a descriptive name
- **Description** — What the agent does
- **Icon** — Choose from 20 icons (Brain, Code, Search, Globe, etc.)
- **Category** — coding, research, analysis, writing, data, design, domain-specific, general

**Choose export targets:**

| Target | Format | Description |
|--------|--------|-------------|
| Claude | `.md` | Claude Code / Claude Desktop agent definition |
| AMP | `.md` | Anthropic Model Protocol format |
| Codex | `.md` | OpenAI Codex agent format |
| OpenClaw | `.md` | OpenClaw skill format |
| Generic | `.md` | Runtime-agnostic markdown definition |

You can download a single target or **Download All** to get every format at once.

### Import Agent

Click the **Upload** icon in the Topbar to import an agent from a `.md`, `.yaml`, `.yml`, or `.json` file. The importer parses the file and populates the canvas with the agent's configuration.

### Presets

Presets are pre-configured canvas setups. Select a preset from the Topbar dropdown to quickly load a knowledge + skills + output combination tailored for a specific use case.

---

## Marketplace

Access the Marketplace from the **shopping bag icon** in the Topbar.

### Three tabs:

**Skills** — Browse agent capabilities like Web Search, GitHub, Weather, Coding Agent, and more. Each skill card shows:
- Name, description, author
- Install count
- Supported runtimes (Claude, AMP, Codex, etc.)
- Install button with runtime and scope selection

**MCP Servers** — Browse MCP servers like Firecrawl, Filesystem, PostgreSQL, etc. Each card shows:
- Transport type (stdio)
- Config fields required
- Install and configure flow

**Presets** — Pre-built canvas configurations for common use cases.

### Filtering

- **Search bar** — Filter by name or description
- **Category filter** — All, Research, Coding, Data, Design, Writing, Domain

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open file picker |
| `Ctrl/Cmd + Enter` | Run the agent |
| `Escape` | Close any open modal or picker |
| `Delete` | Remove selected edge |

---

## Troubleshooting

### "No API key configured"

Open **Settings → Providers**, expand your provider, paste the API key, click **Save**, then **Test Connection**. A green checkmark confirms it's working.

### MCP server shows red status

1. Check that the server's required environment variables are set (API keys, tokens)
2. Try **Disconnect** then **Connect** again
3. Hover over the red indicator to see the error message
4. Verify the MCP server package is installed (`npx -y <package>` should work)

### Claude Agent SDK shows "Not authenticated"

The Claude Agent SDK requires the `claude` CLI to be authenticated. Run `claude` in your terminal and complete the authentication flow, then retry in Modular Studio.

### Response node shows nothing after running

1. Verify a provider is connected (green status in Settings → Providers)
2. Check that the selected model matches your provider (e.g., don't select Claude models with an OpenAI key)
3. Look for errors in the browser console (`F12`)

### Canvas feels sluggish

- Collapse nodes you're not actively using (click the chevron in each node header)
- Switch to list view mode instead of card view
- Disable the minimap in Settings → General if not needed
