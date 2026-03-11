# Engineering Guidelines — Modular Studio

## Core Principles

| Principle | Rule |
|-----------|------|
| **SRP** | Single Responsibility — each function/class does ONE thing |
| **DRY** | Don't Repeat Yourself — extract duplicates, single source of truth |
| **KISS** | Keep It Simple — simplest solution that works, optimize for readability |
| **YAGNI** | You Aren't Gonna Need It — don't build unused features |
| **Boy Scout** | Leave code cleaner than you found it |
| **No commented-out code** | Dead code must be removed. Version control keeps history. |
| **Continuous refactoring** | Clean as you go. Refactor before adding complexity. |

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(scope): <description>
```

| Type | Description |
|------|-------------|
| `feat` | New feature or significant change |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `docs` | Documentation changes |
| `test` | Adding or modifying tests |
| `chore` | Maintenance, deps, tooling |
| `perf` | Performance improvement |
| `style` | Formatting, no logic change |
| `build` | Build system or external deps |
| `ci` | CI configuration |
| `revert` | Reverting a previous commit |

**Do NOT extend this type list.**

Examples:
- `feat(connections): unified ConnectionPicker modal`
- `fix(chat): preserve conversation history across turns`
- `refactor(settings): merge MCP tab with consoleStore`

## Branch Naming

- `feature/*` — new functionality
- `fix/*` — bug fix
- `hotfix/*` — urgent production fix

## Pull Request Format

### Title
Follows conventional commit: `fix(chat): preserve conversation history`

### Description
```markdown
## Problem
[User/business impact, not technical detail]

## Solution
[Technical root cause + how the code changes fix it]
```

## Code Style

### TypeScript
- **No `as` casts** for data flow — use type guards or proper generics
- **No magic numbers** — use named constants
- **Max 20 lines per function** (ideally 5-10)
- **Max 3 arguments** per function
- **Guard clauses** — early returns for edge cases
- **Flat > nested** — max 2 levels of nesting

### React
- **One component per file**
- **Props interfaces** declared above the component
- **No inline styles > 3 properties** — extract to a `const styles` object or CSS
- **Theme tokens** via `useTheme()` — never hardcode colors (except `#FE5000` accent)

### Before Editing Any File
1. What imports this file? → They might break
2. What does this file import? → Interface changes
3. What tests cover this? → Tests might fail
4. Is this shared? → Multiple places affected

**Edit the file + all dependents in the SAME task.**

## Testing

- **Unit tests** for pure functions and stores
- **Integration tests** for API routes
- **Smoke test before publish**: open the app in a browser and test:
  1. Chat sends a message and gets a response
  2. Conversation history persists across turns
  3. Knowledge pipeline indexes a file
  4. MCP server connects
  5. Settings page loads without errors
  6. Export produces valid output

## Verification Before Merge

| Check | Command |
|-------|---------|
| TypeScript | `npx tsc --noEmit` |
| Tests | `npx vitest run` |
| Build | `npm run build:all` |
| Smoke | Open browser, test 6 flows above |

**All 4 checks must pass before any publish.**
