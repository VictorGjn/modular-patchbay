# Cross-Platform Portability Plan (macOS + Linux)

*March 11, 2026 — Analysis of all platform-dependent code.*

---

## Status: What Already Works ✅

Most of the codebase is **already portable**:
- Server: pure Node.js, no native binaries (sharp stubbed, sql.js is WASM)
- Client: Vite + React, zero platform deps
- Paths: `~/.modular-studio/` uses `os.homedir()` — works everywhere
- Path separators: Most places already normalize `\` → `/` via `.replace(/\\/g, '/')`
- `StdioClientTransport` from `@modelcontextprotocol/sdk` handles spawn internally

---

## 🔴 P0 — Must Fix Before "Works on Mac"

### 1. `npx` on Windows requires `shell: true`
**Where:** `server/mcp/manager.ts` → `StdioClientTransport`
**Problem:** On Windows, `npx` is actually `npx.cmd` — a batch file. `child_process.spawn('npx', ...)` without `shell: true` fails silently on Windows. On macOS/Linux, `npx` is a real executable — no issue.
**Current state:** The MCP SDK's `StdioClientTransport` handles this internally (it detects platform). **No fix needed** — the SDK does it right.
**Verify:** Test `modular-studio` on macOS with an MCP server using `npx`. If SDK handles it, we're good.

### 2. `uvx` dependency not installed by default on macOS/Linux
**Where:** `mcp-registry.ts:60` — `mcp-server-git` uses `command: 'uvx'`
**Problem:** `uvx` (from `uv`, the Python package manager) is not installed by default anywhere. On macOS: `brew install uv`. On Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`.
**Fix:** 
```typescript
// In ConnectionPicker: detect if command is available before showing "Add"
// Show install hint if missing
configHint?: string; // "Requires: brew install uv (macOS) or pip install uv"
```
**Effort:** 30min — add `configHint` field to registry entries that need non-npm tools.

### 3. OAuth redirect URIs hardcoded to `localhost:4800`
**Where:** `server/routes/connectors.ts:49-70`
```typescript
redirectUri: 'http://localhost:4800/api/connectors/oauth/callback',
```
**Problem:** If the server runs on a different port (env `PORT`), OAuth breaks. Not platform-specific per se, but affects deployability.
**Fix:**
```typescript
const PORT = process.env.PORT || 4800;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// ...
redirectUri: `${BASE_URL}/api/connectors/oauth/callback`,
```
**Effort:** 15min.

### 4. `skills-search.ts` uses `shell: true`
**Where:** `server/routes/skills-search.ts:222`
```typescript
const { stdout, stderr } = await exec('npx', args, { timeout: 60000, shell: true });
```
**Status:** `shell: true` is actually the **right** approach for cross-platform `npx` calls.
**No fix needed** — already portable.

---

## 🟡 P1 — Should Fix for Good Experience

### 5. `worktreeManager.ts` uses `execSync` without platform awareness
**Where:** `server/services/worktreeManager.ts:56,60`
```typescript
execSync(command, { stdio: 'pipe', timeout: 120_000 });
```
**Problem:** The `command` is constructed as string — if it contains paths with spaces (common on macOS: `/Users/John Doe/...`), it'll break.
**Fix:** Use `execFileSync` with array args instead of string commands. Or quote paths.
**Effort:** 30min.

### 6. MCP command allowlist missing platform variants
**Where:** `server/mcp/manager.ts:22`
```typescript
private readonly ALLOWED_MCP_COMMANDS = new Set([
  'npx', 'node', 'python', 'python3', 'uvx', 'uv', 'deno', 'bun'
]);
```
**Problem:** On macOS, Python might be `python3` only (no `python`). On some Linux distros, `nodejs` instead of `node`. Windows: `npx.cmd`, `python.exe`.
**Current state:** The SDK resolves `.cmd` extensions internally. The allowlist extracts base command name (line 36: `command.split(/[/\\]/).pop()?.split('.')[0]`), so `npx.cmd` → `npx` works.
**Fix needed:** Add `nodejs` to allowlist. Consider adding `/usr/bin/env` (common in shebang-style invocations).
```typescript
'npx', 'node', 'nodejs', 'python', 'python3', 'uvx', 'uv', 'deno', 'bun'
```
**Effort:** 5min.

### 7. `open` command for OAuth popup
**Where:** `server/routes/mcp-oauth.ts` — returns URL, client opens popup
**Status:** The server returns the URL, the browser client opens it via `window.open()`. **Already portable** — browser handles it.

### 8. `stub-sharp.cjs` path resolution
**Where:** `scripts/stub-sharp.cjs`
```javascript
const sharpIndex = path.join(__dirname, '..', 'node_modules', 'sharp', 'lib', 'index.js');
```
**Status:** Uses `path.join` — **already portable**.

---

## 🔵 P2 — Nice to Have

### 9. File extension handling in knowledge indexer
**Where:** `server/routes/knowledge.ts:65-66`
```typescript
'.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
```
**Status:** All extensions listed — indexes both Unix and Windows scripts. **Already portable**.

### 10. Config directory permissions
**Where:** `~/.modular-studio/` created by various server routes
**Problem:** On Linux, `mkdir` defaults to 0755. On macOS, same. No issue.
**But:** If running as root (Docker), files created as root can't be read by normal user later.
**Fix:** Add `{ mode: 0o755 }` to `mkdirSync` calls. Low priority.

### 11. `node_modules/.bin` PATH resolution
**Where:** Implicit — when running MCP servers via `npx`
**Problem:** On Windows, `node_modules/.bin/` contains `.cmd` files. On macOS/Linux, they're symlinks to `.js` files.
**Status:** Handled by `npx` and the MCP SDK. **No fix needed**.

---

## Provider Connection Portability

### Already Portable ✅
| Provider | Auth Method | Portable? | Notes |
|----------|-------------|-----------|-------|
| Anthropic | API key → env/config | ✅ | HTTP API, no platform deps |
| OpenAI | API key → env/config | ✅ | HTTP API |
| Google | API key → env/config | ✅ | HTTP API |
| Groq | API key → env/config | ✅ | HTTP API |
| Mistral | API key → env/config | ✅ | HTTP API |
| OpenRouter | API key → env/config | ✅ | HTTP API |
| Ollama | Local HTTP | ✅ | Runs on all platforms |

### Needs Attention ⚠️
| Provider | Auth Method | Issue |
|----------|-------------|-------|
| Any OAuth | Browser popup | Redirect URI hardcoded (Fix #3) |

### MCP Server Portability
| Server | Command | Portable? | Notes |
|--------|---------|-----------|-------|
| 120+ `npx` servers | `npx` | ✅ | Works if Node.js installed |
| `mcp-server-git` | `uvx` | ⚠️ | Needs `uv` installed (Fix #2) |
| Docker-based | `docker` | ⚠️ | Needs Docker Desktop |
| Puppeteer | `npx` | ⚠️ | Needs Chromium — downloads on first run |

---

## Implementation Priority

| # | Fix | Platform | Effort | Impact |
|---|-----|----------|--------|--------|
| 3 | Dynamic OAuth redirect URI | All | 15min | OAuth works on any port |
| 6 | Add `nodejs` to MCP allowlist | Linux | 5min | Some distros use `nodejs` |
| 2 | `configHint` for non-npm tools | All | 30min | User knows what to install |
| 5 | `worktreeManager` path quoting | macOS | 30min | Paths with spaces work |
| 10 | Config dir permissions | Linux/Docker | 15min | Root → user transitions |

**Total effort: ~1h35min for full cross-platform support.**

---

## Testing Checklist

Before claiming "works on macOS/Linux":

- [ ] `npm install -g modular-studio && modular-studio` on macOS (Apple Silicon)
- [ ] `npm install -g modular-studio && modular-studio` on macOS (Intel)
- [ ] `npm install -g modular-studio && modular-studio` on Ubuntu 22.04
- [ ] Connect an MCP server via `npx` on each platform
- [ ] Connect an OAuth provider (Notion) on each platform
- [ ] Enter API key for Anthropic/OpenAI, test model loading
- [ ] Index a local directory via Knowledge panel
- [ ] `sharp` stub works (no native binary errors)
- [ ] `sql.js` WASM loads (SQLite for embeddings cache)
