# Contributing to Modular

## Engineering Guidelines

The following conventions apply to all contributions:

### Code Quality
- **No commented-out code** — dead code must be removed, not hidden
- **DRY** — extract common functionality, avoid copy-paste
- **KISS** — simple, understandable solutions over clever ones
- **Continuous refactoring** — clean as you go (boy scout rule)

### Commits
- **Conventional Commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `chore:`, `test:`, `perf:`
- **Commit related changes** — one logical change per commit
- **Commit often** — small, granular commits
- **Don't commit half-done work** — only commit completed logical components
- **Test before you commit** — `npm run build` must pass

### Branches
- `feature/*` — new features
- `fix/*` — bug fixes
- `hotfix/*` — production fixes

### Pull Requests
- **Squash-and-merge** strategy
- PR title follows conventional commit format
- Include Problem / Solution description
- Delete branch after merge

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # TypeScript check + Vite build
npx tsc --noEmit # Type check only
```

## Architecture

```
src/
├── components/     # UI components (Topbar, ChannelStrip, etc.)
├── controls/       # Analog control components (Knob, Toggle, LED, etc.)
├── store/          # Zustand state management
├── utils/          # Utility functions
└── styles/         # Global CSS
```
