## Problem

The Review tab sections (Persona, Constraints, Objectives) lack the ✨ Refine button that exists in AgentBuilder. Users can't get AI-assisted improvements for specific fields after agent generation:

- No per-field refinement in PersonaSection
- No constraint optimization in ConstraintsSection  
- No objective refinement in ObjectivesSection
- Users must manually edit or go back to AgentBuilder for AI help

This creates an inconsistent UX and limits iterative improvement workflows.

## Proposed Solution

Add ✨ Refine buttons to all relevant fields in Review tab sections, using the existing `refineField()` utility:

1. **PersonaSection**: Refine button for persona text field
2. **ConstraintsSection**: Refine button for custom constraints text
3. **ObjectivesSection**: Refine buttons for scope definition and primary objective
4. **Consistent UX**: Same styling and behavior as AgentBuilder refinement

## Types & Interfaces

From `src/utils/refineInstruction.ts`:
```typescript
export type RefineMode = 'full' | 'persona' | 'constraints' | 'scope';
export async function refineField(field: RefineMode, userInput: string): Promise<string | RefinedAgent>;
```

From Review tab sections:
```typescript
// PersonaSection - refine persona field
// ConstraintsSection - refine customConstraints field  
// ObjectivesSection - refine scopeDefinition and primary objective
```

Store integration:
```typescript
// useInstructionStore actions needed:
// setPersona, setCustomConstraints, setScopeDefinition, setPrimaryObjective
```

## Behaviors

1. **Refine Button**: Click ✨ → loading state → call `refineField()` → update store
2. **Loading State**: Show spinner, disable button during API call
3. **Error Handling**: Show error message if refinement fails
4. **Success State**: Apply refined text to field, brief success indication
5. **Field Mapping**:
   - Persona field → `refineField('persona', currentPersona)`
   - Custom constraints → `refineField('constraints', currentConstraints)`
   - Scope definition → `refineField('scope', currentScope)`

## Edge Cases

- Handle empty/whitespace-only fields (show appropriate error)
- Prevent multiple simultaneous refinements on same field
- Handle provider configuration errors gracefully
- Preserve user text if refinement fails or is cancelled
- Handle very long field content (API token limits)

## Acceptance Criteria

- [ ] PersonaSection has ✨ Refine button next to persona text field
- [ ] ConstraintsSection has ✨ Refine button next to custom constraints field
- [ ] ObjectivesSection has ✨ Refine button next to scope definition field
- [ ] ObjectivesSection has ✨ Refine button next to primary objective field
- [ ] Click Refine → loading → field updated with AI-improved version
- [ ] Error handling shows helpful messages for refinement failures
- [ ] Visual consistency with AgentBuilder refine buttons
- [ ] No duplicate refinements allowed while one is in progress

## Files to Modify

- `src/tabs/ReviewTab/PersonaSection.tsx` - Add refine button to persona field
- `src/tabs/ReviewTab/ConstraintsSection.tsx` - Add refine button to custom constraints
- `src/tabs/ReviewTab/ObjectivesSection.tsx` - Add refine buttons to scope and primary objective
- Import `refineField` from `src/utils/refineInstruction.ts`
- Use existing button styling from AgentBuilder refine implementation

## Estimate

**Small (S)** - UI enhancement using existing utility function, straightforward implementation across 3 components