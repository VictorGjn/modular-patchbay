import { describe, it, expect } from 'vitest';
import { startPipeline, completePipeline, runPipelineSync } from '../../src/services/pipeline';
import type { PipelineSource } from '../../src/services/pipeline';

const DOCS: PipelineSource[] = [
  {
    name: 'order-management.md',
    type: 'markdown',
    content: `# Order Management

## Architecture
The order system uses a Zustand store with async actions.

## Data Flow
### Create Order
User fills form → validateOrder() → store.createOrder() → POST /api/orders.

### Update Order
OrderRow click → modal → store.updateOrder() → PATCH /api/orders/:id.

## Key Files
- src/store/orderStore.ts — state + actions
- src/components/OrderList.tsx — table with filters
- src/api/orders.ts — API client

## Edge Cases
Empty state shows illustration. Pagination resets on filter change.
`,
  },
  {
    name: 'auth-system.md',
    type: 'markdown',
    content: `# Authentication

## Flow
Login → JWT issued → stored in httpOnly cookie → refreshed on 401.

## Key Files
- src/store/authStore.ts — token management
- src/api/auth.ts — login/logout/refresh
- src/middleware/auth.ts — route protection
`,
  },
];

describe('startPipeline', () => {
  it('indexes sources and produces navigation prompt', () => {
    const result = startPipeline({
      task: 'Add date filter to order list',
      sources: DOCS,
      tokenBudget: 2000,
    });

    expect(result.indexes).toHaveLength(2);
    expect(result.headlines).toHaveLength(2);
    expect(result.navigationPrompt).toContain('Add date filter');
    expect(result.navigationPrompt).toContain('Order Management');
    expect(result.navigationPrompt).toContain('Authentication');
    expect(result.indexMs).toBeGreaterThanOrEqual(0);
  });
});

describe('completePipeline', () => {
  it('assembles context from agent navigation response', () => {
    const { indexes, indexMs } = startPipeline({
      task: 'Add date filter',
      sources: DOCS,
      tokenBudget: 2000,
    });

    // Use actual node IDs — h1 is children[0], h2s are children[0].children
    const orderH1 = indexes[0].root.children[0]; // Order Management
    const archNode = orderH1.children[0]; // Architecture
    const keyFilesNode = orderH1.children[2]; // Key Files

    const agentResponse = JSON.stringify([
      { nodeId: archNode.nodeId, depth: 0, reason: 'Architecture', priority: 1 },
      { nodeId: keyFilesNode.nodeId, depth: 0, reason: 'Key files', priority: 0 },
    ]);

    const options = { task: 'Add date filter', sources: DOCS, tokenBudget: 2000 };
    const result = completePipeline(indexes, agentResponse, options, indexMs);

    expect(result.tokens).toBeGreaterThan(0);
    expect(result.context).toContain('orderStore');
    expect(result.sources).toHaveLength(2);
    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
  });
});

describe('runPipelineSync', () => {
  it('runs full pipeline with manual selections', () => {
    const { indexes } = startPipeline({ task: 'test', sources: DOCS, tokenBudget: 2000 });
    const orderH1 = indexes[0].root.children[0];
    const archNode = orderH1.children[0];
    const keyFilesNode = orderH1.children[2];

    const result = runPipelineSync({
      task: 'Add date filter to order list',
      sources: DOCS,
      tokenBudget: 2000,
      manualSelections: [
        { nodeId: archNode.nodeId, depth: 0, priority: 0 },
        { nodeId: keyFilesNode.nodeId, depth: 0, priority: 0 },
      ],
    });

    expect(result.context).toContain('Zustand store');
    expect(result.context).toContain('orderStore');
    expect(result.compression.ratio).toBeLessThanOrEqual(1);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.utilization).toBeLessThanOrEqual(1);
  });

  it('compresses content to fit budget', () => {
    const { indexes } = startPipeline({ task: 'test', sources: DOCS, tokenBudget: 2000 });
    const archNode = indexes[0].root.children[0].children[0];

    const result = runPipelineSync({
      task: 'test',
      sources: DOCS,
      tokenBudget: 50,
      manualSelections: [
        { nodeId: archNode.nodeId, depth: 0, priority: 0 },
      ],
      compression: { aggressiveness: 0.8 },
    });

    expect(result.tokens).toBeLessThanOrEqual(60); // budget + tolerance
  });

  it('handles empty sources', () => {
    const result = runPipelineSync({
      task: 'test',
      sources: [],
      tokenBudget: 1000,
      manualSelections: [],
    });
    expect(result.tokens).toBe(0);
    expect(result.context).toBe('');
  });

  it('handles structured sources', () => {
    const result = runPipelineSync({
      task: 'Check deal status',
      sources: [{
        name: 'Deal #456',
        type: 'structured',
        sourceType: 'hubspot',
        fields: [
          { key: 'name', label: 'Deal Name', value: 'Acme Corp', group: 'deal' },
          { key: 'amount', label: 'Amount', value: '$50K', group: 'deal' },
          { key: 'contact', label: 'Contact', value: 'John', group: 'people' },
        ],
      }],
      tokenBudget: 500,
      manualSelections: [], // no selections — just test source indexing
    });

    // With empty selections, context is empty but source is indexed
    expect(result.sources[0].type).toBe('hubspot');
    expect(result.sources[0].type).toBe('hubspot');
  });
});
