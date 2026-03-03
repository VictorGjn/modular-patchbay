# Agent Orchestration Spec (v0.1)

## Goal
Deliver production-oriented orchestration for a 2-agent execution flow:
- **Backend Agent** (API/data/contracts)
- **Frontend Agent** (UI integration)

Starting point: user provides a feature spec + design brief. Runtime executes both agents with shared facts and explicit contracts, then prepares a GitHub-ready delivery flow.

## Scope
In scope:
1. Spec/design ingestion
2. Two-agent team execution
3. Contract/fact exchange between agents
4. Runtime trace visibility
5. GitHub delivery checklist (branch/commit/PR format)

Out of scope:
- Full autonomous PR creation in this iteration
- Multi-team orchestration beyond 2 core agents
- New cable-based UI patterns

## Product Constraints
- Keep current card-based agent visualization
- Prioritize orchestration reliability over UI expansion
- Preserve clean-code conventions and minimal abstractions

## Inputs
### Required
- `featureSpec`: functional requirements and acceptance criteria
- `designBrief`: UX/UI guidance, constraints, edge cases

### Optional
- `repoUrl` per agent
- `repoRef` branch/tag
- `model` override

## Runtime Data Model
### Contract Fact
```ts
{
  key: string;
  value: string;
  epistemicType: 'contract';
  confidence: number;
  source?: string;
}
```

### Shared Fact
```ts
{
  key: string;
  value: string;
  epistemicType: 'observation' | 'inference' | 'decision' | 'hypothesis' | 'contract';
  confidence: number;
  source?: string; // agentId when per-agent
}
```

## Orchestration Flow
1. User submits feature spec + design brief
2. Runtime extracts contract facts
3. Backend agent runs first pass
4. Backend emits contract/output facts
5. Frontend agent consumes updated facts
6. Frontend runs implementation pass
7. Runtime performs consistency checks:
   - required contract keys present
   - no contract conflicts
   - output completeness markers
8. Runtime marks run as completed/error with trace summary

## Consistency Rules (v0.1)
- Backend must publish: `api_contract`, `data_shape`, `error_paths`
- Frontend must publish: `ui_states`, `api_bindings`, `fallback_states`
- If missing mandatory facts -> status `error`

## UI Requirements
- Agent cards show:
  - status
  - current message
  - extracted facts count
- Runtime panel shows:
  - contract facts
  - shared facts timeline
  - per-agent output summary

## GitHub Delivery Convention
### Branch format
- `feat/<scope>-backend-frontend-orchestration`

### Commit format
- `feat(runtime): ...`
- `feat(ui): ...`
- `test(runtime): ...`
- `docs(orchestration): ...`

### PR format
- Problem
- Scope
- Runtime behavior changes
- Validation (build/test/e2e)
- Risks + rollback

## Validation Gate
Before PR ready:
1. `npm run build:all`
2. `npm run test`
3. `npm run test:e2e`
4. Manual smoke:
   - run team with two agents
   - verify fact exchange
   - verify status progression

## Next Iterations
- Multi-agent dependency graph (N agents)
- Memory TTL + contradiction detection
- GitHub integration for automated PR draft
