# E2E Functional Audit Tests

**Issue:** #132
**Branch:** `test/e2e-functional-audit`
**Purpose:** Map what actually works, pipeline by pipeline.

## Specs

| Spec | Pipeline tested | LLM needed? |
|------|----------------|-------------|
| `knowledge-pipeline.spec.ts` | source → index → tree → review | No |
| `metaprompt-generate.spec.ts` | description → 7 phases → config | Yes (degrades gracefully) |
| `agent-export.spec.ts` | config → save → load → export | No |
| `qualification-flow.spec.ts` | generate suite → run → patches | Yes (degrades gracefully) |
| `memory-pipeline.spec.ts` | facts → storage → retrieval | Partial (extract/llm needs LLM) |
| `connector-auth.spec.ts` | auth → fetch for GitHub/Notion/Slack | No (tests error handling) |
| `mcp-lifecycle.spec.ts` | add → connect → tools → disconnect | No |
| `graph-pipeline.spec.ts` | scan → build → query → pack | No |

## Running

```bash
# All functional tests
npx playwright test tests/e2e/functional/

# Single spec
npx playwright test tests/e2e/functional/mcp-lifecycle.spec.ts

# With UI (headed)
npx playwright test tests/e2e/functional/ --headed
```

## Output

After running, generate the audit report:
```
reports/e2e-functional-audit.md
```

Each test documents: PASS / FAIL / SKIP with the exact failure point.
Tests that SKIP mean the backend is unavailable (not a failure).
Tests that FAIL document the exact broken pipeline step.
