import { describe, it, expect } from 'vitest';
import { buildFileNode } from '../scanner.js';
import { extractYamlRelations } from '../extractors/yaml.js';
import { extractCrossTypeRelations } from '../extractors/cross-type.js';
import type { FileNode } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function node(path: string, content = ''): FileNode {
  return buildFileNode(path, content);
}

// ── YAML Extractor Tests ──────────────────────────────────────────────────────

describe('extractYamlRelations', () => {
  it('extracts configured_by from tsconfig paths', () => {
    const tsconfig = node('tsconfig.json', JSON.stringify({
      compilerOptions: { paths: { '@/*': ['./src/index.ts'] } },
      include: ['src/main.ts'],
    }));
    const indexTs = node('src/index.ts', '');
    const mainTs = node('src/main.ts', '');
    const allNodes = [tsconfig, indexTs, mainTs];

    const rels = extractYamlRelations(tsconfig, allNodes, JSON.stringify({
      compilerOptions: { paths: { '@/*': ['./src/index.ts'] } },
      include: ['src/main.ts'],
    }));

    const targets = rels.map(r => r.sourceFile);
    expect(rels.length).toBeGreaterThanOrEqual(1);
    expect(rels.every(r => r.kind === 'configured_by')).toBe(true);
    expect(rels.every(r => r.targetFile === tsconfig.id)).toBe(true);
    expect(targets).toContain(indexTs.id);
  });

  it('extracts configured_by from package.json main/types fields', () => {
    const pkgJson = node('package.json', '');
    const distIndex = node('dist/index.js', '');
    const distTypes = node('dist/index.d.ts', '');
    const allNodes = [pkgJson, distIndex, distTypes];

    const content = JSON.stringify({
      name: 'my-pkg',
      main: './dist/index.js',
      types: './dist/index.d.ts',
    });

    const rels = extractYamlRelations(pkgJson, allNodes, content);
    const targets = rels.map(r => r.sourceFile);
    expect(targets).toContain(distIndex.id);
    expect(targets).toContain(distTypes.id);
    expect(rels.every(r => r.kind === 'configured_by')).toBe(true);
    expect(rels.every(r => r.weight === 0.8)).toBe(true);
  });

  it('extracts configured_by from JSON $schema reference', () => {
    const schemaFile = node('schemas/config-schema.json', '');
    const configFile = node('config.json', '');
    const allNodes = [schemaFile, configFile];

    const content = JSON.stringify({
      $schema: './schemas/config-schema.json',
      setting: 'value',
    });

    const rels = extractYamlRelations(configFile, allNodes, content);
    expect(rels.length).toBe(1);
    expect(rels[0].sourceFile).toBe(configFile.id);
    expect(rels[0].targetFile).toBe(schemaFile.id);
    expect(rels[0].kind).toBe('configured_by');
    expect(rels[0].weight).toBe(0.6);
  });

  it('extracts configured_by from YAML config referencing TS files', () => {
    const yamlConfig = node('vitest.config.yaml', '');
    const setupFile = node('src/setup.ts', '');
    const allNodes = [yamlConfig, setupFile];

    const content = `
test:
  setupFiles: src/setup.ts
  environment: node
`;

    const rels = extractYamlRelations(yamlConfig, allNodes, content);
    expect(rels.length).toBeGreaterThanOrEqual(1);
    expect(rels[0].sourceFile).toBe(setupFile.id);
    expect(rels[0].targetFile).toBe(yamlConfig.id);
    expect(rels[0].kind).toBe('configured_by');
  });

  it('does not produce relations for external / non-project paths', () => {
    const pkgJson = node('package.json', '');
    const allNodes = [pkgJson];

    const content = JSON.stringify({
      main: 'dist/index.js',  // file not in allNodes
      scripts: { build: 'tsc' },
    });

    const rels = extractYamlRelations(pkgJson, allNodes, content);
    expect(rels.length).toBe(0);
  });

  it('deduplicates identical relations', () => {
    const cfg = node('tsconfig.json', '');
    const src = node('src/app.ts', '');
    const allNodes = [cfg, src];

    // src/app.ts appears twice in the content
    const content = `{"include":["src/app.ts","src/app.ts"]}`;
    const rels = extractYamlRelations(cfg, allNodes, content);
    const dupes = rels.filter(r => r.sourceFile === src.id && r.targetFile === cfg.id);
    expect(dupes.length).toBe(1);
  });

  it('returns empty array for non-yaml/json files', () => {
    const tsFile = node('src/app.ts', 'const x = 1;');
    const rels = extractYamlRelations(tsFile, [tsFile], 'const x = 1;');
    expect(rels).toEqual([]);
  });
});

// ── Cross-Type Extractor Tests ────────────────────────────────────────────────

describe('extractCrossTypeRelations', () => {
  it('README.md documents sibling code files', () => {
    const readme = node('src/README.md', '# My Module');
    const appTs = node('src/app.ts', '');
    const utilsTs = node('src/utils.ts', '');
    const otherReadme = node('docs/README.md', '');   // different dir — should NOT match
    const allNodes = [readme, appTs, utilsTs, otherReadme];

    const rels = extractCrossTypeRelations(readme, allNodes, '# My Module');
    const targets = rels.map(r => r.targetFile);

    expect(targets).toContain(appTs.id);
    expect(targets).toContain(utilsTs.id);
    expect(targets).not.toContain(otherReadme.id);
    expect(rels.every(r => r.sourceFile === readme.id)).toBe(true);
    expect(rels.every(r => r.kind === 'documents')).toBe(true);
    expect(rels.every(r => r.weight === 0.7)).toBe(true);
  });

  it('README.md does not document markdown files in same dir', () => {
    const readme = node('src/README.md', '');
    const guide = node('src/GUIDE.md', '');
    const allNodes = [readme, guide];

    const rels = extractCrossTypeRelations(readme, allNodes, '');
    expect(rels.length).toBe(0);
  });

  it('backtick filename mention creates documents relation', () => {
    const docFile = node('docs/overview.md', 'See `src/app.ts` for the entry point.');
    const appTs = node('src/app.ts', '');
    const allNodes = [docFile, appTs];

    const rels = extractCrossTypeRelations(docFile, allNodes, 'See `src/app.ts` for the entry point.');
    expect(rels.length).toBe(1);
    expect(rels[0].sourceFile).toBe(docFile.id);
    expect(rels[0].targetFile).toBe(appTs.id);
    expect(rels[0].kind).toBe('documents');
    expect(rels[0].weight).toBe(0.6);
  });

  it('backtick match works by basename', () => {
    const readme = node('README.md', 'Check out `utils.ts`');
    const utils = node('src/lib/utils.ts', '');
    const allNodes = [readme, utils];

    const rels = extractCrossTypeRelations(readme, allNodes, 'Check out `utils.ts`');
    expect(rels.length).toBe(1);
    expect(rels[0].targetFile).toBe(utils.id);
  });

  it('no false positives for common words without extensions', () => {
    const readme = node('README.md', 'Run `npm install` and then `npm start`');
    const someTs = node('src/index.ts', '');
    const allNodes = [readme, someTs];

    const rels = extractCrossTypeRelations(readme, allNodes, 'Run `npm install` and then `npm start`');
    expect(rels.length).toBe(0);
  });

  it('deduplicates duplicate backtick mentions', () => {
    const doc = node('docs/guide.md', 'Use `app.ts` and also `app.ts`.');
    const appTs = node('src/app.ts', '');
    const allNodes = [doc, appTs];

    const rels = extractCrossTypeRelations(doc, allNodes, 'Use `app.ts` and also `app.ts`.');
    const dupes = rels.filter(r => r.targetFile === appTs.id);
    expect(dupes.length).toBe(1);
  });

  it('cross-type works on non-markdown files (code comments)', () => {
    const tsFile = node('src/server.ts', '// See also `src/config.ts` for settings');
    const configTs = node('src/config.ts', '');
    const allNodes = [tsFile, configTs];

    const rels = extractCrossTypeRelations(tsFile, allNodes, '// See also `src/config.ts` for settings');
    expect(rels.length).toBe(1);
    expect(rels[0].targetFile).toBe(configTs.id);
    expect(rels[0].kind).toBe('documents');
  });

  it('non-README markdown with no backtick mentions produces no relations', () => {
    const guide = node('docs/guide.md', '# Installation\n\nJust install it.');
    const appTs = node('src/app.ts', '');
    const allNodes = [guide, appTs];

    const rels = extractCrossTypeRelations(guide, allNodes, '# Installation\n\nJust install it.');
    expect(rels.length).toBe(0);
  });
});
