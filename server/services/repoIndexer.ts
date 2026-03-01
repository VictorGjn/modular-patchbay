/**
 * Repository Indexer
 *
 * Analyzes a codebase and generates a structured markdown knowledge base
 * optimized for tree indexing and depth filtering.
 *
 * Unlike Aider's repo map (AST → symbol list) or Autodoc (per-file LLM docs),
 * this generates FEATURE-LEVEL and FLOW-LEVEL documentation that answers:
 * - What does this feature do?
 * - Where does it live (key files)?
 * - How does data flow through it?
 * - What patterns/conventions does it follow?
 * - What are the edge cases and gotchas?
 *
 * Output: markdown files with heading structure that maps to depth levels:
 *   # Feature name         → Mention (depth 4)
 *   ## Architecture         → Headlines (depth 3)
 *   ### Data flow details   → Summary (depth 2)
 *   Paragraphs              → Detail (depth 1) / Full (depth 0)
 *
 * Pipeline: scan → analyze → cluster → generate → index
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, basename, dirname } from 'node:path';

// ── Types ──

export interface RepoFile {
  path: string;         // relative to repo root
  ext: string;
  size: number;
  tokens: number;       // estimated
  category: FileCategory;
  imports: string[];    // extracted import paths
  exports: string[];    // exported symbols
  functions: string[];  // function/method names
  classes: string[];    // class names
  types: string[];      // type/interface names
}

export type FileCategory =
  | 'component'     // UI components (React, Vue, Svelte)
  | 'store'         // state management (Zustand, Redux, Pinia)
  | 'service'       // API calls, external integrations
  | 'util'          // pure utility functions
  | 'route'         // API routes / page routes
  | 'config'        // configuration files
  | 'test'          // test files
  | 'type'          // type definitions
  | 'style'         // CSS/SCSS
  | 'doc'           // documentation
  | 'script'        // build scripts, CLI
  | 'other';

export interface RepoModule {
  name: string;
  path: string;        // directory path
  files: RepoFile[];
  entryPoint?: string;  // main file
  description?: string;
}

export interface RepoFeature {
  name: string;
  description: string;
  modules: string[];     // module paths involved
  keyFiles: string[];    // most important files
  stores: string[];      // state stores used
  routes: string[];      // API/page routes
  components: string[];  // UI components
  imports: Map<string, string[]>; // file → what it imports from other features
}

export interface RepoScan {
  root: string;
  name: string;            // from package.json or dir name
  files: RepoFile[];
  modules: RepoModule[];
  features: RepoFeature[];
  conventions: RepoConvention[];
  stack: StackInfo;
  totalFiles: number;
  totalTokens: number;
}

export interface RepoConvention {
  pattern: string;
  description: string;
  examples: string[];
}

export interface StackInfo {
  language: string;
  framework: string;
  stateManagement: string;
  styling: string;
  testing: string;
  buildTool: string;
  packageManager: string;
}

// ── Config ──

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.cache', 'coverage',
  '.turbo', '.vercel', '.output', 'archive',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go',
  '.vue', '.svelte', '.astro',
]);

const MAX_FILE_SIZE = 100_000; // 100KB
const MAX_FILES = 2000;

// ── Scanner ──

function categorizeFile(path: string, content: string): FileCategory {
  const base = basename(path).toLowerCase();
  const dir = dirname(path).toLowerCase();

  if (base.includes('.test.') || base.includes('.spec.') || dir.includes('__tests__') || dir.includes('test')) return 'test';
  if (base.includes('.d.ts') || dir.includes('types')) return 'type';
  if (base.endsWith('.css') || base.endsWith('.scss') || base.endsWith('.less')) return 'style';
  if (base === 'readme.md' || base === 'changelog.md' || dir.includes('docs')) return 'doc';
  if (base.includes('config') || base.includes('.env') || base === 'tsconfig.json') return 'config';
  if (dir.includes('route') || base.includes('route')) return 'route';
  if (dir.includes('store') || content.includes('create(') || content.includes('createSlice')) return 'store';
  if (dir.includes('service') || dir.includes('api') || content.includes('fetch(')) return 'service';
  if (dir.includes('util') || dir.includes('helper') || dir.includes('lib')) return 'util';
  if (dir.includes('component') || dir.includes('page') || dir.includes('panel') || dir.includes('layout')) return 'component';
  if (base.endsWith('.sh') || base.endsWith('.ps1') || dir.includes('script') || dir.includes('bin')) return 'script';

  // Heuristic: if it has JSX/TSX, it's a component
  if ((path.endsWith('.tsx') || path.endsWith('.jsx')) && (content.includes('return (') || content.includes('return <'))) return 'component';

  return 'other';
}

function extractSymbols(content: string, ext: string): {
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  types: string[];
} {
  const imports: string[] = [];
  const exports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    // Imports
    const importRegex = /import\s+(?:{[^}]*}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(content)) !== null) imports.push(m[1]);

    // Exports
    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g;
    while ((m = exportRegex.exec(content)) !== null) exports.push(m[1]);

    // Functions
    const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    while ((m = fnRegex.exec(content)) !== null) functions.push(m[1] || m[2]);

    // Classes
    const classRegex = /class\s+(\w+)/g;
    while ((m = classRegex.exec(content)) !== null) classes.push(m[1]);

    // Types/Interfaces
    const typeRegex = /(?:type|interface)\s+(\w+)/g;
    while ((m = typeRegex.exec(content)) !== null) types.push(m[1]);
  }

  if (ext === '.py') {
    const defRegex = /^(?:async\s+)?def\s+(\w+)/gm;
    let m;
    while ((m = defRegex.exec(content)) !== null) functions.push(m[1]);

    const classRegex = /^class\s+(\w+)/gm;
    while ((m = classRegex.exec(content)) !== null) classes.push(m[1]);

    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+/gm;
    while ((m = importRegex.exec(content)) !== null) imports.push(m[1] || '');
  }

  return { imports, exports, functions, classes, types };
}

function detectStack(root: string, files: RepoFile[]): StackInfo {
  const stack: StackInfo = {
    language: 'unknown',
    framework: 'unknown',
    stateManagement: 'none',
    styling: 'unknown',
    testing: 'unknown',
    buildTool: 'unknown',
    packageManager: 'unknown',
  };

  // Check package.json
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Language
      if (deps.typescript || files.some(f => f.ext === '.ts')) stack.language = 'TypeScript';
      else if (files.some(f => f.ext === '.js')) stack.language = 'JavaScript';

      // Framework
      if (deps.next) stack.framework = 'Next.js';
      else if (deps.nuxt) stack.framework = 'Nuxt';
      else if (deps.react) stack.framework = 'React';
      else if (deps.vue) stack.framework = 'Vue';
      else if (deps.svelte) stack.framework = 'Svelte';
      else if (deps.express) stack.framework = 'Express';
      else if (deps.fastify) stack.framework = 'Fastify';

      // State
      if (deps.zustand) stack.stateManagement = 'Zustand';
      else if (deps['@reduxjs/toolkit'] || deps.redux) stack.stateManagement = 'Redux';
      else if (deps.pinia) stack.stateManagement = 'Pinia';
      else if (deps.jotai) stack.stateManagement = 'Jotai';

      // Styling
      if (deps.tailwindcss) stack.styling = 'Tailwind CSS';
      else if (deps['styled-components']) stack.styling = 'styled-components';
      else if (deps['@emotion/react']) stack.styling = 'Emotion';

      // Testing
      if (deps.vitest) stack.testing = 'Vitest';
      else if (deps.jest) stack.testing = 'Jest';
      else if (deps['@playwright/test']) stack.testing = 'Playwright';

      // Build
      if (deps.vite) stack.buildTool = 'Vite';
      else if (deps.webpack) stack.buildTool = 'Webpack';
      else if (deps.esbuild) stack.buildTool = 'esbuild';

      // Package manager
      if (existsSync(join(root, 'pnpm-lock.yaml'))) stack.packageManager = 'pnpm';
      else if (existsSync(join(root, 'yarn.lock'))) stack.packageManager = 'yarn';
      else if (existsSync(join(root, 'bun.lockb'))) stack.packageManager = 'bun';
      else stack.packageManager = 'npm';
    } catch { /* ignore */ }
  }

  // Python
  if (files.some(f => f.ext === '.py')) {
    stack.language = stack.language === 'unknown' ? 'Python' : stack.language;
    if (existsSync(join(root, 'pyproject.toml'))) stack.buildTool = 'pyproject';
  }

  return stack;
}

function detectConventions(files: RepoFile[]): RepoConvention[] {
  const conventions: RepoConvention[] = [];

  // File naming
  const usesKebab = files.filter(f => f.path.includes('-')).length;
  const usesCamel = files.filter(f => /[a-z][A-Z]/.test(basename(f.path))).length;
  const usesPascal = files.filter(f => /^[A-Z]/.test(basename(f.path))).length;

  if (usesPascal > usesKebab && usesPascal > usesCamel) {
    conventions.push({ pattern: 'PascalCase files', description: 'Component files use PascalCase naming', examples: files.filter(f => /^[A-Z]/.test(basename(f.path))).slice(0, 3).map(f => f.path) });
  } else if (usesKebab > usesCamel) {
    conventions.push({ pattern: 'kebab-case files', description: 'Files use kebab-case naming', examples: files.filter(f => f.path.includes('-')).slice(0, 3).map(f => f.path) });
  }

  // Barrel exports
  const barrels = files.filter(f => basename(f.path) === 'index.ts' || basename(f.path) === 'index.js');
  if (barrels.length > 2) {
    conventions.push({ pattern: 'barrel exports', description: 'Uses index.ts barrel files for module exports', examples: barrels.slice(0, 3).map(f => f.path) });
  }

  // Co-located tests
  const colocated = files.filter(f => f.category === 'test' && !f.path.includes('__tests__'));
  if (colocated.length > files.filter(f => f.category === 'test').length / 2) {
    conventions.push({ pattern: 'co-located tests', description: 'Test files live alongside source files', examples: colocated.slice(0, 3).map(f => f.path) });
  }

  return conventions;
}

/**
 * Cluster files into feature groups based on import relationships and directory structure.
 */
function clusterFeatures(files: RepoFile[], modules: RepoModule[]): RepoFeature[] {
  const features: RepoFeature[] = [];

  // Group by top-level directory as initial clusters
  const dirGroups = new Map<string, RepoFile[]>();
  for (const f of files) {
    if (f.category === 'test' || f.category === 'config' || f.category === 'style') continue;
    const topDir = f.path.split('/')[0] || 'root';
    if (!dirGroups.has(topDir)) dirGroups.set(topDir, []);
    dirGroups.get(topDir)!.push(f);
  }

  // For each meaningful group, create a feature
  for (const [dir, groupFiles] of dirGroups) {
    if (groupFiles.length < 2) continue;

    const stores = groupFiles.filter(f => f.category === 'store');
    const routes = groupFiles.filter(f => f.category === 'route');
    const components = groupFiles.filter(f => f.category === 'component');
    // const services = groupFiles.filter(f => f.category === 'service');

    // Build import graph within feature
    const internalImports = new Map<string, string[]>();
    for (const f of groupFiles) {
      const deps = f.imports.filter(imp =>
        !imp.startsWith('@') && !imp.startsWith('node:') && imp.startsWith('.')
      );
      if (deps.length > 0) internalImports.set(f.path, deps);
    }

    // Find key files (most imported within the group)
    const importCounts = new Map<string, number>();
    for (const f of groupFiles) {
      for (const imp of f.imports) {
        const resolved = imp.replace(/^\.\//, `${dir}/`);
        importCounts.set(resolved, (importCounts.get(resolved) || 0) + 1);
      }
    }

    const keyFiles = groupFiles
      .sort((a, b) => (importCounts.get(b.path) || 0) - (importCounts.get(a.path) || 0))
      .slice(0, 10)
      .map(f => f.path);

    const feature: RepoFeature = {
      name: humanizeDirName(dir),
      description: '', // filled by LLM later
      modules: modules.filter(m => m.path.startsWith(dir)).map(m => m.path),
      keyFiles,
      stores: stores.map(f => f.path),
      routes: routes.map(f => f.path),
      components: components.map(f => f.path),
      imports: internalImports,
    };

    features.push(feature);
  }

  return features;
}

function humanizeDirName(dir: string): string {
  return dir
    .replace(/^src\//, '')
    .replace(/\//g, ' > ')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function discoverModules(_root: string, files: RepoFile[]): RepoModule[] {
  const modules: RepoModule[] = [];
  const dirs = new Set(files.map(f => dirname(f.path)));

  for (const dir of dirs) {
    const dirFiles = files.filter(f => dirname(f.path) === dir);
    if (dirFiles.length < 2) continue;

    const entry = dirFiles.find(f => basename(f.path).startsWith('index.')) || dirFiles[0];
    modules.push({
      name: humanizeDirName(dir),
      path: dir,
      files: dirFiles,
      entryPoint: entry?.path,
    });
  }

  return modules;
}

// ── Main Scanner ──

export function scanRepository(root: string): RepoScan {
  const files: RepoFile[] = [];
  let counter = 0;

  function walk(dir: string) {
    if (counter >= MAX_FILES) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (counter >= MAX_FILES) break;
      const fullPath = join(dir, entry.name);
      const relPath = relative(root, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (!CODE_EXTENSIONS.has(ext) && ext !== '.md' && ext !== '.json' && ext !== '.yaml' && ext !== '.yml') continue;

        try {
          const stat = statSync(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue;

          const content = readFileSync(fullPath, 'utf-8');
          const symbols = extractSymbols(content, ext);
          const category = categorizeFile(relPath, content);

          files.push({
            path: relPath,
            ext,
            size: stat.size,
            tokens: Math.ceil(stat.size / 4),
            category,
            ...symbols,
          });
          counter++;
        } catch { /* skip */ }
      }
    }
  }

  walk(root);

  const modules = discoverModules(root, files);
  const features = clusterFeatures(files, modules);
  const conventions = detectConventions(files);
  const stack = detectStack(root, files);

  // Repo name from package.json or dir name
  let name = basename(root);
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    if (pkg.name) name = pkg.name;
  } catch { /* ignore */ }

  return {
    root,
    name,
    files,
    modules,
    features,
    conventions,
    stack,
    totalFiles: files.length,
    totalTokens: files.reduce((sum, f) => sum + f.tokens, 0),
  };
}

// ── Markdown Knowledge Base Generator ──

/**
 * Generate the overview document for the repository.
 */
export function generateOverviewDoc(scan: RepoScan): string {
  const lines: string[] = [];

  lines.push(`# ${scan.name}`);
  lines.push('');
  lines.push(`## Stack`);
  lines.push(`- **Language:** ${scan.stack.language}`);
  lines.push(`- **Framework:** ${scan.stack.framework}`);
  lines.push(`- **State:** ${scan.stack.stateManagement}`);
  lines.push(`- **Styling:** ${scan.stack.styling}`);
  lines.push(`- **Testing:** ${scan.stack.testing}`);
  lines.push(`- **Build:** ${scan.stack.buildTool}`);
  lines.push(`- **Package Manager:** ${scan.stack.packageManager}`);
  lines.push('');

  lines.push(`## Structure`);
  lines.push(`- ${scan.totalFiles} files indexed`);
  lines.push(`- ~${Math.round(scan.totalTokens / 1000)}K tokens total`);
  lines.push(`- ${scan.features.length} feature clusters detected`);
  lines.push(`- ${scan.modules.length} modules`);
  lines.push('');

  // File distribution by category
  const cats = new Map<string, number>();
  for (const f of scan.files) cats.set(f.category, (cats.get(f.category) || 0) + 1);
  lines.push(`## File Distribution`);
  for (const [cat, count] of [...cats.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${cat}: ${count} files`);
  }
  lines.push('');

  // Conventions
  if (scan.conventions.length > 0) {
    lines.push(`## Conventions`);
    for (const c of scan.conventions) {
      lines.push(`### ${c.pattern}`);
      lines.push(c.description);
      lines.push(`Examples: ${c.examples.join(', ')}`);
      lines.push('');
    }
  }

  // Feature list
  lines.push(`## Features`);
  for (const f of scan.features) {
    lines.push(`### ${f.name}`);
    lines.push(`Key files: ${f.keyFiles.slice(0, 5).join(', ')}`);
    if (f.stores.length) lines.push(`Stores: ${f.stores.join(', ')}`);
    if (f.components.length) lines.push(`Components: ${f.components.length} files`);
    if (f.routes.length) lines.push(`Routes: ${f.routes.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a detailed feature document.
 */
export function generateFeatureDoc(scan: RepoScan, feature: RepoFeature): string {
  const lines: string[] = [];

  lines.push(`# Feature: ${feature.name}`);
  lines.push('');

  lines.push(`## Architecture`);
  lines.push(`This feature spans ${feature.keyFiles.length} key files across ${feature.modules.length} module(s).`);
  lines.push('');

  lines.push(`## Key Files`);
  for (const fp of feature.keyFiles) {
    const file = scan.files.find(f => f.path === fp);
    if (file) {
      const symbols = [...file.exports, ...file.functions.slice(0, 5)].slice(0, 8);
      lines.push(`### ${fp}`);
      lines.push(`- Category: ${file.category}`);
      lines.push(`- Size: ${file.size} bytes (~${file.tokens} tokens)`);
      if (symbols.length > 0) lines.push(`- Exports: \`${symbols.join('`, `')}\``);
      if (file.classes.length > 0) lines.push(`- Classes: \`${file.classes.join('`, `')}\``);
      if (file.types.length > 0) lines.push(`- Types: \`${file.types.join('`, `')}\``);
      lines.push('');
    }
  }

  // Import graph
  if (feature.imports.size > 0) {
    lines.push(`## Data Flow`);
    lines.push('Internal import relationships:');
    lines.push('');
    for (const [file, deps] of feature.imports) {
      lines.push(`- \`${file}\` → ${deps.map(d => `\`${d}\``).join(', ')}`);
    }
    lines.push('');
  }

  // Stores
  if (feature.stores.length > 0) {
    lines.push(`## State Management`);
    for (const sp of feature.stores) {
      const file = scan.files.find(f => f.path === sp);
      if (file) {
        lines.push(`### ${basename(sp)}`);
        lines.push(`- Path: ${sp}`);
        if (file.exports.length > 0) lines.push(`- Actions/Selectors: \`${file.exports.join('`, `')}\``);
        lines.push('');
      }
    }
  }

  // Components
  if (feature.components.length > 0) {
    lines.push(`## Components`);
    for (const cp of feature.components.slice(0, 10)) {
      const file = scan.files.find(f => f.path === cp);
      if (file) {
        lines.push(`- \`${cp}\` — exports: ${file.exports.slice(0, 3).map(e => `\`${e}\``).join(', ') || 'default'}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate the full knowledge base as a map of filename → markdown content.
 */
export function generateKnowledgeBase(scan: RepoScan): Map<string, string> {
  const docs = new Map<string, string>();

  // Overview
  docs.set('00-overview.md', generateOverviewDoc(scan));

  // Per-feature docs
  for (let i = 0; i < scan.features.length; i++) {
    const feature = scan.features[i];
    const slug = feature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `${String(i + 1).padStart(2, '0')}-${slug}.md`;
    docs.set(filename, generateFeatureDoc(scan, feature));
  }

  return docs;
}
