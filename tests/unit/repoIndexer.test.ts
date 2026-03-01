import { describe, it, expect } from 'vitest';
import {
  scanRepository,
  generateOverviewDoc,
  generateFeatureDoc,
  generateKnowledgeBase,
} from '../../server/services/repoIndexer';
import { join } from 'node:path';

// Use this repo itself as the test subject
const REPO_ROOT = join(__dirname, '../..');

describe('scanRepository', () => {
  it('scans the modular-patchbay repo', () => {
    const scan = scanRepository(REPO_ROOT);
    expect(scan.name).toBe('modular-studio');
    expect(scan.totalFiles).toBeGreaterThan(20);
    expect(scan.files.length).toBe(scan.totalFiles);
  });

  it('detects the tech stack', () => {
    const scan = scanRepository(REPO_ROOT);
    expect(scan.stack.language).toBe('TypeScript');
    expect(scan.stack.framework).toMatch(/React|Express/);
    expect(scan.stack.stateManagement).toBe('Zustand');
    expect(scan.stack.testing).toBe('Vitest');
    expect(scan.stack.buildTool).toBe('Vite');
  });

  it('categorizes files', () => {
    const scan = scanRepository(REPO_ROOT);
    const stores = scan.files.filter(f => f.category === 'store');
    const components = scan.files.filter(f => f.category === 'component');
    expect(stores.length).toBeGreaterThan(3);
    expect(components.length).toBeGreaterThan(3);
  });

  it('extracts symbols from TypeScript files', () => {
    const scan = scanRepository(REPO_ROOT);
    const consoleStore = scan.files.find(f => f.path.includes('consoleStore'));
    expect(consoleStore).toBeDefined();
    expect(consoleStore!.exports.length).toBeGreaterThan(0);
  });

  it('clusters features', () => {
    const scan = scanRepository(REPO_ROOT);
    expect(scan.features.length).toBeGreaterThan(0);
    // Each feature should have key files
    for (const f of scan.features) {
      expect(f.keyFiles.length).toBeGreaterThan(0);
    }
  });

  it('detects conventions', () => {
    const scan = scanRepository(REPO_ROOT);
    // We use PascalCase for components
    expect(scan.conventions.length).toBeGreaterThan(0);
  });

  it('discovers modules', () => {
    const scan = scanRepository(REPO_ROOT);
    expect(scan.modules.length).toBeGreaterThan(5);
  });
});

describe('generateOverviewDoc', () => {
  it('produces valid markdown', () => {
    const scan = scanRepository(REPO_ROOT);
    const doc = generateOverviewDoc(scan);
    expect(doc).toContain('# modular-studio');
    expect(doc).toContain('## Stack');
    expect(doc).toContain('## Structure');
    expect(doc).toContain('## Features');
    expect(doc).toContain('TypeScript');
  });
});

describe('generateFeatureDoc', () => {
  it('produces feature docs with key files', () => {
    const scan = scanRepository(REPO_ROOT);
    const feature = scan.features[0];
    const doc = generateFeatureDoc(scan, feature);
    expect(doc).toContain(`# Feature: ${feature.name}`);
    expect(doc).toContain('## Key Files');
    expect(doc).toContain('## Architecture');
  });
});

describe('generateKnowledgeBase', () => {
  it('produces overview + feature docs', () => {
    const scan = scanRepository(REPO_ROOT);
    const docs = generateKnowledgeBase(scan);
    expect(docs.has('00-overview.md')).toBe(true);
    expect(docs.size).toBeGreaterThan(1); // overview + at least 1 feature
  });

  it('files are numbered and slugged', () => {
    const scan = scanRepository(REPO_ROOT);
    const docs = generateKnowledgeBase(scan);
    const keys = [...docs.keys()];
    expect(keys[0]).toBe('00-overview.md');
    // Feature files should be 01-xxx.md, 02-xxx.md, etc.
    for (const key of keys.slice(1)) {
      expect(key).toMatch(/^\d{2}-[\w-]+\.md$/);
    }
  });
});
