import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGraphStore } from '../graphStore';
import type { FileNode, Relation } from '../../graph/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(id: string, path: string, overrides: Partial<FileNode> = {}): FileNode {
  return {
    id,
    path,
    language: 'typescript',
    lastModified: Date.now(),
    contentHash: 'abc',
    tokens: 100,
    symbols: [],
    ...overrides,
  };
}

function makeRelation(sourceFile: string, targetFile: string, kind: Relation['kind'] = 'imports'): Relation {
  return { sourceFile, targetFile, kind, weight: 1.0 };
}

function mockFetch(responses: Array<{ status: string; data?: unknown; error?: string }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[call++] ?? responses[responses.length - 1];
    return Promise.resolve({
      json: () => Promise.resolve(resp),
      ok: resp.status === 'ok',
    });
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useGraphStore.setState({
    nodes: [],
    relations: [],
    stats: null,
    lastScanResult: null,
    lastQueryResult: null,
    readiness: null,
    selectedNodeId: null,
    highlightIds: new Set(),
    scanning: false,
    querying: false,
    error: null,
    lastScanTime: null,
    rootPath: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── scan() ────────────────────────────────────────────────────────────────────

describe('scan()', () => {
  it('populates lastScanResult and stats on success', async () => {
    const scanData = {
      totalFiles: 10,
      totalSymbols: 50,
      totalRelations: 20,
      durationMs: 123,
      filesUpdated: 10,
      relationsAdded: 20,
      relationsRemoved: 0,
      staleFilesTriggered: 0,
    };
    const mockNodes = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`, path: `src/file${i}.ts`, language: 'typescript',
      lastModified: Date.now(), contentHash: 'abc', tokens: 100, symbols: [],
    }));
    const mockRelations = Array.from({ length: 5 }, (_, i) => ({
      sourceFile: `n${i}`, targetFile: `n${i + 1}`, kind: 'imports', weight: 1.0,
    }));

    globalThis.fetch = mockFetch([
      { status: 'ok', data: scanData },
      { status: 'ok', data: { nodes: mockNodes, relations: mockRelations } },
    ]);

    await useGraphStore.getState().scan('/some/path');

    const state = useGraphStore.getState();
    expect(state.scanning).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastScanResult).toEqual({
      totalFiles: 10,
      totalSymbols: 50,
      totalRelations: 20,
      durationMs: 123,
    });
    expect(state.stats).toEqual({ nodes: 10, symbols: 0, relations: 5 });
    expect(state.rootPath).toBe('/some/path');
    expect(state.lastScanTime).toBeTypeOf('number');
  });

  it('sets error and clears scanning flag on failure', async () => {
    globalThis.fetch = mockFetch([{ status: 'error', error: 'Access denied' }]);

    await useGraphStore.getState().scan('/bad/path');

    const state = useGraphStore.getState();
    expect(state.scanning).toBe(false);
    expect(state.error).toBe('Access denied');
    expect(state.lastScanResult).toBeNull();
  });

  it('handles network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    await useGraphStore.getState().scan('/some/path');

    const state = useGraphStore.getState();
    expect(state.scanning).toBe(false);
    expect(state.error).toBe('Network failure');
  });
});

// ── query() ───────────────────────────────────────────────────────────────────

describe('query()', () => {
  it('populates lastQueryResult and highlightIds on success', async () => {
    const queryData = {
      items: [
        { path: 'src/foo.ts', language: 'typescript', depth: 0, tokens: 200, relevance: 0.9, symbols: [] },
      ],
      totalTokens: 200,
      budgetUtilization: 0.2,
      entryPoints: [
        { fileId: 'abc123', symbol: 'FooClass', confidence: 0.95, reason: 'Filename match' },
        { fileId: 'def456', confidence: 0.7, reason: 'Semantic match' },
      ],
    };

    globalThis.fetch = mockFetch([{ status: 'ok', data: queryData }]);

    await useGraphStore.getState().query('explain FooClass');

    const state = useGraphStore.getState();
    expect(state.querying).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastQueryResult?.items).toHaveLength(1);
    expect(state.lastQueryResult?.totalTokens).toBe(200);
    expect(state.lastQueryResult?.budgetUtilization).toBe(0.2);
    expect(state.highlightIds).toEqual(new Set(['abc123', 'def456']));
  });

  it('sets error on query failure', async () => {
    globalThis.fetch = mockFetch([{ status: 'error', error: 'query is required' }]);

    await useGraphStore.getState().query('');

    const state = useGraphStore.getState();
    expect(state.querying).toBe(false);
    expect(state.error).toBe('query is required');
    expect(state.lastQueryResult).toBeNull();
  });

  it('passes tokenBudget and taskType to the API', async () => {
    globalThis.fetch = mockFetch([{
      status: 'ok',
      data: { items: [], totalTokens: 0, budgetUtilization: 0, entryPoints: [] },
    }]);

    await useGraphStore.getState().query('fix the bug', 50000, 'fix');

    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.tokenBudget).toBe(50000);
    expect(body.taskType).toBe('fix');
  });
});

// ── computeReadiness() ────────────────────────────────────────────────────────

describe('computeReadiness()', () => {
  it('returns null when nodes array is empty', () => {
    useGraphStore.setState({ nodes: [], relations: [] });
    useGraphStore.getState().computeReadiness();
    expect(useGraphStore.getState().readiness).toBeNull();
  });

  it('computes correct metrics from sample data', () => {
    const nodeA = makeNode('a', 'src/a.ts');
    const nodeB = makeNode('b', 'src/b.ts');
    const nodeC = makeNode('c', 'src/c.test.ts');
    const nodeD = makeNode('d', 'src/d.ts'); // orphan
    const nodeDoc = makeNode('doc', 'src/README.md', { language: 'markdown' });

    const relations: Relation[] = [
      makeRelation('b', 'a', 'imports'),
      makeRelation('c', 'a', 'tested_by'),
      makeRelation('doc', 'a', 'documents'),
    ];

    useGraphStore.setState({ nodes: [nodeA, nodeB, nodeC, nodeD, nodeDoc], relations });
    useGraphStore.getState().computeReadiness();

    const r = useGraphStore.getState().readiness!;
    expect(r).not.toBeNull();
    // a, b, c, doc are connected; d is orphan → coverage = 4/5
    expect(r.coverage).toBeCloseTo(0.8);
    expect(r.orphanFiles).toBe(1);
    // score should be a number in [0,100]
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('detects import cycles', () => {
    const a = makeNode('a', 'a.ts');
    const b = makeNode('b', 'b.ts');
    const c = makeNode('c', 'c.ts');
    // cycle: a → b → c → a
    const relations: Relation[] = [
      makeRelation('a', 'b', 'imports'),
      makeRelation('b', 'c', 'imports'),
      makeRelation('c', 'a', 'imports'),
    ];
    useGraphStore.setState({ nodes: [a, b, c], relations });
    useGraphStore.getState().computeReadiness();
    expect(useGraphStore.getState().readiness!.circularDeps).toBeGreaterThan(0);
  });

  it('computes testCoupling correctly', () => {
    const src = makeNode('src', 'src/service.ts');
    const test = makeNode('test', 'src/service.test.ts');
    const relations: Relation[] = [
      makeRelation('src', 'test', 'tested_by'),
    ];
    useGraphStore.setState({ nodes: [src, test], relations });
    useGraphStore.getState().computeReadiness();
    // src/service.ts is non-test and has tested_by → 1/1
    expect(useGraphStore.getState().readiness!.testCoupling).toBe(1);
  });
});

// ── Loading / error state management ─────────────────────────────────────────

describe('loading and error state', () => {
  it('sets scanning=true during scan', async () => {
    let resolveFetch!: (v: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValue(
      new Promise(res => { resolveFetch = res; })
    );

    const scanPromise = useGraphStore.getState().scan('/path');
    expect(useGraphStore.getState().scanning).toBe(true);

    resolveFetch({ json: () => Promise.resolve({ status: 'error', error: 'boom' }) });
    await scanPromise;
    expect(useGraphStore.getState().scanning).toBe(false);
  });

  it('sets querying=true during query', async () => {
    let resolveFetch!: (v: unknown) => void;
    globalThis.fetch = vi.fn().mockReturnValue(
      new Promise(res => { resolveFetch = res; })
    );

    const queryPromise = useGraphStore.getState().query('test');
    expect(useGraphStore.getState().querying).toBe(true);

    resolveFetch({ json: () => Promise.resolve({ status: 'error', error: 'boom' }) });
    await queryPromise;
    expect(useGraphStore.getState().querying).toBe(false);
  });

  it('clearError() resets error to null', () => {
    useGraphStore.setState({ error: 'some error' });
    useGraphStore.getState().clearError();
    expect(useGraphStore.getState().error).toBeNull();
  });

  it('selectNode() updates selectedNodeId', () => {
    useGraphStore.getState().selectNode('node-42');
    expect(useGraphStore.getState().selectedNodeId).toBe('node-42');
    useGraphStore.getState().selectNode(null);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });

  it('setHighlights() updates highlightIds', () => {
    const ids = new Set(['a', 'b', 'c']);
    useGraphStore.getState().setHighlights(ids);
    expect(useGraphStore.getState().highlightIds).toEqual(ids);
  });
});
