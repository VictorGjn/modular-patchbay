# V2 UI Polish — Execution Plan

## Current State
- Branch: feat/v2-wizard-ui (3 commits ahead of master)
- TypeScript: clean (0 errors)
- 7 tabs implemented, ds/ has 24 shared components
- Audit grade: C+ (69/100) — target: B+ (85+)

## Execution Order (dependency-aware)

### Wave 1: Foundation (must do first — everything depends on this)
**Task 1A: WizardLayout fixes (#22)**
- Sticky prev/next footer
- Tab bar horizontal scroll with fade on < 1024px
- Unify tab nav with Topbar
- Arrow key navigation between tabs
- Code split: React.lazy for Test + Qualification tabs

### Wave 2: Tab polish (parallel — no cross-dependencies)
**Task 2A: DescribeTab (#23)**
- Template cards → radio button group with aria
- Character count on textarea
- Validation (>= 20 chars to proceed)
- Auto-save on blur

**Task 2B: KnowledgeTab (#24)**
- Two-column layout (60/40)
- Type pills → 44px min with aria-pressed
- Status indicators: icon + text, not just color
- Fact Insights + Knowledge Gaps sections

**Task 2C: ToolsTab (#25)**
- Two-column layout (50/50)
- StatusDot with text labels
- Empty/error/loading states

**Task 2D: MemoryTab (#26)**
- Two-column layout (50/50)
- Strategy selector with inline descriptions
- Seed facts CRUD
- Budget bar with text alternative

**Task 2E: ReviewTab (#27)**
- Two-column layout (60/40)
- Copy button on system prompt
- Export dropdown (JSON/YAML/MD/Claude/OpenAI)
- Chip-based constraint input

### Wave 3: Complex (depends on Wave 1)
**Task 3A: TestTab (#28)**
- 3-panel IDE layout (trace | conversation | context inspector)
- Resizable panels
- Trace event filtering
- State persistence across tab switches

## Quality Gates (per task)
1. `npx tsc --noEmit` — zero errors
2. No inline styles > 3 properties
3. No `as` casts
4. All interactive elements keyboard-accessible
5. Status indicators have text + icon, not just color
