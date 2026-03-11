import { describe, it, expect } from 'vitest';
import {
  exportAgentDirectory,
  parseSimpleYaml,
  parseAgentDirectory,
  agentDirectoryToState,
  type AgentDirectoryFiles,
  type ParsedAgentDirectory,
} from '../../src/utils/agentDirectory';
import type { ExportConfig } from '../../src/utils/agentExport';

// Mock ExportConfig helper
function createMockExportConfig(overrides: Partial<ExportConfig> = {}): ExportConfig {
  return {
    agentMeta: {
      name: 'Test Agent',
      description: 'A test agent for unit testing',
      icon: '🤖',
      avatar: '',
      category: 'general',
      tags: ['test', 'automation'],
    },
    selectedModel: 'claude-3-sonnet',
    tokenBudget: 50000,
    outputFormat: 'markdown',
    outputFormats: ['markdown', 'json'],
    prompt: 'You are a helpful assistant.',
    instructionState: {
      persona: 'Friendly and professional AI assistant',
      tone: 'professional',
      expertise: 4,
      objectives: {
        primary: 'Help users with their tasks efficiently',
        successCriteria: ['User goals achieved', 'Clear communication'],
        failureModes: ['Providing incorrect information', 'Being unhelpful'],
      },
      constraints: {
        neverMakeUp: true,
        askBeforeActions: false,
        stayInScope: true,
        scopeDefinition: 'General assistance tasks',
        useOnlyTools: true,
        limitWords: false,
        wordLimit: 500,
        customConstraints: 'Always be polite\nRespect user privacy',
      },
    },
    agentConfig: {
      temperature: 0.7,
      planningMode: 'single-shot' as const,
      model: 'claude-3-sonnet',
    },
    workflowSteps: [
      { id: 'step-1', label: 'Understand', action: 'Analyze the user request' },
      { id: 'step-2', label: 'Plan', action: 'Create a strategy' },
      { id: 'step-3', label: 'Execute', action: 'Perform the task' },
    ],
    mcpServers: [
      { id: 'test-server', name: 'Test MCP Server', enabled: true, added: true, connected: false, icon: '🔧', capabilities: ['tool'], category: 'development', description: 'A test MCP server' },
    ],
    skills: [
      { id: 'test-skill', name: 'Test Skill', enabled: true, added: true, icon: '🎯', category: 'content', description: 'A test skill' },
    ],
    channels: [
      { sourceId: 'test-channel', name: 'Test Channel', path: '/test/path', category: 'knowledge', enabled: true, knowledgeType: 'evidence', depth: 1, baseTokens: 1000, hint: 'Test data' },
    ],
    connectors: [
      { id: 'test-connector', name: 'Test Connector', service: 'github', direction: 'inbound', enabled: true, hint: 'GitHub integration' },
    ],
    ...overrides,
  };
}

describe('agentDirectory', () => {
  describe('exportAgentDirectory', () => {
    it('produces correct file structure with all required files', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);

      expect(Object.keys(files)).toEqual([
        'agent.yaml',
        'SOUL.md',
        'INSTRUCTIONS.md',
        'TOOLS.md',
        'KNOWLEDGE.md',
        'MEMORY.md',
      ]);

      // All files should have content
      Object.values(files).forEach(content => {
        expect(content).toBeTruthy();
        expect(typeof content).toBe('string');
      });
    });

    it('generates correct agent.yaml content', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);
      const yaml = files['agent.yaml'];

      expect(yaml).toContain('name: Test Agent');
      expect(yaml).toContain('model: claude-3-sonnet');
      expect(yaml).toContain('token_budget: 50000');
      expect(yaml).toContain('version: "1.0.0"');
      expect(yaml).toContain('description: A test agent for unit testing');
      expect(yaml).toContain('temperature: 0.7');
      expect(yaml).toContain('planning: single-shot');
      expect(yaml).toContain('output_format: markdown');
      expect(yaml).toContain('- test');
      expect(yaml).toContain('- automation');
    });

    it('generates correct SOUL.md content', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);
      const soul = files['SOUL.md'];

      expect(soul).toContain('# Test Agent');
      expect(soul).toContain('A test agent for unit testing');
      expect(soul).toContain('## Persona');
      expect(soul).toContain('Friendly and professional AI assistant');
      expect(soul).toContain('**Tone:** professional');
      expect(soul).toContain('**Expertise:** Advanced (4/5)');
    });

    it('generates correct INSTRUCTIONS.md content', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);
      const instructions = files['INSTRUCTIONS.md'];

      expect(instructions).toContain('# Instructions');
      expect(instructions).toContain('## Objective');
      expect(instructions).toContain('Help users with their tasks efficiently');
      expect(instructions).toContain('## Constraints');
      expect(instructions).toContain('Never fabricate information');
      expect(instructions).toContain('Stay within scope: General assistance tasks');
      expect(instructions).toContain('Always be polite');
      expect(instructions).toContain('Respect user privacy');
      expect(instructions).toContain('## Workflow');
      expect(instructions).toContain('1. **Understand** — Analyze the user request');
      expect(instructions).toContain('2. **Plan** — Create a strategy');
      expect(instructions).toContain('3. **Execute** — Perform the task');
    });

    it('generates correct TOOLS.md content', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);
      const tools = files['TOOLS.md'];

      expect(tools).toContain('# Tools');
      expect(tools).toContain('## MCP Servers');
      expect(tools).toContain('### Test MCP Server');
      expect(tools).toContain('A test MCP server');
      expect(tools).toContain('id: test-server');
      expect(tools).toContain('transport: stdio');
      expect(tools).toContain('command: npx');
      expect(tools).toContain('args: ["@test-server/mcp"]');
      expect(tools).toContain('## Skills');
      expect(tools).toContain('- **Test Skill** — A test skill');
    });

    it('generates correct KNOWLEDGE.md content', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);
      const knowledge = files['KNOWLEDGE.md'];

      expect(knowledge).toContain('# Knowledge');
      expect(knowledge).toContain('## Sources');
      expect(knowledge).toContain('### Test Channel');
      expect(knowledge).toContain('- **Path:** `/test/path`');
      expect(knowledge).toContain('- **Type:** evidence');
      expect(knowledge).toContain('- **Hint:** Test data');
      expect(knowledge).toContain('## Connectors');
      expect(knowledge).toContain('- **Test Connector** (github) — inbound, scope: GitHub integration');
      expect(knowledge).toContain('## Budget');
      expect(knowledge).toContain('Token budget: 50000');
    });

    it('generates MEMORY.md with template content', () => {
      const config = createMockExportConfig();
      const files = exportAgentDirectory(config);
      const memory = files['MEMORY.md'];

      expect(memory).toContain('# Memory');
      expect(memory).toContain('<!-- Initial memory for this agent');
    });

    it('handles empty or missing configurations gracefully', () => {
      const minimalConfig = createMockExportConfig({
        agentMeta: {
          name: '',
          description: '',
          icon: '',
          avatar: '',
          category: 'general',
          tags: [],
        },
        instructionState: undefined,
        workflowSteps: [],
        mcpServers: [],
        skills: [],
        channels: [],
        connectors: [],
      });

      const files = exportAgentDirectory(minimalConfig);

      expect(files['agent.yaml']).toContain('name: Untitled Agent');
      expect(files['SOUL.md']).toContain('# Agent');
      expect(files['TOOLS.md']).toContain('No tools configured');
    });

    it('handles special characters in YAML values correctly', () => {
      const config = createMockExportConfig({
        agentMeta: {
          name: 'Agent: With "Special" Characters & Symbols',
          description: 'Multi-line\ndescription with: special chars',
          icon: '🤖',
          avatar: '',
          category: 'general',
          tags: ['tag with spaces', 'tag:with:colons'],
        },
      });

      const files = exportAgentDirectory(config);
      const yaml = files['agent.yaml'];

      expect(yaml).toContain('name: "Agent: With \\"Special\\" Characters & Symbols"');
      expect(yaml).toMatch(/description: \|[\s\S]*Multi-line[\s\S]*description with: special chars/);
      expect(yaml).toContain('- tag with spaces');
      expect(yaml).toContain('- "tag:with:colons"');
    });
  });

  describe('parseSimpleYaml', () => {
    it('parses basic key-value pairs correctly', () => {
      const yaml = `
name: Test Agent
version: "1.0.0"
temperature: 0.7
enabled: true
disabled: false
      `.trim();

      const result = parseSimpleYaml(yaml);

      expect(result).toEqual({
        name: 'Test Agent',
        version: '1.0.0',
        temperature: 0.7,
        enabled: true,
        disabled: false,
      });
    });

    it('parses lists correctly', () => {
      const yaml = `
tags:
- test
- automation
- "quoted tag"
numbers:
- 1
- 2.5
- 0
      `.trim();

      const result = parseSimpleYaml(yaml);

      expect(result).toEqual({
        tags: ['test', 'automation', 'quoted tag'],
        numbers: ['1', '2.5', '0'],
      });
    });

    it('handles quoted strings correctly', () => {
      const yaml = `
singleQuoted: 'single quotes'
doubleQuoted: "double quotes"
noQuotes: no quotes
      `.trim();

      const result = parseSimpleYaml(yaml);

      expect(result).toEqual({
        singleQuoted: 'single quotes',
        doubleQuoted: 'double quotes',
        noQuotes: 'no quotes',
      });
    });

    it('ignores comments and empty lines', () => {
      const yaml = `
# This is a comment
name: Test Agent

# Another comment
version: 1.0
      `.trim();

      const result = parseSimpleYaml(yaml);

      expect(result).toEqual({
        name: 'Test Agent',
        version: 1.0,
      });
    });

    it('parses numbers and booleans correctly', () => {
      const yaml = `
integer: 42
float: 3.14
zero: 0
boolTrue: true
boolFalse: false
stringNumber: "42"
      `.trim();

      const result = parseSimpleYaml(yaml);

      expect(result).toEqual({
        integer: 42,
        float: 3.14,
        zero: 0,
        boolTrue: true,
        boolFalse: false,
        stringNumber: 42,
      });
    });

    it('handles empty input gracefully', () => {
      expect(parseSimpleYaml('')).toEqual({});
      expect(parseSimpleYaml('   \n  \n  ')).toEqual({});
      expect(parseSimpleYaml('# Only comments\n# More comments')).toEqual({});
    });

    it('handles malformed YAML gracefully', () => {
      const yaml = `
name: Test Agent
: missing key
invalid line without colon
key: value
      `.trim();

      const result = parseSimpleYaml(yaml);

      // Should parse what it can
      expect(result.name).toBe('Test Agent');
      expect(result.key).toBe('value');
    });
  });

  describe('agentDirectoryToState', () => {
    it('converts parsed directory back to store state correctly', () => {
      const parsed: ParsedAgentDirectory = {
        agentYaml: {
          name: 'Converted Agent',
          description: 'A converted agent',
          model: 'claude-3-opus',
          token_budget: 100000,
          output_format: 'json',
          temperature: 0.8,
          planning: 'multi-step',
          tags: ['converted', 'test'],
          avatar: '🔄',
          icon: '⚙️',
          category: 'specialized',
        },
      };

      const state = agentDirectoryToState(parsed);

      expect(state.agentMeta).toEqual({
        name: 'Converted Agent',
        description: 'A converted agent',
        avatar: '🔄',
        icon: '⚙️',
        category: 'specialized',
        tags: ['converted', 'test'],
      });

      expect(state.selectedModel).toBe('claude-3-opus');
      expect(state.tokenBudget).toBe(100000);
      expect(state.outputFormat).toBe('json');

      expect(state.agentConfig).toEqual({
        temperature: 0.8,
        planningMode: 'multi-step',
        model: 'claude-3-opus',
      });
    });

    it('handles missing agentYaml gracefully', () => {
      const parsed: ParsedAgentDirectory = {};
      const state = agentDirectoryToState(parsed);

      expect(state).toEqual({});
    });

    it('uses default values for missing properties', () => {
      const parsed: ParsedAgentDirectory = {
        agentYaml: {
          name: 'Minimal Agent',
          // Missing other properties
        },
      };

      const state = agentDirectoryToState(parsed);

      expect(state.agentMeta).toEqual({
        name: 'Minimal Agent',
        description: '',
        avatar: '',
        icon: '',
        category: 'general',
        tags: [],
      });

      expect(state.agentConfig).toEqual({
        temperature: 0.7,
        planningMode: 'single-shot',
        model: '',
      });
    });

    it('handles non-array tags correctly', () => {
      const parsed: ParsedAgentDirectory = {
        agentYaml: {
          name: 'Test Agent',
          tags: 'not-an-array', // Invalid tags
        },
      };

      const state = agentDirectoryToState(parsed);

      expect(state.agentMeta.tags).toEqual([]);
    });
  });

  describe('roundtrip export → parse → state', () => {
    it('preserves agent metadata through export/import cycle', () => {
      const originalConfig = createMockExportConfig();
      
      // Export to directory format
      const files = exportAgentDirectory(originalConfig);
      
      // Parse back from files
      const parsed = parseAgentDirectory(files);
      
      // Convert to state
      const state = agentDirectoryToState(parsed);
      
      // Verify key properties are preserved
      expect(state.agentMeta.name).toBe(originalConfig.agentMeta.name);
      expect(state.agentMeta.description).toBe(originalConfig.agentMeta.description);
      expect(state.selectedModel).toBe(originalConfig.selectedModel);
      expect(state.tokenBudget).toBe(originalConfig.tokenBudget);
      expect(state.outputFormat).toBe(originalConfig.outputFormat);
      
      // Agent config should match
      expect(state.agentConfig.temperature).toBe(originalConfig.agentConfig?.temperature);
      expect(state.agentConfig.planningMode).toBe(originalConfig.agentConfig?.planningMode);
    });
  });

  describe('parseAgentDirectory', () => {
    it('parses all file types correctly', () => {
      const files = {
        'agent.yaml': 'name: Test\nversion: 1.0',
        'SOUL.md': '# Test Agent\n\nPersona content',
        'INSTRUCTIONS.md': '# Instructions\n\nObjectives...',
        'TOOLS.md': '# Tools\n\nMCP Servers...',
        'KNOWLEDGE.md': '# Knowledge\n\nSources...',
        'MEMORY.md': '# Memory\n\nInitial context...',
      };

      const parsed = parseAgentDirectory(files);

      expect(parsed.agentYaml).toEqual({ name: 'Test', version: 1.0 });
      expect(parsed.soul).toBe('# Test Agent\n\nPersona content');
      expect(parsed.instructions).toBe('# Instructions\n\nObjectives...');
      expect(parsed.tools).toBe('# Tools\n\nMCP Servers...');
      expect(parsed.knowledge).toBe('# Knowledge\n\nSources...');
      expect(parsed.memory).toBe('# Memory\n\nInitial context...');
    });

    it('handles missing files gracefully', () => {
      const files = {
        'agent.yaml': 'name: Test',
        'SOUL.md': '# Test Agent',
        // Missing other files
      };

      const parsed = parseAgentDirectory(files);

      expect(parsed.agentYaml).toEqual({ name: 'Test' });
      expect(parsed.soul).toBe('# Test Agent');
      expect(parsed.instructions).toBeUndefined();
      expect(parsed.tools).toBeUndefined();
      expect(parsed.knowledge).toBeUndefined();
      expect(parsed.memory).toBeUndefined();
    });
  });
});