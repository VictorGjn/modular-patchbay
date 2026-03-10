# Killed Runtime Features — Archive for Future Rebuild

Removed: 2026-03-10
Reason: Over-engineered for the core use case (shared-instruction team of N agents).
These can be rebuilt incrementally when needed.

---

## 1. Contract Extraction Pipeline

**What it did:** Before running agents, extracted TypeScript interfaces/types/DTOs from a "feature spec" using an LLM call. Injected these as `contract` type facts into agent context.

**Files:**
- `teamRunner.ts` → `extractContractsFromSpec()` function
- `runtime.ts` route → `POST /extract-contracts` endpoint
- `RuntimePanel.tsx` → "Extract Contracts" stage in pipeline visualization

**Key types:**
```typescript
interface ExtractedFact {
  key: string;
  value: string;
  epistemicType: 'observation' | 'inference' | 'decision' | 'hypothesis' | 'contract';
  confidence: number;
  source: string;
}
```

**When to rebuild:** When Modular targets code-generation teams where agents need shared type definitions (e.g., frontend agent + backend agent building the same feature).

---

## 2. Worktree Management

**What it did:** For each agent with a `repoUrl`, cloned the repo, created a git worktree on a unique branch, tree-indexed it into markdown, and gave the agent both the indexed knowledge AND a working directory to edit files.

**Files:**
- `server/services/worktreeManager.ts` → `prepareAgentWorktree()`
- `server/services/githubIndexer.ts` → `indexLocalRepo()` (tree-indexed markdown from repo)
- `teamRunner.ts` → Step 2 (worktree prep loop)
- `server/routes/worktrees.ts` → REST endpoints for worktree status
- `src/components/WorktreeGraphPanel.tsx` → Visual git graph of agent branches

**Key types:**
```typescript
interface AgentWorktreeStatus {
  agentId: string;
  repoUrl: string;
  worktreePath: string;
  branch: string;
  status: 'pending' | 'ready' | 'error';
}
```

**When to rebuild:** When agents need to edit code in isolated branches and produce PRs. The worktree approach is solid — each agent gets its own branch, no conflicts.

---

## 3. Epistemic Fact Type System

**What it did:** Facts extracted from agent output were classified into 5 epistemic types with confidence scores. Each type had a color and icon. Cross-agent validation checked that backend agents published API facts and frontend agents published UI facts.

**Types:** observation (●), inference (◆), decision (■), hypothesis (▲), contract (▣)

**Files:**
- `server/services/factExtractor.ts` → LLM-based fact extraction with type classification
- `teamRunner.ts` → `validateAgentMemoryExchange()` — cross-agent fact validation
- `RuntimePanel.tsx` → `FactRow` component with colored epistemic badges

**When to rebuild:** When fact quality matters more than fact quantity. The confidence scoring and type system add overhead but enable fact filtering (e.g., "only inject decisions with confidence > 0.8").

---

## 4. Frontend/Backend Agent Role Validation

**What it did:** `isBackendAgent()` / `isFrontendAgent()` detected agent roles by name pattern matching. After execution, validated that backend agents produced API/contract facts and frontend agents produced UI/state facts. Failed agents got `status: 'error'`.

**When to rebuild:** When building specialized code-gen teams where role-specific output quality matters.

---

## 5. Capability Matrix & Gates

**What it did:** Runtime panel showed a capability matrix (which features are available based on config). `CapabilityGate` component conditionally rendered UI based on capabilities.

**Files:**
- `src/capabilities.ts` → `getCapabilityMatrix()`
- `src/components/CapabilityMatrix.tsx` → Matrix display
- `src/components/CapabilityGate.tsx` → Conditional rendering wrapper

**When to rebuild:** When Modular has a plugin system and capabilities vary per installation.

---

## 6. RuntimeWorkspaceLayout

**What it did:** Full-page layout with sidebar navigation between Runtime, Agent Cards, Shared Facts, and Worktree views. Separate from the main Dashboard layout.

**Files:**
- `src/layouts/RuntimeWorkspaceLayout.tsx`
- `src/panels/RuntimePanel.tsx` (900+ lines)

**When to rebuild:** When runtime becomes a first-class mode with its own navigation needs. For now, runtime lives inside TestPanel.

---

## 7. Pipeline Stage Visualization

**What it did:** 3-stage progress bar (Contracts → Agents → Shared Facts) with completion indicators.

**Component:** `RuntimeStages` in `RuntimePanel.tsx`

**When to rebuild:** When the pipeline has meaningful sequential stages again.
