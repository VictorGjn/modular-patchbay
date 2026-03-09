import { describe, it, expect } from 'vitest';
import {
  extractHeadlines,
  buildNavigationPrompt,
  assembleFromPlan,
  parseNavigationResponse,
  buildHyDEPrompt,
  shouldUseHyDE,
} from '../../src/services/treeNavigator';
import { indexMarkdown } from '../../src/services/treeIndexer';

const SAMPLE = `# Order Management

## Architecture
The order system uses a Zustand store with async actions for API calls.

It follows the standard pattern: Component → Store → API → Database.

## Data Flow
### Create Order
User fills form → validateOrder() → store.createOrder() → POST /api/orders → optimistic update.

### Update Order
OrderRow click → modal opens → store.updateOrder() → PATCH /api/orders/:id → refetch list.

## Key Files
- src/store/orderStore.ts — state + actions + selectors
- src/components/OrderList.tsx — paginated table with filters
- src/components/OrderForm.tsx — create/edit form with validation
- src/api/orders.ts — API client

## Conventions
Uses the shared ErrorBoundary for all order pages. Toast notifications via useToast().

## Edge Cases
Empty state shows illustration. Pagination resets on filter change. Concurrent edits show conflict modal.
`;

function buildIndex() {
  return indexMarkdown('order-management.md', SAMPLE);
}

describe('extractHeadlines', () => {
  it('produces a compact tree view with token counts', () => {
    const idx = buildIndex();
    const headlines = extractHeadlines(idx);
    expect(headlines).toContain('Architecture');
    expect(headlines).toContain('Data Flow');
    expect(headlines).toContain('Key Files');
    expect(headlines).toContain('tokens');
  });

  it('shows nodeIds for selection', () => {
    const idx = buildIndex();
    const headlines = extractHeadlines(idx);
    expect(headlines).toMatch(/\[n\d+-\d+\]/); // [n1-1] etc
  });

  it('includes first sentence hints', () => {
    const idx = buildIndex();
    const headlines = extractHeadlines(idx);
    expect(headlines).toContain('Zustand store');
  });
});

describe('buildNavigationPrompt', () => {
  it('includes task and budget', () => {
    const idx = buildIndex();
    const headlines = extractHeadlines(idx);
    const prompt = buildNavigationPrompt([headlines], {
      task: 'Add a date range filter to the order list',
      tokenBudget: 2000,
    });
    expect(prompt).toContain('Add a date range filter');
    expect(prompt).toContain('2000');
    expect(prompt).toContain('Architecture');
  });

  it('includes existing context note', () => {
    const prompt = buildNavigationPrompt(['...'], {
      task: 'test',
      tokenBudget: 1000,
      existingContext: 'Already loaded: OrderList component',
    });
    expect(prompt).toContain('Already loaded: OrderList component');
  });
});

describe('parseNavigationResponse', () => {
  it('parses valid JSON array', () => {
    const response = `Here are my selections:
\`\`\`json
[
  { "nodeId": "n1-2", "depth": 0, "reason": "Need full data flow", "priority": 0 },
  { "nodeId": "n1-1", "depth": 2, "reason": "Architecture overview", "priority": 1 }
]
\`\`\``;
    const selections = parseNavigationResponse(response);
    expect(selections).toHaveLength(2);
    expect(selections[0].nodeId).toBe('n1-2');
    expect(selections[0].depth).toBe(0);
    expect(selections[0].priority).toBe(0);
  });

  it('handles raw JSON without code blocks', () => {
    const selections = parseNavigationResponse('[{"nodeId":"n1-0","depth":1}]');
    expect(selections).toHaveLength(1);
    expect(selections[0].priority).toBe(2); // default
  });

  it('clamps depth to 0-4', () => {
    const selections = parseNavigationResponse('[{"nodeId":"n1-0","depth":99}]');
    expect(selections[0].depth).toBe(4);
  });

  it('returns empty on invalid input', () => {
    expect(parseNavigationResponse('no json here')).toEqual([]);
    expect(parseNavigationResponse('{"not":"array"}')).toEqual([]);
  });
});

describe('assembleFromPlan', () => {
  it('assembles content from selected branches', () => {
    const idx = buildIndex();
    const result = assembleFromPlan([idx], {
      source: 'order-management.md',
      selections: [
        { nodeId: 'n2-3', depth: 0, priority: 0 }, // Create Order — full
        { nodeId: 'n1-1', depth: 2, priority: 1 }, // Architecture — summary
      ],
      totalTokens: 500,
      taskRelevance: 'Need data flow for adding filters',
    });

    expect(result.tokens).toBeGreaterThan(0);
    expect(result.content).toContain('Create Order');
    expect(result.breakdown).toHaveLength(2);
  });

  it('orders sections by priority', () => {
    const idx = buildIndex();
    const result = assembleFromPlan([idx], {
      source: 'order-management.md',
      selections: [
        { nodeId: 'n1-1', depth: 2, priority: 2 }, // Architecture — low priority
        { nodeId: 'n2-3', depth: 0, priority: 0 }, // Create Order — high priority
      ],
      totalTokens: 500,
      taskRelevance: 'test',
    });

    // Critical (priority 0) should come before helpful (priority 2)
    expect(result.breakdown[0].nodeId).toBe('n2-3');
    expect(result.breakdown[1].nodeId).toBe('n1-1');
  });

  it('handles budget overflow by truncating content', () => {
    const idx = buildIndex();
    const allNodes = idx.root.children[0].children;
    const result = assembleFromPlan([idx], {
      source: 'order-management.md',
      selections: allNodes.map(n => ({ nodeId: n.nodeId, depth: 0, priority: 0 })),
      totalTokens: 20,
      taskRelevance: 'test',
    });
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('handles empty tree (no children)', () => {
    const emptyIdx = indexMarkdown('empty.md', '');
    const headlines = extractHeadlines(emptyIdx);
    expect(typeof headlines).toBe('string');
  });

  it('handles single-node tree', () => {
    const singleIdx = indexMarkdown('single.md', '# Just One Heading\n\nSome body text here.');
    const headlines = extractHeadlines(singleIdx);
    expect(headlines).toContain('Just One Heading');

    const prompt = buildNavigationPrompt([headlines], { task: 'test', tokenBudget: 500 });
    expect(prompt).toContain('Just One Heading');
  });

  it('skips nodes not found', () => {
    const idx = buildIndex();
    const result = assembleFromPlan([idx], {
      source: 'test',
      selections: [
        { nodeId: 'nonexistent', depth: 0, priority: 0 },
      ],
      totalTokens: 0,
      taskRelevance: 'test',
    });
    expect(result.breakdown).toHaveLength(0);
  });
});

describe('buildHyDEPrompt', () => {
  it('includes the user query', () => {
    const query = 'How do I implement user authentication with JWT tokens?';
    const prompt = buildHyDEPrompt(query);

    expect(prompt).toContain('How do I implement user authentication with JWT tokens?');
    expect(prompt).toContain('hypothetical');
    expect(prompt).toContain('documentation');
    expect(prompt).toContain('code examples');
  });

  it('asks for comprehensive documentation', () => {
    const query = 'Database migration patterns';
    const prompt = buildHyDEPrompt(query);

    expect(prompt).toContain('Implementation details');
    expect(prompt).toContain('Configuration options');
    expect(prompt).toContain('best practices');
  });

  it('handles queries with special characters and symbols', () => {
    const query = 'How to handle <XML> & JSON parsing with "quotes" & regex /patterns/?';
    const prompt = buildHyDEPrompt(query);

    expect(prompt).toContain('<XML>');
    expect(prompt).toContain('"quotes"');
    expect(prompt).toContain('/patterns/');
    expect(prompt).toContain('&');
    expect(prompt).toContain('?');
  });

  it('handles very long queries', () => {
    const longQuery = 'How to implement a comprehensive user authentication system with JWT tokens refresh token rotation OAuth2 integration social login support multi-factor authentication password reset email verification account lockout rate limiting session management and audit logging';
    const prompt = buildHyDEPrompt(longQuery);

    expect(prompt).toContain(longQuery);
    expect(prompt).toContain('hypothetical');
    expect(prompt).toContain('documentation');
  });

  it('handles empty and whitespace queries', () => {
    expect(buildHyDEPrompt('')).toContain('hypothetical');
    expect(buildHyDEPrompt('   ')).toContain('hypothetical');
    expect(buildHyDEPrompt('\n\t')).toContain('hypothetical');
  });
});

describe('shouldUseHyDE', () => {
  it('returns false for short queries', () => {
    expect(shouldUseHyDE('hello')).toBe(false);
    expect(shouldUseHyDE('fix bug')).toBe(false);
    expect(shouldUseHyDE('short query here')).toBe(false);
    expect(shouldUseHyDE('this is a nine word query test')).toBe(false);
  });

  it('returns true for long queries', () => {
    expect(shouldUseHyDE('this is a very long query that has more than ten words in it')).toBe(true);
    expect(shouldUseHyDE('How do I implement user authentication with JWT tokens and refresh token rotation?')).toBe(true);
    expect(shouldUseHyDE('I need to understand the complete database migration process including rollbacks and schema versioning')).toBe(true);
  });

  it('handles edge case of exactly 10 words', () => {
    expect(shouldUseHyDE('this query has exactly ten words in it today now')).toBe(true);
  });

  it('handles boundary cases around 10 words', () => {
    // Exactly 9 words - should be false
    expect(shouldUseHyDE('this query has exactly nine words in it now')).toBe(false);

    // Exactly 10 words - should be true
    expect(shouldUseHyDE('this query has exactly ten words in it right now')).toBe(true);

    // Exactly 11 words - should be true
    expect(shouldUseHyDE('this query has exactly eleven words in it right now here')).toBe(true);
  });

  it('handles queries with extra whitespace and punctuation', () => {
    // Test with extra spaces (count actual words)
    const query1 = '  this   query  has exactly ten words   in  it now  ';
    const words1 = query1.trim().split(/\s+/).filter(w => w.length > 0);
    expect(shouldUseHyDE(query1)).toBe(words1.length > 10);

    // Test with punctuation (count actual words)
    const query2 = 'this, query has exactly ten words in it now!';
    const words2 = query2.trim().split(/\s+/).filter(w => w.length > 0);
    expect(shouldUseHyDE(query2)).toBe(words2.length > 10);

    // Test with fewer words
    const query3 = 'this query has exactly nine words in it!';
    const words3 = query3.trim().split(/\s+/).filter(w => w.length > 0);
    expect(shouldUseHyDE(query3)).toBe(words3.length > 10);
  });

  it('handles empty and whitespace queries', () => {
    expect(shouldUseHyDE('')).toBe(false);
    expect(shouldUseHyDE('   ')).toBe(false);
    expect(shouldUseHyDE('\n\t')).toBe(false);
  });

  it('handles queries with special characters', () => {
    // 10 words with special chars - should be true
    expect(shouldUseHyDE('How do I parse <XML> & JSON with regex /patterns/ today?')).toBe(true);

    // 9 words with special chars - should be false
    expect(shouldUseHyDE('How parse <XML> & JSON with regex /patterns/ today?')).toBe(false);
  });
});
