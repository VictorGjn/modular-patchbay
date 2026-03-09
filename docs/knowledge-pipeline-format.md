# Knowledge Pipeline Format Specification

> This document is the canonical reference for the output format of Modular's repository indexing pipeline.
> If the format changes, this doc MUST be updated. Any agent or human wanting to understand what the pipeline produces should start here.

## Pipeline Overview

```
Input: GitHub URL or local path
  → git clone --depth 1
    → scanRepository()
      → 1. Walk: all code files (<100KB, known extensions)
      → 2. Categorization: component | store | service | route | util | test | config | type | style
      → 3. Symbol extraction: imports, exports, functions, classes, types
      → 4. Module discovery: grouping by parent directory
      → 5. Feature clustering: grouping by import graph connectivity
      → 6. Convention detection: naming patterns, test co-location, barrel files
      → 7. Stack detection: language, framework, state mgmt, styling, build tool
    → generateKnowledgeBase()
      → 00-overview.md: stack, structure, conventions, feature list
      → 01-feature.md ... N-feature.md: per feature cluster
    → contentStore: JSON persisted to ~/.modular-studio/content/
```

## Output Document Structure

Each feature document follows this heading hierarchy. Heading depth maps to the depth mixer levels:

| Heading Depth | Depth Level | Contains |
|---|---|---|
| H1 (`#`) | 0 — Mention | Feature name only |
| H2 (`##`) | 1 — Headlines | Section titles: Architecture, Key Files, Data Flow, State Management, Components |
| H3 (`###`) | 2 — Summary | Individual file entries with metadata |
| Body text | 3 — Detail | Full metadata, descriptions, inline content |
| Source code | 4 — Full | Raw file content (via `get_file_contents` tool) |

### Example Feature Document

```markdown
# Feature: Authentication                        ← H1: feature name (depth 0)

## Architecture                                   ← H2: section header (depth 1)
Authentication uses JWT tokens stored in httpOnly cookies.
Session management is handled by a Zustand store.

## Key Files                                      ← H2: section header (depth 1)

### src/services/auth/auth.service.ts             ← H3: file entry (depth 2)
- Category: service                               ← What this file DOES
- Size: 3204 bytes (~801 tokens)                  ← Token budget info
- Exports: `AuthService`, `login`, `logout`       ← Public API surface
- Types: `AuthConfig`, `SessionInfo`              ← Type contracts
- Imports: `./token-store`, `../api/client`       ← Dependencies

### src/store/auth.store.ts                       ← H3: another file
- Category: store
- Size: 1580 bytes (~395 tokens)
- Exports: `useAuthStore`
- Types: `AuthState`

## Data Flow                                      ← H2: dependency graph (depth 1)
- `src/App.tsx` → `./providers/AuthProvider`
- `src/providers/AuthProvider.tsx` → `../services/auth/auth.service`
- `src/services/auth/auth.service.ts` → `./token-store`, `../api/client`
- `src/store/auth.store.ts` → `../services/auth/auth.service`

## State Management                               ← H2: stores (depth 1)
- `useAuthStore` (auth.store.ts): login, logout, refreshSession, isAuthenticated

## Components                                     ← H2: UI surface (depth 1)
- LoginForm, SignupForm, ProtectedRoute, AuthProvider
```

## Field Semantics

### Category
Describes the **intent** of a file. An agent should use category to know WHERE to look:

| Category | Intent | When to check |
|---|---|---|
| `component` | Renders UI (JSX/TSX) | "How does X look?" |
| `store` | Manages state (Zustand, Redux, MobX) | "What state does X track?" |
| `service` | Business logic, API calls | "How does X work?" |
| `route` | HTTP endpoint or page route | "What API does X expose?" |
| `util` | Pure helper functions | "Is there a helper for X?" |
| `test` | Test files | "Is X tested?" |
| `config` | Configuration files | "How is X configured?" |
| `type` | Type definitions | "What shape does X have?" |
| `style` | CSS/SCSS/styled | "How is X styled?" |

### Exports & Types
These represent the **public API surface** of a file. An agent can answer "what does file X export?" without ever reading the file.

### Data Flow
The import graph between files within a feature. Each line is:
```
source_file → imported_module
```
This is a **dependency graph without reading files**. If an agent wants to know what `App.tsx` depends on, the answer is already here.

### Size & Tokens
- **Size**: file size in bytes
- **Tokens**: estimated token count (~4 chars/token)
- Used for budget decisions: the depth mixer uses these to stay within token limits

## Content Store Format

Persisted as JSON in `~/.modular-studio/content/{sourceId}.json`:

```typescript
interface StoredContent {
  sourceId: string;        // e.g. "github-user-repo" or "local-path"
  name: string;            // Repository name
  overviewMarkdown: string; // 00-overview.md content
  knowledgeDocs: Record<string, string>; // filename → markdown content
  repoMeta: {
    name: string;
    stack: StackInfo;       // { language, framework, stateManagement, styling, testing, buildTool, packageManager }
    totalFiles: number;
    totalTokens: number;
    baseUrl?: string;       // e.g. "https://github.com/user/repo/blob/main/"
    features: { name: string; keyFiles: string[] }[];
  };
}
```

## Orientation Block

At runtime, the pipeline generates an `<orientation>` block in the system prompt containing:
- Repository name, stack, and base URL
- Feature list
- Condensed file tree (top directories → child entries)
- Usage instructions for the agent

The orientation block is a **lookup table**, not the data itself. The agent should:
1. Check orientation for structure
2. Read compressed docs for details
3. Use `get_file_contents` only when actual source code is needed

## Base URL Convention

For GitHub repos: `https://github.com/{owner}/{repo}/blob/{branch}/`
For local repos: no base URL (use tool calls instead)

To build a file link: `{baseUrl}{filePath}` — agents should NEVER invent URLs.

## Versioning

This is format **v1**. Breaking changes to field names, heading structure, or metadata format require a version bump and migration path.
