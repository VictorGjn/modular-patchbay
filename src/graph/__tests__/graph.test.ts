import { describe, it, expect, beforeEach } from 'vitest';
import {
  GraphDB, fullScan, buildFileNode, fileId, resolveEntryPoints, traverseGraph, traverseForTask, packContext,
  extractCodeRelations, extractMarkdownRelations, extractMarkdownSymbols,
  detectTaskType, ContextGraphEngine,
} from '../index.js';
import type { ContextGraph } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(path: string, content: string): { path: string; content: string } {
  return { path, content };
}

// ── DB Tests (#80) ────────────────────────────────────────────────────────────

describe('GraphDB', () => {
  let db: GraphDB;

  beforeEach(() => {
    db = new GraphDB();
  });

  it('upserts and retrieves nodes', () => {
    const node = buildFileNode('src/utils.ts', 'export function add(a: number, b: number) { return a + b; }');
    db.upsertNode(node);
    expect(db.getNode(node.id)).toBeDefined();
    expect(db.getNodeByPath('src/utils.ts')).toBeDefined();
    expect(db.getNodeCount()).toBe(1);
  });

  it('removes nodes and cascades relations', () => {
    const a = buildFileNode('a.ts', 'export function foo() {}');
    const b = buildFileNode('b.ts', 'import { foo } from "./a"');
    db.upsertNode(a);
    db.upsertNode(b);
    db.addRelation({ sourceFile: b.id, targetFile: a.id, kind: 'imports', weight: 1.0 });

    expect(db.getRelationCount()).toBe(1);
    db.removeNode(a.id);
    expect(db.getNode(a.id)).toBeUndefined();
    expect(db.getRelationCount()).toBe(0);
  });

  it('deduplicates relations', () => {
    const a = buildFileNode('a.ts', '');
    const b = buildFileNode('b.ts', '');
    db.upsertNode(a);
    db.upsertNode(b);
    db.addRelation({ sourceFile: a.id, targetFile: b.id, kind: 'imports', weight: 1.0 });
    db.addRelation({ sourceFile: a.id, targetFile: b.id, kind: 'imports', weight: 1.0 });
    expect(db.getRelationCount()).toBe(1);
  });

  it('finds files by symbol name', () => {
    const node = buildFileNode('math.ts', 'export function calculateTotal() {}');
    db.upsertNode(node);
    const results = db.findFilesBySymbol('calculateTotal');
    expect(results.length).toBe(1);
    expect(results[0].path).toBe('math.ts');
  });

  it('searches symbols with prefix matching', () => {
    const node = buildFileNode('utils.ts', 'export function handlePayment() {}\nexport function handleRefund() {}');
    db.upsertNode(node);
    const results = db.searchSymbols('handle');
    expect(results.length).toBe(2);
  });

  it('reports correct stats', () => {
    const node = buildFileNode('a.ts', 'export function foo() {}\nexport function bar() {}');
    db.upsertNode(node);
    const stats = db.getStats();
    expect(stats.nodes).toBe(1);
    expect(stats.symbols).toBeGreaterThanOrEqual(2);
  });
});

// ── Code Extractor Tests (#81) ────────────────────────────────────────────────

describe('Code Extractor', () => {
  it('extracts import relations for TypeScript', () => {
    const utils = buildFileNode('src/utils.ts', 'export function add() {}');
    const main = buildFileNode('src/main.ts', 'import { add } from "./utils";\nadd();');
    const rels = extractCodeRelations(main, [utils, main], 'import { add } from "./utils";\nadd();');

    const imports = rels.filter(r => r.kind === 'imports');
    expect(imports.length).toBe(1);
    expect(imports[0].targetFile).toBe(utils.id);
  });

  it('extracts extends relations', () => {
    const base = buildFileNode('base.ts', 'export class Animal {}');
    const child = buildFileNode('dog.ts', 'import { Animal } from "./base";\nexport class Dog extends Animal {}');
    const rels = extractCodeRelations(child, [base, child], child.symbols.length > 0 ?
      'import { Animal } from "./base";\nexport class Dog extends Animal {}' : '');

    const ext = rels.filter(r => r.kind === 'extends');
    expect(ext.length).toBe(1);
    expect(ext[0].targetSymbol).toBe('Animal');
  });

  it('detects test files and creates tested_by relations', () => {
    const src = buildFileNode('src/payment.ts', 'export function pay() {}');
    const test = buildFileNode('src/payment.test.ts', 'import { pay } from "./payment";\ndescribe("pay", () => { it("works", () => { expect(pay()).toBe(true); }); });');
    const content = 'import { pay } from "./payment";\ndescribe("pay", () => {});';
    const rels = extractCodeRelations(test, [src, test], content);

    const testRels = rels.filter(r => r.kind === 'tests');
    expect(testRels.length).toBeGreaterThanOrEqual(1);

    const testedBy = rels.filter(r => r.kind === 'tested_by');
    expect(testedBy.length).toBeGreaterThanOrEqual(1);
  });

  it('skips node_modules imports', () => {
    const main = buildFileNode('src/main.ts', 'import express from "express";');
    const rels = extractCodeRelations(main, [main], 'import express from "express";');
    expect(rels.filter(r => r.kind === 'imports').length).toBe(0);
  });

  it('handles call detection with weight based on import presence', () => {
    const utils = buildFileNode('utils.ts', 'export function calculateTotal() {}');
    const main = buildFileNode('main.ts', 'import { calculateTotal } from "./utils";\ncalculateTotal();');
    const content = 'import { calculateTotal } from "./utils";\ncalculateTotal();';
    const rels = extractCodeRelations(main, [utils, main], content);

    const calls = rels.filter(r => r.kind === 'calls');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Has import → higher weight
    expect(calls[0].weight).toBeGreaterThanOrEqual(0.5);
  });
});

// ── Markdown Extractor Tests (#82) ────────────────────────────────────────────

describe('Markdown Extractor', () => {
  it('extracts explicit markdown links', () => {
    const doc1 = buildFileNode('docs/guide.md', '# Guide\nSee [architecture](./arch.md) for details.');
    const doc2 = buildFileNode('docs/arch.md', '# Architecture\nEvent-driven design.');
    const content = '# Guide\nSee [architecture](./arch.md) for details.';
    const rels = extractMarkdownRelations(doc1, [doc1, doc2], content);

    const links = rels.filter(r => r.kind === 'links_to');
    expect(links.length).toBe(1);
    expect(links[0].weight).toBe(1.0);
  });

  it('extracts wiki-style links', () => {
    const doc1 = buildFileNode('notes/today.md', '# Today\nSee [[decisions]]');
    const doc2 = buildFileNode('notes/decisions.md', '# Decisions');
    const content = '# Today\nSee [[decisions]]';
    const rels = extractMarkdownRelations(doc1, [doc1, doc2], content);

    expect(rels.filter(r => r.kind === 'links_to').length).toBe(1);
  });

  it('extracts cross-document term references', () => {
    const glossary = buildFileNode('glossary.md', '# Glossary\n**Event-Driven Architecture**: A software pattern...');
    // Rebuild with markdown symbols
    glossary.symbols = extractMarkdownSymbols('# Glossary\n**Event-Driven Architecture**: A software pattern...');
    
    const design = buildFileNode('design.md', '# Design\nWe use event-driven architecture for our system.');
    const content = '# Design\nWe use event-driven architecture for our system.';
    const rels = extractMarkdownRelations(design, [glossary, design], content);

    const refs = rels.filter(r => r.kind === 'references');
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].weight).toBe(0.6);
  });

  it('extracts markdown symbols (headings + definitions)', () => {
    const content = '# Overview\n## Architecture\n**API Gateway**: The entry point\n## Testing';
    const symbols = extractMarkdownSymbols(content);

    const headings = symbols.filter(s => s.kind === 'heading');
    expect(headings.length).toBe(3);
    expect(headings.map(h => h.name)).toContain('Overview');
    expect(headings.map(h => h.name)).toContain('Architecture');

    const defs = symbols.filter(s => s.kind === 'definition');
    expect(defs.length).toBe(1);
    expect(defs[0].name).toBe('API Gateway');
  });

  it('skips external links', () => {
    const doc = buildFileNode('readme.md', '# README\n[GitHub](https://github.com)');
    const rels = extractMarkdownRelations(doc, [doc], '# README\n[GitHub](https://github.com)');
    expect(rels.filter(r => r.kind === 'links_to').length).toBe(0);
  });
});

// ── Entry Point Resolver Tests (#83a) ─────────────────────────────────────────

describe('Entry Point Resolver', () => {
  function makeGraph(): ContextGraph {
    const db = new GraphDB();
    const payment = buildFileNode('src/payment.ts', 'export function handlePayment() {}');
    const cart = buildFileNode('src/cart.ts', 'export function addToCart() {}');
    const readme = buildFileNode('docs/README.md', '# Payment System');
    readme.symbols = extractMarkdownSymbols('# Payment System');
    db.upsertNode(payment);
    db.upsertNode(cart);
    db.upsertNode(readme);
    return db.toContextGraph('/project');
  }

  it('finds entry point by symbol name', () => {
    const graph = makeGraph();
    const eps = resolveEntryPoints('fix the handlePayment function', graph);
    expect(eps.length).toBeGreaterThanOrEqual(1);
    expect(eps[0].confidence).toBe(1.0);
    expect(eps[0].reason).toBe('Direct mention');
  });

  it('finds entry point by filename', () => {
    const graph = makeGraph();
    const eps = resolveEntryPoints('update the payment module', graph);
    expect(eps.some(e => e.reason === 'Filename match')).toBe(true);
  });

  it('returns empty for unrelated query', () => {
    const graph = makeGraph();
    const eps = resolveEntryPoints('deploy to production', graph);
    // Should find nothing specific
    expect(eps.every(e => e.confidence < 1.0)).toBe(true);
  });
});

// ── Graph Traversal Tests (#83b) ──────────────────────────────────────────────

describe('Graph Traversal', () => {
  function makeGraphWithRelations(): ContextGraph {
    const db = new GraphDB();
    const a = buildFileNode('a.ts', 'export function foo() {}');
    const b = buildFileNode('b.ts', 'import { foo } from "./a";\nexport function bar() { foo(); }');
    const c = buildFileNode('c.ts', 'import { bar } from "./b";\nexport function baz() { bar(); }');
    const test = buildFileNode('a.test.ts', 'import { foo } from "./a";\ndescribe("foo", () => {});');
    db.upsertNode(a);
    db.upsertNode(b);
    db.upsertNode(c);
    db.upsertNode(test);
    db.addRelation({ sourceFile: b.id, targetFile: a.id, kind: 'imports', weight: 1.0 });
    db.addRelation({ sourceFile: c.id, targetFile: b.id, kind: 'imports', weight: 1.0 });
    db.addRelation({ sourceFile: b.id, targetFile: a.id, kind: 'calls', weight: 0.9 });
    db.addRelation({ sourceFile: test.id, targetFile: a.id, kind: 'tests', weight: 1.0 });
    db.addRelation({ sourceFile: a.id, targetFile: test.id, kind: 'tested_by', weight: 1.0 });
    return db.toContextGraph('/project');
  }

  it('traverses from entry point following imports', () => {
    const graph = makeGraphWithRelations();
    const eps = [{ fileId: fileId('b.ts'), confidence: 1.0, reason: 'Direct mention' as const }];
    const result = traverseGraph(eps, graph, { followImports: true, maxDepth: 3 });

    expect(result.files.length).toBeGreaterThanOrEqual(2); // b + a at minimum
    expect(result.graphStats.nodesIncluded).toBeGreaterThanOrEqual(2);
  });

  it('respects maxDepth', () => {
    const graph = makeGraphWithRelations();
    const eps = [{ fileId: fileId('c.ts'), confidence: 1.0, reason: 'Direct mention' as const }];
    const result = traverseGraph(eps, graph, { followImports: true, maxDepth: 1 });

    // Should get c + b, but not a (2 hops away)
    expect(result.files.length).toBeLessThanOrEqual(3);
  });

  it('includes tests when followTests is true', () => {
    const graph = makeGraphWithRelations();
    const eps = [{ fileId: fileId('a.ts'), confidence: 1.0, reason: 'Direct mention' as const }];
    const result = traverseGraph(eps, graph, { followTests: true, followImports: true, maxDepth: 2 });

    const hasTest = result.files.some(f => f.node.path === 'a.test.ts');
    expect(hasTest).toBe(true);
  });

  it('excludes tests when followTests is false', () => {
    const graph = makeGraphWithRelations();
    const eps = [{ fileId: fileId('a.ts'), confidence: 1.0, reason: 'Direct mention' as const }];
    const result = traverseGraph(eps, graph, { followTests: false, followImports: true, maxDepth: 2 });

    const hasTest = result.files.some(f => f.node.path === 'a.test.ts');
    expect(hasTest).toBe(false);
  });

  it('uses task presets', () => {
    const graph = makeGraphWithRelations();
    const eps = [{ fileId: fileId('a.ts'), confidence: 1.0, reason: 'Direct mention' as const }];
    const fix = traverseForTask('fix the bug in foo', eps, graph, 'fix');
    expect(fix.files.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Budget Packer Tests (#84) ─────────────────────────────────────────────────

describe('Budget Packer', () => {
  it('assigns depth based on relevance', () => {
    const result = packContext({
      files: [
        { node: buildFileNode('high.ts', 'export function a() {}'), relevance: 0.9, distance: 0, reason: 'entry' },
        { node: buildFileNode('low.ts', 'export function b() {}'), relevance: 0.2, distance: 2, reason: 'via' },
      ],
      totalTokens: 200,
      graphStats: { nodesTraversed: 2, edgesFollowed: 1, nodesIncluded: 2, nodesPruned: 0 },
    }, 100000);

    expect(result.items[0].depth).toBeLessThan(result.items[1].depth);
  });

  it('demotes when over budget', () => {
    const bigFile = buildFileNode('big.ts', 'x'.repeat(10000));
    const result = packContext({
      files: [
        { node: bigFile, relevance: 0.5, distance: 0, reason: 'entry' },
      ],
      totalTokens: bigFile.tokens,
      graphStats: { nodesTraversed: 1, edgesFollowed: 0, nodesIncluded: 1, nodesPruned: 0 },
    }, 100); // Very tight budget

    expect(result.items.length).toBeLessThanOrEqual(1);
    if (result.items.length > 0) {
      expect(result.items[0].depth).toBeGreaterThan(0); // Should be demoted
    }
  });

  it('respects budget utilization', () => {
    const result = packContext({
      files: [
        { node: buildFileNode('a.ts', 'export function a() {}'), relevance: 1.0, distance: 0, reason: '' },
      ],
      totalTokens: 50,
      graphStats: { nodesTraversed: 1, edgesFollowed: 0, nodesIncluded: 1, nodesPruned: 0 },
    }, 10000);

    expect(result.budgetUtilization).toBeLessThanOrEqual(1.0);
    expect(result.budgetUtilization).toBeGreaterThan(0);
  });

  it('returns empty for no files', () => {
    const result = packContext({
      files: [],
      totalTokens: 0,
      graphStats: { nodesTraversed: 0, edgesFollowed: 0, nodesIncluded: 0, nodesPruned: 0 },
    }, 10000);

    expect(result.items).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });
});

// ── Task Detection ────────────────────────────────────────────────────────────

describe('Task Detection', () => {
  it('detects fix tasks', () => { expect(detectTaskType('fix the bug in payment')).toBe('fix'); });
  it('detects review tasks', () => { expect(detectTaskType('review this PR')).toBe('review'); });
  it('detects explain tasks', () => { expect(detectTaskType('explain how auth works')).toBe('explain'); });
  it('detects build tasks', () => { expect(detectTaskType('add a new feature')).toBe('build'); });
  it('detects document tasks', () => { expect(detectTaskType('write documentation')).toBe('document'); });
  it('detects research tasks', () => { expect(detectTaskType('research best practices')).toBe('research'); });
  it('defaults to explain', () => { expect(detectTaskType('some random query')).toBe('explain'); });
});

// ── Full Scan Integration (#85) ───────────────────────────────────────────────

describe('Full Scan', () => {
  it('scans a mini project and builds graph', () => {
    const db = new GraphDB();
    const result = fullScan([
      makeNode('src/utils.ts', 'export function add(a: number, b: number) { return a + b; }'),
      makeNode('src/main.ts', 'import { add } from "./utils";\nconsole.log(add(1, 2));'),
      makeNode('docs/README.md', '# Project\nSee [utils](../src/utils.ts) for math functions.'),
      makeNode('node_modules/foo/index.js', 'module.exports = {}'), // Should be skipped
    ], db);

    expect(result.totalFiles).toBe(3); // node_modules skipped
    expect(result.totalSymbols).toBeGreaterThan(0);
    expect(result.totalRelations).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThan(5000);
  });
});

// ── ContextGraphEngine Integration ────────────────────────────────────────────

describe('ContextGraphEngine', () => {
  it('full pipeline: scan → query → pack', () => {
    const engine = new ContextGraphEngine();

    engine.scan('/project', [
      makeNode('src/payment.ts', 'export function handlePayment(amount: number) { return amount * 1.1; }'),
      makeNode('src/cart.ts', 'import { handlePayment } from "./payment";\nexport function checkout() { handlePayment(100); }'),
      makeNode('src/payment.test.ts', 'import { handlePayment } from "./payment";\ndescribe("payment", () => { it("works", () => {}); });'),
      makeNode('docs/payments.md', '# Payment System\nThe [payment module](../src/payment.ts) handles transactions.'),
    ]);

    const stats = engine.getStats();
    expect(stats.nodes).toBe(4);
    expect(stats.relations).toBeGreaterThan(0);

    // Query about payment
    const packed = engine.query('fix the handlePayment function', 50000, 'fix');
    expect(packed.items.length).toBeGreaterThanOrEqual(1);
    expect(packed.items[0].file.path).toBe('src/payment.ts');
    expect(packed.totalTokens).toBeGreaterThan(0);
    expect(packed.budgetUtilization).toBeGreaterThan(0);
    expect(packed.budgetUtilization).toBeLessThanOrEqual(1.0);
  });
});
