## Problem

The QualificationTab component exists but hasn't been verified to work end-to-end with the v2 wizard flow. Key concerns:

- Suite generation may not work with current agent state structure
- Test execution might fail with v2 wizard-generated agents
- Results display might not handle new trace/pipeline data format
- Patch application could conflict with v2 agent schema
- Backend `/api/qualification/*` endpoints need verification with current stack

## Proposed Solution

Comprehensive end-to-end testing and verification of the qualification system:

1. **Test Suite Generation**: Verify mission brief → test case creation works
2. **Test Execution**: Confirm agent responses and LLM judging pipeline
3. **Results Display**: Ensure scoring and pass/fail display works correctly
4. **Patch Application**: Verify agent config updates and version management
5. **Schema Compatibility**: Ensure qualification works with v2 wizard agent structure

## Types & Interfaces

Backend APIs to verify:
```typescript
POST /api/qualification/generate-suite
POST /api/qualification/run
POST /api/qualification/apply-patches
GET /api/qualification/:agentId/history
```

Frontend integration:
```typescript
interface QualificationSuite {
  testCases: TestCase[];
  scoringDimensions: ScoringDimension[];
  passThreshold: number;
}

interface QualificationRun {
  results: TestResult[];
  overallScore: number;
  passed: boolean;
  suggestedPatches?: AgentPatch[];
}
```

## Behaviors

1. **Suite Generation**: Enter mission brief → LLM generates test cases + scoring criteria
2. **Test Execution**: Run agent against test cases → LLM judge scores responses
3. **Results Analysis**: Display per-test scores, overall pass/fail, improvement suggestions
4. **Patch Review**: Present suggested changes → user selects → apply to agent config
5. **Version Management**: Successful patches create new version checkpoint

## Edge Cases

- Handle qualification with agents that have no knowledge sources
- Graceful handling of LLM judge failures or inconsistent scoring
- Handle very long agent responses that exceed token limits
- Manage qualification state when user navigates away mid-run
- Handle patch conflicts with concurrent agent edits
- Deal with malformed test cases from LLM generation

## Acceptance Criteria

- [ ] Mission brief input generates valid test suite
- [ ] Test suite shows editable test cases and scoring criteria
- [ ] "Run Qualification" executes all tests and shows progress
- [ ] Results display with per-test breakdown and overall score
- [ ] Suggested patches appear when qualification identifies issues
- [ ] Patch application updates agent config and creates version
- [ ] Failed qualification runs show helpful error messages
- [ ] Qualification history shows previous runs and outcomes

## Files to Modify

- Verify `src/tabs/QualificationTab.tsx` works with current wizard state
- Check backend integration with `/api/qualification/*` endpoints
- Ensure compatibility with current agent schema and stores
- Test with agents created through v2 wizard generation flow
- Verify version management integration with qualification patches

## Estimate

**Medium (M)** - Testing and verification work, may require fixes to qualification pipeline integration with v2 wizard schema