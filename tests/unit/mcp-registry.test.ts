import { describe, it, expect } from 'vitest';
import { MCP_REGISTRY, type McpRegistryEntry } from '../../src/store/mcp-registry';

describe('MCP Registry', () => {
  it('has at least 100 entries', () => {
    expect(MCP_REGISTRY.length).toBeGreaterThanOrEqual(100);
  });

  // Remote entries (streamable-http, sse without command) don't have npmPackage or command
  const isRemoteEntry = (e: McpRegistryEntry) => !e.command && (e.transport === 'streamable-http' || e.url);
  const localEntries = () => MCP_REGISTRY.filter(e => !isRemoteEntry(e));

  it('all entries have required fields', () => {
    for (const entry of MCP_REGISTRY) {
      expect(entry.id, `${entry.name} missing id`).toBeTruthy();
      expect(entry.name, `${entry.id} missing name`).toBeTruthy();
      expect(entry.description, `${entry.id} missing description`).toBeTruthy();
      expect(entry.icon, `${entry.id} missing icon`).toBeTruthy();
      expect(entry.category, `${entry.id} missing category`).toBeTruthy();
      expect(entry.author, `${entry.id} missing author`).toBeTruthy();
      expect(entry.transport, `${entry.id} missing transport`).toBeTruthy();
      expect(entry.defaultArgs, `${entry.id} missing defaultArgs`).toBeDefined();
      expect(entry.configFields, `${entry.id} missing configFields`).toBeDefined();
      expect(entry.tags, `${entry.id} missing tags`).toBeDefined();
      expect(entry.runtimes.length, `${entry.id} has no runtimes`).toBeGreaterThan(0);
      // Local entries must have npmPackage and command
      if (!isRemoteEntry(entry)) {
        expect(entry.npmPackage, `${entry.id} missing npmPackage`).toBeTruthy();
        expect(entry.command, `${entry.id} missing command`).toBeTruthy();
      }
    }
  });

  it('all IDs are unique', () => {
    const ids = MCP_REGISTRY.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    if (unique.size !== ids.length) {
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      throw new Error(`Duplicate IDs: ${dupes.join(', ')}`);
    }
  });

  it('categories are valid', () => {
    const validCategories = ['all', 'research', 'coding', 'data', 'design', 'writing', 'domain'];
    for (const entry of MCP_REGISTRY) {
      expect(validCategories, `${entry.id} has invalid category: ${entry.category}`).toContain(entry.category);
    }
  });

  it('transports are valid', () => {
    const validTransports = ['stdio', 'sse', 'streamable-http'];
    for (const entry of MCP_REGISTRY) {
      expect(validTransports, `${entry.id} has invalid transport: ${entry.transport}`).toContain(entry.transport);
    }
  });

  it('commands are valid (npx, uvx, docker, node, python)', () => {
    const validCommands = ['npx', 'uvx', 'docker', 'node', 'python', 'python3', 'deno'];
    for (const entry of localEntries()) {
      expect(validCommands, `${entry.id} has unexpected command: ${entry.command}`).toContain(entry.command);
    }
  });

  it('configFields have proper structure', () => {
    for (const entry of MCP_REGISTRY) {
      for (const field of entry.configFields) {
        expect(field.key, `${entry.id} field missing key`).toBeTruthy();
        expect(field.label, `${entry.id} field ${field.key} missing label`).toBeTruthy();
        expect(['text', 'password', 'url'], `${entry.id} field ${field.key} invalid type`).toContain(field.type);
        expect(typeof field.required).toBe('boolean');
      }
    }
  });

  it('category distribution is reasonable', () => {
    const counts: Record<string, number> = {};
    for (const entry of MCP_REGISTRY) {
      counts[entry.category] = (counts[entry.category] || 0) + 1;
    }
    // Each category should have at least a few entries
    expect(counts['coding'] || 0).toBeGreaterThanOrEqual(10);
    expect(counts['data'] || 0).toBeGreaterThanOrEqual(10);
    expect(counts['research'] || 0).toBeGreaterThanOrEqual(5);
  });

  it('official MCP servers are present', () => {
    const officialIds = ['mcp-filesystem', 'mcp-memory', 'mcp-fetch', 'mcp-git', 'mcp-sequential-thinking'];
    for (const id of officialIds) {
      expect(MCP_REGISTRY.find((e) => e.id === id), `Missing official server: ${id}`).toBeDefined();
    }
  });

  it('popular community servers are present', () => {
    const popular = ['mcp-github', 'mcp-postgres', 'mcp-slack', 'mcp-notion', 'mcp-brave-search'];
    for (const id of popular) {
      const found = MCP_REGISTRY.find((e) => e.id === id);
      expect(found, `Missing popular server: ${id}`).toBeDefined();
    }
  });

  it('secret fields (API keys, tokens, secrets) use password type', () => {
    // Only check fields that are clearly secrets — exclude ACCESS_KEY_ID (username-like), paths, etc.
    const secretPatterns = ['api_key', 'apikey', 'secret', 'token'];
    const nonSecretPatterns = ['access_key_id', 'key_path', 'key_id'];

    for (const entry of MCP_REGISTRY) {
      for (const field of entry.configFields) {
        const lower = field.key.toLowerCase();
        const isSecret = secretPatterns.some((p) => lower.includes(p));
        const isExempt = nonSecretPatterns.some((p) => lower.includes(p));
        if (isSecret && !isExempt) {
          expect(field.type, `${entry.id}.${field.key} should be password type`).toBe('password');
        }
      }
    }
  });

  it('npmPackage names look valid', () => {
    for (const entry of localEntries()) {
      // npm packages should start with @, a letter, or a digit
      expect(entry.npmPackage, `${entry.id} has invalid npm package: ${entry.npmPackage}`).toMatch(/^[@a-z0-9]/);
    }
  });

  it('tags are non-empty arrays of strings', () => {
    for (const entry of MCP_REGISTRY) {
      expect(Array.isArray(entry.tags), `${entry.id} tags is not an array`).toBe(true);
      expect(entry.tags.length, `${entry.id} has no tags`).toBeGreaterThan(0);
      for (const tag of entry.tags) {
        expect(typeof tag).toBe('string');
        expect(tag.length).toBeGreaterThan(0);
      }
    }
  });
});
