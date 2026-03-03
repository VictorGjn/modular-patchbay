# Runtime UX Proposal — Dedicated Runtime Workspace

## Goal
Replace the old "test tab" mental model with a dedicated Runtime page focused on orchestration:
- global instruction
- per-agent instruction
- run status
- shared facts

Constraints respected:
- **No cable UI / no ReactFlow reintroduction**
- Keep existing agent visual cards (**radar / chip / layercake** metaphors via Card/Circuit/Layers views)
- Keep runtime interaction simple and linear

---

## UX Structure (wireframe-level)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: logo | Builder / Runtime switch | model | output | actions         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Runtime Workspace                                                          │
│                                                                             │
│ ┌──────────────────────────────┬───────────────────────────────────────────┐ │
│ │ Team Snapshot                │ Runtime Orchestration                    │ │
│ │ (left rail, sticky context)  │ (main panel)                             │ │
│ │                              │                                           │ │
│ │ - AgentViz mode switch       │ 1) Feature Spec                           │ │
│ │   [Card|Circuit|Layers]      │ 2) Global Instruction                     │ │
│ │ - Current agent profile      │ 3) Per-agent Instructions                 │ │
│ │ - Persistent visual identity │ 4) Agent Repositories                     │ │
│ │                              │ 5) Actions: Extract Contracts / Run Team  │ │
│ │                              │ 6) Run feedback:                          │ │
│ │                              │    - Contract Facts                       │ │
│ │                              │    - Agent Execution Status Cards         │ │
│ │                              │    - Shared Facts                         │ │
│ └──────────────────────────────┴───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why this solves the problem
- Runtime is no longer hidden as a tab inside a testing panel.
- The orchestration path is explicit and sequential.
- Users keep visual grounding with agent cards while running the team.
- No graph/cable interaction required.

---

## Concrete Implementation Plan

### 1) Navigation model
- Add top-level workspace switch in Topbar:
  - `Builder`
  - `Runtime`
- Keep default landing on `Builder`.

### 2) Dedicated runtime layout
- Add `RuntimeWorkspaceLayout` with split view:
  - Left: `AgentViz` (Card/Circuit/Layers)
  - Right: existing `RuntimePanel`
- Keep runtime logic in `RuntimePanel` (no behavioral rewrite).

### 3) Remove old runtime tab mental model
- In `TestPanel`, remove `Runtime` tab and panel content.
- Keep `Chat / Traces / Export` for local testing/export only.

### 4) App composition updates
- In `App.tsx`, switch rendered layout by workspace mode:
  - builder → `DashboardLayout`
  - runtime → `RuntimeWorkspaceLayout`
- Remove always-mounted `ConversationTester` instance from root to avoid mixed mental models.

---

## Files changed in low-risk patch

1. `src/layouts/RuntimeWorkspaceLayout.tsx` (new)
   - New dedicated runtime workspace layout.

2. `src/components/Topbar.tsx`
   - Added Builder/Runtime switch props and UI buttons.

3. `src/App.tsx`
   - Added `workspaceMode` state.
   - Topbar now controls workspace mode.
   - Conditional layout rendering.
   - Removed root-level `ConversationTester` mount.

4. `src/panels/TestPanel.tsx`
   - Removed embedded Runtime tab/panel.
   - Kept only chat/traces/export tabs.

---

## Optional follow-ups (not in current patch)
- Persist workspace mode to localStorage.
- Add a compact “last run summary” strip in Topbar when in Runtime mode.
- Add empty-state coaching for first-time runtime users (1-2 sentence checklist).
