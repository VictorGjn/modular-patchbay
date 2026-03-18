## Problem

The v2 wizard UI has replaced the old React Flow canvas layout, leaving substantial dead code in the repository:

- `src/layouts/DashboardLayout.tsx` (replaced by WizardLayout)
- `src/layouts/RuntimeWorkspaceLayout.tsx` (unused)
- All React Flow node components (11 files): AgentNode, GeneratorNode, KnowledgeNode, etc.
- Edge components: FeedbackEdge, PatchCable
- Control components: Knob, LEDIndicator, Scope, Screw, Toggle
- Legacy visualization components: AgentCard, AgentViz, JackPort

This dead code increases bundle size, confuses developers, and complicates maintenance.

## Proposed Solution

Systematic cleanup of v1 canvas-related code with proper archival:

1. **Import Analysis**: Verify no active files import the dead code
2. **Safe Deletion**: Remove only confirmed unused files
3. **Documentation**: Create `docs/ARCHIVE-V1-CANVAS.md` documenting what was removed
4. **Build Verification**: Ensure `npx vite build` passes after cleanup

## Types & Interfaces

Files to investigate for deletion:
```
src/layouts/
├── DashboardLayout.tsx (replaced by WizardLayout)
└── RuntimeWorkspaceLayout.tsx (unused)

src/nodes/ (all 11 React Flow node components)
├── AgentNode.tsx
├── AgentPreviewNode.tsx  
├── GeneratorNode.tsx
├── KnowledgeNode.tsx
├── McpNode.tsx
├── MemoryNode.tsx
├── OutputNode.tsx
├── PromptNode.tsx
├── ResponseNode.tsx
├── SkillsNode.tsx
└── WorkflowNode.tsx

src/edges/
├── FeedbackEdge.tsx
└── PatchCable.tsx

src/controls/
├── Knob.tsx
├── LEDIndicator.tsx
├── Scope.tsx
├── Screw.tsx
└── Toggle.tsx

src/components/
├── AgentCard.tsx (replaced by AgentLibrary)
├── AgentViz.tsx
├── AgentVizCircuit.tsx
├── AgentVizLayers.tsx
└── JackPort.tsx
```

## Behaviors

1. **Import Check**: Search codebase for imports of each file
2. **Conditional Deletion**: Only delete files with zero imports
3. **Documentation**: Record deleted files with rationale in archive document
4. **Build Test**: Verify application builds and runs after each deletion batch

## Edge Cases

- Some files might be imported by other dead files (delete together)
- Files might be imported dynamically (string-based imports)
- Shared utilities might be used by both dead and live code (preserve utilities)
- Type definitions might be referenced without imports
- Files might be imported in test files only

## Acceptance Criteria

- [ ] All confirmed dead files from v1 canvas system are removed
- [ ] No build errors or runtime errors after deletion
- [ ] `docs/ARCHIVE-V1-CANVAS.md` documents what was removed and why
- [ ] Files still imported by active code are preserved (with comment/issue)
- [ ] Bundle size reduction is measurable
- [ ] Git history preserves deleted code for future reference
- [ ] `npx vite build` passes successfully

## Files to Modify

**Files to DELETE** (after import verification):
- All files listed in the file structure above
- Any related test files in same directories

**Files to CREATE**:
- `docs/ARCHIVE-V1-CANVAS.md` - Documentation of removed code

**Files to CHECK**:
- Any remaining files that might import deleted components

## Estimate

**Small (S)** - Systematic cleanup task, mostly file deletion with verification steps. Low risk since these are confirmed legacy components.