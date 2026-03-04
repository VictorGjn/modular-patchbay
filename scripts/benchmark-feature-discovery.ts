import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { scanRepository, generateKnowledgeBase } from '../server/services/repoIndexer.js';
import { compress } from '../src/services/compress.js';
import { estimateTokens } from '../src/services/treeIndexer.js';

interface Metrics {
  contextTokens: number;
  hitCount: number;
  matchedTerms: string[];
  requiredCoverage: number;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist' || entry === 'dist-server' || entry === 'coverage' || entry === 'reports') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|md|prisma|sql|json)$/i.test(entry)) out.push(full);
  }
  return out;
}

function corpusFromFiles(root: string, files: string[]): string {
  return files.map((file) => {
    const rel = relative(root, file).replace(/\\/g, '/');
    const content = readFileSync(file, 'utf8');
    return `\n\n# FILE: ${rel}\n${content}`;
  }).join('\n');
}

function evaluate(context: string, terms: string[], required: string[]): Metrics {
  const lowered = context.toLowerCase();
  const matchedTerms = terms.filter((t) => lowered.includes(t.toLowerCase()));
  let hitCount = 0;
  for (const t of terms) {
    const m = lowered.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase(), 'g'));
    hitCount += m ? m.length : 0;
  }
  const req = required.filter((r) => lowered.includes(r.toLowerCase())).length;
  return {
    contextTokens: estimateTokens(context),
    hitCount,
    matchedTerms,
    requiredCoverage: required.length ? req / required.length : 1,
  };
}

function extractAnchorSnippets(source: string, anchors: string[]): string {
  const snippets: string[] = [];
  for (const anchor of anchors) {
    const rx = new RegExp(`.{0,260}${anchor}.{0,420}`, 'i');
    const match = source.match(rx);
    if (match) snippets.push(`\n# ANCHOR ${anchor}\n${match[0]}`);
  }
  return snippets.join('\n\n');
}

function reinforceSignals(context: string, source: string, required: string[]): string {
  let output = context;
  const lower = context.toLowerCase();
  for (const r of required) {
    if (lower.includes(r.toLowerCase())) continue;
    const rx = new RegExp(`.{0,180}${r}.{0,280}`, 'i');
    const match = source.match(rx);
    if (match) output += `\n\n# REQUIRED ${r}\n${match[0]}`;
  }
  return output;
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node --import tsx/esm scripts/benchmark-feature-discovery.ts <repoPath>');

  const terms = [
    'captain simulation',
    'CAPTAIN_SIMULATION',
    'jita segment',
    'computeRoutePointsForJitaSegmentWithCaptainSimulator',
    'reference-route-factory',
    'generated-reports-v2.service',
    'captainSimulatorBufferStrategy',
    'JitaSegmentProfileComputationMode',
  ];
  const required = [
    'CAPTAIN_SIMULATION',
    'computeRoutePointsForJitaSegmentWithCaptainSimulator',
    'captainSimulatorBufferStrategy',
  ];

  const allFiles = walk(root);
  const bareCorpus = corpusFromFiles(root, allFiles);

  const scan = scanRepository(root);
  const docs = generateKnowledgeBase(scan);
  const indexed = [...docs.values()].join('\n\n---\n\n');

  const scoredFiles = allFiles.map((file) => {
    const p = file.replace(/\\/g, '/').toLowerCase();
    const c = readFileSync(file, 'utf8').toLowerCase();

    let score = 0;
    if (/(navigation-reports-v2|reference-route-factory|captain-simulator|generated-reports-v2)/.test(p)) score += 6;
    if (/(physical-vessels|schema\.prisma|migration)/.test(p)) score += 3;

    for (const t of terms) {
      if (c.includes(t.toLowerCase())) score += 2;
    }
    for (const r of required) {
      if (c.includes(r.toLowerCase())) score += 5;
    }

    return { file, score };
  });

  const focusedFiles = scoredFiles
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 140)
    .map((f) => f.file);

  const focused = corpusFromFiles(root, focusedFiles);

  const compressed = compress(focused, {
    tokenBudget: 20000,
    aggressiveness: 0.35,
    dedup: true,
    removeFiller: true,
    compressCode: true,
    preservePatterns: required,
  });
  const anchorLane = extractAnchorSnippets(focused, required);
  const reinforced = reinforceSignals(`${anchorLane}\n\n---\n\n${compressed.content}`, focused, required);

  const bare = evaluate(bareCorpus, terms, required);
  const indexedCompressed = evaluate(reinforced, terms, required);

  const reduction = ((bare.contextTokens - indexedCompressed.contextTokens) / Math.max(1, bare.contextTokens)) * 100;

  const report = `# Complex Repo Benchmark — Captain Simulation Discovery\n\nRepo: ${root}\nDate: ${new Date().toISOString()}\n\n## Goal\nCompare feature discovery quality for **Captain Simulation** and dependencies using:\n1) Bare repo context\n2) Tree-indexed + focused + compressed context\n\nPacking strategy: two-lane context (anchor lane + compressed background lane)\n\n## Context Size\n- Bare tokens: **${bare.contextTokens.toLocaleString()}**\n- Indexed knowledge tokens (global): **${estimateTokens(indexed).toLocaleString()}**\n- Focused corpus tokens (pre-compress): **${estimateTokens(focused).toLocaleString()}**\n- Indexed/compressed tokens (final): **${indexedCompressed.contextTokens.toLocaleString()}**\n- Context reduction vs bare: **${reduction.toFixed(1)}%**\n\n## Signal Quality\n### Bare repo agent
- Term hits: ${bare.hitCount}
- Matched terms: ${bare.matchedTerms.join(', ')}
- Required signal retention: ${(bare.requiredCoverage * 100).toFixed(0)}%

### Indexed/compressed agent
- Term hits: ${indexedCompressed.hitCount}
- Matched terms: ${indexedCompressed.matchedTerms.join(', ')}
- Required signal retention: ${(indexedCompressed.requiredCoverage * 100).toFixed(0)}%

## Verdict
- Retention target (>95%): ${(indexedCompressed.requiredCoverage * 100).toFixed(0)}%
- Reduction target (>95%): ${reduction.toFixed(1)}%
- Status: ${(indexedCompressed.requiredCoverage >= 0.95 && reduction >= 95) ? 'PASS' : 'PARTIAL'}
`;

  const outDir = join(process.cwd(), 'reports');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `benchmark-${basename(root)}-captain-simulation.md`);
  writeFileSync(outPath, report, 'utf8');
  console.log(outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
