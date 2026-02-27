# Modular App — E2E Audit Report

**Date:** 2026-02-27  
**Branch:** `feat/ux-audit`  
**App:** React + TypeScript + @xyflow/react visual AI agent builder  
**Test runner:** Playwright (Chromium)

---

## Test Results Summary

| # | Test | Result | Duration |
|---|------|--------|----------|
| 1 | App loads, canvas renders | ✅ PASS | 7.4s |
| 2 | All initial node types render (knowledge, skills, mcp, prompt, output, response) | ✅ PASS | 2.1s |
| 3 | Drag node on canvas | ✅ PASS | 2.8s |
| 4 | Connect two nodes via ports | ✅ PASS | 2.2s |
| 5 | Edge deletion (select + Backspace) | ✅ PASS | 2.5s |
| 6 | Theme toggle (dark ↔ light) | ✅ PASS | 3.5s |
| 7 | Marketplace opens, search works, tabs switch, Escape closes | ✅ PASS | 4.2s |
| 8 | Preset load from topbar dropdown | ✅ PASS | 2.5s |
| 9 | Accessibility audit (aria-labels, keyboard nav) | ✅ PASS | 2.2s |

**9/9 tests passed** in 33.1s total.

### Notable observations from tests:
- **Edge deletion works**: Backspace on a selected edge reduced count from 7 → 6.
- **6 node types** all render on initial load: `knowledge`, `skills`, `mcp`, `prompt`, `output`, `response`.
- **11 presets** available: Senior PM, Competitive Intel, Company Intel, Feedback Manager, Odfjell Deep Dive, Voyage Prep Dev, Event Prep, Maritime Intel, Discovery, All Knowledge.
- **4 select elements** in topbar (model, preset, output format, + 1 more). **None have associated `<label>` elements or `aria-label`**.
- **6 topbar buttons** have `aria-label` attributes ✅.
- **0 images** missing `alt` text ✅.

---

## UI Bugs Found

### Critical

| # | Bug | Screenshot |
|---|-----|-----------|
| B1 | **Marketplace modal z-index bleed-through** — Canvas nodes and connection wires are visible through the modal's dimmed overlay. The backdrop opacity (~60%) is insufficient and elements render on top of the overlay. | `09-marketplace-open.png` |
| B2 | **Status badges unreadable** — Red/orange badges next to Knowledge and Destination items (Product Wiki, CRM Contacts, #reports) are too small (<8px) with text content indecipherable. | `01-app-loaded.png` |

### High

| # | Bug | Screenshot |
|---|-----|-----------|
| B3 | **"Load Preset" button text truncated** — In Marketplace Presets tab, every button reads "Load Prese…" instead of "Load Preset". Container too narrow. | `12-marketplace-presets.png` |
| B4 | **Marketplace item descriptions truncated without affordance** — Right-column descriptions cut off with "…" but no tooltip or expand mechanism. | `09-marketplace-open.png` |
| B5 | **Red squiggly underlines on skill names** — Browser spellcheck artifacts on all marketplace skill names. Missing `spellcheck="false"` on text elements. | `09-marketplace-open.png` |
| B6 | **Light theme contrast regression** — Topbar dropdowns and canvas connection lines (especially yellow) lose significant contrast in light mode. | `07-theme-light.png` |

### Medium

| # | Bug | Screenshot |
|---|-----|-----------|
| B7 | **Connection line visual clutter** — Multiple colored lines (orange, yellow, green, dashed, solid) converge on the PROMPT node with no routing to prevent overlap. Hard to trace connections. | `01-app-loaded.png` |
| B8 | **"TEST RUN" vs "RUN" confusion** — Both a "TEST RUN" button (center) and "RUN Ctrl+Enter" (topbar) exist with unclear distinction. | `01-app-loaded.png` |
| B9 | **Token budget truncated** — Shows "49.8K / 200…" with full budget limit cut off at bottom-right. | `13-preset-loaded.png` |
| B10 | **Output panel overlap** — The OUTPUT dropdown partially occludes the canvas when expanded. | `13-preset-loaded.png` |
| B11 | **Panel layout inconsistency** — Knowledge uses list+checkboxes, Skills uses card grid, MCP uses card grid. Mixed paradigms increase cognitive load. | `01-app-loaded.png` |
| B12 | **Marketplace tab labels run together** — "SKILLS MCP SERVERS PRESETS" appears as near-continuous text without clear visual separation. | `12-marketplace-presets.png` |

### Low

| # | Bug | Screenshot |
|---|-----|-----------|
| B13 | **"0c ~0 tokens" notation** — Cryptic token counter in empty prompt area. No tooltip or explanation of "0c". | `01-app-loaded.png` |
| B14 | **Zoom controls barely visible** — Bottom-left +/- buttons are minimally styled and easy to miss. | `01-app-loaded.png` |
| B15 | **Large empty space in Presets tab** — 6 presets fill only half the panel, leaving dead space. | `12-marketplace-presets.png` |

---

## Accessibility Issues

| # | Issue | Severity | WCAG |
|---|-------|----------|------|
| A1 | **Select elements missing labels** — 4 `<select>` elements in topbar have no `<label>`, `aria-label`, or `aria-labelledby`. Screen readers can't identify them. | High | 1.3.1 |
| A2 | **Color-only connection differentiation** — Connection types (output, feedback, MCP) differentiated solely by color. Users with color vision deficiency cannot distinguish them. Dashed/solid patterns are inconsistent. | High | 1.4.1 |
| A3 | **No visible focus indicators** — After tabbing through elements, no focus ring or outline is visible on interactive controls. | High | 2.4.7 |
| A4 | **Small interactive targets** — Connection port handles (~8-10px diameter) are well below the 44×44px WCAG target size recommendation. | Medium | 2.5.8 |
| A5 | **All-caps text overuse** — Labels like "AWAITING SIGNAL", "MODULAR", "KNOWLEDGE", section headers all use `text-transform: uppercase` or hard-coded caps. Reduces readability for dyslexic users. | Low | 1.4.8 |
| A6 | **Marketplace modal focus trap** — Not verified if focus is properly trapped inside modal when open, or if it returns to trigger on close. | Medium | 2.4.3 |
| A7 | **Text below minimum size** — Multiple labels at 8-10px font size (skill "USED BY" labels, badge text, connection labels on canvas). WCAG recommends minimum 12px. | Medium | 1.4.4 |

---

## Performance Observations

- **Initial load**: App loaded and canvas rendered in ~7.4s on first test (cold start). Subsequent navigations ~2s.
- **No perceptible jank**: Node dragging, theme toggling, and marketplace opening all felt smooth (<500ms response).
- **7 initial edges + 6 nodes**: For this small graph, performance is fine. No stress testing performed with 50+ nodes.
- **Dev server**: Vite HMR responsive. Build time not tested.
- **Bundle size concern**: `lucide-react` imports individual icons (good tree-shaking pattern). `zustand` is lightweight. Main concern would be `@xyflow/react` bundle size for production.

---

## Screenshots Reference

| File | Description |
|------|-------------|
| `01-app-loaded.png` | Initial app load, dark theme, all 6 nodes visible |
| `02-all-nodes.png` | All node types confirmed rendered |
| `03-node-dragged.png` | Prompt node after drag operation |
| `04-connect-nodes.png` | After connection attempt between nodes |
| `05-edge-deleted.png` | After edge deletion via Backspace |
| `06-theme-dark.png` | Dark theme baseline |
| `07-theme-light.png` | Light theme after toggle |
| `08-theme-dark-again.png` | Dark theme restored |
| `09-marketplace-open.png` | Marketplace modal — Skills tab |
| `10-marketplace-search.png` | Marketplace with "web" search filter |
| `11-marketplace-mcp.png` | Marketplace — MCP Servers tab |
| `12-marketplace-presets.png` | Marketplace — Presets tab |
| `13-preset-loaded.png` | After loading "Senior PM" preset |
| `14-keyboard-nav.png` | After 3x Tab key presses |

---

## Recommendations (Priority Order)

1. **Fix marketplace modal overlay** — Increase backdrop opacity to 80%+ or use `isolation: isolate` on modal container
2. **Add `aria-label` to all `<select>` elements** in Topbar
3. **Add visible focus indicators** (`outline` or `box-shadow`) on all interactive elements
4. **Add `spellcheck="false"` to marketplace item name elements**
5. **Use line patterns (dashed, dotted, double) in addition to color** for connection type differentiation
6. **Increase minimum font size to 11-12px** for all functional text
7. **Fix "Load Preset" button width** — ensure text doesn't truncate
8. **Add tooltips to truncated marketplace descriptions**
9. **Clarify TEST RUN vs RUN** — either merge or clearly label the difference
10. **Audit light theme** for contrast ratios (several elements fall below 4.5:1)
