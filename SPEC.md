# MODULAR — Agent Patchbay

## Vision
A Moog modular synthesizer-inspired visual programming interface for AI agent orchestration. 
Users patch together tools, models, and routing modules with virtual cables to build agent workflows.

**Think: Moog System 55 meets n8n/Zapier.**

## Tech Stack
- React 18+ with TypeScript (strict)
- Vite for build
- @xyflow/react (React Flow v12) — handles canvas, nodes, edges, panning, zooming, minimap
- Tailwind CSS 4 — utility classes
- Zustand — state management (patches, module configs)
- No other UI library. Custom components only.

## Design Language — "Digital Moog"

### Colors
```
--bg-rack: #0f0f0f          // Main background (rack rails)
--bg-panel: #1e1a17         // Module faceplate (warm dark brown, like walnut)
--bg-panel-dark: #151210    // Darker panel areas
--border-panel: #2d2720     // Panel edges
--accent: #FE5000           // Primary accent (Syroco orange — for indicators, active states)
--accent-dim: #CC4000       // Dimmed accent
--text-primary: #e8e0d8     // Cream/warm white labels
--text-secondary: #8a7e72   // Dimmed labels
--text-label: #b5a898       // Panel engraved text feel
--jack-ring: #888888        // Jack socket metal ring
--jack-hole: #0a0a0a        // Jack socket hole
--led-green: #00ff88        // Active/connected LED
--led-red: #ff3344          // Error LED
--led-amber: #ffaa00        // Warning/processing LED
--cable-colors: [#e74c3c, #3498db, #2ecc71, #f1c40f, #e67e22, #9b59b6, #00bcd4, #e91e8a, #ff6b6b, #45b7d1]
--knob-body: #333333        // Knob housing
--knob-cap: #1a1a1a         // Knob center cap
--knob-indicator: #ffffff   // Knob position line
```

### Typography
- Module titles: `'Space Mono', monospace` — uppercase, letter-spacing 3px, 10-11px
- Jack labels: `'Space Mono', monospace` — uppercase, letter-spacing 1px, 9px
- Values/readouts: `'Space Mono', monospace` — 10px, accent color
- Body text (sidebar, tooltips): `'Inter', sans-serif` — 12px

### Module Panel Design
Each module node is a "panel" inspired by Moog module faceplates:
- Warm dark brown/walnut background with subtle texture (CSS gradient)
- Rounded corners: 6px
- 4 decorative screws (corners) — radial gradient circles
- Top header bar: darker, with LED indicator + title
- Engraved label feel (text-shadow for emboss effect)
- Box shadow for depth (like a module sitting in a rack)
- Min-width per module type, height adapts to content

### Jack Sockets
Real Moog 3.5mm jack style:
- Circular, 24px diameter
- Dark hole center with metallic ring border
- On hover: accent glow ring
- When connected: filled dot or ring color change
- Inputs on LEFT side of module, outputs on RIGHT side
- Each jack has a small label above or beside it

### Knobs
Skeuomorphic rotary knobs:
- 44px diameter circle
- Radial gradient for 3D dome effect
- White indicator line from center to edge
- Rotation range: -135° to +135° (270° total)
- Drag interaction: vertical mouse movement (up = clockwise)
- Below knob: value readout (accent color)
- Below value: label text (dim)

### Toggle Switches
- Pill-shaped, 36x18px
- Thumb slides left/right
- ON state: accent color background
- Label to the right

### Cables (Edges)
**This is the signature element. Must look like real patch cables:**
- Thick (4-5px stroke) with rounded caps
- Catenary/droop curve (not straight, not bezier — simulate gravity sag)
- Use custom React Flow edge component with quadratic bezier where control point is pulled down
- Random color from palette assigned on connection
- Subtle drop shadow for depth
- On hover: thicken + glow
- Click to delete (with small × button appearing on hover)
- Animated dashed stroke when "signal flowing" (during execution)
- Cable should originate from the jack center point

### Oscilloscope / Signal Monitor
On processor modules (LLM, Vision, TTS):
- Small dark rectangle (like a CRT scope screen)
- Green trace line animating — sine wave when idle, active waveform when processing
- Scanline overlay effect (subtle horizontal lines)
- Corner label "SIGNAL" in green

## Module Types

### Sources (Blue-ish tint on header)
1. **PROMPT** — Text input. Has a textarea. Output: `text`
2. **FILE READ** — Path input jack + offset/limit knobs. Outputs: `content`, `meta`
3. **WEB SEARCH** — Query input jack + count knob + freshness toggle. Output: `results`
4. **WEB FETCH** — URL input jack + maxChars knob + mode toggle (markdown/text). Outputs: `content`, `meta`
5. **SCHEDULE** — Cron expression input. Output: `trigger`. Has cron display.
6. **WEBHOOK IN** — No inputs. Output: `payload`. Has URL display.

### Processors (Green-ish tint on header)
7. **LLM** — The big one. Inputs: `system`, `user`, `context`, `tools`. Outputs: `response`, `tool_calls`, `tokens`. Knobs: temperature, max_tokens, top_p. Toggles: thinking, stream. Model dropdown selector. Has scope display.
8. **VISION** — Inputs: `image`, `prompt`. Output: `analysis`. Has scope.
9. **TTS** — Input: `text`. Output: `audio`. Knob: speed, voice selector.
10. **EMBEDDINGS** — Input: `text`. Output: `vector`. Model selector.
11. **TRANSFORM** — Input: `data`. Output: `result`. Has code editor textarea (JS transform function).

### Tools (Orange-ish tint on header)
12. **SHELL** — Input: `command`. Outputs: `stdout`, `stderr`, `exit_code`. Knobs: timeout. Toggles: pty, background.
13. **BROWSER** — Inputs: `url`, `action`. Outputs: `snapshot`, `screenshot`. Toggle: headless.
14. **MEMORY** — Input: `query`. Output: `results`. Knob: maxResults.
15. **CODE AGENT** — Inputs: `task`, `context`. Outputs: `result`, `files`. Knob: timeout. Toggle: yolo.
16. **HTTP REQUEST** — Inputs: `url`, `body`, `headers`. Outputs: `response`, `status`. Method selector dropdown.
17. **DATABASE** — Inputs: `query`, `params`. Output: `rows`. Connection string config.

### Routing (Purple-ish tint on header)
18. **SPLITTER** — Input: `in`. Outputs: `out_1`, `out_2`, `out_3`. Fan-out.
19. **MIXER** — Inputs: `in_1`, `in_2`, `in_3`. Output: `out`. Merge mode knob (concat/array/object).
20. **GATE** — Inputs: `signal`, `condition`. Outputs: `pass`, `reject`. Toggle: invert.
21. **LOOP** — Inputs: `items`, `body_result`. Outputs: `item`, `done`. Knob: max iterations.
22. **DELAY** — Input: `in`. Output: `out`. Knob: delay_ms.
23. **SWITCH** — Input: `value`. Outputs: `case_1`, `case_2`, `case_3`, `default`. Config for match values.

### Outputs (Red-ish tint on header)
24. **MESSAGE** — Inputs: `text`, `media`. Channel selector (WhatsApp/Telegram/Discord/Slack/Signal). Toggle: silent.
25. **FILE WRITE** — Inputs: `content`, `path`. Output: `written_path`. Toggle: append.
26. **WEBHOOK OUT** — Inputs: `body`, `url`. Output: `response`. Method selector.
27. **CANVAS** — Input: `html`. Presents to OpenClaw canvas.
28. **NOTIFY** — Input: `text`. Sends system notification to paired nodes.

## Architecture

```
src/
  main.tsx                    # Entry point
  App.tsx                     # Top-level layout: Topbar + Sidebar + Rack
  
  store/
    patchStore.ts             # Zustand store: nodes, edges, module configs, execution state
    moduleDefinitions.ts      # All MODULE_DEFS (types, ports, knobs, toggles, defaults)
    
  components/
    Topbar.tsx                # Logo, action buttons (Clear, Auto-Layout, Run, Export, Import)
    Sidebar.tsx               # Module library — categorized, draggable
    Rack.tsx                  # React Flow canvas wrapper with custom config
    
  nodes/                      # Custom React Flow node components
    BaseModule.tsx            # Shared module shell (panel, header, screws, LED, close btn)
    SourceModule.tsx          # Sources with optional textarea
    ProcessorModule.tsx       # Processors with scope display
    ToolModule.tsx            # Tools
    RoutingModule.tsx         # Routing modules
    OutputModule.tsx          # Output modules
    
  controls/                   # Reusable synth controls
    Jack.tsx                  # Custom Handle component (jack socket style)
    Knob.tsx                  # Rotary knob with drag interaction
    Toggle.tsx                # Toggle switch
    Scope.tsx                 # Oscilloscope display (canvas-based)
    ModuleSelect.tsx          # Styled dropdown
    LEDIndicator.tsx          # LED dot with glow
    Screw.tsx                 # Decorative screw
    
  edges/
    PatchCable.tsx            # Custom edge: catenary curve, colored, animated
    
  execution/
    executor.ts              # Topological sort + execute patch (simulated for now)
    
  utils/
    cableColors.ts            # Color palette + round-robin assignment
    catenary.ts               # Catenary/droop math for cable paths
    serialization.ts          # Export/import patch as JSON
    
  styles/
    globals.css               # CSS variables, fonts, base styles
    modules.css               # Module-specific overrides
```

## Key Implementation Details

### React Flow Configuration
```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  onConnect={onConnect}
  connectionMode={ConnectionMode.Loose}
  defaultEdgeOptions={{ type: 'patchCable' }}
  snapToGrid={true}
  snapGrid={[15, 15]}
  fitView
  minZoom={0.2}
  maxZoom={2}
  proOptions={{ hideAttribution: true }}
>
  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a2a" />
  <Controls />
  <MiniMap />
</ReactFlow>
```

### Custom Handle (Jack) 
The Handle component wraps React Flow's `<Handle>` with jack-socket styling. Position handles vertically along left (inputs) and right (outputs) sides.

### Cable Physics (Catenary Curve)
Instead of default bezier, calculate a catenary-like droop:
```
// Approximate catenary with quadratic bezier
const midX = (sourceX + targetX) / 2;
const midY = (sourceY + targetY) / 2;
const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
const sag = Math.min(dist * 0.25, 100); // gravity pull
const controlY = midY + sag;
const path = `M ${sourceX} ${sourceY} Q ${midX} ${controlY} ${targetX} ${targetY}`;
```

### Knob Drag Behavior
- onMouseDown: capture start Y + current value
- onMouseMove: delta = startY - currentY (up = increase)
- Map delta to value range (150px drag = full range)
- Snap to step increments
- Update indicator rotation: angle = -135 + (pct * 270)

### Execution (Run button)
1. Topological sort of connected modules
2. Walk sorted order: for each module, gather inputs from connected output edges
3. Execute module logic (simulated — just logs and animates cables)
4. Animate cable `strokeDasharray` + `strokeDashoffset` for signal flow
5. Update scope displays on processor modules
6. Set LED states: green=done, amber=processing, red=error

### Drag from Sidebar
Sidebar items have `draggable` attribute. On drop onto React Flow canvas, get drop position via `reactFlowInstance.screenToFlowPosition()` and create new node.

### Serialization
Export/Import saves `{ version, nodes, edges, moduleConfigs }` as JSON. 
- Nodes include position, type, config (knob values, toggle states, textarea content)
- Edges include source/target handles, color
- Can be saved to localStorage for persistence

### MiniMap
Custom MiniMap node colors by category:
- Sources: #3498db
- Processors: #2ecc71
- Tools: #e67e22
- Routing: #9b59b6
- Outputs: #e74c3c

## Files to Create

1. `package.json` — deps: @xyflow/react, zustand, react, react-dom, typescript, tailwindcss, vite, @types/react, @types/react-dom
2. `vite.config.ts` — standard React + TS config
3. `tsconfig.json` — strict, ESNext
4. `tailwind.config.ts` — custom theme colors + fonts
5. `index.html` — root with Google Fonts link (Space Mono, Inter)
6. All `src/` files per architecture above
7. `README.md` — project description, screenshot placeholder, setup instructions
8. `.gitignore` — node_modules, dist, .env
9. `LICENSE` — MIT

## Critical Quality Bar
- TypeScript strict mode, no `any`
- All components properly typed with interfaces
- Clean separation: store / components / nodes / controls / edges / utils
- No commented-out code
- Conventional commits
- Responsive to window resize
- Keyboard shortcuts: Delete (remove selected), Escape (cancel connection), Ctrl+Z (undo)
- Persist to localStorage automatically
- Must look STUNNING — this is a visual product. The Moog aesthetic must be unmistakable.

## What NOT to Build (Yet)
- Actual OpenClaw/MCP integration (just simulated execution)
- User auth
- Backend/API
- Multi-user collaboration
- Undo/redo stack (basic only via React Flow built-in)
