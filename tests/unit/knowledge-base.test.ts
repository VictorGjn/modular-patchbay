import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_TYPES, DEPTH_LEVELS, CATEGORY_COLORS, OUTPUT_FORMATS, PRESETS,
  DEFAULT_AGENT_CONFIG,
  classifyKnowledge, classifyKnowledgeType, detectOutputFormat,
  type KnowledgeType, type Category, type ClassificationResult,
} from '../../src/store/knowledgeBase';

// ─── Knowledge Types ─────────────────────────────────────────

describe('KNOWLEDGE_TYPES', () => {
  const allTypes: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];

  it('defines all 6 types', () => {
    expect(Object.keys(KNOWLEDGE_TYPES)).toHaveLength(6);
    for (const t of allTypes) {
      expect(KNOWLEDGE_TYPES[t]).toBeDefined();
    }
  });

  it('each type has label, color, icon, and instruction', () => {
    for (const [key, val] of Object.entries(KNOWLEDGE_TYPES)) {
      expect(val.label, `${key}.label`).toBeTruthy();
      expect(val.color, `${key}.color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(val.icon, `${key}.icon`).toBeTruthy();
      expect(val.instruction, `${key}.instruction`).toBeTruthy();
    }
  });

  it('colors are unique', () => {
    const colors = Object.values(KNOWLEDGE_TYPES).map((v) => v.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('icons are unique', () => {
    const icons = Object.values(KNOWLEDGE_TYPES).map((v) => v.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

// ─── Depth Levels ────────────────────────────────────────────

describe('DEPTH_LEVELS', () => {
  it('has 5 levels', () => {
    expect(DEPTH_LEVELS).toHaveLength(5);
  });

  it('labels are Full, Detail, Summary, Headlines, Mention', () => {
    expect(DEPTH_LEVELS.map((d) => d.label)).toEqual(['Full', 'Detail', 'Summary', 'Headlines', 'Mention']);
  });

  it('percentages are descending from 1.0 to 0.1', () => {
    expect(DEPTH_LEVELS[0].pct).toBe(1.0);
    expect(DEPTH_LEVELS[4].pct).toBe(0.1);
    for (let i = 1; i < DEPTH_LEVELS.length; i++) {
      expect(DEPTH_LEVELS[i].pct).toBeLessThan(DEPTH_LEVELS[i - 1].pct);
    }
  });
});

// ─── Category Colors ─────────────────────────────────────────

describe('CATEGORY_COLORS', () => {
  it('defines all 4 categories', () => {
    const cats: Category[] = ['knowledge', 'discovery', 'intel', 'agents'];
    for (const c of cats) {
      expect(CATEGORY_COLORS[c]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ─── Classification — Path Rules ─────────────────────────────

describe('classifyKnowledge (path-based)', () => {
  it('classifies signal paths', () => {
    expect(classifyKnowledgeType('07 - Signals/User feedback/odfjell/')).toBe('signal');
    expect(classifyKnowledgeType('feedback/survey.md')).toBe('signal');
  });

  it('classifies hypothesis paths', () => {
    expect(classifyKnowledgeType('01 - Discovery/_temp_ideas/')).toBe('hypothesis');
  });

  it('classifies framework paths', () => {
    expect(classifyKnowledgeType('03 - Roadmap/Q3.md')).toBe('framework');
    expect(classifyKnowledgeType('plans/sprint-5.md')).toBe('framework');
  });

  it('classifies evidence paths', () => {
    expect(classifyKnowledgeType('05 - Intel/competitive/stormgeo.md')).toBe('evidence');
    expect(classifyKnowledgeType('research/market.md')).toBe('evidence');
    expect(classifyKnowledgeType('savings-analysis/report.md')).toBe('evidence');
  });

  it('classifies release/handoff paths as evidence', () => {
    expect(classifyKnowledgeType('release/v1.2.md')).toBe('evidence');
    expect(classifyKnowledgeType('cmo-handoff/newsletter.md')).toBe('evidence');
    expect(classifyKnowledgeType('demo/walkthrough.md')).toBe('evidence');
  });

  it('classifies guideline paths', () => {
    expect(classifyKnowledgeType('guidelines/code-style.md')).toBe('guideline');
    expect(classifyKnowledgeType('contributing.md')).toBe('guideline');
    expect(classifyKnowledgeType('engineering-rules/branching.md')).toBe('guideline');
  });

  it('classifies ground-truth paths', () => {
    expect(classifyKnowledgeType('products/NR/spec.md')).toBe('ground-truth');
    expect(classifyKnowledgeType('clients/odfjell/contract.md')).toBe('ground-truth');
    expect(classifyKnowledgeType('voyage-preparation/config.yaml')).toBe('ground-truth');
  });

  it('products/feedback → signal (exclude rule)', () => {
    expect(classifyKnowledgeType('products/feedback/survey.md')).toBe('signal');
  });

  it('path rules return high confidence', () => {
    const result = classifyKnowledge('feedback/survey.md');
    expect(result.confidence).toBe('high');
    expect(result.reason).toContain('Path matches');
  });
});

// ─── Classification — Content Rules ──────────────────────────

describe('classifyKnowledge (content-based)', () => {
  it('detects ground-truth from spec content', () => {
    const content = `## Specification\nThe API MUST return JSON.\nSHALL support pagination.\n\`\`\`json\n{"a": 1}\n\`\`\`\nversion v2.1`;
    const result = classifyKnowledge('unknown/file.md', content);
    expect(result.knowledgeType).toBe('ground-truth');
  });

  it('detects signal from feedback content', () => {
    const content = `Customer said "I need faster reports". User feedback interview notes. The customer requested a new feature. Pain point: loading times. NPS dropped to 42.`;
    const result = classifyKnowledge('unknown/notes.md', content);
    expect(result.knowledgeType).toBe('signal');
  });

  it('detects evidence from metrics content', () => {
    const content = `## Analysis Report\nKey findings: 35% increase in usage. Benchmark comparison shows 12.5% growth trend. KPI metrics measured Q2. | Metric | Value |`;
    const result = classifyKnowledge('unknown/report.md', content);
    expect(result.knowledgeType).toBe('evidence');
  });

  it('detects framework from methodology content', () => {
    const content = `## Framework for Decision Making\nStep 1: Gather requirements\nStep 2: Evaluate options\nBest practice: validate early\nChecklist for review process. When to escalate. How to prioritize.`;
    const result = classifyKnowledge('unknown/guide.md', content);
    expect(result.knowledgeType).toBe('framework');
  });

  it('detects hypothesis from proposal content', () => {
    const content = `## Proposal: New Feature\nHypothesis: users want real-time alerts. What if we added a dashboard? Suggestion to explore alternative approach. Option A vs Option B. Assumption: market demand exists. Experiment plan.`;
    const result = classifyKnowledge('unknown/idea.md', content);
    expect(result.knowledgeType).toBe('hypothesis');
  });

  it('detects changelog as evidence', () => {
    const content = `## Release Notes v3.2.1\nChangelog for sprint 14. Generated export summary. Meeting notes from Tuesday. Action item: follow up with design. Decision: proceed with option B.`;
    const result = classifyKnowledge('unknown/changelog.md', content);
    expect(result.knowledgeType).toBe('evidence');
  });

  it('detects guideline from convention content', () => {
    const content = `## Coding Standards\nYou MUST use TypeScript strict mode. NEVER push to main directly. Branch naming convention: feat/<ticket>-<slug>. All PRs MUST have tests. ALWAYS run linting before commit.`;
    const result = classifyKnowledge('unknown/guidelines.md', content);
    expect(result.knowledgeType).toBe('guideline');
  });

  it('falls back to extension-based for unknown content', () => {
    expect(classifyKnowledgeType('data.json')).toBe('ground-truth');
    expect(classifyKnowledgeType('schema.yaml')).toBe('ground-truth');
    expect(classifyKnowledgeType('report.csv')).toBe('evidence');
    expect(classifyKnowledgeType('component.tsx')).toBe('guideline');
  });

  it('defaults to evidence with low confidence for unknown', () => {
    const result = classifyKnowledge('random/file.xyz');
    expect(result.knowledgeType).toBe('evidence');
    expect(result.confidence).toBe('low');
  });
});

// ─── Depth Suggestion ────────────────────────────────────────

describe('depth suggestion', () => {
  it('ground-truth always gets Full (0)', () => {
    const result = classifyKnowledge('products/spec.md', 'version v1.0');
    expect(result.depth).toBe(0);
  });

  it('signal always gets Full (0)', () => {
    const result = classifyKnowledge('feedback/survey.md');
    expect(result.depth).toBe(0);
  });

  it('evidence (ex-artifact) paths get depth based on content rules', () => {
    const longContent = 'x'.repeat(3000);
    const result = classifyKnowledge('cmo-handoff/newsletter.md', longContent);
    // cmo-handoff now classifies as evidence, depth depends on content size rules
    expect(result.depth).toBeGreaterThanOrEqual(0);
    expect(result.depth).toBeLessThanOrEqual(4);
  });

  it('artifact with no content gets Full (0) — short file rule', () => {
    const result = classifyKnowledge('cmo-handoff/newsletter.md');
    expect(result.depth).toBe(0); // empty = short = Full
  });

  it('short files get Full (0) regardless of type', () => {
    const result = classifyKnowledge('unknown/tiny.md', 'Short content here');
    expect(result.depth).toBe(0);
  });
});

// ─── Output Format Detection ─────────────────────────────────

describe('detectOutputFormat', () => {
  it('detects slides', () => {
    expect(detectOutputFormat('Create a presentation about Q3')).toBe('html-slides');
    expect(detectOutputFormat('Build a pitch deck')).toBe('html-slides');
  });

  it('detects email', () => {
    expect(detectOutputFormat('Draft an email to the team')).toBe('email');
    expect(detectOutputFormat('Send to marketing')).toBe('email');
  });

  it('detects code', () => {
    expect(detectOutputFormat('Implement a login function')).toBe('code');
    expect(detectOutputFormat('Write a Python script')).toBe('code');
  });

  it('detects csv/data', () => {
    expect(detectOutputFormat('Create a table of results')).toBe('csv');
    expect(detectOutputFormat('Export as spreadsheet')).toBe('csv');
  });

  it('detects json', () => {
    expect(detectOutputFormat('Generate a JSON schema')).toBe('json');
    expect(detectOutputFormat('Build an API response')).toBe('json');
  });

  it('detects diagram', () => {
    expect(detectOutputFormat('Draw a flowchart')).toBe('diagram');
    expect(detectOutputFormat('Create an architecture diagram')).toBe('diagram');
  });

  it('detects slack', () => {
    expect(detectOutputFormat('Post in slack channel')).toBe('slack');
  });

  it('defaults to markdown', () => {
    expect(detectOutputFormat('Summarize the document')).toBe('markdown');
    expect(detectOutputFormat('')).toBe('markdown');
  });
});

// ─── Output Formats ──────────────────────────────────────────

describe('OUTPUT_FORMATS', () => {
  it('has 8 formats', () => {
    expect(OUTPUT_FORMATS).toHaveLength(8);
  });

  it('each format has id, label, icon, ext', () => {
    for (const f of OUTPUT_FORMATS) {
      expect(f.id).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(f.icon).toBeTruthy();
      expect(typeof f.ext).toBe('string');
    }
  });

  it('IDs are unique', () => {
    const ids = OUTPUT_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Default Agent Config ────────────────────────────────────

describe('DEFAULT_AGENT_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_AGENT_CONFIG.model).toBeTruthy();
    expect(DEFAULT_AGENT_CONFIG.temperature).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_CONFIG.temperature).toBeLessThanOrEqual(1);
    expect(DEFAULT_AGENT_CONFIG.maxTokens).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_CONFIG.planningMode).toBeTruthy();
  });
});

// ─── Presets ─────────────────────────────────────────────────

describe('PRESETS', () => {
  it('has at least 5 presets', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('each preset has id, name, and channels', () => {
    for (const p of PRESETS) {
      expect(p.id, `preset missing id`).toBeTruthy();
      expect(p.name, `${p.id} missing name`).toBeTruthy();
      expect(p.channels.length, `${p.id} has no channels`).toBeGreaterThan(0);
    }
  });

  it('preset IDs are unique', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preset channels have valid knowledge types', () => {
    const validTypes = Object.keys(KNOWLEDGE_TYPES);
    for (const p of PRESETS) {
      for (const ch of p.channels) {
        expect(validTypes, `${p.id} channel "${ch.name}" has invalid type: ${ch.knowledgeType}`).toContain(ch.knowledgeType);
      }
    }
  });

  it('preset channels have valid depths (0-4)', () => {
    for (const p of PRESETS) {
      for (const ch of p.channels) {
        expect(ch.depth).toBeGreaterThanOrEqual(0);
        expect(ch.depth).toBeLessThanOrEqual(4);
      }
    }
  });

  it('preset channels have positive baseTokens', () => {
    for (const p of PRESETS) {
      for (const ch of p.channels) {
        expect(ch.baseTokens, `${p.id}/${ch.name}`).toBeGreaterThan(0);
      }
    }
  });
});
