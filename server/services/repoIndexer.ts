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
  domainStem: string;
  description: string;
  files: string[];
  keyFiles: string[];
  stores: string[];
  routes: string[];
  components: string[];
  services: string[];
  tests: string[];
  imports: Map<string, string[]>;
  crossFeatureDeps: string[];
  fileCount: number;
  tokenCount: number;
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

// ── Feature Clustering Constants ──

const GENERIC_DIRS = new Set([
  'src', 'lib', 'app', 'server', 'client', 'api',
  'services', 'service', 'store', 'stores', 'state',
  'components', 'component', 'pages', 'page', 'views', 'view',
  'routes', 'route', 'controllers', 'controller',
  'utils', 'util', 'helpers', 'helper', 'common', 'shared',
  'models', 'model', 'types', 'interfaces',
  'panels', 'panel', 'tabs', 'tab', 'layouts', 'layout',
  'middleware', 'middlewares', 'guards', 'pipes',
  'config', 'configs', 'constants',
  'hooks', 'composables', 'providers',
  'assets', 'static', 'public',
  '__tests__', '__mocks__', 'test', 'tests', 'spec', 'specs',
]);

const FUNCTIONAL_SUFFIXES = /(?:Service|Store|Controller|Route|Router|Form|Panel|Component|View|Page|Tab|Utils?|Helpers?|Handler|Manager|Provider|Factory|Adapter|Middleware|Guard|Pipe|Module|Config|Spec|Test|Mock|Fixture|Schema|Model|Entity|DTO|Repository|Gateway|Client|Api|Hook|Composable|Plugin|Decorator|Interceptor|Filter|Resolver|Validator|Transformer|Mapper|Builder|Strategy|Observer|Subscriber|Listener|Worker|Job|Task|Queue|Cache|Logger|Monitor|Migration|Seed|Index)$/;

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

// ── Feature Clustering Helpers ──

function extractDomainStem(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1];
  const baseName = fileName.replace(/\.[^.]+$/, ''); // strip extension

  // Find last non-generic directory
  let specificDir = '';
  for (let i = parts.length - 2; i >= 0; i--) {
    const dir = parts[i].toLowerCase().replace(/[-_]/g, '');
    if (!GENERIC_DIRS.has(dir) && dir.length > 1) {
      specificDir = parts[i];
      break;
    }
  }

  // Strip functional suffix from filename
  const strippedName = baseName.replace(FUNCTIONAL_SUFFIXES, '');

  // If filename is generic (index, main, app, types, utils), use directory
  const GENERIC_NAMES = new Set(['index', 'main', 'app', 'types', 'utils', 'helpers', 'constants', 'config', 'mod']);
  const nameToUse = GENERIC_NAMES.has(strippedName.toLowerCase()) && specificDir
    ? specificDir
    : strippedName;

  // Normalize: camelCase/PascalCase → kebab → lower
  return nameToUse
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase → kebab
    .replace(/[-_]+/g, '-')
    .replace(/\bv\d+$/, '')  // strip version suffix (v2, v3)
    .toLowerCase()
    .replace(/-+$/, '');
}

function resolveImportPath(fromFile: string, importPath: string, allFiles: RepoFile[]): string | null {
  if (!importPath.startsWith('.')) return null; // skip node_modules

  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  let resolved = importPath;

  // Resolve relative path
  if (resolved.startsWith('./')) resolved = resolved.slice(2);
  if (resolved.startsWith('../')) {
    const parts = fromDir.split('/');
    for (const seg of resolved.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    resolved = parts.join('/');
  } else {
    resolved = fromDir ? fromDir + '/' + resolved : resolved;
  }

  // Try exact match, then with extensions
  const candidates = [resolved, resolved + '.ts', resolved + '.tsx', resolved + '.js', resolved + '.jsx', resolved + '/index.ts', resolved + '/index.js'];
  for (const c of candidates) {
    if (allFiles.some(f => f.path === c)) return c;
  }
  return null;
}

function humanizeStem(stem: string): string {
  return stem
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function clusterByDomainAndImports(files: RepoFile[]): Map<string, RepoFile[]> {
  // A) Seed clusters by domain stem
  const stemMap = new Map<string, RepoFile[]>();
  for (const f of files) {
    if (f.category === 'config' || f.category === 'style') continue;
    const stem = extractDomainStem(f.path);
    if (!stemMap.has(stem)) stemMap.set(stem, []);
    stemMap.get(stem)!.push(f);
  }

  // B) Build reverse import index: file path → which files import it
  const importedBy = new Map<string, Set<string>>();
  for (const f of files) {
    for (const imp of f.imports) {
      const resolved = resolveImportPath(f.path, imp, files);
      if (!resolved) continue;
      if (!importedBy.has(resolved)) importedBy.set(resolved, new Set());
      importedBy.get(resolved)!.add(f.path);
    }
  }

  // C) Absorb orphans: files in clusters of size 1
  //    If imported by ≥2 files from the same cluster → join that cluster
  const orphanStems = [...stemMap.entries()].filter(([, fs]) => fs.length === 1);
  for (const [stem, [orphan]] of orphanStems) {
    const importers = importedBy.get(orphan.path);
    if (!importers) continue;

    // Count how many files from each OTHER cluster import this orphan
    const clusterHits = new Map<string, number>();
    for (const importerPath of importers) {
      for (const [otherStem, otherFiles] of stemMap) {
        if (otherStem === stem) continue;
        if (otherFiles.some(f => f.path === importerPath)) {
          clusterHits.set(otherStem, (clusterHits.get(otherStem) ?? 0) + 1);
        }
      }
    }

    // Join the cluster with most imports (≥2 threshold)
    let bestCluster = '';
    let bestCount = 1; // threshold: needs ≥2
    for (const [cs, count] of clusterHits) {
      if (count > bestCount) { bestCluster = cs; bestCount = count; }
    }

    if (bestCluster) {
      stemMap.get(bestCluster)!.push(orphan);
      stemMap.delete(stem);
    }
  }

  return stemMap;
}

function buildFeatures(stemMap: Map<string, RepoFile[]>, allFiles: RepoFile[]): RepoFeature[] {
  const features: RepoFeature[] = [];
  const sharedFiles: RepoFile[] = [];

  // A) Merge micro-clusters (<3 files)
  const microStems = [...stemMap.entries()].filter(([, fs]) => fs.length < 3);
  for (const [stem, fs] of microStems) {
    // Find most-connected larger cluster
    let bestTarget = '';
    let bestConnections = 0;

    for (const [otherStem, otherFiles] of stemMap) {
      if (otherStem === stem || otherFiles.length < 3) continue;
      let connections = 0;
      for (const f of fs) {
        for (const imp of f.imports) {
          const resolved = resolveImportPath(f.path, imp, allFiles);
          if (resolved && otherFiles.some(of => of.path === resolved)) connections++;
        }
      }
      if (connections > bestConnections) { bestTarget = otherStem; bestConnections = connections; }
    }

    if (bestTarget) {
      stemMap.get(bestTarget)!.push(...fs);
    } else {
      sharedFiles.push(...fs);
    }
    stemMap.delete(stem);
  }

  // Add "shared" cluster if any orphans remain
  if (sharedFiles.length > 0) {
    stemMap.set('shared', sharedFiles);
  }

  // B) Build RepoFeature for each cluster
  for (const [stem, clusterFiles] of stemMap) {
    if (clusterFiles.length === 0) continue;

    // Compute import fan-in within cluster
    const fanIn = new Map<string, number>();
    for (const f of clusterFiles) {
      for (const imp of f.imports) {
        const resolved = resolveImportPath(f.path, imp, allFiles);
        if (resolved && clusterFiles.some(cf => cf.path === resolved)) {
          fanIn.set(resolved, (fanIn.get(resolved) ?? 0) + 1);
        }
      }
    }

    const keyFiles = [...clusterFiles]
      .sort((a, b) => (fanIn.get(b.path) ?? 0) - (fanIn.get(a.path) ?? 0))
      .slice(0, 5)
      .map(f => f.path);

    // Internal imports
    const internalImports = new Map<string, string[]>();
    for (const f of clusterFiles) {
      const deps = f.imports
        .map(imp => resolveImportPath(f.path, imp, allFiles))
        .filter((r): r is string => r !== null && clusterFiles.some(cf => cf.path === r));
      if (deps.length > 0) internalImports.set(f.path, deps);
    }

    // Cross-feature deps
    const crossDeps = new Set<string>();
    for (const f of clusterFiles) {
      for (const imp of f.imports) {
        const resolved = resolveImportPath(f.path, imp, allFiles);
        if (!resolved) continue;
        if (clusterFiles.some(cf => cf.path === resolved)) continue; // internal
        // Find which feature owns this file
        for (const [otherStem, otherFiles] of stemMap) {
          if (otherStem === stem) continue;
          if (otherFiles.some(of => of.path === resolved)) {
            crossDeps.add(humanizeStem(otherStem));
          }
        }
      }
    }

    features.push({
      name: humanizeStem(stem),
      domainStem: stem,
      description: '',
      files: clusterFiles.map(f => f.path),
      keyFiles,
      stores: clusterFiles.filter(f => f.category === 'store').map(f => f.path),
      routes: clusterFiles.filter(f => f.category === 'route').map(f => f.path),
      components: clusterFiles.filter(f => f.category === 'component').map(f => f.path),
      services: clusterFiles.filter(f => f.category === 'service').map(f => f.path),
      tests: clusterFiles.filter(f => f.category === 'test').map(f => f.path),
      imports: internalImports,
      crossFeatureDeps: [...crossDeps],
      fileCount: clusterFiles.length,
      tokenCount: clusterFiles.reduce((sum, f) => sum + f.tokens, 0),
    });
  }

  // Cap at 50 features, merge smallest
  features.sort((a, b) => b.fileCount - a.fileCount);
  if (features.length > 50) {
    const kept = features.slice(0, 49);
    const merged = features.slice(49);
    const overflow: RepoFeature = {
      name: 'Other',
      domainStem: 'other',
      description: `${merged.length} small feature clusters merged`,
      files: merged.flatMap(f => f.files),
      keyFiles: merged.flatMap(f => f.keyFiles).slice(0, 5),
      stores: merged.flatMap(f => f.stores),
      routes: merged.flatMap(f => f.routes),
      components: merged.flatMap(f => f.components),
      services: merged.flatMap(f => f.services),
      tests: merged.flatMap(f => f.tests),
      imports: new Map(),
      crossFeatureDeps: [],
      fileCount: merged.reduce((s, f) => s + f.fileCount, 0),
      tokenCount: merged.reduce((s, f) => s + f.tokenCount, 0),
    };
    kept.push(overflow);
    return kept;
  }

  return features;
}

/**
 * Cluster files into feature groups using a 3-pass domain+import algorithm.
 */
function clusterFeatures(files: RepoFile[], _modules: RepoModule[]): RepoFeature[] {
  const stemMap = clusterByDomainAndImports(files);
  return buildFeatures(stemMap, files);
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
  lines.push(`## Features (${scan.features.length} clusters)`);
  lines.push('');
  for (const f of scan.features) {
    const tokK = (f.tokenCount / 1000).toFixed(1);
    lines.push(`### ${f.name} (${f.fileCount} files · ~${tokK}K tokens)`);
    if (f.keyFiles.length > 0) lines.push(`Key: ${f.keyFiles.map(p => p.split('/').pop()).join(', ')}`);
    if (f.crossFeatureDeps.length > 0) lines.push(`Deps: ${f.crossFeatureDeps.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a detailed feature document.
 */
export function generateFeatureDoc(scan: RepoScan, feature: RepoFeature): string {
  const lines: string[] = [];
  const tokK = (feature.tokenCount / 1000).toFixed(1);

  lines.push(`# Feature: ${feature.name}`);
  lines.push(`${feature.fileCount} files · ~${tokK}K tokens`);
  lines.push('');

  // Key Files
  if (feature.keyFiles.length > 0) {
    lines.push(`## Key Files`);
    for (const fp of feature.keyFiles) {
      const file = scan.files.find(f => f.path === fp);
      if (file) {
        const symbols = [...file.exports, ...file.functions.slice(0, 5)].filter(Boolean).slice(0, 8);
        const symStr = symbols.length > 0 ? ` — ${symbols.join(', ')}` : '';
        lines.push(`- ${basename(fp)} (${file.category})${symStr}`);
      }
    }
    lines.push('');
  }

  // Architecture
  lines.push(`## Architecture`);
  if (feature.stores.length > 0) lines.push(`- Stores: ${feature.stores.map(p => basename(p)).join(', ')}`);
  if (feature.routes.length > 0) lines.push(`- Routes: ${feature.routes.map(p => basename(p)).join(', ')}`);
  if (feature.services.length > 0) lines.push(`- Services: ${feature.services.map(p => basename(p)).join(', ')}`);
  if (feature.components.length > 0) lines.push(`- Components: ${feature.components.map(p => basename(p)).join(', ')}`);
  if (feature.tests.length > 0) lines.push(`- Tests: ${feature.tests.map(p => basename(p)).join(', ')}`);
  lines.push('');

  // Dependencies
  if (feature.crossFeatureDeps.length > 0) {
    lines.push(`## Dependencies`);
    lines.push(`- Imports from: ${feature.crossFeatureDeps.join(', ')}`);
    lines.push('');
  }

  // Internal Data Flow
  if (feature.imports.size > 0) {
    lines.push(`## Internal Data Flow`);
    for (const [file, deps] of feature.imports) {
      for (const dep of deps) {
        lines.push(`${basename(file)} → ${basename(dep)}`);
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
    const slug = feature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
    const filename = `${String(i + 1).padStart(2, '0')}-${slug}.md`;
    docs.set(filename, generateFeatureDoc(scan, feature));
  }

  return docs;
}
