## Problem

The version dropdown shows timestamps but provides no visibility into what actually changed between versions:

- Users can see when versions were created but not why
- No way to understand what was modified between v0.1.0 and v0.2.0  
- Difficult to track the evolution of agent configuration
- Cannot review impact of qualification patches or manual edits
- Version restoration is blind without seeing diff preview

## Proposed Solution

Add version comparison functionality with clear diff visualization:

1. **Compare Button**: Add "Compare" option in version dropdown
2. **Version Selector**: Choose two versions to compare (A vs B)
3. **Diff Display**: Show what changed in agent meta, constraints, workflow steps
4. **Change Categories**: Group changes by type (persona, constraints, knowledge, tools)
5. **Visual Diff**: Color-coded additions/deletions/modifications

## Types & Interfaces

Version comparison data:
```typescript
interface VersionDiff {
  versionA: string;
  versionB: string;
  changes: ChangeSet[];
  summary: DiffSummary;
}

interface ChangeSet {
  category: 'meta' | 'persona' | 'constraints' | 'workflow' | 'knowledge' | 'tools';
  field: string;
  type: 'added' | 'removed' | 'modified';
  before?: any;
  after?: any;
  description: string;
}

interface DiffSummary {
  totalChanges: number;
  categoryCounts: Record<string, number>;
  changeTypes: Record<string, number>;
}
```

## Behaviors

1. **Version Selection**: Choose two versions from dropdown with clear labels
2. **Diff Calculation**: Deep compare agent state objects between versions
3. **Change Categorization**: Group changes by logical sections (persona, constraints, etc.)
4. **Visual Presentation**: Show added (green), removed (red), modified (orange) changes
5. **Navigation**: Click version in dropdown → "Compare with..." submenu

## Edge Cases

- Handle comparison between versions with different schema versions
- Graceful handling of corrupted or missing version data
- Handle large diffs that might overwhelm the UI
- Support comparison when one version has nested data the other lacks
- Handle versions created during qualification vs manual edits (different change patterns)
- Empty diffs when versions are identical

## Acceptance Criteria

- [ ] Version dropdown has "Compare" option or "Compare with..." submenu
- [ ] Two-version selector shows version numbers and timestamps
- [ ] Diff display shows changes grouped by category (meta, persona, constraints, etc.)
- [ ] Visual indicators for added (green), removed (red), modified (orange) changes
- [ ] Summary shows total changes and breakdown by category
- [ ] Large diffs are paginated or collapsible by section
- [ ] "No changes" state for identical versions
- [ ] Comparison works with versions created by different methods (manual, qualification, generation)

## Files to Modify

- `src/components/VersionDropdown.tsx` - Add compare functionality to version selector
- Create `src/utils/versionDiff.ts` - Version comparison logic
- Create diff visualization component (or enhance existing modal)
- Backend: May need `GET /api/agents/:id/versions/:versionA/compare/:versionB` endpoint
- Integrate with existing version management in `src/store/versionStore.ts`

## Estimate

**Medium (M)** - New feature requiring diff calculation logic, UI design for comparison view, and integration with version system