# Cross-Platform Portability Plan — Full Codebase

*March 11, 2026 — Every file in src/, server/, bin/, scripts/ scanned.*

---

## Executive Summary

Modular Studio is **~90% portable already.** Zero `process.platform` checks in the entire codebase (good — it's not littered with platform hacks). But there are **8 real issues** and a testing gap.

---

## What's Already Portable ✅

| Layer | Why it works | Files |
|-------|-------------|-------|
| **React client** | Browser = universal | All `src/` |
| **Config storage** | `os.homedir()` → `~/.modular-studio/` | `knowledge.ts`, `pipeline.ts`, `agentStore.ts` |
| **Path normalization** | `.replace(/\\/g, '/')` everywhere | `knowledge.ts:117,228`, `contextAssembler.ts:210` |
| **Temp dirs** | `os.tmpdir()` | `githubIndexer.ts:137`, `worktreeManager.ts:30`, `repo-index.ts:9` |
| **SQLite** | `sql.js` (WASM) — no native binary | `sqliteStore.ts` |
| **Embeddings** | `@huggingface/transformers` (JS) + `sharp` stubbed | `embeddingService.ts`, `stub-sharp.cjs` |
| **Sharp stub** | `path.join(__dirname, ..)` | `scripts/stub-sharp.cjs` |
| **MCP stdio transport** | SDK handles `npx.cmd` vs `npx` internally | `server/mcp/manager.ts` |
| **MCP streamable-http** | Pure HTTP, no platform deps | `server/mcp/manager.ts` |
| **Provider API calls** | All HTTP — Anthropic, OpenAI, etc. | `server/routes/providers.ts`, `llm.ts` |
| **Tree indexer** | Pure string parsing | `treeIndexer.ts`, `treeNavigator.ts` |
| **File extension list** | Includes both `.sh/.bash/.zsh` AND `.ps1/.bat/.cmd` | `knowledge.ts:65-66` |
| **Server bind** | `app.listen(port)` — no host specified = dual-stack | `server/index.ts:156` |
| **Browser open** | `open` npm package — works macOS/Linux/Windows | `bin/modular-studio.ts` |
| **Vite dev server** | Standard config, no platform hacks | `vite.config.ts` |
| **Line endings** | Only one `\r\n` normalize in `agentImport.ts:538` | Sufficient |

---

## 🔴 P0 — Breaks on macOS/Linux

### 1. `githubIndexer.ts` — Shell injection via string concatenation
**File:** `server/services/githubIndexer.ts:145-146`
```typescript
execSync(
  `git clone ${depthArg} ${branchArg} --single-branch "${cloneUrl}" "${tempDir}"`,
  { stdio: 'pipe', timeout: 120_000 }
);
```
**Problem:** String-concatenated command. On macOS, `tempDir` from `os.tmpdir()` returns `/var/folders/xx/...` (contains no spaces), but `cloneUrl` could contain special characters. More critically, `execSync` with a string command uses `/bin/sh` on macOS/Linux vs `cmd.exe` on Windows — **quoting rules are different**.
- Windows: double quotes work → `"C:\Users\foo\bar"` ✅
- macOS/Linux: double quotes work for most cases, BUT `$` in URLs triggers shell expansion → `"https://token@github.com"` could break if token contains `$`

**Fix:**
```typescript
import { execFileSync } from 'node:child_process';
execFileSync('git', ['clone', ...depthArgs, ...branchArgs, '--single-branch', cloneUrl, tempDir], {
  stdio: 'pipe', timeout: 120_000
});
```
`execFileSync` with array args = no shell, no injection, works everywhere.

**Effort:** 20min (3 `execSync` calls to convert).

### 2. `worktreeManager.ts` — Same shell command pattern
**File:** `server/services/worktreeManager.ts:56,60`
```typescript
execSync(command, { stdio: 'pipe', timeout: 120_000 });
```
**Problem:** `command` is built as a string (e.g., `git worktree add "path" branch`). Same shell quoting issue as #1.
**Fix:** Convert to `execFileSync('git', [...args])`.
**Effort:** 30min.

### 3. OAuth redirect URIs hardcoded to `localhost:4800`
**File:** `server/routes/connectors.ts:49-70`
```typescript
redirectUri: 'http://localhost:4800/api/connectors/oauth/callback',
```
**Problem:** If server runs on different port (via `--port 5000`), all OAuth flows break. Not platform-specific per se, but Amélie hit this when testing. The `--port` flag exists but OAuth ignores it.
**Fix:**
```typescript
function getBaseUrl(req: express.Request): string {
  return process.env.BASE_URL || `http://localhost:${req.socket.localPort || 4800}`;
}
```
**Effort:** 15min.

---

## 🟡 P1 — Works but degraded experience

### 4. MCP command allowlist missing `nodejs`
**File:** `server/mcp/manager.ts:22`
```typescript
private readonly ALLOWED_MCP_COMMANDS = new Set([
  'npx', 'node', 'python', 'python3', 'uvx', 'uv', 'deno', 'bun'
]);
```
**Problem:** Some Debian/Ubuntu distros ship `nodejs` instead of `node`. Trying to run a custom MCP server via `nodejs my-server.js` gets blocked.
**Fix:** Add `'nodejs'` to the set.
**Effort:** 1min.

### 5. `uvx` dependency not available by default
**File:** `src/store/mcp-registry.ts:60` — `mcp-server-git` uses `command: 'uvx'`
**Problem:** `uvx` requires `uv` (Astral's Python toolchain). Not installed by default on any platform.
**Fix:** Add `installHint` to registry entries:
```typescript
{
  id: 'mcp-server-git',
  command: 'uvx',
  installHint: { 
    macos: 'brew install uv', 
    linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
    windows: 'pip install uv'
  },
  // ...
}
```
Show this hint in ConnectionPicker when command is not in PATH.
**Effort:** 1h (registry schema change + UI hint).

### 6. `skills-search.ts` uses `shell: true` — correct but inconsistent
**File:** `server/routes/skills-search.ts:222`
```typescript
const { stdout, stderr } = await exec('npx', args, { timeout: 60000, shell: true });
```
**Status:** `shell: true` makes `npx` work everywhere. This is **fine**.
BUT `health.ts:320` also calls `npx` without `shell: true`:
```typescript
const { stdout } = await exec('npx', ['skills', 'update', id, '--dry-run'], { ... });
```
**Problem:** The `health.ts` call might fail on Windows without `shell: true` (needs `npx.cmd`). Works fine on macOS/Linux.
**Fix:** Add `shell: true` to `health.ts:320`.
**Effort:** 2min.

### 7. No `engines` field enforcement
**File:** `package.json`
```json
"engines": { "node": ">=18" }
```
**Status:** Declared but not enforced. A user on Node 16 gets cryptic errors.
**Fix:** Add to `bin/modular-studio.ts`:
```typescript
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error('modular-studio requires Node.js 18+'); process.exit(1); }
```
**Effort:** 5min.

---

## 🔵 P2 — Edge cases

### 8. Config directory permissions (Docker)
**Problem:** If first run is as root (Docker), `~/.modular-studio/` is owned by root. Subsequent non-root runs can't write.
**Fix:** `mkdirSync(dir, { recursive: true, mode: 0o755 })` everywhere + check ownership on startup.
**Effort:** 15min.

### 9. 15 orphan components increase bundle
**Files:** `Divider.tsx`, `EmptyState.tsx`, `ConversationTester.tsx`, etc.
**Impact:** No platform issue, but tree-shaking should handle it. If not, dead code = larger install.
**Fix:** Delete or mark with `// @deprecated`.
**Effort:** 10min.

---

## Platform Test Matrix

| Test | macOS (ARM) | macOS (Intel) | Ubuntu 22 | Ubuntu 24 | Alpine (Docker) |
|------|------------|---------------|-----------|-----------|-----------------|
| `npm i -g modular-studio` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Server starts (`--port 4800`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `--open` opens browser | ⬜ | ⬜ | ⬜ | ⬜ | N/A |
| Enter Anthropic API key | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Chat with agent | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Index local dir (Knowledge) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Index GitHub repo | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Connect MCP (npx) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Connect MCP (uvx) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| OAuth flow (Notion) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Embeddings + search | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| SQLite persistence | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Agent export/import | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `npm test` (674 tests) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

## Implementation Order

| # | Fix | Effort | Blocks |
|---|-----|--------|--------|
| 1 | `githubIndexer` → `execFileSync` | 20min | GitHub repo indexing on macOS |
| 2 | `worktreeManager` → `execFileSync` | 30min | Worktree features on macOS |
| 3 | Dynamic OAuth redirect URI | 15min | OAuth on custom ports |
| 4 | Add `nodejs` to allowlist | 1min | MCP on Debian |
| 6 | `health.ts` `shell: true` | 2min | Skill updates on Windows |
| 7 | Node version check in binary | 5min | Clear error on old Node |
| 5 | `installHint` for non-npm MCP | 1h | UX for uvx/docker servers |
| 8 | Config dir permissions | 15min | Docker deployments |

**Total: ~2h30 for full cross-platform.**

---

## CI Matrix (V1.1)

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [18, 20, 22, 24]
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: ${{ matrix.node }} }
  - run: npm ci
  - run: npm test
  - run: npm run build:all
```

This catches platform issues automatically on every push.
