import { describe, it, expect } from 'vitest';
import {
  exportForClaude, exportForAmp, exportForCodex,
  exportForVibeKanban, exportForOpenClaw, exportGenericJSON,
  exportForTarget, TARGET_META,
  type ExportConfig,
} from '../../src/utils/agentExport';

function makeConfig(overrides?: Partial<ExportConfig>): ExportConfig {
  return {
    channels: [
      { sourceId: 'ch1', name: 'Docs', path: 'docs/', category: 'knowledge', knowledgeType: 'ground-truth', enabled: true, depth: 0, baseTokens: 5000 },
      { sourceId: 'ch2', name: 'Signals', path: 'signals/', category: 'intel', knowledgeType: 'signal', enabled: true, depth: 1, baseTokens: 3000 },
      { sourceId: 'ch3', name: 'Disabled', path: 'old/', category: 'knowledge', knowledgeType: 'guideline', enabled: false, depth: 2, baseTokens: 1000 },
    ],
    selectedModel: 'claude-opus-4',
    outputFormat: 'markdown',
    outputFormats: ['markdown', 'json'],
    prompt: 'Analyze the docs and produce a report.',
    tokenBudget: 50000,
    mcpServers: [
      { id: 'mcp1', name: 'GitHub', icon: 'git', connected: true, enabled: true, added: true, capabilities: ['read'], category: 'development', description: 'GitHub MCP' },
    ] as any,
    skills: [
      { id: 'sk1', name: 'Web Search', icon: 'search', enabled: true, added: true, description: 'Search', category: 'analysis' },
    ] as any,
    agentMeta: { name: 'Test Agent', description: 'A test agent', icon: 'brain', category: 'research', tags: ['test'], avatar: '🧪' },
    agentConfig: { model: 'claude-opus-4', temperature: 0.5, systemPrompt: '', planningMode: 'chain-of-thought' as any, maxTokens: 8192 },
    connectors: [],
    ...overrides,
  };
}

// ─── Claude Export ───────────────────────────────────────────

describe('exportForClaude', () => {
  it('produces valid frontmatter + markdown', () => {
    const result = exportForClaude(makeConfig());
    expect(result).toContain('---');
    expect(result).toContain('name: Test Agent');
    expect(result).toContain('model: claude-opus-4');
    expect(result).toContain('## Role');
  });

  it('includes tools in frontmatter', () => {
    const result = exportForClaude(makeConfig());
    expect(result).toContain('tools:');
    expect(result).toContain('Web Search');
  });

  it('includes MCP servers', () => {
    const result = exportForClaude(makeConfig());
    expect(result).toContain('mcp_servers:');
  });

  it('includes reads (only enabled channels)', () => {
    const result = exportForClaude(makeConfig());
    expect(result).toContain('docs/');
    expect(result).toContain('signals/');
    expect(result).not.toContain('old/');  // disabled channel
  });

  it('includes output_format', () => {
    const result = exportForClaude(makeConfig());
    expect(result).toContain('output_format:');
    expect(result).toContain('markdown');
  });
});

// ─── Amp Export ──────────────────────────────────────────────

describe('exportForAmp', () => {
  it('produces valid YAML', () => {
    const result = exportForAmp(makeConfig());
    expect(result).toContain('name: Test Agent');
    expect(result).toContain('model: claude-opus-4');
  });

  it('includes MCP as object keys', () => {
    const result = exportForAmp(makeConfig());
    expect(result).toContain('mcp:');
  });

  it('includes instructions', () => {
    const result = exportForAmp(makeConfig());
    expect(result).toContain('instructions: |');
  });
});

// ─── Codex Export ────────────────────────────────────────────

describe('exportForCodex', () => {
  it('produces valid JSON', () => {
    const result = exportForCodex(makeConfig());
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Test Agent');
    expect(parsed.model).toBe('claude-opus-4');
  });

  it('includes tools and mcp_servers', () => {
    const parsed = JSON.parse(exportForCodex(makeConfig()));
    expect(parsed.tools).toContain('Web Search');
    expect(parsed.mcp_servers.length).toBeGreaterThan(0);
  });

  it('includes context_files from enabled channels', () => {
    const parsed = JSON.parse(exportForCodex(makeConfig()));
    expect(parsed.context_files).toContain('docs/');
    expect(parsed.context_files).not.toContain('old/');
  });
});

// ─── Vibe Kanban Export ──────────────────────────────────────

describe('exportForVibeKanban', () => {
  it('produces valid JSON with template field', () => {
    const parsed = JSON.parse(exportForVibeKanban(makeConfig()));
    expect(parsed.template).toBe('Test Agent');
    expect(parsed.agent).toBe('claude-code');
    expect(Array.isArray(parsed.context_files)).toBe(true);
  });

  it('includes mcp_config as object', () => {
    const parsed = JSON.parse(exportForVibeKanban(makeConfig()));
    expect(typeof parsed.mcp_config).toBe('object');
  });
});

// ─── OpenClaw Export ─────────────────────────────────────────

describe('exportForOpenClaw', () => {
  it('produces YAML with agents: top-level key', () => {
    const result = exportForOpenClaw(makeConfig());
    expect(result).toContain('agents:');
    expect(result).toContain('test-agent:');
    expect(result).toContain('model: claude-opus-4');
  });

  it('includes skills and mcp', () => {
    const result = exportForOpenClaw(makeConfig());
    expect(result).toContain('skills:');
  });
});

// ─── Generic JSON Export ─────────────────────────────────────

describe('exportGenericJSON', () => {
  it('produces valid JSON with modular_version', () => {
    const parsed = JSON.parse(exportGenericJSON(makeConfig()));
    expect(parsed.modular_version).toBe('1.0');
    expect(parsed.agent).toBeDefined();
    expect(parsed.agent.name).toBe('Test Agent');
  });

  it('includes connections array', () => {
    const parsed = JSON.parse(exportGenericJSON(makeConfig()));
    expect(parsed.agent.connections).toBeDefined();
    expect(Array.isArray(parsed.agent.connections)).toBe(true);
  });
});

// ─── exportForTarget ─────────────────────────────────────────

describe('exportForTarget', () => {
  it('routes to correct exporter', () => {
    const targets = ['claude', 'amp', 'codex', 'vibe-kanban', 'openclaw', 'generic'] as const;
    for (const target of targets) {
      const result = exportForTarget(target, makeConfig());
      expect(result.length, `${target} export is empty`).toBeGreaterThan(10);
    }
  });
});

// ─── TARGET_META ─────────────────────────────────────────────

describe('TARGET_META', () => {
  it('has all 6 targets', () => {
    const targets = ['claude', 'amp', 'codex', 'vibe-kanban', 'openclaw', 'generic'];
    for (const t of targets) {
      expect(TARGET_META[t as keyof typeof TARGET_META]).toBeDefined();
    }
  });

  it('each target has name, ext, mime', () => {
    for (const [key, meta] of Object.entries(TARGET_META)) {
      expect(meta.name, `${key}.name`).toBeTruthy();
      expect(meta.ext, `${key}.ext`).toBeDefined();
      expect(meta.mime, `${key}.mime`).toBeTruthy();
    }
  });
});

// ─── Edge Cases ──────────────────────────────────────────────

describe('export edge cases', () => {
  it('handles empty channels', () => {
    const result = exportForClaude(makeConfig({ channels: [] }));
    expect(result).toContain('---');
    expect(result).not.toContain('reads:');
  });

  it('handles empty prompt', () => {
    const result = exportForClaude(makeConfig({ prompt: '' }));
    expect(result).toContain('---');
  });

  it('handles empty agentMeta name (derives from prompt)', () => {
    const result = exportForClaude(makeConfig({
      agentMeta: { name: '', description: '', icon: '', category: '', tags: [], avatar: '' },
    }));
    expect(result).toContain('name:');
  });

  it('handles no skills or MCP', () => {
    const result = exportForClaude(makeConfig({ skills: [], mcpServers: [] }));
    expect(result).toContain('---');
  });
});
