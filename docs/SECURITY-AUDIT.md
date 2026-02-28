# Security Audit Report — Modular Studio

**Date:** 2026-02-28  
**Auditor:** Automated (Claude)  
**Scope:** Backend (`server/`), Frontend (`src/`), MCP/LLM integration  
**npm audit:** 0 known vulnerabilities

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 4     |
| MEDIUM   | 4     |
| LOW      | 3     |

---

## CRITICAL

### C1: API Keys Stored in Plain Text in localStorage
**File:** `src/components/SettingsModal.tsx`  
**Lines:** 10-11, 41  
**Description:** API keys (OpenAI, OpenRouter, etc.) are stored as plain text in `localStorage` under `modular-api-key`. Any XSS vulnerability or malicious browser extension can exfiltrate them. localStorage is also accessible from browser DevTools.  
**Impact:** Full compromise of user's LLM API keys → financial loss, data exfiltration.  
**Status:** ⚠️ **NOT auto-fixed** — requires architectural decision. Options:
1. Move key storage server-side (providers route already exists)
2. Use the backend as a proxy (already supported via `/api/llm/chat`) and remove client-side key storage entirely
3. At minimum, encrypt with a session-derived key

**Recommendation:** Remove the `SettingsModal` localStorage path entirely. The app already has server-side provider management (`/api/providers`). Use that exclusively.

### C2: API Keys Returned in Plain Text via GET /api/providers
**File:** `server/routes/providers.ts`  
**Lines:** 8-11  
**Description:** `GET /api/providers` returns the full provider config including `apiKey` in plain text. Combined with no authentication on the API, any process on localhost can read all stored API keys.  
**Impact:** API key theft from any local process or browser tab.  
**Status:** ✅ **Fixed** — API keys are now masked in GET responses.

---

## HIGH

### H1: No Authentication on Any API Route
**Files:** All `server/routes/*.ts`  
**Description:** Zero authentication or authorization on any endpoint. The API is protected only by CORS (localhost origins) and network access. Any local application, browser extension, or script can call all endpoints.  
**Impact:** Unauthorized access to API keys, MCP server management, file reading, LLM proxy usage.  
**Recommendation:** Add at minimum a session token or bearer token for API access.

### H2: No Rate Limiting on LLM Proxy Routes
**Files:** `server/routes/llm.ts`, `server/routes/agent-sdk.ts`  
**Description:** No rate limiting on `/api/llm/chat` or `/api/agent-sdk/chat`. A malicious script can make unlimited LLM API calls through the proxy, causing unbounded cost.  
**Impact:** Cost attack — unlimited token spend on user's API keys.  
**Recommendation:** Add `express-rate-limit` middleware, especially on LLM routes. Cap at e.g. 60 req/min.

### H3: No Token Budget Enforcement on Backend
**Files:** `server/routes/llm.ts`, `server/routes/agent-sdk.ts`  
**Description:** The frontend has a `tokenBudget` UI control, but the backend enforces no limits on `maxTokens`. A crafted API call can set `maxTokens: 1000000`.  
**Impact:** Single request can consume large amounts of API credits.  
**Recommendation:** Enforce a server-side maximum for `maxTokens` (e.g., cap at 32768).

### H4: MCP Server Command Execution Without Validation
**File:** `server/mcp/manager.ts`  
**Description:** `McpManager.connect()` spawns arbitrary commands from `config.command` with `StdioClientTransport`. While this is by design for MCP, any user who can POST to `/api/mcp` can register and execute arbitrary commands on the host.  
**Impact:** Remote code execution via the unauthenticated API.  
**Recommendation:** Combine with H1 (authentication). Optionally add a command allowlist.

---

## MEDIUM

### M1: CORS Allows Only Hardcoded localhost Origins
**File:** `server/index.ts`  
**Lines:** 22-28  
**Description:** CORS is restricted to `localhost:5173-5176`, which is good. However, if the app is ever deployed beyond localhost, this must be updated. No dynamic origin support.  
**Impact:** Low currently (localhost only). Risk if deployment model changes.  

### M2: Error Messages May Leak Internal Details
**Files:** Multiple routes  
**Description:** Error handlers forward `err.message` to clients (e.g., `server/index.ts:46`, various catch blocks). Node.js error messages can contain file paths, stack traces, or system details.  
**Recommendation:** In production, return generic error messages. Log details server-side only.

### M3: No CSP Headers
**File:** `index.html`  
**Description:** No Content-Security-Policy header or meta tag. This means inline scripts, external script sources, and other injection vectors are unrestricted.  
**Recommendation:** Add CSP headers via Vite plugin or Express middleware for the served frontend.

### M4: Prompt Injection via User Inputs to LLM
**Files:** `server/routes/llm.ts`, `server/routes/agent-sdk.ts`  
**Description:** User-provided `prompt` and `messages` are forwarded directly to LLM APIs without sanitization. In the Agent SDK path, the agent has tool access (Read, Edit, Bash, etc.), making prompt injection particularly dangerous.  
**Recommendation:** For the Agent SDK route, consider sandboxing, limiting tools, or adding prompt guardrails.

---

## LOW

### L1: dangerouslySetInnerHTML Usage (Mitigated)
**File:** `src/components/SaveAgentModal.tsx:467`  
**Description:** Uses `dangerouslySetInnerHTML` for syntax highlighting in the export preview. The `colorizeLine` function properly calls `escapeHtml()` before injecting HTML.  
**Impact:** Currently safe. Risk if `escapeHtml` is bypassed in future refactors.  

### L2: Frontend Direct LLM Calls Expose API Key in Network Tab
**File:** `src/services/llmService.ts` (`streamCompletion`)  
**Description:** `streamCompletion()` sends API key directly from browser to external LLM APIs. The key is visible in browser DevTools Network tab as an `Authorization` header.  
**Impact:** Key visible to anyone with DevTools access (same user, so limited impact).  
**Recommendation:** Route all LLM calls through the backend proxy (`/api/llm/chat`).

### L3: Google API Key Exposed in URL Query Parameter
**File:** `server/routes/providers.ts:138`  
**Description:** For Google provider testing, the API key is sent as a URL query parameter (`?key=...`). Query parameters may be logged in server access logs, proxy logs, and browser history.  
**Recommendation:** Use header-based authentication for Google API calls where possible.

---

## What Was Fixed

### Fix C2: Mask API Keys in Provider GET Response

API keys are now masked (showing only last 4 chars) in `GET /api/providers` responses. Full keys are only used server-side for actual API calls.

---

## Recommendations Priority

1. **Add authentication** to the Express API (H1) — this alone mitigates H4 and reduces H2/H3 severity
2. **Add rate limiting** on LLM routes (H2)
3. **Enforce server-side token caps** (H3)
4. **Remove client-side API key storage** — use server-side providers exclusively (C1)
5. **Add CSP headers** (M3)
6. **Sanitize error messages** in production mode (M2)
