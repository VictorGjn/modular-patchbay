## Problem

Demo presets exist in `src/store/demoPresets.ts` but aren't exposed in the v2 wizard UI. New users see an empty Agent Library with only a "+ New Agent" button:

- No starter templates for common use cases
- Users must start from blank slate or know to use AgentBuilder
- Missing onboarding opportunity for showcasing platform capabilities
- Existing presets (Senior PM, Feedback Manager, Competitor Scraper) are unused

## Proposed Solution

Display demo presets as template cards alongside saved agents in the AgentLibrary:

1. **Template Section**: Show template cards with visual distinction from saved agents
2. **Visual Design**: Lighter border, "Template" badge, different styling
3. **Click Action**: Load preset data → hydrate stores → navigate to editor
4. **Mixed Display**: Templates and saved agents in same grid with clear distinction

## Types & Interfaces

From `src/store/demoPresets.ts`:
```typescript
export const DEMO_PRESETS: Record<string, DemoPresetData> = {
  'senior-pm': SENIOR_PM_PRESET,
  'feedback-manager': FEEDBACK_MANAGER_PRESET,
  'competitor-scraper': COMPETITOR_SCRAPER_PRESET,
};

interface DemoPresetData {
  agentMeta: {
    name: string;
    description: string;
    icon: string;
    category: string;
    tags: string[];
    avatar: string;
  };
  instructionState: { /* full instruction config */ };
  // ... other preset properties
}
```

UI extensions needed:
```typescript
interface TemplateCard {
  id: string;
  type: 'template' | 'saved';
  name: string;
  description: string;
  avatar: string;
  tags: string[];
}
```

## Behaviors

1. **Template Display**: Show template cards with "Template" badge and distinct styling
2. **Load Template**: Click template → call `hydrateFromPreset(preset)` → redirect to editor
3. **Mixed Grid**: Templates appear alongside saved agents, sorted templates first
4. **Hydration**: Load all preset data into relevant stores (agentMeta, instructions, workflow, etc.)
5. **Clear State**: Reset agent ID to create new agent from template

## Edge Cases

- Handle cases where both templates and saved agents are present
- Ensure template loading doesn't conflict with existing agent state
- Handle preset data that might have outdated schema
- Graceful fallback if preset hydration fails
- Prevent accidental overwriting of currently loaded agent

## Acceptance Criteria

- [ ] Demo presets appear as template cards in AgentLibrary
- [ ] Template cards have distinct visual styling (lighter border, "Template" badge)
- [ ] Clicking template loads preset data and navigates to editor
- [ ] Templates appear before saved agents in the grid
- [ ] Template loading clears any existing agent state
- [ ] Failed template loads show helpful error messages
- [ ] Template cards show appropriate icons and descriptions
- [ ] New users see starter options instead of empty library

## Files to Modify

- `src/components/AgentLibrary.tsx` - Add template rendering and load logic
- Import `DEMO_PRESETS` from `src/store/demoPresets.ts`
- Add template card styling with visual distinction
- Create `hydrateFromPreset()` function or use existing hydration utilities
- Update grid layout to handle mixed content types

## Estimate

**Small (S)** - UI enhancement using existing preset data, straightforward template loading and display logic