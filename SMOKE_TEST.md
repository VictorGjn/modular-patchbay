# Smoke Test Checklist — Modular Studio

> Run before every version bump. Automate with chrome-devtools-mcp or Playwright.

## Strategy

### Manual (30 sec)
For quick checks during dev. Open browser, follow the checklist.

### Semi-automated with chrome-devtools-mcp
The `.mcp.json` config in this repo provides `chrome-devtools` MCP server.
Any coding agent (Claude Code, Codex, Copilot) can connect to it and run the checklist programmatically:
- Navigate, click, type, take screenshots
- Read console for errors (no 404s, no React crashes)
- Check network tab for failed requests
- Performance traces for obvious regressions

### Fully automated with Playwright (CI)
`tests/e2e/smoke.spec.ts` — runs in CI, headless, 100% reproducible.
See Phase 4 implementation below.

---

## Checklist

### 1. App Loads
- [ ] Open `http://localhost:5173` (or prod URL)
- [ ] No blank screen — main layout renders
- [ ] No console errors (React Error boundaries, uncaught exceptions)
- [ ] No 404 network requests

### 2. Sources Panel (Left)
- [ ] Brain dump textarea is visible and accepts input
- [ ] Type a description → click Generate → agent config appears in center panel
- [ ] Missing Sources section renders if gaps detected (red banner)
- [ ] Insights/Facts section renders if facts exist

### 3. Agent Configuration (Center)
- [ ] Identity section: name, description, tags editable
- [ ] Tags input: can type spaces and commas, commits on blur
- [ ] Persona: tone/expertise toggles respond to clicks
- [ ] Constraints: safety profile buttons work, custom rules addable
- [ ] Objectives: primary objective editable, success criteria addable
- [ ] System Prompt: auto-sync toggle works
- [ ] Context Budget: bar renders with token counts
- [ ] NO dead "Generate" buttons on Constraints or Objectives

### 4. Skills
- [ ] Skill Library button opens SkillPicker modal
- [ ] Skills show SecurityBadges (SEC/DEP/DOC) — no 404 in console
- [ ] Adding a skill → appears in SkillsSection with badges

### 5. Test Panel (Right)
- [ ] Panel expands on click
- [ ] Can type and send a message (requires provider API key)
- [ ] Response renders with markdown (bold, code blocks, lists)
- [ ] Conversation maintains context (follow-up references prior message)
- [ ] Pipeline stats visible after response

### 6. Settings
- [ ] Settings page opens without crash
- [ ] Providers tab: can add/edit API keys
- [ ] MCP tab: renders without infinite loop (React Error #185)

### 7. Export
- [ ] Export agent → file downloads (MD or ZIP)
- [ ] Import agent → config loads correctly

---

## Automation Priority

| Test | Effort | Value | Automate? |
|------|--------|-------|-----------|
| App loads, no console errors | Low | Critical | ✅ First |
| No 404 network requests | Low | Critical | ✅ First |
| Generate flow works | Medium | High | ✅ Yes |
| Chat flow works | Medium | High | ✅ Yes |
| Skills badges load | Low | Medium | ✅ Yes |
| Settings doesn't crash | Low | High | ✅ Yes |
| Export/Import | Medium | Medium | Later |

## Running with chrome-devtools-mcp

```bash
# Start the app
npm run dev &

# In your coding agent (Claude Code, Codex, etc.):
# The .mcp.json provides chrome-devtools MCP automatically
# Agent can: navigate, screenshot, check console, inspect network
```

## Running with Playwright

```bash
npx playwright test tests/e2e/smoke.spec.ts
```
