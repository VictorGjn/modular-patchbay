# Modular — Design Guide

> Comprehensive UX/design reference for building a visual AI agent builder with React + TypeScript + @xyflow/react.  
> Last updated: 2026-02-27

---

## Table of Contents

1. [Node-Based UI Patterns](#1-node-based-ui-patterns)
2. [Design System for Node Editors](#2-design-system-for-node-editors)
3. [Progressive Disclosure](#3-progressive-disclosure)
4. [Marketplace / Library UX](#4-marketplace--library-ux)
5. [Connection / Cable UX](#5-connection--cable-ux)
6. [Settings Panels](#6-settings-panels)
7. [Accessibility](#7-accessibility)
8. [Dark / Light Theme](#8-dark--light-theme)

---

## 1. Node-Based UI Patterns

### Lessons from Existing Products

| Product | Strengths | Weaknesses |
|---------|-----------|------------|
| **Unreal Blueprints** | Color-coded pins by type, reroute nodes, collapsible macro nodes, comment boxes for grouping | Spaghetti at scale, nodes too wide, no minimap by default |
| **ComfyUI** | Powerful workflow composition, widget embedding in nodes | Steep learning curve, inconsistent node sizes, no visual hierarchy, ugly defaults |
| **Node-RED** | Clean color palette (muted pastels), compact node size, consistent port placement, great label system | Limited inline editing, port labels only on hover |
| **Blender Shader Nodes** | Preview thumbnails in nodes, frame/group nodes, consistent left→right flow, socket coloring | Dense UI, small text at default zoom |
| **Figma Prototype Wiring** | Ultra-clean, minimal chrome, great connection animation | Not a general-purpose node editor |

### Node Sizing

**Recommended defaults for Modular:**

```
Minimum node width:   200px
Default node width:   280px
Maximum node width:   400px (before scroll/collapse)
Node header height:   40px
Node padding:         12px
Handle (port) size:   12px diameter, 2px border
Handle hit area:      24px × 24px (invisible, for easier targeting)
```

**Why these values:**
- 280px fits ~30 characters of readable text at 13px font — enough for most labels
- Unreal uses ~300px default; Node-RED uses ~150px (too narrow for our use case with config)
- 12px handles are visible but not dominant; Blender uses 12px, ComfyUI uses 10px

### Spacing & Grid

```
Grid size:            20px (snap-to-grid optional, off by default)
Minimum node gap:     40px (enforced during auto-layout)
Group/frame padding:  24px
```

**Auto-layout:** Use dagre or elkjs for automatic left-to-right layout. Offer a "tidy" button (not forced). ComfyUI's lack of auto-layout is its #1 usability complaint.

### Grouping

- **Frame/Comment nodes** (like Blender): colored rectangles that contain child nodes. Dragging a frame moves its children. Essential for complex workflows.
- **Naming convention:** Let users name frames. Render the title at top-left in a larger font (16px bold).
- **Collapse groups:** Double-click a frame header to collapse it into a summary node showing only external connections.

### Recommendations for Modular

1. **Left-to-right flow** — inputs on left, outputs on right. This is the universal standard (Unreal, Blender, Node-RED all use it).
2. **Fixed-width nodes** per type, with dynamic height based on visible fields.
3. **Reroute nodes** — simple pass-through dots for cable management (Unreal's best feature).
4. **Comment/frame nodes** — group related nodes with a labeled background rectangle.
5. **Minimap** — always available in bottom-right corner. React Flow has `<MiniMap />` built in.

---

## 2. Design System for Node Editors

### Color Coding by Node Category

Use distinct, muted hues for node headers/left-border strips. Avoid saturated colors — they fatigue the eye on dark backgrounds.

```css
/* Node category colors — header background or left accent stripe */
--node-trigger:      #5B8DEF;  /* Blue — entry points, webhooks */
--node-ai:           #A855F7;  /* Purple — LLM, AI model nodes */
--node-logic:        #F59E0B;  /* Amber — conditions, switches, loops */
--node-transform:    #10B981;  /* Emerald — data transform, parse, format */
--node-action:       #EF4444;  /* Red — send email, API call, side effects */
--node-utility:      #6B7280;  /* Gray — debug, comment, note */
--node-integration:  #EC4899;  /* Pink — third-party services */
--node-output:       #06B6D4;  /* Cyan — final outputs, responses */
```

**Precedent:** Node-RED uses muted pastels per category (#3FADB5 for network, #E7E7AE for function, #FFAAAA for output). Unreal uses a saturated stripe on the left edge. Blender uses socket/wire color per data type.

### Data Type Colors (for handles/wires)

```css
--type-string:     #22C55E;  /* Green */
--type-number:     #3B82F6;  /* Blue */
--type-boolean:    #EF4444;  /* Red */
--type-object:     #A855F7;  /* Purple */
--type-array:      #F97316;  /* Orange */
--type-any:        #9CA3AF;  /* Gray */
--type-image:      #EC4899;  /* Pink */
--type-audio:      #06B6D4;  /* Cyan */
--type-llm:        #8B5CF6;  /* Violet — model/chain objects */
```

**Unreal Blueprint convention:** Each pin type has a unique color. Users learn the system fast — color becomes a visual shorthand for compatibility.

### Typography Hierarchy

```css
--font-family:        'Inter', system-ui, sans-serif;

/* Node internals */
--font-node-title:    600 13px/1.2 var(--font-family);   /* Node header */
--font-node-label:    400 12px/1.4 var(--font-family);   /* Field labels */
--font-node-value:    400 12px/1.4 var(--font-family);   /* Input values */
--font-node-badge:    500 10px/1 var(--font-family);     /* Status badges */

/* Canvas UI */
--font-frame-title:   600 16px/1.2 var(--font-family);   /* Group/frame names */
--font-minimap:       400 8px/1 var(--font-family);       /* Minimap labels */

/* Panels */
--font-panel-title:   600 14px/1.3 var(--font-family);
--font-panel-body:    400 13px/1.5 var(--font-family);
```

**Why Inter?** Best free font for UI at small sizes. Used by Figma, Linear, Vercel. Tabular numbers, clear at 11–13px.

### Iconography

Use a consistent icon set. **Lucide** (open source, tree-shakable, React-native) is the best choice for this stack.

- Node category icons: 20×20px in the header, left of title
- Handle type icons: optional 10×10px inside handles for extra clarity
- Status icons: 16×16px for running/error/success states

### State Indicators

| State | Visual Treatment |
|-------|-----------------|
| **Idle** | Default appearance, no extra indicators |
| **Selected** | 2px solid ring, `box-shadow: 0 0 0 2px var(--accent)` |
| **Running/Active** | Pulsing border animation, subtle glow `box-shadow: 0 0 8px rgba(88,166,255,0.4)` |
| **Success** | Brief green flash on header, checkmark icon, fades after 2s |
| **Error** | Red border + red dot badge on top-right corner, persists until resolved |
| **Disabled** | 50% opacity, desaturated, strikethrough on title |
| **Hover** | Slight elevation (`box-shadow` increase), handle highlights appear |

```css
/* Running state animation */
@keyframes node-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(88,166,255,0.3); }
  50%      { box-shadow: 0 0 0 4px rgba(88,166,255,0.6); }
}
.node--running { animation: node-pulse 2s ease-in-out infinite; }
```

---

## 3. Progressive Disclosure

### The Problem

AI agent nodes can have 15+ settings (model, temperature, max tokens, system prompt, tools, memory config, retry logic, output format...). Showing everything creates visual noise and overwhelms beginners.

### Strategy: Three Tiers

**Tier 1 — Always visible (node body)**
- The most-changed settings: model selector, main prompt/input, output handle
- Target: 3–5 fields maximum

**Tier 2 — Expandable section (node accordion)**
- Click "Advanced" chevron to reveal: temperature, max tokens, stop sequences
- Collapsed by default, remembers user's preference per node type

**Tier 3 — Side panel (detail editor)**
- Click node title or double-click to open a right-side panel
- Full settings: retry config, fallback models, memory, tool bindings, JSON schema
- This is where ComfyUI fails — it tries to show everything inline

### Implementation Patterns

```
┌──────────────────────────┐
│ 🤖 GPT-4o               │  ← Header (category color + icon + title)
├──────────────────────────┤
│ Model: [GPT-4o      ▼]  │  ← Tier 1: always visible
│ Prompt: [textarea    ]   │
│ ▸ Advanced               │  ← Tier 2: collapsed accordion
├──────────────────────────┤
│ ● input    output ●      │  ← Handles
└──────────────────────────┘

Double-click opens side panel (Tier 3):
┌──────────────────────────────────────────┐
│ GPT-4o Settings                     [×]  │
│                                          │
│ Model          [GPT-4o            ▼]     │
│ Temperature    [0.7           ━━━●━]     │
│ Max Tokens     [4096              ]      │
│ System Prompt  [textarea          ]      │
│ Tools          [+ Add tool       ]       │
│ Memory         [○ None ● Window ○ All]   │
│ Response Format [Text ▼]                 │
│ Retry on Error  [✓] Max retries [3]      │
│ Timeout         [30s             ]       │
│ Fallback Model  [None            ▼]      │
└──────────────────────────────────────────┘
```

### Real-World References

- **Figma:** Properties panel on right, minimal controls on canvas. Best example of progressive disclosure in a visual tool.
- **Blender:** Node properties show minimal inline, full settings in sidebar (N-panel).
- **VS Code:** Settings page with search + categories. Common settings first, "Commonly Changed" badge.
- **Node-RED:** Double-click opens a full edit dialog. Works well for simple nodes but interrupts flow for quick tweaks.

### Recommendations for Modular

1. **Inline for the top 3 settings** — model, primary input, one key toggle. Everything else goes behind a chevron or to the panel.
2. **Side panel for deep editing** — 320px wide, right-aligned, shows full config for the selected node. Persists while clicking different nodes (updates content).
3. **Panel tabs** for complex nodes: "Config", "Input Schema", "Output Schema", "Test"
4. **"Quick edit" mode:** Single-click selects, double-click opens panel. This matches Figma's pattern and feels natural.
5. **Textarea expansion:** For prompt nodes, allow the inline textarea to be "popped out" to a larger modal or the side panel. Editing a 500-word system prompt in a 60px textarea is painful (ComfyUI's biggest sin).

---

## 4. Marketplace / Library UX

### Discovery Patterns

| Product | Pattern | Lesson |
|---------|---------|--------|
| **VS Code Extensions** | Left sidebar, search + categories + trending/recommended | Categories + curated lists work. "Recommended" based on workspace context is powerful |
| **Figma Community** | Full-page browse, cards with previews, remixable | Visual previews are essential for discovery |
| **npm** | Search-first, minimal browse | Works for developers, bad for visual discovery |
| **Blender Add-ons** | In-preferences panel with search and categories | Low-friction install (toggle on/off) |
| **ComfyUI Manager** | In-app package manager, git-based | Powerful but confusing UX, no curation |

### Recommended UX for Modular

#### Node Library (built-in palette)

```
┌─────────────────────────┐
│ 🔍 Search nodes...      │  ← Fuzzy search (cmd+K also opens this)
├─────────────────────────┤
│ ★ Favorites             │
│ ↻ Recently Used         │
├─────────────────────────┤
│ ▸ Triggers (4)          │  ← Collapsible categories with count
│ ▸ AI Models (8)         │
│ ▸ Logic (6)             │
│ ▸ Transform (5)         │
│ ▸ Actions (12)          │
│ ▸ Integrations (24)     │
├─────────────────────────┤
│ + Browse Marketplace    │
└─────────────────────────┘
```

- **Drag from palette to canvas** to add nodes (standard in all node editors)
- **Double-click canvas** → opens quick-add searchable dropdown at cursor position (Blender's Shift+A pattern, incredibly efficient)
- **Right-click canvas** → context menu with "Add Node" submenu

#### Marketplace (installable community nodes)

```
┌──────────────────────────────────────────────────┐
│ Modular Marketplace                              │
│ 🔍 [Search community nodes...               ]   │
│                                                  │
│ [All] [AI] [Data] [Integrations] [Utilities]     │  ← Tab filters
│ Sort: [Popular ▼]                                │
│                                                  │
│ ┌──────────────────────┐ ┌────────────────────┐  │
│ │ 📦 Anthropic Tools   │ │ 📦 Vector DB       │  │
│ │ ★★★★☆ (142)         │ │ ★★★★★ (89)        │  │
│ │ by @author           │ │ by @author          │  │
│ │ Claude integration   │ │ Pinecone, Weaviate  │  │
│ │ [Install]            │ │ [Installed ✓]       │  │
│ └──────────────────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Install Flow

1. Click **Install** → shows brief permission summary ("This node accesses: network, file system")
2. Progress indicator (download + install)
3. **No restart required** — hot-load the node definition. This is critical. VS Code's reload requirement is its worst install UX flaw.
4. New nodes appear in palette with a "New" badge for 7 days
5. Installed packages manageable in Settings → Packages (enable/disable/uninstall)

### Search UX

- **Fuzzy matching** — "gpt" matches "OpenAI GPT-4", "anthropic" matches "Anthropic Claude"
- **Keyword aliases** — searching "LLM" should show all AI model nodes
- **Result ranking:** installed > favorites > popular > alphabetical
- **Instant filter** — no submit button, results update as you type (debounced 150ms)

---

## 5. Connection / Cable UX

### Edge Routing

React Flow provides four built-in edge types: `bezier` (default), `smoothstep`, `step`, `straight`.

**Recommendation: Use `smoothstep` as default.**

- Bezier curves look elegant but create visual ambiguity when many edges cross
- Smoothstep provides clean right-angle routing with rounded corners — readable at scale
- Allow user preference toggle in settings

```tsx
// Default edge options
const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
};
```

### Wire Colors

Color wires by data type (matching handle colors from Section 2). This is Unreal Blueprint's killer feature — you can read a graph without reading labels.

```css
.react-flow__edge-path[data-type="string"]  { stroke: var(--type-string); }
.react-flow__edge-path[data-type="number"]  { stroke: var(--type-number); }
.react-flow__edge-path[data-type="object"]  { stroke: var(--type-object); }
/* etc. */
```

### Visual Feedback During Connection Drag

This is where most node editors feel janky. Get this right:

1. **Start dragging from handle** → connection line follows cursor, colored by source type
2. **Compatible handles glow** — highlight all valid target handles with a pulsing ring and slight scale-up (`transform: scale(1.3)`)
3. **Incompatible handles dim** — reduce opacity to 0.3
4. **Hovering over valid target** → handle snaps to "connected" appearance, line snaps to target position
5. **Dropping on empty canvas** → show quick-add menu filtered to nodes that accept this type as input (Unreal's best UX innovation)
6. **Invalid connection** → brief red flash + shake animation on the target handle

```tsx
// React Flow's isValidConnection callback
const isValidConnection = useCallback((connection: Connection) => {
  const sourceType = getHandleType(connection.sourceHandle);
  const targetType = getHandleType(connection.targetHandle);
  return sourceType === targetType || targetType === 'any';
}, []);
```

### Type Compatibility Matrix

```
           string  number  boolean  object  array  any  image  audio
string       ✓       ✗       ✗       ✗       ✗     ✓     ✗      ✗
number       ✗       ✓       ✗       ✗       ✗     ✓     ✗      ✗
boolean      ✗       ✗       ✓       ✗       ✗     ✓     ✗      ✗
object       ✗       ✗       ✗       ✓       ✗     ✓     ✗      ✗
array        ✗       ✗       ✗       ✗       ✓     ✓     ✗      ✗
any          ✓       ✓       ✓       ✓       ✓     ✓     ✓      ✓
```

Consider adding **auto-conversion nodes**: dragging a `number` to a `string` input could auto-insert a "To String" converter node (Blender does this elegantly).

### Edge Deletion

- **Select edge + Delete/Backspace** — standard
- **Right-click edge → "Delete"** — context menu
- **Drag edge away from target handle** — disconnect by pulling off (Blender pattern, very intuitive)
- **Click the × button on edge** — React Flow supports edge labels/buttons via custom edges. Add a small × that appears on hover at the midpoint.

### Cable Management at Scale

- **Reroute nodes** — small circular pass-through points. Essential for >10 connections.
- **Edge bundling** — when multiple edges run parallel, offset them slightly (2px per edge) so they're individually selectable.
- **"Tidy wires" action** — recalculates routing to minimize crossings.
- **Edge z-index** — selected/hovered edges render on top.

---

## 6. Settings Panels

### Panel Architecture

Use a modal-style overlay or a dedicated settings page (not a side panel — that's reserved for node editing).

```
┌───────────────────────────────────────────────────┐
│ ⚙ Settings                                  [×]  │
├──────────┬────────────────────────────────────────┤
│          │                                        │
│ General  │  General Settings                      │
│ Editor   │                                        │
│ Provider │  Theme        [Dark ▼]                 │
│ Keys     │  Auto-save    [● On  ○ Off]            │
│ Keyboard │  Grid snap    [○ On  ● Off]            │
│ About    │  Edge style   [Smoothstep ▼]           │
│          │  Minimap      [● On  ○ Off]            │
│          │  Canvas bg    [Dots ▼]                  │
│          │                                        │
└──────────┴────────────────────────────────────────┘
```

### Provider Configuration

AI agent builders need provider/API key management. This is a first-class settings section.

```
┌────────────────────────────────────────────────────┐
│ Providers                                          │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ OpenAI                              [Connected]│ │
│ │ API Key: sk-...████████                [Edit]  │ │
│ │ Models: gpt-4o, gpt-4o-mini, o1                │ │
│ │ Usage: $12.43 this month                       │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Anthropic                         [Not configured]│
│ │ [+ Add API Key]                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ [+ Add Provider]                                   │
└────────────────────────────────────────────────────┘
```

**Key UX details:**
- Mask API keys by default (show last 4 chars)
- "Test Connection" button per provider
- Show available models after successful connection
- Color-coded status: green dot = connected, yellow = rate limited, red = invalid key

### Keyboard Shortcuts Panel

Reference: **Figma's shortcut panel** (Ctrl+Shift+?) — the gold standard.

```
┌──────────────────────────────────────────────┐
│ Keyboard Shortcuts                      [×]  │
│ 🔍 Search shortcuts...                      │
├──────────────────────────────────────────────┤
│ General                                      │
│   Undo                          Ctrl+Z       │
│   Redo                          Ctrl+Shift+Z │
│   Delete selected               Delete       │
│   Select all                    Ctrl+A       │
│                                              │
│ Canvas                                       │
│   Zoom in                       Ctrl++       │
│   Zoom out                      Ctrl+-       │
│   Fit view                      Ctrl+1       │
│   Toggle minimap                Ctrl+M       │
│                                              │
│ Nodes                                        │
│   Quick add node                /            │
│   Duplicate                     Ctrl+D       │
│   Group selected                Ctrl+G       │
│   Toggle node enable            D            │
│                                              │
│ Edges                                        │
│   Delete edge                   Backspace    │
│   Reroute                       R            │
└──────────────────────────────────────────────┘
```

**Important:** Use `/` (slash) for quick-add node search (like Notion's block command). This is becoming a universal pattern.

---

## 7. Accessibility

### Keyboard Navigation

Node editors are notoriously bad for accessibility. Modular can differentiate here.

**Focus model:**

1. **Tab** cycles through: toolbar → node palette → canvas → side panel → next toolbar
2. Inside canvas, **Arrow keys** move between nodes (spatial navigation: left/right/up/down finds nearest node in that direction)
3. **Enter** on a focused node opens the detail panel
4. **Space** on a focused node toggles selection
5. **Tab inside a node** cycles through its editable fields
6. **Escape** returns focus to canvas from any panel

**Implementation with React Flow:**

```tsx
// React Flow supports keyboard handlers
<ReactFlow
  onNodeClick={handleNodeClick}
  onKeyDown={(event) => {
    if (event.key === 'Tab') {
      // Custom spatial navigation
      event.preventDefault();
      focusNextNode(event.shiftKey ? 'prev' : 'next');
    }
  }}
  // Enable keyboard-accessible node selection
  nodesFocusable={true}
  edgesFocusable={true}
/>
```

### Screen Reader Support

```tsx
// Node component with ARIA
const CustomNode = ({ data, selected }) => (
  <div
    role="treeitem"
    aria-label={`${data.type} node: ${data.label}`}
    aria-selected={selected}
    aria-describedby={`node-${data.id}-description`}
    tabIndex={0}
  >
    <span id={`node-${data.id}-description`} className="sr-only">
      {`${data.type} node with ${data.inputs.length} inputs and ${data.outputs.length} outputs. 
        Connected to: ${data.connections.map(c => c.label).join(', ')}`}
    </span>
    {/* visible content */}
  </div>
);

// Canvas container
<div role="tree" aria-label="Workflow canvas" aria-orientation="horizontal">
  <ReactFlow ... />
</div>
```

### ARIA Live Regions for State Changes

```tsx
// Announce connection events
<div aria-live="polite" className="sr-only" id="canvas-announcements">
  {announcement} {/* e.g., "Connected GPT-4o output to Format Response input" */}
</div>
```

### Focus Management

- When a node is added, focus moves to it automatically
- When a node is deleted, focus moves to the nearest remaining node
- Opening the side panel moves focus to the panel title; closing returns focus to the node
- Modal dialogs trap focus (standard pattern)

### Motion Sensitivity

```css
@media (prefers-reduced-motion: reduce) {
  .node--running { animation: none; border-color: var(--accent); }
  .react-flow__edge-path { transition: none; }
  * { transition-duration: 0.01ms !important; }
}
```

---

## 8. Dark / Light Theme

### Token Architecture

Use semantic tokens that reference primitive tokens. This scales cleanly.

```css
/* ===== Primitive Tokens ===== */
:root {
  /* Neutrals (based on Tailwind Zinc) */
  --gray-50:   #fafafa;
  --gray-100:  #f4f4f5;
  --gray-200:  #e4e4e7;
  --gray-300:  #d4d4d8;
  --gray-400:  #a1a1aa;
  --gray-500:  #71717a;
  --gray-600:  #52525b;
  --gray-700:  #3f3f46;
  --gray-800:  #27272a;
  --gray-850:  #1f1f23;
  --gray-900:  #18181b;
  --gray-950:  #09090b;

  /* Brand */
  --brand-50:  #EEF2FF;
  --brand-100: #E0E7FF;
  --brand-200: #C7D2FE;
  --brand-400: #818CF8;
  --brand-500: #6366F1;  /* Primary brand — Indigo */
  --brand-600: #4F46E5;
  --brand-700: #4338CA;
}

/* ===== Semantic Tokens: Dark (default) ===== */
[data-theme="dark"] {
  /* Surfaces */
  --bg-canvas:          var(--gray-950);  /* Main canvas background */
  --bg-surface:         var(--gray-900);  /* Node body, panels */
  --bg-surface-raised:  var(--gray-850);  /* Hovered nodes, cards */
  --bg-surface-overlay: var(--gray-800);  /* Dropdowns, tooltips */
  --bg-node-header:     var(--gray-800);  /* Node header bar */

  /* Borders */
  --border-default:     var(--gray-700);
  --border-subtle:      var(--gray-800);
  --border-strong:      var(--gray-600);
  --border-selected:    var(--brand-500);

  /* Text */
  --text-primary:       var(--gray-50);   /* Titles, important */
  --text-secondary:     var(--gray-400);  /* Labels, descriptions */
  --text-tertiary:      var(--gray-500);  /* Placeholders, hints */
  --text-inverse:       var(--gray-950);  /* Text on colored backgrounds */

  /* Interactive */
  --accent:             var(--brand-500);
  --accent-hover:       var(--brand-400);
  --accent-muted:       rgba(99, 102, 241, 0.15);

  /* Status */
  --status-success:     #22C55E;
  --status-error:       #EF4444;
  --status-warning:     #F59E0B;
  --status-info:        #3B82F6;
  --status-running:     #60A5FA;

  /* Canvas-specific */
  --canvas-dot:         var(--gray-800);  /* Grid dots */
  --canvas-dot-size:    1px;
  --edge-default:       var(--gray-500);
  --edge-selected:      var(--brand-400);
  --edge-hover:         var(--gray-300);

  /* Shadows */
  --shadow-node:        0 2px 8px rgba(0,0,0,0.3);
  --shadow-node-hover:  0 4px 16px rgba(0,0,0,0.4);
  --shadow-panel:       0 8px 32px rgba(0,0,0,0.5);
}

/* ===== Semantic Tokens: Light ===== */
[data-theme="light"] {
  --bg-canvas:          var(--gray-100);
  --bg-surface:         #FFFFFF;
  --bg-surface-raised:  var(--gray-50);
  --bg-surface-overlay: #FFFFFF;
  --bg-node-header:     var(--gray-100);

  --border-default:     var(--gray-200);
  --border-subtle:      var(--gray-100);
  --border-strong:      var(--gray-300);
  --border-selected:    var(--brand-600);

  --text-primary:       var(--gray-900);
  --text-secondary:     var(--gray-600);
  --text-tertiary:      var(--gray-400);
  --text-inverse:       #FFFFFF;

  --accent:             var(--brand-600);
  --accent-hover:       var(--brand-700);
  --accent-muted:       rgba(99, 102, 241, 0.08);

  --canvas-dot:         var(--gray-300);
  --edge-default:       var(--gray-400);
  --edge-selected:      var(--brand-600);
  --edge-hover:         var(--gray-600);

  --shadow-node:        0 1px 4px rgba(0,0,0,0.08);
  --shadow-node-hover:  0 4px 12px rgba(0,0,0,0.12);
  --shadow-panel:       0 8px 24px rgba(0,0,0,0.1);
}
```

### Contrast Requirements

**WCAG AA minimum (4.5:1 for text, 3:1 for UI components):**

| Element | Dark Theme | Light Theme | Ratio |
|---------|-----------|-------------|-------|
| Primary text on canvas | #fafafa on #09090b | #18181b on #f4f4f5 | 19.4:1 ✓ |
| Secondary text on surface | #a1a1aa on #18181b | #52525b on #ffffff | 5.1:1 ✓ |
| Node border on canvas | #3f3f46 on #09090b | #e4e4e7 on #f4f4f5 | 3.2:1 ✓ |
| Accent on surface | #6366F1 on #18181b | #4F46E5 on #ffffff | 4.6:1 ✓ |

### Node Category Colors — Theme Adaptation

Category colors (Section 2) should be slightly adjusted per theme. In dark mode, use the default values. In light mode, darken them by ~15%:

```css
[data-theme="light"] {
  --node-trigger:      #3B7DDF;
  --node-ai:           #9333EA;
  --node-logic:        #D97706;
  --node-transform:    #059669;
  --node-action:       #DC2626;
}
```

### Canvas Background

```css
/* Dot grid pattern (dark) */
.react-flow__background {
  --dot-color: var(--canvas-dot);
  --dot-size: var(--canvas-dot-size);
  --gap: 20px;
}
```

Offer three canvas background options in settings: **Dots** (default), **Lines** (grid), **None** (clean).

### Theme Switching

- **System preference by default** (`prefers-color-scheme` media query)
- **Manual override** in settings with three options: System / Light / Dark
- **Instant switch** — no reload, CSS custom properties swap instantly
- Store preference in `localStorage`

```tsx
// Theme provider
const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() =>
  localStorage.getItem('theme') ?? 'system'
);

useEffect(() => {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}, [theme]);
```

---

## Appendix: Quick Reference Cheat Sheet

### Must-Have Interactions

| Action | Trigger |
|--------|---------|
| Add node | Drag from palette, double-click canvas, or press `/` |
| Connect | Drag from output handle to input handle |
| Select multiple | Shift+drag or Ctrl+click |
| Delete | Select + Delete/Backspace |
| Duplicate | Ctrl+D |
| Undo/Redo | Ctrl+Z / Ctrl+Shift+Z |
| Zoom | Scroll wheel, Ctrl++ / Ctrl+- |
| Fit view | Ctrl+1 |
| Search | Ctrl+K (command palette) or `/` (quick node add) |
| Pan | Middle-click drag or Space+drag |
| Edit node | Double-click or Enter when focused |

### Component Library Stack

| Purpose | Recommended Library |
|---------|-------------------|
| Node editor | `@xyflow/react` (React Flow) |
| Icons | `lucide-react` |
| UI components | `radix-ui/primitives` + custom styling |
| Layout algorithm | `elkjs` or `dagre` |
| Command palette | `cmdk` |
| Tooltip/popover | `@radix-ui/react-tooltip` |
| Theme | CSS custom properties (no runtime cost) |
| Motion | `framer-motion` (only for panel transitions) |
| Code editing | `@monaco-editor/react` (for JSON schema / code nodes) |

### File Structure (suggested)

```
src/
  components/
    nodes/           # Custom node components
    edges/           # Custom edge components  
    panels/          # Side panel, settings, marketplace
    canvas/          # Canvas wrapper, minimap, toolbar
    ui/              # Shared UI primitives (button, input, dropdown)
  hooks/             # useNodeTypes, useConnections, useTheme
  styles/
    tokens.css       # All CSS custom properties
    nodes.css        # Node-specific styles
    edges.css        # Edge styles
    theme.css        # Theme switching logic
  types/             # TypeScript types for nodes, edges, handles
  lib/
    type-system.ts   # Handle type checking & compatibility
    layout.ts        # Auto-layout with elkjs
```

---

## Sources & Further Reading

- **React Flow docs:** https://reactflow.dev/learn
- **Node-RED node appearance:** https://nodered.org/docs/creating-nodes/appearance
- **NNGroup Progressive Disclosure:** https://www.nngroup.com/articles/progressive-disclosure/
- **Unreal Blueprint docs:** https://docs.unrealengine.com/en-US/ProgrammingAndScripting/Blueprints/
- **Blender Manual — Node Editor:** https://docs.blender.org/manual/en/latest/interface/controls/nodes/
- **ComfyUI GitHub:** https://github.com/comfyanonymous/ComfyUI
- **WCAG 2.1 Contrast:** https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- **Radix UI Primitives:** https://www.radix-ui.com/primitives
- **Lucide Icons:** https://lucide.dev
- **Inter font:** https://rsms.me/inter/
- **cmdk (command palette):** https://cmdk.paco.me
- **elkjs (layout):** https://github.com/kieler/elkjs
