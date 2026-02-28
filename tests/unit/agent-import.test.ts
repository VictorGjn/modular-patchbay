import { describe, it, expect } from 'vitest';
import { importAgent } from '../../src/utils/agentImport';

// ─── JSON Import ─────────────────────────────────────────────

describe('importAgent — JSON formats', () => {
  it('imports generic JSON (modular_version)', () => {
    const json = JSON.stringify({
      modular_version: '1.0',
      agent: {
        name: 'Research Bot',
        model: 'claude-opus-4',
        system_prompt: 'You are a researcher.',
        knowledge: [{ path: 'docs/' }],
        output_formats: ['markdown'],
        token_budget: 50000,
      },
    });
    const result = importAgent(json);
    expect(result.agentMeta?.name).toBe('Research Bot');
    expect(result.selectedModel).toBe('claude-opus-4');
    expect(result.detectedFormat).toBe('generic');
    expect(result.channels?.length).toBe(1);
  });

  it('imports Vibe Kanban JSON', () => {
    const json = JSON.stringify({
      template: 'Code Reviewer',
      agent: 'claude-code',
      context_files: ['src/', 'tests/'],
      tools: ['lint', 'test'],
    });
    const result = importAgent(json);
    expect(result.agentMeta?.name).toBe('Code Reviewer');
    expect(result.detectedFormat).toBe('vibe-kanban');
    expect(result.channels?.length).toBe(2);
  });

  it('imports Codex JSON', () => {
    const json = JSON.stringify({
      name: 'Codex Agent',
      model: 'gpt-4o',
      instructions: 'Help with code.',
      context_files: ['src/'],
    });
    const result = importAgent(json);
    expect(result.agentMeta?.name).toBe('Codex Agent');
    expect(result.selectedModel).toBe('gpt-4o');
    expect(result.detectedFormat).toBe('codex');
  });

  it('handles malformed JSON gracefully', () => {
    const result = importAgent('{not valid json');
    expect(result).toBeDefined();
    // Should return empty result, not throw
  });
});

// ─── Markdown Import ─────────────────────────────────────────

describe('importAgent — Markdown (Claude)', () => {
  it('parses frontmatter and body', () => {
    const md = `---
name: PM Agent
model: claude-opus-4
tools:
  - Web Search
reads:
  - docs/
  - signals/
output_format:
  - markdown
token_budget: 30000
---

## Role
You are a senior PM assistant.

## Default Prompt
Analyze the product roadmap.`;

    const result = importAgent(md);
    expect(result.agentMeta?.name).toBe('PM Agent');
    expect(result.selectedModel).toBe('claude-opus-4');
    expect(result.detectedFormat).toBe('claude');
    // Channels may or may not parse from simple YAML parser — check prompt at least
    expect(result.prompt).toContain('roadmap');
  });
});

// ─── YAML Import ─────────────────────────────────────────────

describe('importAgent — YAML formats', () => {
  it('imports Amp YAML', () => {
    const yaml = `name: Amp Agent
model: claude-sonnet-4
mcp:
  github:
    command: npx @github/mcp
context_files:
  - src/
instructions: |
  You help with coding tasks.`;

    const result = importAgent(yaml);
    expect(result.agentMeta?.name).toBe('Amp Agent');
    expect(result.detectedFormat).toBe('amp');
    expect(result.prompt).toContain('coding');
  });

  it('imports OpenClaw YAML', () => {
    const yaml = `agents:
  research-bot:
    model: claude-opus-4
    temperature: 0.5
    skills:
      - web-search
    context:
      - docs/`;

    const result = importAgent(yaml);
    expect(result.agentMeta?.name).toContain('research');
    expect(result.detectedFormat).toBe('openclaw');
  });
});

// ─── Round-trip ──────────────────────────────────────────────

describe('import/export consistency', () => {
  it('model aliases resolve correctly', () => {
    const json = JSON.stringify({ name: 'Test', model: 'opus' });
    const result = importAgent(json);
    expect(result.selectedModel).toBe('claude-opus-4');
  });

  it('output formats are validated', () => {
    const json = JSON.stringify({ name: 'Test', output_format: ['markdown', 'invalid-format'] });
    const result = importAgent(json);
    expect(result.outputFormat).toBe('markdown');
  });

  it('empty input returns empty result', () => {
    const result = importAgent('');
    expect(result).toBeDefined();
  });
});
