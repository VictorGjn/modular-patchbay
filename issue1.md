## Problem

The current knowledge source configuration UX is confusing for users:
- Depth slider has no visible labels showing what percentages mean (Full/Detail/Summary/Headlines/Mention)
- Knowledge type selector is not prominently visible per source
- Token count impact at current depth is not shown
- Users can't understand what depth setting they've chosen or its effects

## Proposed Solution

1. Add visible depth level labels next to the slider showing current selection
2. Make knowledge type selector more prominent in the source panels
3. Display calculated token count for each source at current depth
4. Add tooltips explaining what each depth level includes

## Types & Interfaces

From `src/store/knowledgeBase.ts`:
```typescript
export type DepthLevel = 'Full' | 'Detail' | 'Summary' | 'Headlines' | 'Mention';
export const DEPTH_LEVELS: { label: DepthLevel; pct: number }[];
export type KnowledgeType = 'ground-truth' | 'signal' | 'evidence' | 'framework' | 'hypothesis' | 'guideline';
export const KNOWLEDGE_TYPES: Record<KnowledgeType, { label: string; color: string; icon: string; instruction: string }>;
```

## Behaviors

1. **Depth Labels**: When user moves slider, label updates in real-time showing current depth level
2. **Token Display**: Calculate and show tokens using `getChannelTokens()` logic from LocalFilesPanel
3. **Knowledge Type Visibility**: Move type selector to prominent position, show current selection with color/icon
4. **Tooltip Guidance**: Explain what content is included at each depth level

## Edge Cases

- Handle sources without indexed tokens (show baseTokens estimate)
- Graceful handling when tree indexes not yet available
- Ensure labels update immediately on slider changes without lag
- Handle very long source names in compact UI space

## Acceptance Criteria

- [ ] Depth slider shows current level label (e.g., "Detail (75%)")
- [ ] Knowledge type selector is prominently displayed per source
- [ ] Token count shows for each source: "~1.2k tokens at Summary level"
- [ ] Tooltips explain what each depth level includes
- [ ] Changes are visually immediate without requiring refresh
- [ ] Works for both LocalFilesPanel and GitRepoPanel

## Files to Modify

- `src/panels/knowledge/LocalFilesPanel.tsx`
- `src/panels/knowledge/GitRepoPanel.tsx`
- Update depth label logic (already exists as `getDepthLabel()`)
- Enhance token calculation display logic

## Estimate

**Medium (M)** - UI enhancement affecting multiple panels, requires careful UX design