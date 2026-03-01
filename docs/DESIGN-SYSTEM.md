# Modular Studio — Design System

All components live in `src/components/ds/` and are barrel-exported from `src/components/ds/index.ts`.

## Principles

- **Theme-driven** — every component calls `useTheme()` for colors; no hardcoded palette except accent `#FE5000`
- **Typography** — Space Mono for labels, headers & UI chrome; Inter for body text and inputs
- **Sizes** — most components support `sm` | `md` (some add `lg`)
- **Composable** — components accept `className` / `style` for overrides
- **No raw HTML inputs** — always use `<Input>`, `<TextArea>`, `<Toggle>`, `<Select>` from DS
- **No emojis as icons** — use Lucide SVG icons; Avatar accepts icon IDs (`'bot'`, `'rocket'`, etc.)
- **ReactFlow compat** — all DS inputs include `nodrag` class; textareas include `nowheel nodrag`

## Node Handle Pattern

Canvas nodes use **fixed-position React Flow `<Handle>`** components placed on the node border:
- **No JackGutter or JackPort** on nodes where content is tall (e.g., AgentNode)
- Handles are 8px colored dots at percentage positions (`top: '25%'`, `left: -4`)
- Colors match the edge/connection type (blue=knowledge, yellow=skills, green=MCP, purple=prompt, orange=workflow, red=memory)
- Smaller nodes (KnowledgeNode, McpNode, SkillsNode) may still use `JackGutter` if content is short

## Section Divider Pattern

Large nodes use `Section` dividers with:
- 3px colored bar indicator (unique per section)
- Bold uppercase label in Space Mono
- Optional right-aligned action button (Generate, toggle, etc.)
- Click to collapse/expand
- Subtle background tint on hover row

---

## Components

### Button

Interactive button with variants and loading state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | Visual style |
| `size` | `'sm' \| 'md'` | `'md'` | Height & font size |
| `icon` | `ReactNode` | — | Left icon |
| `iconRight` | `ReactNode` | — | Right icon |
| `loading` | `boolean` | `false` | Shows spinner, disables button |

```tsx
<Button variant="primary" icon={<Plus size={12} />}>Create</Button>
```

---

### Input

Single-line text input with label and error state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Uppercase label above input |
| `error` | `string` | — | Error message below input |

```tsx
<Input label="Name" placeholder="Enter name" error="Required" />
```

---

### TextArea

Multi-line input with optional character count.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Uppercase label |
| `error` | `string` | — | Error message |
| `showCount` | `boolean` | `false` | Show character counter |
| `maxChars` | `number` | — | Max chars (counter turns red when exceeded) |

```tsx
<TextArea label="Description" showCount maxChars={200} value={text} onChange={...} />
```

---

### Select

Dropdown select with portal-based options list.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `SelectOption[]` | — | `{ value, label, icon? }` |
| `value` | `string` | — | Selected value |
| `onChange` | `(value: string) => void` | — | Change handler |
| `label` | `string` | — | Uppercase label |
| `placeholder` | `string` | `'Select...'` | Placeholder text |
| `size` | `'sm' \| 'md'` | `'md'` | Trigger height |

```tsx
<Select label="Type" options={[{ value: 'a', label: 'Alpha' }]} value={val} onChange={setVal} />
```

---

### Toggle

On/off switch with optional label.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | — | Current state |
| `onChange` | `(checked: boolean) => void` | — | Change handler |
| `label` | `string` | — | Text label |
| `size` | `'sm' \| 'md'` | `'md'` | Switch dimensions |
| `disabled` | `boolean` | `false` | Disabled state |

```tsx
<Toggle checked={on} onChange={setOn} label="Enable feature" />
```

---

### Badge

Colored label for status/category.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'success' \| 'warning' \| 'error' \| 'info' \| 'neutral'` | `'neutral'` | Color scheme |
| `dot` | `boolean` | `false` | Show status dot before text |
| `size` | `'sm' \| 'md'` | `'sm'` | Font size & padding |

```tsx
<Badge variant="success" dot>Online</Badge>
```

---

### Tabs

Horizontal tab bar with active indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `Tab[]` | — | `{ id, label, icon?, count? }` |
| `active` | `string` | — | Active tab id |
| `onChange` | `(id: string) => void` | — | Tab change handler |
| `size` | `'sm' \| 'md'` | `'sm'` | Font size & padding |

```tsx
<Tabs tabs={[{ id: 'all', label: 'All', count: 5 }]} active="all" onChange={setTab} />
```

---

### Card

Container with optional header, footer, and elevation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `header` | `ReactNode` | — | Header slot (top, with border) |
| `footer` | `ReactNode` | — | Footer slot (bottom, with border) |
| `padding` | `boolean` | `true` | Add padding to body |
| `elevated` | `boolean` | `false` | Use elevated surface color |

```tsx
<Card header={<span>Settings</span>} elevated>Content here</Card>
```

---

### Modal

Portal-based overlay with escape-to-close and backdrop blur.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Visibility |
| `onClose` | `() => void` | — | Close handler |
| `title` | `string` | — | Header title with close button |
| `footer` | `ReactNode` | — | Footer slot (right-aligned) |
| `width` | `number` | `520` | Panel width in px |

```tsx
<Modal open={show} onClose={() => setShow(false)} title="Confirm" footer={<Button>OK</Button>}>
  Are you sure?
</Modal>
```

---

### IconButton

Icon-only button with hover state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | Icon element |
| `size` | `'sm' \| 'md'` | `'md'` | Dimensions (24/32px) |
| `variant` | `'ghost' \| 'secondary' \| 'danger'` | `'ghost'` | Color scheme |
| `tooltip` | `string` | — | Title/aria-label |
| `active` | `boolean` | `false` | Active/selected state (accent color) |

```tsx
<IconButton icon={<Settings size={14} />} tooltip="Settings" />
```

---

### Spinner

Animated loading indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Diameter (12/16/24px) |

```tsx
<Spinner size="sm" />
```

---

### Avatar

Circular avatar with image, SVG icon ID, or initials fallback.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Diameter (24/32/48px) |
| `src` | `string` | — | Image URL |
| `alt` | `string` | — | Alt text |
| `emoji` | `string` | — | SVG icon ID (e.g. `'bot'`, `'brain'`, `'rocket'`) or legacy emoji string |
| `initials` | `string` | — | 2-letter initials fallback |

Supported icon IDs: `bot`, `brain`, `zap`, `flame`, `lightbulb`, `target`, `rocket`, `shield`, `microscope`, `chart`, `palette`, `file`, `drama`, `star`, `gem`, `bird`, `bug`, `cat`, `dog`, `heart`

```tsx
<Avatar src="/avatar.jpg" size="lg" />
<Avatar emoji="bot" />
```

---

### Chip

Removable tag/chip.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'success' \| 'error' \| 'warning' \| 'info'` | `'default'` | Color scheme |
| `onRemove` | `() => void` | — | Shows × button when provided |

```tsx
<Chip variant="success" onRemove={() => remove(id)}>Active</Chip>
```

---

### Divider

Horizontal rule with optional centered label.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Centered label text |

```tsx
<Divider label="OR" />
```

---

### Progress

Horizontal progress bar.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | 0–100 percentage |
| `showLabel` | `boolean` | `false` | Show "Progress" label and percentage |

```tsx
<Progress value={65} showLabel />
```

---

### EmptyState

Centered placeholder for empty views.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | Large icon |
| `title` | `string` | — | Heading |
| `subtitle` | `string` | — | Description text |
| `action` | `ReactNode` | — | CTA button slot |

```tsx
<EmptyState icon={<Inbox size={32} />} title="No items" subtitle="Create one to get started" action={<Button>Add</Button>} />
```

---

### StatusDot

Small colored status indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'success' \| 'error' \| 'warning' \| 'info'` | — | Color |
| `pulsing` | `boolean` | `false` | Pulse animation |

```tsx
<StatusDot status="success" pulsing />
```

---

### Tooltip

Hover tooltip rendered via portal.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | — | Tooltip text |
| `position` | `'top' \| 'bottom'` | `'top'` | Placement |
| `delay` | `number` | `300` | Show delay in ms |

```tsx
<Tooltip content="Save changes"><IconButton icon={<Save size={14} />} /></Tooltip>
```
