# Task: Switch to React Flow canvas with draggable blocks and manual cable connections

## Current State
The app has a CSS grid layout with 4 sections + center prompt. Cables are broken (wrong positions, SVG overlay approach doesn't work). User wants:
1. **Draggable blocks** — move Knowledge, Skills, MCP, Output sections freely on a canvas
2. **Manual cable connections** — drag from output port to input port to connect blocks to the prompt
3. **Labeled ports** — each block has "Input" and "Output" labeled jack ports

## What to Build
Use `@xyflow/react` (already in package.json, v12) to create a node-based canvas.

### Nodes (draggable blocks):
1. **PromptNode** — central node with the prompt textarea. Has:
   - Left port labeled "INPUT" (target handle) — receives from Knowledge, Skills, MCP
   - Right port labeled "OUTPUT" (source handle) — sends to Output format node
2. **KnowledgeNode** — shows added knowledge sources as tiles. Has:
   - Right port labeled "OUTPUT" (source handle)
   - "+" button opens FilePicker modal
3. **McpNode** — shows added MCP servers. Has:
   - Right port labeled "OUTPUT" (source handle)
   - "+" button opens McpPicker modal
4. **SkillsNode** — shows added skills. Has:
   - Right port labeled "OUTPUT" (source handle)
   - "+" button opens SkillPicker modal
5. **OutputNode** — shows output format selector. Has:
   - Left port labeled "INPUT" (target handle)
6. **ResponseNode** — shows the response/output area. Has:
   - Left port labeled "INPUT" (target handle)

### Edges (cables):
- Use custom edge component with catenary curve (quadratic bezier with sag)
- Thick 4px stroke with shadow and glow (like v1 PatchCable)
- Colored by source node type
- User can drag from any OUTPUT port to any INPUT port to create a cable
- Cables can be deleted by clicking the × button on hover

### Jack Port Style:
- Big 22px chrome rings with radial gradient (like v1 Jack.tsx)
- Label "INPUT" or "OUTPUT" next to each port in Space Mono uppercase
- Glow effect when connecting

### Default Layout:
- Knowledge, Skills, MCP on the left (stacked vertically)
- Prompt in the center
- Output + Response on the right
- Pre-connected with cables by default

### Canvas:
- Dark background (#111114) with subtle dot grid
- Pan and zoom enabled
- MiniMap in bottom-right corner
- Controls in bottom-left (zoom in/out/fit)

## Files to Modify/Create
- `src/App.tsx` — replace grid layout with ReactFlow canvas
- `src/nodes/PromptNode.tsx` — prompt textarea as a node
- `src/nodes/KnowledgeNode.tsx` — knowledge tiles as a node
- `src/nodes/McpNode.tsx` — MCP tiles as a node
- `src/nodes/SkillsNode.tsx` — skills tiles as a node
- `src/nodes/OutputNode.tsx` — output format as a node
- `src/nodes/ResponseNode.tsx` — response area as a node
- `src/edges/PatchCable.tsx` — custom edge with catenary + glow
- `src/components/JackPort.tsx` — reusable jack port with label
- DELETE `src/components/CableLayer.tsx` — replaced by React Flow edges
- DELETE `src/components/Section.tsx` — replaced by node components
- Keep: Topbar, FilePicker, McpPicker, SkillPicker, TokenBudget, AgentPreview, icons

## React Flow Setup
```tsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

## Constraints
- Keep all Zustand store logic (consoleStore, knowledgeBase)
- Keep all picker modals (FilePicker, McpPicker, SkillPicker)
- Keep Topbar, TokenBudget, AgentPreview
- Build must pass with zero TS errors
- Use conventional commits

## When Done
Run `npm run build` to verify. Commit. Then run:
```
openclaw system event --text "Done: React Flow canvas with draggable blocks, manual cables, labeled ports" --mode now
```
