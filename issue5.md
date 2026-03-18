## Problem

The Describe tab lacks contextual hints to help users connect relevant knowledge sources while writing their agent descriptions. The `getGhostSuggestions()` utility exists but isn't wired into the v2 wizard UI:

- No contextual suggestions appear while typing
- Users don't discover relevant knowledge sources during agent creation
- Missing opportunity to guide users toward helpful connections
- Ghost suggestions exist but only used in legacy components

## Proposed Solution

Wire ghost suggestions into the DescribeTab with polished UX:

1. **Trigger Logic**: Show suggestions after 50+ characters typed in description
2. **Debouncing**: Wait 500ms after user stops typing to avoid flickering
3. **UI Design**: Display as clickable pills/chips below textarea
4. **Action**: Clicking suggestion navigates to Knowledge tab and highlights source
5. **Smart Hiding**: Hide suggestions when Knowledge tab is already configured

## Types & Interfaces

From `src/utils/ghostSuggestions.ts`:
```typescript
interface GhostSuggestion {
  source: KnowledgeSource;
  reason: string;
}

export function getGhostSuggestions(
  prompt: string, 
  activeChannels: ChannelConfig[], 
  maxSuggestions = 3
): GhostSuggestion[];
```

UI State needed:
```typescript
interface GhostState {
  suggestions: GhostSuggestion[];
  loading: boolean;
  visible: boolean;
  debounceTimer?: NodeJS.Timeout;
}
```

## Behaviors

1. **Text Analysis**: On text change, debounce 500ms then call `getGhostSuggestions()`
2. **Suggestion Display**: Show up to 3 suggestions as pills with icons and reasons
3. **Click Action**: Navigate to Knowledge tab + scroll to suggested source
4. **Auto-Hide**: Hide suggestions if user already has 3+ knowledge sources connected
5. **Persistence**: Remember dismissed suggestions for current session

## Edge Cases

- Handle rapid typing without overwhelming the suggestion system
- Graceful handling when knowledge sources aren't yet loaded
- Clear suggestions when user clears the text input
- Handle navigation when Knowledge tab has errors/loading states
- Don't show suggestions for sources already connected
- Handle case where suggested source no longer exists

## Acceptance Criteria

- [ ] Suggestions appear after 50+ characters typed with 500ms debounce
- [ ] Suggestions display as clickable pills below textarea
- [ ] Pills show source name and reason (e.g., "Mentions 'fleet dashboard'")
- [ ] Clicking suggestion navigates to Knowledge tab
- [ ] Suggestions automatically hide when user has 3+ sources connected
- [ ] No suggestions shown during suggestion loading state
- [ ] Suggestions clear when user deletes text below threshold
- [ ] Visual design matches overall v2 wizard aesthetic

## Files to Modify

- `src/tabs/DescribeTab.tsx` - Add ghost suggestions UI and logic
- Wire `getGhostSuggestions()` from `src/utils/ghostSuggestions.ts`
- Use existing `useConsoleStore` to check active channels
- Add navigation logic to switch to Knowledge tab
- Style suggestion pills consistently with design system

## Estimate

**Small (S)** - UI integration of existing utility function, straightforward debouncing and navigation logic