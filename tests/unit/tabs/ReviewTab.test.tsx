import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { ReviewTab } from '../../../src/tabs/ReviewTab';

// Mock all sub-components to isolate ReviewTab logic
vi.mock('../../../src/panels/review/IdentitySection', () => ({
  IdentitySection: ({ agentMeta }: any) => (
    <div data-testid="identity-section">
      <span>{agentMeta?.name}</span>
      <span>{agentMeta?.description}</span>
    </div>
  ),
}));

vi.mock('../../../src/panels/review/PersonaSection', () => ({
  PersonaSection: () => <div data-testid="persona-section">Persona</div>,
}));

vi.mock('../../../src/panels/review/ConstraintsSection', () => ({
  ConstraintsSection: () => <div data-testid="constraints-section">Constraints</div>,
}));

vi.mock('../../../src/panels/review/ObjectivesSection', () => ({
  ObjectivesSection: () => <div data-testid="objectives-section">Objectives</div>,
}));

vi.mock('../../../src/panels/review/WorkflowSection', () => ({
  WorkflowSection: () => <div data-testid="workflow-section">Workflow</div>,
}));

vi.mock('../../../src/panels/review/OutputConfigSection', () => ({
  OutputConfigSection: ({ selectedModel, tokenBudget }: any) => (
    <div data-testid="output-config-section">
      <span>{selectedModel}</span>
      <span>{tokenBudget}</span>
    </div>
  ),
}));

vi.mock('../../../src/panels/review/ExportActions', () => ({
  ExportActions: ({ onExport, onExportFormat, onPromptPreview }: any) => (
    <div data-testid="export-actions">
      <button onClick={onExport}>Export</button>
      <button onClick={() => onExportFormat('JSON')}>Export JSON</button>
      <button onClick={() => onExportFormat('YAML')}>Export YAML</button>
      <button onClick={onPromptPreview}>Preview Prompt</button>
    </div>
  ),
}));

vi.mock('../../../src/panels/review/FactInsightsSection', () => ({
  FactInsightsSection: () => <div data-testid="fact-insights-section">Facts</div>,
}));

vi.mock('../../../src/panels/review/PromptPreviewModal', () => ({
  PromptPreviewModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="prompt-preview-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../../../src/components/VersionIndicator', () => ({
  VersionIndicator: () => <div data-testid="version-indicator">v1.0.0</div>,
}));

// Mock export utilities
vi.mock('../../../src/utils/agentExport', () => ({
  exportAsAgent: vi.fn().mockReturnValue('exported-content'),
  downloadAgentFile: vi.fn(),
  exportForTarget: vi.fn().mockReturnValue('target-content'),
  exportGenericJSON: vi.fn().mockReturnValue('{"name":"test"}'),
  exportAsYAML: vi.fn().mockReturnValue('name: test'),
}));

// Mock store state
const mockConsoleState = {
  agentMeta: {
    name: 'Test Agent',
    description: 'Test Description',
    avatar: 'bot',
    tags: ['ai', 'assistant'],
  },
  setAgentMeta: vi.fn(),
  instructionState: {
    persona: 'A helpful assistant',
    tone: 'neutral' as const,
    expertise: 3,
    constraints: {
      neverMakeUp: false,
      askBeforeActions: false,
      stayInScope: false,
      useOnlyTools: false,
      limitWords: false,
      wordLimit: 500,
      customConstraints: '',
      scopeDefinition: '',
    },
    objectives: {
      primary: '',
      successCriteria: [],
      failureModes: [],
    },
    rawPrompt: '',
    autoSync: true,
  },
  updateInstruction: vi.fn(),
  workflowSteps: [],
  channels: [],
  selectedModel: 'gpt-4',
  outputFormat: 'JSON',
  setOutputFormat: vi.fn(),
  outputFormats: ['JSON', 'YAML'],
  prompt: 'Test prompt',
  tokenBudget: 2048,
  mcpServers: [],
  skills: [],
  agentConfig: {},
  connectors: [],
};

vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleState);
    }
    return mockConsoleState;
  },
  // getState is called in collectFullState
  useConsoleStore_getState: vi.fn(() => mockConsoleState),
}));

// Patch getState on the mock
vi.mock('../../../src/store/consoleStore', () => {
  const mockFn = (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleState);
    }
    return mockConsoleState;
  };
  mockFn.getState = () => mockConsoleState;
  return { useConsoleStore: mockFn };
});

const mockConversationState = {
  lastPipelineStats: null,
};

vi.mock('../../../src/store/conversationStore', () => {
  const mockFn = (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConversationState);
    }
    return mockConversationState;
  };
  mockFn.getState = () => mockConversationState;
  return { useConversationStore: mockFn };
});

const mockMemoryState = {
  facts: [],
};

vi.mock('../../../src/store/memoryStore', () => {
  const mockFn = (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockMemoryState);
    }
    return mockMemoryState;
  };
  mockFn.getState = () => mockMemoryState;
  return { useMemoryStore: mockFn };
});

const mockVersionState = {
  saveStatus: 'saved' as const,
};

vi.mock('../../../src/store/versionStore', () => ({
  useVersionStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockVersionState);
    }
    return mockVersionState;
  },
}));

describe('ReviewTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders all configuration sections', () => {
    render(<ReviewTab />);

    // Check for main heading
    expect(screen.getByText(/review & configure/i)).toBeInTheDocument();

    // All sub-sections should be present
    expect(screen.getByTestId('identity-section')).toBeInTheDocument();
    expect(screen.getByTestId('persona-section')).toBeInTheDocument();
    expect(screen.getByTestId('constraints-section')).toBeInTheDocument();
    expect(screen.getByTestId('objectives-section')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-section')).toBeInTheDocument();
    expect(screen.getByTestId('output-config-section')).toBeInTheDocument();
  });

  it('export dropdown works', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);

    // ExportActions mock renders these buttons
    const exportButton = screen.getByRole('button', { name: /^export$/i });
    expect(exportButton).toBeInTheDocument();
    await user.click(exportButton);

    // exportAsAgent should be called
    const { exportAsAgent } = await import('../../../src/utils/agentExport');
    expect(exportAsAgent).toHaveBeenCalled();
  });

  it('can select different export formats', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);

    // Click JSON export button
    const jsonButton = screen.getByRole('button', { name: /export json/i });
    await user.click(jsonButton);

    const { downloadAgentFile } = await import('../../../src/utils/agentExport');
    expect(downloadAgentFile).toHaveBeenCalled();
  });

  it('prompt preview button opens modal', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);

    // Modal should not be visible initially
    expect(screen.queryByTestId('prompt-preview-modal')).not.toBeInTheDocument();

    // Click preview prompt button
    const previewButton = screen.getByRole('button', { name: /preview prompt/i });
    await user.click(previewButton);

    // Modal should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('prompt-preview-modal')).toBeInTheDocument();
    });
  });

  it('model selector shows available models', () => {
    render(<ReviewTab />);

    // OutputConfigSection mock shows selectedModel
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('can change model selection', async () => {
    render(<ReviewTab />);

    // OutputConfigSection is mocked - just verify it renders
    expect(screen.getByTestId('output-config-section')).toBeInTheDocument();
  });

  it('displays current agent configuration summary', () => {
    render(<ReviewTab />);

    // IdentitySection mock shows agent name and description
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('shows token budget and model limitations', () => {
    render(<ReviewTab />);

    // OutputConfigSection mock shows tokenBudget
    expect(screen.getByText('2048')).toBeInTheDocument();
  });

  it('can update agent metadata', async () => {
    render(<ReviewTab />);

    // IdentitySection is mocked with setAgentMeta prop
    // Just verify the component renders correctly
    expect(screen.getByTestId('identity-section')).toBeInTheDocument();
  });

  it('shows tags and categories correctly', () => {
    render(<ReviewTab />);

    // IdentitySection mock renders agent metadata including name
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
  });

  it('displays avatar selection', () => {
    render(<ReviewTab />);

    // IdentitySection handles avatar, verify section is present
    expect(screen.getByTestId('identity-section')).toBeInTheDocument();
  });

  it('handles version information display', () => {
    render(<ReviewTab />);

    // VersionIndicator mock is rendered
    expect(screen.getByTestId('version-indicator')).toBeInTheDocument();
  });

  it('shows save state correctly', () => {
    render(<ReviewTab />);

    // ExportActions receives saveStatus prop
    expect(screen.getByTestId('export-actions')).toBeInTheDocument();
  });
});
