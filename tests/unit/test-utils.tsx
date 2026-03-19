import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { create } from 'zustand';
import type { AgentConfig, Skill, McpServer, Provider, Agent } from '../../src/store/knowledgeBase';

// Mock theme setup
const mockThemeStore = create(() => ({
  theme: 'dark' as const,
  toggleTheme: vi.fn(),
}));

// Mock store creators for zustand stores
export const createMockConsoleStore = () => create(() => ({
  // Agent configuration
  agentConfig: {
    name: 'Test Agent',
    description: 'A test agent for unit testing',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant.',
  } as AgentConfig,
  
  // UI state
  currentTab: 0,
  setCurrentTab: vi.fn(),
  
  // Skills and tools
  skills: [] as Skill[],
  mcpServers: [] as McpServer[],
  addSkill: vi.fn(),
  removeSkill: vi.fn(),
  
  // Mock actions
  exportAgent: vi.fn(),
  importAgent: vi.fn(),
  resetAgent: vi.fn(),
  
  // Preset management
  quickStartTemplates: [
    { id: 'research', name: 'Research Assistant', prompt: 'Help me research topics...' },
    { id: 'coding', name: 'Code Helper', prompt: 'Help me with coding tasks...' },
    { id: 'writing', name: 'Writing Assistant', prompt: 'Help me write content...' },
  ],
  selectedTemplate: null,
  selectTemplate: vi.fn(),
}));

export const createMockProviderStore = () => create(() => ({
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      enabled: true,
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      type: 'anthropic',
      models: ['claude-3-sonnet', 'claude-3-haiku'],
      enabled: true,
    },
  ] as Provider[],
  selectedProvider: 'openai',
  setSelectedProvider: vi.fn(),
}));

export const createMockMemoryStore = () => create(() => ({
  strategy: 'none' as const,
  setStrategy: vi.fn(),
  postgresConnection: '',
  setPostgresConnection: vi.fn(),
  redisConnection: '',
  setRedisConnection: vi.fn(),
}));

export const createMockSkillsStore = () => create(() => ({
  availableSkills: [
    {
      id: 'test-skill-1',
      name: 'Test Skill 1',
      description: 'A test skill for unit testing',
      category: 'development',
      enabled: false,
      added: false,
    },
    {
      id: 'test-skill-2',
      name: 'Test Skill 2',
      description: 'Another test skill',
      category: 'analysis',
      enabled: false,
      added: false,
    },
  ] as Skill[],
  selectedSkills: [] as string[],
  toggleSkillSelection: vi.fn(),
  addSelectedSkills: vi.fn(),
  clearSelection: vi.fn(),
}));

// Common fixtures
export const mockAgentConfig: AgentConfig = {
  name: 'Test Agent',
  description: 'A test agent configuration',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'You are a helpful AI assistant for testing.',
  tools: {
    skills: [],
    mcpServers: [],
    knowledge: [],
  },
  memory: {
    strategy: 'none',
  },
  qualifications: {
    requirements: [],
    constraints: [],
  },
};

export const mockProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
    enabled: true,
    config: {},
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    models: ['claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus'],
    enabled: true,
    config: {},
  },
];

export const mockSkills: Skill[] = [
  {
    id: 'research-skill',
    name: 'Research Assistant',
    description: 'Help with research tasks',
    category: 'analysis',
    enabled: false,
    added: false,
    config: {},
  },
  {
    id: 'code-helper',
    name: 'Code Helper',
    description: 'Assist with coding tasks',
    category: 'development',
    enabled: false,
    added: false,
    config: {},
  },
];

// Mock implementations for external dependencies
vi.mock('../../src/store/themeStore', () => ({
  useThemeStore: () => mockThemeStore(),
}));

// Theme provider wrapper
const ThemeWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="theme-wrapper">{children}</div>;
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: ThemeWrapper, ...options });
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { vi } from 'vitest';

// Helper to create clean test environment
export const setupTestEnvironment = () => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
};