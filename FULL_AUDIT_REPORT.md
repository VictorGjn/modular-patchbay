# Modular Studio — Full Audit Report

**Date:** 2026-03-23
**Version:** 1.0.6
**Auditors:** 5 specialist agents (Frontend, Backend, UX, Product, Infra)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Frontend Audit](#frontend-audit)
3. [Backend Audit](#backend-audit)
4. [UX Audit](#ux-audit)
5. [Product Audit](#product-audit)
6. [Infrastructure Audit](#infrastructure-audit)
7. [Cross-Cutting Conflicts & Resolutions](#cross-cutting-conflicts--resolutions)
8. [Prioritized Action Plan](#prioritized-action-plan)

---

## Executive Summary

Modular Studio is a mature, well-engineered AI agent builder with a defensible niche: **context engineering for knowledge-heavy agents**. The codebase is 23,070 lines of TypeScript, has 916 passing unit tests, and features a sophisticated retrieval pipeline (semantic caching, contrastive retrieval, cache-aware assembly) that competitors haven't matched.

**The product is conditionally release-ready.** Several P0 issues (plaintext credential storage, silent data loss, security misconfigurations) must be fixed before any public exposure. Once those are addressed, a controlled beta to technical audiences (data engineers, research engineers) is appropriate.

### Health Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Frontend Architecture | 7/10 | Good structure, god components need splitting |
| Backend Security | 5/10 | Strong MCP safety, critical credential gap |
| UX Quality | 6/10 | Solid flows, several data-loss vectors |
| Product Completeness | 7/10 | Deep feature set, thin template gallery |
| Infrastructure | 6/10 | Good CI foundation, missing security gates |
| **Overall** | **6.2/10** | **Conditional go — fix P0s first** |

---

## Frontend Audit

### ✅ Strengths

- **Smart code splitting**: 6 manual chunks (vendor, markdown, icons, stores, mermaid, services) + lazy-loaded tabs with Suspense
- **214 memoization instances** across components — good performance discipline
- **60+ theme tokens** for dark/light modes with semantic naming via `useTheme()`
- **Unified LLM service**: single `/api/llm/chat` and `/api/agent-sdk/chat` proxy with SSE stream parsing for both Anthropic and OpenAI formats
- **ErrorBoundary** wraps each lazy tab with per-tab label and "Try again" recovery
- **ForwardRef and aria-live** patterns present; `prefers-reduced-motion` respected in CSS

### ⚠️ Issues

**Critical:**
- **3 god components** exceed 1,000 lines — `SourcesPanel.tsx` (1,689 lines), `TestPanel.tsx` (1,540 lines), `SettingsPage.tsx` (1,040 lines). Single points of failure; near-impossible to unit test.
- **Accessibility gap**: Only 38 aria attributes across 213 TypeScript files. WCAG 2.1 AA requires substantially more. GraphView has no keyboard navigation for node selection.
- **Silent SSE errors**: Malformed SSE data is swallowed with `catch { /* skip malformed */ }` — users get no feedback when streaming fails.

**Major:**
- **24 Zustand stores** with overlapping concerns. `consoleStore` alone is 2,000+ lines mixing agent execution, UI toggles, and file management.
- **54 `any` type usages** — including ForceGraph2D node/link types and runtime body destructuring in routes.
- **No unified loading/error state pattern**: mix of boolean flags, string states, and unhandled async failures.

**Minor:**
- 3 unresolved TODO comments
- Hardcoded hex colors (`#FE5000`) bypass the token system
- No bundle size budget enforced in build config

### 🔧 Recommendations

1. **Split god components**: SourcesPanel → SourcesList + SourceDetail + SourceActions; TestPanel → TestRunner + TestOutput + TestActions; SettingsPage → ProviderSettings + ModelSettings + GeneralSettings
2. **Consolidate stores**: reduce from 24 → 12–15 with clear ownership model; split consoleStore by concern
3. **Eliminate `any`**: 54 instances; enable `noImplicitAny`; add strict ForceGraph2D types
4. **Standardize async states**: `type AsyncState = 'idle' | 'loading' | 'success' | 'error'` across all stores
5. **Accessibility pass**: add aria-labels, keyboard navigation for GraphView, focus management in modals

### 📊 Metrics

| Metric | Value | Target |
|--------|-------|--------|
| TypeScript files | 213 | — |
| `any` usages | 54 | 0 |
| Components > 1000 lines | 3 | 0 |
| Memoization instances | 214 | ✅ |
| Aria attributes | 38 | 200+ |
| Zustand stores | 24 | 12–15 |

---

## Backend Audit

### ✅ Strengths

- **MCP command allowlisting**: `validateMcpCommand()` uses strict allowlist (npx, node, python, uvx, uv, deno, bun) — no blocklist — preventing arbitrary command execution
- **Environment variable sanitization**: blocks `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, `NODE_OPTIONS`
- **Consistent `ApiResponse<T>`** interface with `status: 'ok' | 'error'` across all 50+ endpoints
- **API key redaction**: provider GET endpoints return `hasStoredKey: boolean`, never the actual key
- **Rate limiting**: in-memory limiter at 600 req/min per IP
- **Security headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy set globally
- **Path traversal prevention**: `isPathSafe()` validates against `..` and null bytes

### ⚠️ Issues

**Critical:**
- **Plaintext credential storage**: `credentialStore.ts` stores all API keys in `~/.modular-studio/credentials.json` as unencrypted JSON. Any process running as same user can read all secrets. A `// TODO: encrypt` comment acknowledges this but it's not done.
- **No input validation framework**: routes use ad-hoc `typeof` checks, regex patterns, and range guards — no zod/joi schemas. Creates inconsistency and silent type coercion.
- **SSRF risk on provider baseUrl**: `normalizeBaseUrl()` doesn't validate URL scheme or block private IP ranges. A user can set `baseUrl: "http://internal.network/admin"` and the app will make requests to it.
- **MCP tool execution has no timeout**: `callTool()` has no `Promise.race()` deadline. A hung MCP process blocks agent execution indefinitely.

**Major:**
- **No database migration system**: schema changes require manual SQL updates with no version tracking or rollback.
- **No request logging or correlation IDs**: debugging distributed calls requires log archaeology with no trace IDs.
- **Inconsistent HTTP status codes**: some client errors return 500 via global handler instead of 400.
- **No pagination on list endpoints**: GET /providers, GET /agents, etc. return all records — scalability risk at 10K+ records.
- **No rate limiting on pipeline**: `POST /api/repo/assemble` can consume 200K tokens per request with no per-user quota.
- **Response cache never cleaned**: TTL field stored but cleanup queries never run — unbounded disk growth.

**Minor:**
- No CSP header
- No OpenAPI/Swagger documentation
- `MAX_TOKENS_LIMIT = 32768` hardcoded globally but Claude 3 supports 200K, GPT-4 Turbo 128K

### 🔧 Recommendations

1. **Encrypt credentials** with `crypto.subtle` or system keyring (4–6 hours)
2. **Add zod validation** for all POST/PUT request bodies (8–12 hours)
3. **SSRF protection**: whitelist HTTPS scheme; blocklist private IP ranges 127/8, 10/8, 172.16/12, 192.168/16 (2–3 hours)
4. **MCP timeout**: wrap `callTool()` with 30s `Promise.race()` (1–2 hours)
5. **Database migrations**: create `migrations/` dir with version tracking; run on startup (4–6 hours)
6. **Add MCP reconnection**: exponential backoff retry (1s, 2s, 4s, 8s) on process exit (3–4 hours)

### 📊 Metrics

| Metric | Value |
|--------|-------|
| Route modules | 13 |
| Total endpoints | 50+ |
| Critical vulnerabilities | 4 |
| Major issues | 11 |
| Security posture | 5.2/10 |
| TypeScript quality | 73/100 |

---

## UX Audit

### ✅ Strengths

- **7-step wizard** maps cleanly to agent-building mental model; tab completion indicators (green checkmarks) provide live progress feedback
- **Provider onboarding banner** surfaces immediately in every tab with direct CTA to Settings — new users are never left at a dead end
- **~90% empty state coverage** — all 4 tool sections, knowledge map, agent library, version list, and conversation list have distinct empty states with CTAs
- **Keyboard accessibility** is genuinely solid: tab bar supports `ArrowLeft/Right/Home/End`, skip-link exists, `aria-live` regions present
- **Resizable 3-panel TestTab** with persisted widths via `localStorage` — professional IDE feel
- **Export richness**: 6 targets with live syntax-colored preview, copy-to-clipboard, Export All Targets
- **Version control** built into Topbar with Compare and Restore — a power feature most competitors omit

### ⚠️ Issues

**Critical (breaks user flow):**
- **No confirmation on "Restore Version"** — `src/components/Topbar.tsx` lines 183–196: one click immediately replaces the entire agent state with no dialog. Data loss vector.
- **429 retry loop**: when generation hits a rate limit, the Retry button re-calls `handleGenerate()` immediately with no delay — will re-hit the limit in a tight loop. `src/tabs/DescribeTab.tsx` lines 592–595
- **Silent save failure**: `SaveAgentModal.handleSave` calls `.catch(() => {})` — backend save failures are invisible to users. The agent may not appear in the library on next open. `src/components/SaveAgentModal.tsx` lines 163–169

**Major:**
- **"Coming soon" dead-ends**: Redis, ChromaDB, Pinecone, and Custom memory backends are selectable but show only a yellow "Coming soon" banner. Options that cannot be used should not be selectable.
- **Memory tab completion logic inverted**: `isTabComplete('memory')` returns `true` when the user is *not* using default strategy — a brand-new agent shows the tab as green-checked before the user has done anything.
- **Two confusing Run/Play buttons**: the FAB navigates to Test tab; the Topbar button runs the agent. Both use orange brand color + Play icon. Users cannot distinguish them.
- **V2 toggle invisible without Agent SDK**: the entire V2 section disappears silently when `hasAgentSdk` is false. No explanation, no discoverability.
- **Version history capped at 5** with no "show all" affordance — earlier versions are permanently hidden.
- **`Modal` DS component missing `role="dialog"` and `aria-labelledby`** — affects all delete confirmations and inline modals.

**Minor:**
- Auto-advance after generation (2–3s) has no cancel affordance
- `LearningVelocitySection` has hardcoded "Repeated Mistakes: 0" — static fake metric
- `QualificationSparkline` renders `null` with no placeholder when < 2 runs
- Import is accessible only via hidden `<input type="file">` — no visible "Import" button in Topbar
- Inline `onMouseEnter/onMouseLeave` style mutations used pervasively instead of CSS hover — ~200 lines of duplicated logic

### 🔧 Recommendations

1. **Add confirmation dialog to "Restore Version"** — one-line fix prevents data loss
2. **Disable non-functional memory backends** or remove them from the dropdown with a tooltip
3. **Fix Memory tab completion logic** — require explicit user action before green-check
4. **Disambiguate Run buttons** — rename FAB to "Test" with `MessageCircle` icon
5. **Show toast on save failure** — replace empty `.catch()` with error notification
6. **Debounced retry on 429** — show "Retry in 10s" countdown
7. **Add `role="dialog"` to `Modal` DS component** — one-line accessibility fix
8. **Show V2 toggle as locked state** when `hasAgentSdk` is false, with tooltip explaining how to unlock

### 🗺️ User Journey Map

```
Agent Library → New Agent → Describe (generate) → Knowledge (sources)
     ↓               ↓
[Templates]    [Provider banner]    → Tools → Memory → Review → Test → Qualify → Export
```

**Dead ends identified:**
- No agent name prompt at creation time — agent stays unnamed until Review or Save
- Navigating Back to Library mid-edit has no unsaved-changes warning
- Import is undocumented (no visible Topbar button)
- `Cmd+K` opens file picker (not a command palette as users expect)

### 📊 UX Metrics

| Metric | Count |
|--------|-------|
| Wizard tabs | 7 |
| Distinct modal components | 5 |
| Global overlay/picker components | 6 |
| Keyboard shortcuts documented | 3 |
| Distinct user flows | 8 |
| Empty state coverage | ~90% |
| Toast/notification systems | 2 (fragmented, not global) |

---

## Product Audit

### ✅ Strengths

- **Differentiated positioning**: only AI agent builder explicitly around "context engineering" — solving smart knowledge retrieval, not just access to all sources
- **Advanced retrieval systems**: semantic response caching (hybrid cosine + hash + query diff), hindsight memory (biomimetic), contrastive retrieval (conflict detection), cache-aware assembly per provider
- **12 native connectors**: Airtable, Confluence, GitHub, Gmail, Google Docs/Drive/Sheets, HubSpot, Jira, Linear, Plane, Slack
- **150+ MCP servers** via Model Context Protocol
- **4 LLM providers**: Claude, OpenAI, Google Gemini, Ollama (self-hosted)
- **5 export formats**: Claude Code (.md), OpenClaw (.yaml), Codex (.json), Amp, Generic JSON
- **Meta-Prompt V2**: 6-phase pipeline (Parse → Research → Pattern Select → Context Strategy → Assemble → Evaluate) with live web search
- **Multi-agent Team Runner** for coordinated agent workflows

### ⚠️ Issues

**Critical (ship-blocking):**
- **C1 — Knowledge source UX unclear**: depth slider (10%–100%) has no visible labels (no "Headlines," "Summary," "Full" text), no token count estimate at current depth. Affects `LocalFilesPanel.tsx`, `GitRepoPanel.tsx`, `ConnectorPanel.tsx`.
- **C2 — Smoke test incomplete**: end-to-end manual checklist (Describe → Generate → Knowledge → Tools → Memory → Review → Test → Save → Library → Load) defined but not executed as automated Playwright test.
- **C3 — Code-aware tree indexer missing**: current indexer only parses markdown headings, treating repos as document trees not codebases. No AST-level understanding of TypeScript/Python modules, exports, or functions. Listed in PLAN-REMAINING.md as "I1 — The big feature."
- **C4 — FactInsightsSection misplaced**: currently in KnowledgeTab; belongs in ReviewTab. ~15 minute fix per PLAN-REMAINING.md "B1."

**Major:**
- **Template gallery too thin**: fewer than 5 templates; competitors (Dify, Langflow) showcase galleries of 10–20. Onboarding story is weak without high-quality starter templates.
- **Auto-save not implemented**: users must manually save; browser crash = work lost.
- **Qualification and Team Runner verification**: end-to-end correctness unverified. Known incomplete.
- **Mobile responsiveness untested** at 768px and 1024px breakpoints.

**Minor:**
- No onboarding wizard for first-time users
- Pipeline observability stage labels could be larger

### 🔧 Recommendations

**Phase 1 (Next 48 hours):**
1. Fix C1: add depth labels + token counter to knowledge source panels
2. Fix C4: move FactInsightsSection to ReviewTab
3. Complete C2: run smoke test checklist; commit Playwright script

**Phase 2 (Next sprint):**
1. **C3: Code-aware tree indexer** — start with TypeScript regex extraction (modules, exports, function signatures), layer LLM summaries. Estimated: 2–3 days. This is the #1 competitive differentiator.
2. Verify Qualification and Team Runner end-to-end
3. Implement auto-save with 1s debounce on tab navigation

**Phase 3 (Following week):**
1. Expand template gallery to 8+ quality templates (Research Assistant, Code Reviewer, Customer Support, Data Analyst)
2. First-time user onboarding wizard
3. Mobile responsiveness testing + fixes

### 🏆 Competitive Position

| Competitor | Their Strength | Modular's Edge |
|------------|----------------|----------------|
| Dify | Visual workflow builder, large template library | Context engineering depth, cache-aware optimization |
| Langflow | Node-based visual builder, large community | Knowledge pipeline architecture, team orchestration |
| Flowise | Lightweight, easy deployment | Far broader feature set, richer connectors |
| Wordware | Managed hosting, simplicity | Self-hosted, exportable, no vendor lock-in |

**Modular's unique position**: "The IDE for engineers who need smart knowledge pipelines." Not the easiest, not the most visual — the most analytically powerful for knowledge-heavy use cases.

### 📊 Product Metrics

| Metric | Value |
|--------|-------|
| LLM providers | 4 |
| Native connectors | 12 |
| MCP servers | 150+ |
| Export formats | 5 |
| Main wizard tabs | 7 |
| Template count | < 5 (gap) |
| Test pass rate | 95% (916/870 passing) |

---

## Infrastructure Audit

### ✅ Strengths

- **Multi-stage Docker build**: clean build and runtime stages, `node:22-slim` base
- **916 passing unit tests**, 89 test files, 29 skipped (intentional isolation)
- **TypeScript strict mode** across all configs: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **CI/CD pipeline**: GitHub Actions on every push/PR with type-check, build, unit tests, server build, E2E smoke test
- **Vite manual chunks** for intelligent code splitting
- **Separate tsconfigs** for app, server, node, and e2e
- **Docker Compose** with persistent volume for SQLite data

### ⚠️ Issues

**Critical:**
- **Docker runs as root**: Dockerfile has no `USER` directive — container runs as root. A container escape gives full host access.
- **No security scanning in CI**: no `npm audit`, no SAST, no supply chain scanning. A compromised dependency would ship silently.
- **No lint check in CI**: `npm run lint` exists but is not in the CI pipeline. Lint errors can merge.
- **Full E2E not in CI**: only a smoke test runs; the full Playwright suite does not run in the pipeline. UI regressions go undetected.

**Major:**
- **No coverage reporting**: Vitest runs but no thresholds or coverage reports generated — unknown code coverage baseline.
- **Circular dependency warnings** in build: `treeIndexer.ts`, `consoleStore.ts`, `mcpStore.ts` cause chunk optimization warnings.
- **29 tests skipped silently**: integration tests in `mcp-cli.test.ts` and `mcp-server.test.ts` skipped with no documented reason.
- **No Docker health check**: `docker-compose.yml` lacks `healthcheck` directive.
- **Port 4800 hardcoded** in Dockerfile and docker-compose — no environment variable flexibility.
- **9 ESLint rules disabled globally**: `no-explicit-any`, `no-unused-vars`, `no-empty`, etc. — high permissiveness.

**Minor:**
- `.dockerignore` only excludes `node_modules`; missing `.git`, `*.log`, `.env.local`, `.DS_Store`, `tests/`
- No pre-commit hooks (no husky/lint-staged)
- E2E only tests Chromium; no Firefox or Safari coverage
- Benchmark scripts (`benchmark-*.ts`) undocumented in package.json

### 🔧 Recommendations

**Priority 1 — Security:**
1. Add `RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app` + `USER appuser` to Dockerfile
2. Add `npm audit --audit-level=high` step to CI
3. Add `npm run lint` step to CI before build
4. Run full E2E suite in CI (not just smoke test)
5. Expand `.dockerignore` to include `.git/`, `*.log`, `.env.local`, `tests/`

**Priority 2 — Build quality:**
6. Add Docker `healthcheck` directive calling `/health` endpoint
7. Add `PORT` environment variable replacing hardcoded 4800
8. Enable vitest coverage with `v8` provider; fail CI below 70% threshold
9. Fix circular imports in `treeIndexer.ts`, `consoleStore.ts`, `mcpStore.ts`

**Priority 3 — Developer experience:**
10. Add husky + lint-staged for pre-commit checks
11. Document benchmark scripts in package.json with `benchmark:*` entries
12. Add Firefox project to Playwright config
13. Document or fix the 29 skipped integration tests

### 📊 Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Test pass rate | 916/916 (+ 29 skipped) | ✅ |
| Build time (client) | 5.70s | ✅ |
| Client bundle (uncompressed) | 1.4 MB | ⚠️ |
| Security checks in CI | 0 | ❌ |
| Lint in CI | No | ❌ |
| Docker runs as root | Yes | ❌ |
| Coverage reporting | None | ❌ |
| CI jobs | 2 | ⚠️ |

---

## Cross-Cutting Conflicts & Resolutions

### Conflict 1: "Frontend is well-tested" vs "No coverage baseline"
- **Frontend Auditor**: notes good memoization and test patterns
- **Infra Auditor**: notes 0 coverage metrics — unknown actual coverage
- **Resolution**: the 916 tests are real and passing, but without coverage reporting we don't know what percentage of code they exercise. Add vitest coverage as P1 so claims about test quality can be substantiated.

### Conflict 2: "Product wants code indexer now" vs "Backend security needs fixing first"
- **Product Auditor**: code-aware tree indexer is the #1 feature (C3)
- **Backend Auditor**: plaintext credential storage is a blocker for any public release
- **Resolution**: these are parallel work streams on different code areas. Fix credentials (server/services) simultaneously with starting the indexer (server/mcp or server/services). No real conflict; both are high-priority.

### Conflict 3: "Coming soon options should be removed" (UX) vs "Ship template variety quickly" (Product)
- **UX**: non-functional memory backends should be disabled or removed
- **Product**: template gallery is thin and needs expansion
- **Resolution**: UX fix is quick (disable dropdown options + add tooltip = 30 min). Template expansion is a week of work. Prioritize UX fix as P0 (prevents user confusion), template expansion as P1.

### Conflict 4: "SSE errors silently skipped" (Frontend) vs "No error tracking" (Infra)
- Both point to the same underlying problem from different angles
- **Resolution**: add a global toast notification system (Frontend) AND wire it to error tracking (Sentry/DataDog, Infra). These compound into one unified recommendation: add observability layer.

### Conflict 5: "Good TypeScript discipline" (Frontend, Infra) vs "54 any usages, loose route types" (Frontend, Backend)
- **Resolution**: TypeScript strict mode is on but `no-explicit-any` ESLint rule is disabled globally. The tension is real. Recommend: re-enable `no-explicit-any` as a warning (not error) to surface issues gradually without breaking the build.

---

## Prioritized Action Plan

### P0 — Ship-Blocking (fix before any external user sees the product)

| # | Issue | Owner | Effort | Source |
|---|-------|-------|--------|--------|
| P0-1 | **Encrypt credentials** — replace plaintext `credentials.json` with crypto.subtle or system keyring | Backend | 4–6h | Backend |
| P0-2 | **Docker non-root user** — add `USER appuser` to Dockerfile | Infra | 30min | Infra |
| P0-3 | **SSRF protection** — validate provider baseUrl scheme + block private IPs | Backend | 2–3h | Backend |
| P0-4 | **MCP tool timeout** — wrap `callTool()` with 30s `Promise.race()` | Backend | 1–2h | Backend |
| P0-5 | **Restore Version confirmation** — add dialog before `restoreVersion()` call | Frontend/UX | 30min | UX |
| P0-6 | **Silent save failure** — replace `.catch(() => {})` with toast notification | Frontend/UX | 1h | UX |
| P0-7 | **429 retry loop** — disable retry button temporarily or add countdown on rate-limit error | Frontend/UX | 1h | UX |
| P0-8 | **Knowledge source depth UX** — add labels (Headlines/Summary/Detail/Full) + token counter to depth slider | Frontend/UX | 2–4h | Product |
| P0-9 | **FactInsightsSection placement** — move from KnowledgeTab to ReviewTab | Frontend | 15min | Product |
| P0-10 | **Disable non-functional memory backends** — make Redis/ChromaDB/Pinecone/Custom non-selectable with tooltip | Frontend/UX | 30min | UX |
| P0-11 | **Add lint to CI** — add `npm run lint` step to GitHub Actions | Infra | 15min | Infra |
| P0-12 | **Add npm audit to CI** — `npm audit --audit-level=high` in pipeline | Infra | 15min | Infra |

**Total P0 estimated effort: ~14–20 hours**

---

### P1 — Should Fix Before Demo

| # | Issue | Owner | Effort | Source |
|---|-------|-------|--------|--------|
| P1-1 | **Code-aware tree indexer** — TypeScript/Python AST extraction (modules, exports, function sigs); LLM summaries | Backend | 2–3d | Product |
| P1-2 | **Centralized input validation** — add zod schemas for all POST/PUT route bodies | Backend | 8–12h | Backend |
| P1-3 | **Full E2E in CI** — run full Playwright suite in pipeline (not just smoke) | Infra | 2–4h | Infra |
| P1-4 | **Smoke test automation** — Playwright script for complete wizard workflow (Describe→Test→Save) | QA | 4–6h | Product |
| P1-5 | **Fix Memory tab completion** — `isTabComplete('memory')` should require explicit user action | Frontend | 1h | UX |
| P1-6 | **Disambiguate Run buttons** — rename FAB to "Test" + `MessageCircle` icon | Frontend/UX | 1h | UX |
| P1-7 | **Auto-save** — checkpoint on tab navigation with 1s debounce | Frontend | 4–6h | Product |
| P1-8 | **V2 toggle discoverability** — show locked state with tooltip when `hasAgentSdk` is false | Frontend | 1h | UX |
| P1-9 | **Global toast notification system** — unified feedback layer; wire to save, generate, import errors | Frontend | 4–6h | UX/Frontend |
| P1-10 | **Coverage reporting** — enable vitest `v8` coverage; fail CI below 70% | Infra | 2–3h | Infra |
| P1-11 | **Database migrations** — `migrations/` dir with version tracking; run on startup | Backend | 4–6h | Backend |
| P1-12 | **Split god components** — SourcesPanel, TestPanel, SettingsPage each broken into 3 focused components | Frontend | 2–3d | Frontend |
| P1-13 | **MCP reconnection** — exponential backoff retry on process exit | Backend | 3–4h | Backend |
| P1-14 | **Docker health check** — add `HEALTHCHECK` directive calling `/health` | Infra | 30min | Infra |
| P1-15 | **Request logging + correlation IDs** — add morgan middleware with trace IDs | Backend | 3–4h | Backend |

**Total P1 estimated effort: ~5–7 days**

---

### P2 — Nice-to-Have (post-demo polish)

| # | Issue | Owner | Effort | Source |
|---|-------|-------|--------|--------|
| P2-1 | **Template gallery** — expand to 8+ quality templates (Research Assistant, Code Reviewer, Customer Support, Data Analyst) | Product/Frontend | 2–3d | Product |
| P2-2 | **Consolidate Zustand stores** — reduce 24 → 12–15 with clear ownership model; split consoleStore | Frontend | 2–3d | Frontend |
| P2-3 | **Eliminate `any` types** — 54 instances; add strict ForceGraph2D types; enable `no-explicit-any` warning | Frontend | 2d | Frontend |
| P2-4 | **Accessibility pass** — aria-labels, keyboard nav for GraphView, `role="dialog"` on Modal DS component | Frontend/UX | 2–3d | Frontend/UX |
| P2-5 | **First-time user onboarding wizard** — 3-step flow: Connect provider → Describe agent → Generate | Frontend/UX | 1–2d | Product |
| P2-6 | **SSRF + provider capability declarations** — per-provider token limits, model list refresh, rate limits | Backend | 1–2d | Backend |
| P2-7 | **Mobile responsiveness** — test and fix at 768px and 1024px breakpoints | Frontend | 3–4h | Product |
| P2-8 | **Response cache cleanup job** — daily TTL-based eviction; size cap at 1GB | Backend | 2–3h | Backend |
| P2-9 | **Pre-commit hooks** — husky + lint-staged for local quality gates | Infra | 1h | Infra |
| P2-10 | **Multi-browser E2E** — add Firefox to Playwright config | Infra | 30min | Infra |
| P2-11 | **Version history "show all"** — remove `.slice(-5)` cap or add pagination | Frontend/UX | 1h | UX |
| P2-12 | **Unsaved-changes warning** — warn before navigating Back to Library | Frontend/UX | 1–2h | UX |
| P2-13 | **OpenAPI/Swagger documentation** — generate from route types | Backend | 8–10h | Backend |
| P2-14 | **Error tracking integration** — Sentry or equivalent in production | Infra | 2–3h | Infra |
| P2-15 | **Bundle size budgets** — enforce in Vite config; fail build if exceeded | Infra | 1h | Infra |
| P2-16 | **Document benchmark scripts** — add `benchmark:*` npm scripts | Infra | 30min | Infra |
| P2-17 | **`import` button in Topbar** — make agent import discoverable | Frontend/UX | 1h | UX |
| P2-18 | **Fix scrollbar CSS scoping** — dark-mode-only scrollbar styles leaking into light mode | Frontend | 30min | Frontend |

**Total P2 estimated effort: ~3–4 weeks**

---

## Recommended Release Sequence

```
Day 1–2:   Fix all P0 issues (14–20h total)
           → Safe to expose to trusted beta users

Day 3–7:   P1 work (code indexer, validation, E2E CI, auto-save, toast system)
           → Ready for controlled beta to technical audience

Week 2–3:  P1 polish (template gallery, onboarding, accessibility basics)
           → Ready for broader marketing push

Week 4+:   P2 improvements (store consolidation, full accessibility, mobile, error tracking)
           → Enterprise-ready
```

---

*Report generated by 5-agent audit team: FRONTEND_AUDITOR, BACKEND_AUDITOR, UX_AUDITOR, PRODUCT_AUDITOR, INFRA_AUDITOR*
*Orchestrated and synthesized by Claude Sonnet 4.6*
