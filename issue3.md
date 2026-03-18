## Problem

The Agent Library lacks essential management capabilities:
- No search functionality to find agents by name or description
- No delete/remove functionality for cleaning up old agents
- No clone/duplicate feature for creating variations of existing agents
- No sorting options (by name, last modified, creation date)
- Library becomes unusable as agent count grows

## Proposed Solution

Enhance AgentLibrary with full CRUD and discovery capabilities:

1. **Search & Filter**: Search input that filters agents by name/description in real-time
2. **Delete with Confirmation**: Delete button with confirmation modal to prevent accidents
3. **Clone/Duplicate**: Copy existing agent and rename for iterative development
4. **Sorting Options**: Sort by last modified, name, or creation date
5. **Visual Improvements**: Better use of available space and information density

## Types & Interfaces

From `src/components/AgentLibrary.tsx`:
```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  tags: string[];
  updatedAt: string;
}
```

New interfaces needed:
```typescript
interface LibraryState {
  searchQuery: string;
  sortBy: 'name' | 'updatedAt' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

interface AgentActions {
  onDelete: (agentId: string) => Promise<void>;
  onClone: (agentId: string) => Promise<void>;
  onSearch: (query: string) => void;
}
```

## Behaviors

1. **Search**: Real-time filtering with debouncing (300ms), case-insensitive matching against name + description
2. **Delete**: Click delete → confirmation modal → DELETE /api/agents/:id → remove from list
3. **Clone**: Click duplicate → load agent → clear ID → prompt for new name → redirect to editor
4. **Sorting**: Click column headers or dropdown to change sort order, persist preference in localStorage

## Edge Cases

- Handle empty search results with helpful message
- Prevent deletion of currently loaded agent
- Handle clone when agent has large knowledge sources (show progress)
- Graceful handling of API errors during delete/clone operations
- Search should work across paginated results (if pagination added later)
- Handle special characters in search queries

## Acceptance Criteria

- [ ] Search input filters agents in real-time
- [ ] Delete button with "Are you sure?" confirmation modal
- [ ] Clone button creates duplicate agent with "(Copy)" suffix
- [ ] Sorting dropdown with name/date options
- [ ] Empty search state with clear message
- [ ] Successful operations show success toast notifications
- [ ] Failed operations show error messages
- [ ] Delete removes agent from list without refresh

## Files to Modify

- `src/components/AgentLibrary.tsx` - Add search, delete, clone UI and logic
- Backend `DELETE /api/agents/:id` - Should already exist
- Add confirmation modal component (or use existing modal system)
- Update AgentLibraryProps interface for new callbacks

## Estimate

**Medium (M)** - UI enhancements with API integration, requires careful UX for destructive actions