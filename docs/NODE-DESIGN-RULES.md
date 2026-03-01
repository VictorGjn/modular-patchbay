# Node Design Rules — Modular Studio

Definitive visual rules for ALL canvas nodes. Every node MUST follow these.

## Design Tokens

```
--node-width-sm: 260px    (Generator, small utility nodes)
--node-width-md: 320px    (Knowledge, Skills, MCP, Workflow, Memory)
--node-width-lg: 480px    (Agent, Prompt)
--node-radius: 10px
--node-padding-x: 20px    (px-5 — leaves gutter for handles on edges)
--node-padding-y: 12px
--node-gap: 12px          (gap between elements inside a section)
--section-gap: 0px        (sections are flush, divided by border)
--header-height: 40px
--handle-size: 8px
--handle-offset: -4px     (half of handle-size, places center on border)
--font-header: 'Space Mono', monospace
--font-body: 'Inter', sans-serif
--font-size-header: 10px
--font-size-label: 9px
--font-size-body: 13px
--font-size-small: 11px
--accent: #FE5000
```

## Node Structure

Every node follows this exact structure:

```
┌─────────────────────────────┐
│  HEADER (40px, elevated bg) │  ← Icon + Title + optional right content
├─────────────────────────────┤
│  BODY (scrollable)          │  ← px-4 py-3, gap-3 between elements
│                             │
│  [Section Divider]          │  ← Only in large nodes (Agent)
│  [Content]                  │
│                             │
└─────────────────────────────┘
```

## Header Rules

- Height: exactly 40px
- Background: `t.surfaceElevated`
- Border bottom: `1px solid ${t.border}`
- Left: 14px icon (node accent color) + title (10px, Space Mono, bold, tracking 0.15em, uppercase)
- Right: optional count badge or action button
- Padding: `px-4`

## Handle Rules

- ALL nodes use `<Handle>` from `@xyflow/react` directly — NO JackGutter, NO JackPort
- Handle size: 8px circle, no border
- Position: `left: -4` or `right: -4` (center on node border)
- Percentage-based `top` positioning for consistent placement
- Color matches the semantic connection type:
  - Knowledge: `#3498db` (blue)
  - Skills: `#f1c40f` (yellow)  
  - MCP/Tools: `#2ecc71` (green)
  - Prompt/Agent: `#9b59b6` (purple)
  - Workflow: `#e67e22` (orange)
  - Memory: `#e74c3c` (red)
  - Output: `#FE5000` (accent)
  - Feedback: `#95a5a6` (gray, dashed edge)
- Small nodes (1-2 handles per side): handles at 50%
- Medium nodes (2-3 handles): evenly spaced (33%, 67% or 25%, 50%, 75%)
- NO text labels on handles — the edge labels provide enough context

## Handle Style Object

```tsx
const HANDLE: React.CSSProperties = {
  width: 8, height: 8, border: 'none', borderRadius: '50%',
};
// Usage:
<Handle style={{ ...HANDLE, top: '50%', left: -4, background: '#3498db' }} />
```

## Edge / Cable Rules

- Use `patch` type (PatchCable) for data flow edges
- Use `feedback` type (FeedbackEdge) for suggestion edges (dashed, gray)
- Edge labels: short (1 word), lowercase, 9px Space Mono
- Edge colors match the SOURCE handle color
- Minimize edge crossings by canvas layout (left→right flow)
- Curved edges (`smoothstep` or `bezier`), not straight lines

## Body Content Rules

- Padding: `px-5 py-3` for every content section (20px horizontal = handle gutter)
- Gap: `gap-3` (12px) between elements
- ALL text inputs use DS `<Input>` component
- ALL text areas use DS `<TextArea>` component  
- ALL toggles use DS `<Toggle>` component
- ALL buttons use DS `<Button>` or specific patterns below
- NO raw `<input>`, `<textarea>`, `<select>` with inline styles
- NO inline `style={{}}` for standard input styling — DS handles it

## Typography

| Element | Font | Size | Weight | Tracking | Case |
|---------|------|------|--------|----------|------|
| Node title | Space Mono | 10px | bold | 0.15em | UPPERCASE |
| Section label | Space Mono | 9px | 600 | 0.12em | UPPERCASE |
| Field label | Space Mono | 9px | 600 | 0.1em | UPPERCASE |
| Body text | Inter | 13px | 400 | normal | normal |
| Small text | Inter | 11px | 400 | normal | normal |
| Count badge | Space Mono | 9px | 600 | 0.05em | normal |
| Button text | Inter | 11px | 500 | normal | normal |

## Color System

- Node background: `t.surfaceOpaque`
- Node border: `1px solid ${t.border}`
- Node shadow: `0 2px 12px` with theme-appropriate alpha
- Section dividers: `1px solid ${t.borderSubtle}`
- Active/selected states: `${accent}10` background, `${accent}30` border
- Disabled states: 0.5 opacity
- Error states: `#ff4444` text, `#ff000010` background

## Interactive Patterns

### Toggle Row
```tsx
<Toggle checked={value} onChange={setter} label="Description text" />
```

### Segmented Control (2-4 options)
```tsx
<div className="flex rounded-md overflow-hidden" style={{ border }}>
  {options.map(opt => <button ... />)}
</div>
```

### List with Add/Remove
```tsx
{items.map(item => (
  <div className="flex items-center gap-2 mb-1.5">
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
    <Input ... />
    <button onClick={remove}><X size={11} /></button>
  </div>
))}
<AddButton label="Add item" onClick={addItem} />
```

### Action Badge (header right)
```tsx
<span className="text-[9px] px-1.5 py-0.5 rounded"
  style={{ background: `${color}15`, color, fontFamily: 'Space Mono' }}>
  {count} items
</span>
```

### Generate Button
```tsx
<button className="flex items-center gap-1 text-[9px] px-2 py-1 rounded ..."
  style={{ background: '#FE500015', color: '#FE5000' }}>
  <Sparkles size={9} /> Generate
</button>
```

## Node-Specific Width

| Node | Width | Handles Left | Handles Right |
|------|-------|-------------|---------------|
| Generator | 260px | none | 1 (agent, 50%) |
| Knowledge | 320px | 1 (feedback, 50%) | 1 (out, 50%) |
| Skills | 320px | 1 (feedback, 50%) | 1 (out, 50%) |
| MCP | 320px | none | 1 (out, 50%) |
| Agent | 480px | 3 (know 20%, skills 40%, mcp 60%) | 3 (prompt 25%, flow 50%, mem 75%) |
| Workflow | 320px | 1 (in, 50%) | 1 (out, 50%) |
| Memory | 320px | 1 (in, 50%) | 1 (out, 50%) |
| Prompt | 480px | 2 (agent 33%, knowledge 67%) | 2 (output 33%, response 67%) |
| Output | 320px | 1 (in, 50%) | 1 (out, 50%) |
| Response | 320px | 1 (in, 50%) | none |
| AgentPreview | 320px | 1 (in, 50%) | none |

## Canvas Layout (left→right flow)

```
Generator(260) → 
  Knowledge(320) ─┐
  Skills(320)    ─┤→ Agent(480) → Workflow(320) → Prompt(480) → Output(320) → Preview(320)
  MCP(320)       ─┘              Memory(320) ↗                  Response(320)
```

## Checklist Before Committing Node Changes

- [ ] Uses `<Handle>` directly, no JackGutter/JackPort
- [ ] Header is exactly 40px with `t.surfaceElevated`
- [ ] Body padding is `px-4 py-3` with `gap-3`
- [ ] All inputs are DS `<Input>` / `<TextArea>` / `<Toggle>`
- [ ] Typography matches the table above
- [ ] Handle colors match the semantic type
- [ ] `nodrag` on all interactive elements
- [ ] `nowheel` on scrollable areas
- [ ] Width matches the node-specific table
- [ ] No inline input styling (DS handles it)
