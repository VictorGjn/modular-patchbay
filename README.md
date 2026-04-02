# modular-patchbay (modular-studio)

> ⚠️ **This repo has moved to the [modular monorepo](https://github.com/VictorGjn/modular).**
>
> The Studio visual IDE now lives at `apps/studio/` in the unified monorepo.

## New location

**Repo**: [github.com/VictorGjn/modular](https://github.com/VictorGjn/modular)  
**Path**: `apps/studio/`

## Why?

Studio and Crew share significant code — types, providers, worktree manager, context engine. The monorepo eliminates duplication via shared packages:

| Package | What's shared |
|---------|---------------|
| `@modular/core` | Types, Zod schemas, DepthLevel, Fact, Agent types |
| `@modular/providers` | StudioProvider interface, MockProvider |
| `@modular/worktree` | Git worktree isolation (was literally forked) |
| `@modular/context` | SystemPromptBuilder, ReactiveCompaction, ContextCollapse |
| `@modular/harness` | FactBus, Mailbox, HookRunner, BudgetGuard, Presets |
| `@modular/ui` | Shared design tokens + React components |

## Quick start (new repo)

```bash
git clone https://github.com/VictorGjn/modular.git
cd modular
bun install
bun run build
cd apps/studio && npm run dev
```

This repo is archived. All new development happens in the monorepo.
