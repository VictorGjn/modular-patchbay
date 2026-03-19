/**
 * Tests for resolveProviderAndModel — the shared provider/model resolution
 * used by both ConversationTester and TestPanel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock stores
let consoleState: any = {};
let providerState: any = {};

vi.mock('../../src/store/consoleStore', () => ({
  useConsoleStore: Object.assign(
    (sel?: any) => sel ? sel(consoleState) : consoleState,
    { getState: () => consoleState, subscribe: () => () => {} },
  ),
}));

vi.mock('../../src/store/providerStore', () => ({
  useProviderStore: Object.assign(
    (sel?: any) => sel ? sel(providerState) : providerState,
    { getState: () => providerState, subscribe: () => () => {} },
  ),
}));

vi.mock('../../src/store/mcpStore', () => ({
  useMcpStore: Object.assign(
    () => ({ getConnectedTools: () => [] }),
    { getState: () => ({ getConnectedTools: () => [] }) },
  ),
}));

vi.mock('../../src/nodes/WorkflowNode', () => ({
  compileWorkflow: () => '',
}));

vi.mock('../../src/store/traceStore', () => ({
  useTraceStore: Object.assign(
    () => ({ startTrace: () => 'x', addEvent: vi.fn(), endTrace: vi.fn() }),
    { getState: () => ({ startTrace: () => 'x', addEvent: vi.fn(), endTrace: vi.fn() }) },
  ),
}));

vi.mock('../../src/store/versionStore', () => ({
  useVersionStore: Object.assign(
    () => ({ currentVersion: '1.0.0' }),
    { getState: () => ({ currentVersion: '1.0.0' }) },
  ),
}));

vi.mock('../../src/store/treeIndexStore', () => ({
  useTreeIndexStore: Object.assign(
    () => ({ getIndex: () => null, indexFiles: vi.fn() }),
    { getState: () => ({ getIndex: () => null, indexFiles: vi.fn() }) },
  ),
}));

vi.mock('../../src/services/llmService', () => ({
  streamCompletion: vi.fn(),
  streamAgentSdk: vi.fn(),
}));

vi.mock('../../src/services/treeIndexer', () => ({
  estimateTokens: (s: string) => Math.ceil(s.length / 4),
}));

vi.mock('../../src/utils/depthFilter', () => ({
  applyDepthFilter: vi.fn(() => ({ filtered: { children: [] }, totalTokens: 0 })),
  renderFilteredMarkdown: vi.fn(() => ''),
}));

vi.mock('../../src/services/pipeline', () => ({
  startPipeline: vi.fn(),
  completePipeline: vi.fn(),
}));

vi.mock('../../src/services/treeNavigator', () => ({
  extractHeadlines: vi.fn(),
  buildNavigationPrompt: vi.fn(),
  parseNavigationResponse: vi.fn(() => []),
}));

vi.mock('../../src/services/frameworkExtractor', () => ({
  extractFramework: vi.fn(),
  compileFrameworkBlocks: vi.fn(() => ({})),
}));

vi.mock('../../src/config', () => ({
  API_BASE: 'http://localhost:4321/api',
}));

// Import after mocks
import { resolveProviderAndModel } from '../../src/services/pipelineChat';

describe('resolveProviderAndModel', () => {
  beforeEach(() => {
    consoleState = {
      selectedModel: 'gpt-4o',
      agentConfig: { model: 'gpt-4o' },
    };
    providerState = {
      selectedProviderId: 'openai',
      providers: [
        {
          id: 'openai',
          status: 'connected',
          models: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }],
        },
      ],
    };
  });

  it('returns the selected provider and matching model', () => {
    const result = resolveProviderAndModel();
    expect(result.providerId).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.error).toBeUndefined();
  });

  it('falls back to first model when agentConfig model is not in provider list', () => {
    consoleState.selectedModel = 'claude-3-opus';
    const result = resolveProviderAndModel();
    expect(result.providerId).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.error).toBeUndefined();
  });

  it('returns error when no provider is selected', () => {
    providerState.selectedProviderId = 'missing';
    const result = resolveProviderAndModel();
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('No provider/model configured');
  });

  it('returns error when provider has no models', () => {
    providerState.providers = [{ id: 'openai', status: 'connected', models: [] }];
    const result = resolveProviderAndModel();
    expect(result.error).toBeTruthy();
  });

  it('returns error when provider is disconnected', () => {
    providerState.providers = [
      { id: 'openai', status: 'disconnected', models: [{ id: 'gpt-4o' }] },
    ];
    const result = resolveProviderAndModel();
    expect(result.error).toBeTruthy();
  });

  it('accepts configured status', () => {
    providerState.providers = [
      { id: 'openai', status: 'configured', models: [{ id: 'gpt-4o' }] },
    ];
    const result = resolveProviderAndModel();
    expect(result.providerId).toBe('openai');
    expect(result.error).toBeUndefined();
  });
});
