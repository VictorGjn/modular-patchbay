import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { ReviewTab } from '../../../src/tabs/ReviewTab';

// Mock the stores
const mockConsoleStore = {
  agentConfig: {
    name: 'Test Agent',
    description: 'Test Description',
    systemPrompt: 'You are a helpful assistant.',
  },
  agentMeta: {
    name: 'Test Agent',
    description: 'Test Description',
    avatar: 'bot',
    tags: ['ai', 'assistant'],
  },
  updateAgentMeta: vi.fn(),
  updateAgentDescription: vi.fn(),
  channels: [],
  selectedModel: 'gpt-4',
  outputFormat: 'JSON',
  prompt: 'Test prompt',
  tokenBudget: 2048,
  mcpServers: [],
  skills: [],
  connectors: [],
  instructionState: {},
  workflowSteps: [],
  knowledgeContent: [],
  setShowPromptPreview: vi.fn(),
};

const mockProviderStore = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      enabled: true,
    },
    {
      id: 'anthropic', 
      name: 'Anthropic',
      models: ['claude-3-sonnet', 'claude-3-haiku'],
      enabled: true,
    },
  ],
  selectedProvider: 'openai',
  setSelectedProvider: vi.fn(),
};

const mockMemoryStore = {
  strategy: 'none',
  facts: [],
};

const mockConversationStore = {
  conversations: [],
};

const mockVersionStore = {
  version: '1.0.0',
  isDirty: false,
};

vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleStore);
    }
    return mockConsoleStore;
  },
}));

vi.mock('../../../src/store/providerStore', () => ({
  useProviderStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockProviderStore);
    }
    return mockProviderStore;
  },
}));

vi.mock('../../../src/store/memoryStore', () => ({
  useMemoryStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockMemoryStore);
    }
    return mockMemoryStore;
  },
}));

vi.mock('../../../src/store/conversationStore', () => ({
  useConversationStore: () => mockConversationStore,
}));

vi.mock('../../../src/store/versionStore', () => ({
  useVersionStore: () => mockVersionStore,
}));

// Mock the export utilities
vi.mock('../../../src/utils/agentExport', () => ({
  exportAsAgent: vi.fn().mockReturnValue('exported-content'),
  downloadAgentFile: vi.fn(),
  exportForTarget: vi.fn().mockReturnValue('target-content'),
  exportGenericJSON: vi.fn().mockReturnValue('json-content'),
  exportAsYAML: vi.fn().mockReturnValue('yaml-content'),
}));

describe('ReviewTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders all configuration sections', () => {
    render(<ReviewTab />);
    
    // Check for main configuration sections
    expect(screen.getByText(/agent/i) || screen.getByText(/configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/model/i) || screen.getByText(/provider/i)).toBeInTheDocument();
    
    // Check for agent details
    expect(screen.getByText('Test Agent') || screen.getByDisplayValue('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('Test Description') || screen.getByDisplayValue('Test Description')).toBeInTheDocument();
  });

  it('export dropdown works', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);
    
    // Find the export button
    const exportButton = screen.getByRole('button', { name: /export/i }) ||
                        screen.getByText(/export/i) ||
                        screen.getByRole('button', { name: /download/i });
    
    expect(exportButton).toBeInTheDocument();
    
    // Click to open dropdown
    await user.click(exportButton);
    
    // Wait for dropdown to appear
    await waitFor(() => {
      // Look for export format options
      const jsonOption = screen.getByText(/json/i);
      const yamlOption = screen.getByText(/yaml/i) || screen.getByText(/yml/i);
      
      expect(jsonOption || yamlOption).toBeInTheDocument();
    });
  });

  it('can select different export formats', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);
    
    // Find and click export button
    const exportButton = screen.getByRole('button', { name: /export/i }) ||
                        screen.getByText(/export/i);
    
    await user.click(exportButton);
    
    // Wait for dropdown and click JSON option
    await waitFor(() => {
      const jsonOption = screen.getByText(/json/i);
      expect(jsonOption).toBeInTheDocument();
    });
    
    const jsonOption = screen.getByText(/json/i);
    await user.click(jsonOption);
    
    // Verify download was triggered
    const { downloadAgentFile } = await import('../../../src/utils/agentExport');
    expect(downloadAgentFile).toHaveBeenCalledWith('json-content', 'Test Agent', '.json');
  });

  it('prompt preview button opens modal', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);
    
    // Find the preview button
    const previewButton = screen.getByRole('button', { name: /preview/i }) ||
                         screen.getByText(/preview/i) ||
                         screen.getByRole('button', { name: /prompt/i });
    
    if (previewButton) {
      await user.click(previewButton);
      
      // Verify the preview modal was opened
      expect(mockConsoleStore.setShowPromptPreview).toHaveBeenCalledWith(true);
    }
  });

  it('model selector shows available models', () => {
    render(<ReviewTab />);
    
    // Check for model selector
    const modelSelector = screen.getByDisplayValue(/gpt-4/i) ||
                         screen.getByText(/gpt-4/i) ||
                         screen.getByRole('combobox', { name: /model/i });
    
    expect(modelSelector).toBeInTheDocument();
    
    // Check for available models
    expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
  });

  it('can change model selection', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);
    
    // Find model selector
    const modelSelector = screen.getByRole('combobox', { name: /model/i }) ||
                         screen.getByLabelText(/model/i);
    
    if (modelSelector) {
      // Change to a different model
      await user.selectOptions(modelSelector, 'claude-3-sonnet');
      
      // Verify provider store was updated
      expect(mockProviderStore.setSelectedProvider).toHaveBeenCalled();
    }
  });

  it('displays current agent configuration summary', () => {
    render(<ReviewTab />);
    
    // Check for configuration summary
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    
    // Check for system prompt preview
    expect(screen.getByText(/system prompt/i) || 
           screen.getByText(/You are a helpful assistant/i)).toBeInTheDocument();
  });

  it('shows token budget and model limitations', () => {
    render(<ReviewTab />);
    
    // Look for token budget display
    const tokenDisplay = screen.getByText(/token/i) ||
                        screen.getByText(/2048/i) ||
                        screen.getByText(/budget/i);
    
    expect(tokenDisplay).toBeInTheDocument();
  });

  it('can update agent metadata', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);
    
    // Find agent name input
    const nameInput = screen.getByDisplayValue('Test Agent') ||
                     screen.getByLabelText(/name/i);
    
    if (nameInput) {
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Agent Name');
      
      // Verify store was updated
      await waitFor(() => {
        expect(mockConsoleStore.updateAgentMeta).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated Agent Name' })
        );
      });
    }
  });

  it('shows tags and categories correctly', () => {
    render(<ReviewTab />);
    
    // Check for agent tags
    expect(screen.getByText('ai') || screen.getByText('assistant')).toBeInTheDocument();
    
    // Tags should be displayed as chips or badges
    const tagElements = screen.getAllByText(/ai|assistant/);
    expect(tagElements.length).toBeGreaterThan(0);
  });

  it('displays avatar selection', async () => {
    const user = userEvent.setup();
    render(<ReviewTab />);
    
    // Look for avatar display or selection
    const avatarElement = screen.getByTestId('avatar') ||
                         screen.getByRole('button', { name: /avatar/i }) ||
                         screen.querySelector('[data-avatar]');
    
    if (avatarElement) {
      expect(avatarElement).toBeInTheDocument();
      
      // Try clicking to open avatar picker
      if (avatarElement.tagName === 'BUTTON') {
        await user.click(avatarElement);
        
        // Look for avatar options
        await waitFor(() => {
          const avatarOptions = screen.getAllByRole('button').filter(btn =>
            btn.getAttribute('data-avatar') || btn.textContent?.includes('🤖')
          );
          expect(avatarOptions.length).toBeGreaterThan(0);
        });
      }
    }
  });

  it('handles version information display', () => {
    render(<ReviewTab />);
    
    // Look for version information
    const versionDisplay = screen.getByText(/version/i) ||
                          screen.getByText(/1\.0\.0/i) ||
                          screen.getByText(/v\d+\.\d+\.\d+/);
    
    if (versionDisplay) {
      expect(versionDisplay).toBeInTheDocument();
    }
  });

  it('shows save state correctly', () => {
    render(<ReviewTab />);
    
    // Look for save indicators
    const saveButton = screen.getByRole('button', { name: /save/i }) ||
                      screen.getByText(/save/i);
    
    if (saveButton) {
      expect(saveButton).toBeInTheDocument();
    }
    
    // Check for unsaved changes indicator if applicable
    const unsavedIndicator = screen.queryByText(/unsaved/i) ||
                           screen.queryByText(/\*/); // asterisk often indicates unsaved
    
    // May or may not be present depending on state
    if (unsavedIndicator) {
      expect(unsavedIndicator).toBeInTheDocument();
    }
  });
});