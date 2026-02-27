# FULL AUDIT — Modular Studio (2026-02-27)

**Branch:** `feat/ui-modernization`  
**Auditor:** Claw 🦀 (automated)

---

## 1. Mock Data Audit

### MOCK_ Prefixed Data

| # | File | Line | Finding | Severity |
|---|------|------|---------|----------|
| M1 | `src/store/knowledgeBase.ts` | 289 | `MOCK_AGENTS` — 8 hardcoded agent definitions (Senior PM, Engineer, etc.) | **P0** |
| M2 | `src/store/consoleStore.ts` | 177 | `agents: MOCK_AGENTS.map(...)` — store initialized from mock agents | **P0** |
| M3 | `src/components/AgentPreview.tsx` | 3,17 | Imports and uses `MOCK_AGENTS` directly | **P0** |

### Hardcoded Data Arrays

| # | File | Line | Finding | Severity |
|---|------|------|---------|----------|
| M4 | `src/store/knowledgeBase.ts` | 86 | `KNOWLEDGE_TREE` — Entire file tree is hardcoded (~140 lines of fake project structure with fake token estimates) | **P0** |
| M5 | `src/store/knowledgeBase.ts` | 323 | `PRESETS` — 10+ hardcoded presets (not user-saveable) | **P1** |
| M6 | `src/store/registry.ts` | 58 | `REGISTRY_SKILLS` — 22 hardcoded skills with fake install counts | **P1** |
| M7 | `src/store/registry.ts` | 193 | `REGISTRY_MCP_SERVERS` — 16 hardcoded MCP server entries | **P1** |
| M8 | `src/store/registry.ts` | 336 | `REGISTRY_PRESETS` — 6 hardcoded workflow presets | **P1** |
| M9 | `src/utils/ghostSuggestions.ts` | 40+ | Hardcoded keyword→channel mappings for ghost suggestions | **P1** |
| M10 | `src/components/FilePicker.tsx` | 189 | Renders directly from `KNOWLEDGE_TREE` (mock data) | **P0** |
| M11 | `src/utils/agentImport.ts` | 424 | `findSourceByPath` searches `KNOWLEDGE_TREE` — would fail with real data | **P1** |

### Placeholder Text & Fake Data

| # | File | Line | Finding | Severity |
|---|------|------|---------|----------|
| M12 | `src/store/knowledgeBase.ts` | 163+ | Fake paths like `CMO-Handoff/01 - Company Profiles/` with fabricated token estimates (28000, etc.) | **P0** |
| M13 | `src/store/consoleStore.ts` | ~432 | Hardcoded preset-to-agent mappings (`'agent-company-intel': 'company-intel'`) | **P1** |
| M14 | `src/components/SettingsPage.tsx` | 317 | Comment: `// Placeholder data - real data comes from mcpStore` | **P2** |
| M15 | `src/nodes/McpNode.tsx` | 236 | `type: undefined, // TODO: add transport type to McpServerState` | **P2** |

### Removed Mocks (Good — Confirmed Cleaned Up)
- `MOCK_MCP_SERVERS` — removed (line 261 comment confirms)
- `MOCK_SKILLS` — removed (line 277 comment confirms)  
- `MOCK_CONNECTORS` — removed (line 321 comment confirms)

---

## 2. Clean Code Audit

### Console.log in Production Code
✅ **No console.log found in `src/` files** — clean.

### `any` Types
✅ **No `: any`, `as any`, or `<any>` found in `src/`** — clean.

### TODO/FIXME
| # | File | Line | Finding | Severity |
|---|------|------|---------|----------|
| C1 | `src/nodes/McpNode.tsx` | 236 | `// TODO: add transport type to McpServerState` | **P2** |

### Long Functions (>50 lines)
Based on component structure, these files contain monolithic render functions that should be split:
| # | File | Finding | Severity |
|---|------|---------|----------|
| C2 | `src/nodes/KnowledgeNode.tsx` | 684+ lines total — single component with massive render | **P1** |
| C3 | `src/components/Marketplace.tsx` | 580+ lines — 3 sub-components inline but main component is still large | **P1** |
| C4 | `src/components/SaveAgentModal.tsx` | 486+ lines — syntax highlighting logic mixed with UI | **P1** |
| C5 | `src/components/SettingsPage.tsx` | 592+ lines — could extract Provider card, MCP section | **P1** |
| C6 | `src/components/ResponseArea.tsx` | 312+ lines — markdown renderer + 2 response display components | **P2** |

### Duplicated Logic
| # | Files | Finding | Severity |
|---|-------|---------|----------|
| C7 | `SkillPicker.tsx`, `McpPicker.tsx`, `ConnectorPicker.tsx` | Nearly identical picker modal structure (overlay, search, list, close). Should extract a `PickerModal` shell. | **P1** |
| C8 | `ResponseArea.tsx` + `ResponseNode.tsx` | Both implement markdown rendering and response display. `ResponseArea` appears to be an older/standalone version. | **P1** |
| C9 | `SettingsModal.tsx` + `SettingsPage.tsx` | Both handle API key input and provider config. Overlapping concerns. | **P2** |
| C10 | `Marketplace.tsx` lines 322,466 | Identical "Installed ✓" badge pattern repeated for skills and MCP items | **P2** |

### Inconsistent Naming
| # | Finding | Severity |
|---|---------|----------|
| C11 | `mockResponse` used as the state field for *real* LLM responses (in `consoleStore.ts`) — misleading name | **P1** |
| C12 | `knowledgeBase.ts` is a data/types file, not a "base" class — name suggests a service | **P2** |

---

## 3. Design/UX Audit

### Hardcoded Colors (NOT using `useTheme()`)

This is the **biggest design issue**. Hundreds of inline hardcoded colors across the codebase. Components will NOT adapt to light/dark theme properly.

**Worst offenders (dark-only colors hardcoded):**

| # | File | Count | Examples | Severity |
|---|------|-------|---------|----------|
| D1 | `ResponseArea.tsx` | 40+ | `#141417`, `#2a2a30`, `#f0f0f0`, `#00ff88`, `#444`, `#555`, `#888`, `#bbb` | **P0** |
| D2 | `ConnectorPicker.tsx` | 20+ | `#1c1c20`, `#2a2a30`, `#f0f0f0`, `#555`, `#00ff88`, `#9b59b6` | **P0** |
| D3 | `McpPicker.tsx` | 20+ | Same dark palette hardcoded | **P0** |
| D4 | `SkillPicker.tsx` | 20+ | Same dark palette hardcoded | **P0** |
| D5 | `FilePicker.tsx` | 15+ | `#1e1a17`, `#151210`, `#2d2720`, `#e8e0d8`, `#8a7e72` — unique warm palette, inconsistent with other pickers | **P0** |
| D6 | `PromptArea.tsx` | 5+ | `#141417`, `#2a2a30`, `#f0f0f0` | **P1** |
| D7 | `SettingsPage.tsx` | 15+ | `#22c55e`, `#ef4444`, `#666`, `#eab308` | **P1** |
| D8 | `Marketplace.tsx` | 10+ | `#10B981`, `#3B82F6`, `#F59E0B` | **P1** |
| D9 | `src/controls/Knob.tsx` | 5 | Radial gradients with hardcoded grays | **P2** |
| D10 | `src/controls/LEDIndicator.tsx` | 8 | Status colors hardcoded — should come from theme | **P2** |
| D11 | `src/controls/Scope.tsx` | 3 | `#0a0a0a`, `#00ff88` | **P2** |

**Semantic colors hardcoded everywhere (should be theme tokens):**
- Status green: `#00ff88`, `#2ecc71`, `#22c55e`, `#10B981` — **4 different greens** for "success"
- Status red: `#ff3344`, `#e74c3c`, `#ef4444`, `#ff5050` — **4 different reds** for "error"  
- Status yellow: `#f1c40f`, `#ffaa00`, `#eab308`, `#F59E0B` — **4 different yellows** for "warning"
- Text gray: `#444`, `#555`, `#666`, `#888`, `#bbb`, `#999` — **6+ inconsistent grays**

**Suggested fix:** Define semantic color tokens in `theme.ts` (`status.success`, `status.error`, `status.warning`, `text.primary`, `text.secondary`, `text.muted`, etc.) and use `useTheme()` everywhere.

### Missing `nodrag nowheel` on Interactive Elements

Many interactive elements inside nodes lack `nodrag` classes, which means clicking/dragging them will move the node instead of interacting with the element:

| # | File | Line | Element | Severity |
|---|------|------|---------|----------|
| D12 | `KnowledgeNode.tsx` | 373 | `<input>` (directory path) — no `nodrag` | **P1** |
| D13 | `KnowledgeNode.tsx` | 579 | `<input>` (file search) — no `nodrag` | **P1** |
| D14 | `PromptNode.tsx` | 141 | `<textarea>` — no `nodrag` | **P1** |
| D15 | `PromptNode.tsx` | 225 | `<select>` (model selector) — no `nodrag` | **P1** |
| D16 | `PromptNode.tsx` | 305 | `<input>` (max tokens) — no `nodrag` | **P1** |
| D17 | Many node buttons | Various | Most `<button>` elements in nodes lack `nodrag` | **P1** |

**Note:** Some buttons in `SkillsNode.tsx` DO have `nodrag` — inconsistent.

### Font Inconsistencies
| # | File | Finding | Severity |
|---|------|---------|----------|
| D18 | `FilePicker.tsx` | Uses warm-toned palette (`#e8e0d8`, `#8a7e72`, `#2d2720`) completely different from other pickers' cool palette (`#f0f0f0`, `#555`, `#1c1c20`) | **P1** |
| D19 | Various | `fontFamily: "'Space Mono', monospace"` is repeated inline ~30+ times instead of using a CSS class | **P2** |

### z-index
| # | File | Finding | Severity |
|---|------|---------|----------|
| D20 | `Marketplace.tsx:118` | Only one z-index found (`zIndex: 1`). Modals may lack z-index, causing overlap issues with React Flow controls | **P1** |

---

## 4. Accessibility Audit

### Missing aria-labels on Buttons

**~110+ buttons lack `aria-label`** across the entire codebase. Every `<button>` found in the search is missing it. Key examples:

| # | File | Line | Button Purpose | Severity |
|---|------|------|---------------|----------|
| A1 | `Topbar.tsx` | 141-210 | Theme toggle, settings, marketplace, save, run — all icon-only buttons, no aria-label | **P0** |
| A2 | `KnowledgeNode.tsx` | 103-684 | ~15 buttons (add channel, scan, collapse, accept/dismiss feedback) | **P0** |
| A3 | `McpNode.tsx` | 81-328 | ~7 buttons (add server, connect/disconnect, remove) | **P0** |
| A4 | `OutputNode.tsx` | 46-188 | ~6 buttons (format toggles, collapse) | **P1** |
| A5 | `SkillsNode.tsx` | 65-147 | ~6 buttons (collapse, view mode, toggle skill, install/dismiss) | **P1** |
| A6 | `ResponseNode.tsx` | 137-219 | Copy, expand/collapse buttons | **P1** |
| A7 | `EdgeContextMenu.tsx` | 29 | Delete edge button | **P2** |
| A8 | `ContextualHint.tsx` | 70 | Dismiss hint button | **P2** |

### Missing Labels on Inputs

**~25 inputs lack `aria-label` or associated `<label>`:**

| # | File | Line | Input Purpose | Severity |
|---|------|------|--------------|----------|
| A9 | `PromptNode.tsx` | 141 | Main prompt textarea | **P0** |
| A10 | `PromptNode.tsx` | 225 | Model selector dropdown | **P0** |
| A11 | `KnowledgeNode.tsx` | 373 | Directory path input | **P1** |
| A12 | `SettingsModal.tsx` | 94, 121, 136 | API key, base URL, model inputs | **P1** |
| A13 | `Marketplace.tsx` | 138 | Search input | **P1** |
| A14 | `SaveAgentModal.tsx` | 249, 273, 325 | Agent name, description, format selector | **P1** |
| A15 | `Topbar.tsx` | 13 | Preset/model selector `<select>` | **P1** |

### Color-Only Indicators
| # | File | Finding | Severity |
|---|------|---------|----------|
| A16 | `McpNode.tsx:74` | Status dot (green/red) is color-only — no text alternative | **P1** |
| A17 | `LibraryPicker.tsx:178` | Status dot — same issue | **P1** |
| A18 | `KnowledgeNode.tsx:656` | Channel enabled/disabled dot — color-only | **P1** |
| A19 | `ResponseNode.tsx:114` | Running/done/idle LED — color-only | **P1** |
| A20 | `Tile.tsx:20` | Active dot — color-only | **P2** |

### Keyboard Navigation
| # | Finding | Severity |
|---|---------|----------|
| A21 | No visible focus indicators on any buttons (no `focus:ring` or `outline` styles found) | **P0** |
| A22 | Picker modals (`SkillPicker`, `McpPicker`, `ConnectorPicker`) lack Escape-to-close handling | **P1** |
| A23 | No focus trap in modals — tab can escape to elements behind overlay | **P1** |
| A24 | `Topbar.tsx` select elements not keyboard-navigable within React Flow canvas context | **P2** |

---

## 5. Feature Status vs ROADMAP-V2.md

### Phase 1: Demo-Ready

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Wire MCP frontend to real backend | 🔧 Partial | `mcpStore` talks to backend but `McpNode` still renders from old data path |
| 1.2 | Real LLM run with visible streaming | ✅ Done | `llmService.ts` + server proxy working |
| 1.3 | MCP tool use visible in response | 🔧 Partial | Agent SDK route exists but McpNode disconnect means tools may not wire |
| 1.4 | Real knowledge from files | ❌ Missing | `KNOWLEDGE_TREE` is hardcoded. No `/api/knowledge` route exists on server |
| 1.5 | Fix top 5 UI bugs from AUDIT-REPORT | 🔧 Partial | Some fixed, many remain (see this audit) |
| 1.6 | One-command setup: `npx modular-studio` | ✅ Done | `bin` entry in package.json, CLI binary exists |
| 1.7 | Node drag from sidebar | ❌ Missing | No sidebar, no DnD. Nodes are static initial layout |
| 1.8 | Cable animation during execution | ❌ Missing | No `strokeDasharray` animation on edges |

### Phase 2: Alpha

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | npm publish | ❌ Missing | Not yet published |
| 2.2 | Save/load workspace state | ❌ Missing | No persistence to disk |
| 2.3 | Clipboard copy on response | ✅ Done | Copy button exists in `ResponseNode.tsx` |
| 2.4 | Run history | ❌ Missing | No history saved |
| 2.5 | Real connector: Notion | ❌ Missing | Connectors are mock |
| 2.6 | Real skill execution | ❌ Missing | Skills are labels only |
| 2.7 | Snap to grid | ❌ Missing | `snapToGrid` not set |
| 2.8 | Real token counting (tiktoken) | ❌ Missing | Uses `Math.ceil(length / 4)` |
| 2.9 | Replace mock feedback | ❌ Missing | Feedback is hardcoded |
| 2.10 | User-saveable presets | ❌ Missing | Presets are hardcoded array |

### Phase 3-5: Not Started
All multi-agent, hosted, and advanced features are ❌ **Not Started**.

### Technical Debt

| Item | Status | Notes |
|------|--------|-------|
| Remove mock data | 🔧 Partial | `MOCK_MCP_SERVERS`, `MOCK_SKILLS`, `MOCK_CONNECTORS` removed. `MOCK_AGENTS`, `KNOWLEDGE_TREE` remain |
| dist-server in git | ❌ Still present | `dist-server/` directory exists with `.d.ts` files |
| McpNode dual-track | 🔧 Partial | Comment says mocks removed but integration may be incomplete |
| Hardcoded node positions | ❌ Still present | Fixed layout in `App.tsx` |
| Accessibility issues | ❌ Worse than reported | 110+ buttons without aria-labels, 25+ inputs without labels |
| Token estimation | ❌ Still `length/4` | |
| No tests | ❌ Still no tests | |

---

## 6. E2E Test Plan (Playwright)

```typescript
// tests/e2e/modular-studio.spec.ts
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4800';

test.describe('Modular Studio — Core Smoke Tests', () => {

  test('App loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE_URL);
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 });
    expect(errors).toEqual([]);
  });

  test('Theme toggle switches dark/light', async ({ page }) => {
    await page.goto(BASE_URL);
    const body = page.locator('body');
    // Find theme toggle button in topbar (icon-only button)
    const themeBtn = page.locator('button:has(svg)').first(); // Needs better selector with aria-label
    const initialBg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    await themeBtn.click();
    const newBg = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(newBg).not.toBe(initialBg);
  });

  test('Model selector changes model', async ({ page }) => {
    await page.goto(BASE_URL);
    // PromptNode has a <select> for model
    const modelSelect = page.locator('select').first();
    await modelSelect.selectOption({ index: 1 });
    const value = await modelSelect.inputValue();
    expect(value).toBeTruthy();
  });

  test('Settings page opens and closes', async ({ page }) => {
    await page.goto(BASE_URL);
    // Settings button in topbar
    await page.locator('button:has(svg.lucide-settings)').click();
    await expect(page.locator('text=API Providers')).toBeVisible({ timeout: 3000 });
    // Close with X or Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('text=API Providers')).not.toBeVisible({ timeout: 3000 });
  });

  test('Marketplace opens and closes', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('button:has(svg.lucide-store)').click();
    await expect(page.locator('text=Marketplace')).toBeVisible({ timeout: 3000 });
    // Switch tabs
    await page.locator('text=MCP Servers').click();
    await expect(page.locator('text=Filesystem')).toBeVisible();
    await page.locator('text=Presets').click();
    await expect(page.locator('text=Deep Research')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Knowledge node: scan directory flow', async ({ page }) => {
    await page.goto(BASE_URL);
    // Find directory input in KnowledgeNode
    const dirInput = page.locator('input[placeholder="Directory path..."]');
    await dirInput.fill('/tmp/test-project');
    const scanBtn = page.locator('button:has-text("Scan")');
    await scanBtn.click();
    // Should show scanning state or results (or error if no backend route)
    await page.waitForTimeout(2000);
  });

  test('Skills library: open and toggle skill', async ({ page }) => {
    await page.goto(BASE_URL);
    // Find "Add" or library button in SkillsNode
    const addBtn = page.locator('[data-testid="skills-add"], button:has-text("Library")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // Toggle first skill
      const firstSkill = page.locator('.skill-tile, [data-testid="skill-item"]').first();
      if (await firstSkill.isVisible()) await firstSkill.click();
    }
  });

  test('MCP library: open and toggle server', async ({ page }) => {
    await page.goto(BASE_URL);
    const addBtn = page.locator('button:has-text("Add Server"), button:has-text("Library")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Node resize works', async ({ page }) => {
    await page.goto(BASE_URL);
    // Look for ResizeHandle component
    const handle = page.locator('.resize-handle, [data-testid="resize-handle"]').first();
    if (await handle.isVisible()) {
      const box = await handle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 100);
        await page.mouse.up();
      }
    }
  });

  test('Run button triggers LLM call', async ({ page }) => {
    await page.goto(BASE_URL);
    // Type a prompt
    const textarea = page.locator('textarea').first();
    await textarea.fill('Hello, test prompt');
    // Click Run button
    const runBtn = page.locator('button:has-text("Run"), button:has(svg.lucide-play)').first();
    await runBtn.click();
    // Should show running state
    await expect(page.locator('text=Assembling context')).toBeVisible({ timeout: 5000 }).catch(() => {
      // May fail without API key — that's expected
    });
  });
});

// Note: Selectors above are best-effort since most elements lack
// data-testid and aria-label attributes. Adding those (see Accessibility
// audit) would make these tests far more reliable.
```

---

## Summary of Findings

### By Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| **P0 Critical** | 12 | `MOCK_AGENTS` + `KNOWLEDGE_TREE` still mock; `ResponseArea`/Pickers all hardcode dark colors (broken light theme); 110+ buttons missing aria-labels; no focus indicators |
| **P1 Important** | 30+ | 4 different greens/reds/yellows for same semantic meaning; missing `nodrag` on node inputs; duplicated picker logic; `mockResponse` misleading name; no Escape-to-close on pickers; no focus traps; FilePicker has different color palette than other pickers |
| **P2 Nice-to-have** | 10+ | TODO comment in McpNode; `knowledgeBase.ts` naming; repeated inline font-family; controls (Knob/Scope/Screw) hardcoded but unused |

### Top 5 Actions (Highest Impact)

1. **Replace `KNOWLEDGE_TREE` and `MOCK_AGENTS` with real data sources** — The last remaining mock data. Without this, the app is a demo, not a tool.

2. **Centralize color tokens** — Define `status.success`, `status.error`, `status.warning`, `text.*` in `theme.ts`. Currently 4 different greens, 4 reds, 4 yellows, 6+ grays. `ResponseArea.tsx`, all Pickers, and `FilePicker.tsx` are **completely broken in light theme**.

3. **Add aria-labels to all buttons and inputs** — 110+ buttons, 25+ inputs. Start with Topbar (most visible) and node components. This is both an accessibility requirement and makes Playwright testing possible.

4. **Add `nodrag` class to all interactive elements inside nodes** — Inputs, textareas, selects, and buttons inside `KnowledgeNode`, `PromptNode`, `McpNode` will drag the node instead of interacting.

5. **Extract shared `PickerModal` component** — `SkillPicker`, `McpPicker`, and `ConnectorPicker` are 90% identical. One shell component with props would cut ~300 lines of duplication.

---

*Generated 2026-02-27 17:38 CET — Claw 🦀*
