import { describe, it, expect } from 'vitest';
import { REGISTRY_MCP_SERVERS, REGISTRY_SKILLS, REGISTRY_PRESETS, MARKETPLACE_CATEGORIES, RUNTIME_INFO } from '../../src/store/registry';
import { MCP_REGISTRY } from '../../src/store/mcp-registry';

describe('Registry → MCP conversion', () => {
  it('REGISTRY_MCP_SERVERS matches MCP_REGISTRY length', () => {
    expect(REGISTRY_MCP_SERVERS.length).toBe(MCP_REGISTRY.length);
  });

  it('all converted entries have RegistryMcp fields', () => {
    for (const mcp of REGISTRY_MCP_SERVERS) {
      expect(mcp.id).toBeTruthy();
      expect(mcp.name).toBeTruthy();
      expect(mcp.description).toBeTruthy();
      // Remote entries (streamable-http) may not have installCmd or command
      const source = MCP_REGISTRY.find(r => r.id === mcp.id);
      const isRemote = source && !source.command && (source.transport === 'streamable-http' || source.url);
      if (!isRemote) {
        expect(mcp.installCmd, `${mcp.id} missing installCmd`).toBeTruthy();
        expect(mcp.command, `${mcp.id} missing command`).toBeTruthy();
      }
      expect(typeof mcp.installed).toBe('boolean');
      expect(typeof mcp.configured).toBe('boolean');
    }
  });

  it('installCmd is derived from npmPackage', () => {
    for (let i = 0; i < MCP_REGISTRY.length; i++) {
      if (MCP_REGISTRY[i].npmPackage) {
        expect(REGISTRY_MCP_SERVERS[i].installCmd).toContain(MCP_REGISTRY[i].npmPackage);
      }
    }
  });
});

describe('Registry Skills', () => {
  it('has skills defined', () => {
    expect(REGISTRY_SKILLS.length).toBeGreaterThan(10);
  });

  it('all skills have required fields', () => {
    for (const skill of REGISTRY_SKILLS) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.installCmd).toBeTruthy();
      expect(skill.runtimes.length).toBeGreaterThan(0);
    }
  });

  it('skill IDs are unique', () => {
    const ids = REGISTRY_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Registry Presets', () => {
  it('has presets defined', () => {
    expect(REGISTRY_PRESETS.length).toBeGreaterThan(3);
  });

  it('presets reference real skill and MCP IDs', () => {
    const skillIds = new Set(REGISTRY_SKILLS.map((s) => s.id));
    const mcpIds = new Set(REGISTRY_MCP_SERVERS.map((m) => m.id));

    for (const preset of REGISTRY_PRESETS) {
      for (const sid of preset.skills) {
        expect(skillIds.has(sid), `Preset ${preset.id} references unknown skill: ${sid}`).toBe(true);
      }
      for (const mid of preset.mcpServers) {
        expect(mcpIds.has(mid), `Preset ${preset.id} references unknown MCP: ${mid}`).toBe(true);
      }
    }
  });
});

describe('Marketplace categories', () => {
  it('includes expected categories', () => {
    const ids = MARKETPLACE_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('all');
    expect(ids).toContain('coding');
    expect(ids).toContain('data');
    expect(ids).toContain('research');
  });
});

describe('Runtime info', () => {
  it('covers all common runtimes', () => {
    expect(RUNTIME_INFO.claude).toBeDefined();
    expect(RUNTIME_INFO.amp).toBeDefined();
    expect(RUNTIME_INFO.codex).toBeDefined();
    expect(RUNTIME_INFO.openai).toBeDefined();
    expect(RUNTIME_INFO.gemini).toBeDefined();
  });

  it('each runtime has label and color', () => {
    for (const [key, info] of Object.entries(RUNTIME_INFO)) {
      expect(info.label, `${key} missing label`).toBeTruthy();
      expect(info.color, `${key} missing color`).toMatch(/^#/);
    }
  });
});
