import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { AgentLibrary } from '../../../src/components/AgentLibrary';

// Mock config
vi.mock('../../../src/config', () => ({
  API_BASE: 'http://localhost:4800',
}));

// Mock consoleStore — AgentLibrary uses getState() directly for resetAgent/loadDemoPreset
vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleState);
    }
    return mockConsoleState;
  },
  useConsoleStore_getState: vi.fn(() => mockConsoleState),
}));

// Patch getState on the mock (AgentLibrary calls useConsoleStore.getState())
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

const mockConsoleState = {
  resetAgent: vi.fn(),
  loadDemoPreset: vi.fn(),
};

// Sample agents returned by the API
const mockAgents = [
  {
    id: 'agent-111',
    agentMeta: {
      name: 'Research Assistant',
      description: 'Gathers and synthesizes information from multiple sources',
      avatar: 'bot',
      tags: ['research', 'synthesis'],
    },
    savedAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: 'agent-222',
    agentMeta: {
      name: 'Code Reviewer',
      description: 'Reviews code for quality and best practices',
      avatar: 'bot',
      tags: ['code', 'review'],
    },
    savedAt: new Date('2024-01-10').toISOString(),
  },
];

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock TemplateCard to avoid complex rendering
vi.mock('../../../src/components/TemplateCard', () => ({
  TemplateCard: ({ name, onUse, id }: any) => (
    <div data-testid={`template-card-${id}`}>
      <span>{name}</span>
      <button onClick={() => onUse(id)}>Use Template</button>
    </div>
  ),
}));

// Mock demoPresets to keep TEMPLATE_LIST manageable in tests
vi.mock('../../../src/store/demoPresets', () => ({
  DEMO_PRESETS: {
    'preset-pm': {
      agentMeta: {
        name: 'Senior PM',
        description: 'Senior product manager specializing in discovery',
        tags: ['product', 'strategy'],
      },
    },
    'preset-feedback': {
      agentMeta: {
        name: 'Feedback Manager',
        description: 'Manages user feedback lifecycle',
        tags: ['feedback', 'analysis'],
      },
    },
  },
}));

describe('AgentLibrary', () => {
  const onSelectAgent = vi.fn();
  const onNewAgent = vi.fn();

  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
    // Default: successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockAgents }),
    });
  });

  it('renders loading spinner initially', () => {
    // Don't resolve fetch yet — stay in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    // Spinner has role="status" and aria-label="Loading"
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders agent list after loading', async () => {
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });

    expect(screen.getByText('Code Reviewer')).toBeInTheDocument();
  });

  it('renders the Agent Library heading', async () => {
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /agent library/i })).toBeInTheDocument();
    });
  });

  it('renders template cards from DEMO_PRESETS', async () => {
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Senior PM')).toBeInTheDocument();
      expect(screen.getByText('Feedback Manager')).toBeInTheDocument();
    });
  });

  it('New Agent button calls onNewAgent and resets store', async () => {
    const user = userEvent.setup();
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /agent library/i })).toBeInTheDocument();
    });

    const newAgentButton = screen.getByRole('button', { name: /new agent/i });
    await user.click(newAgentButton);

    expect(mockConsoleState.resetAgent).toHaveBeenCalled();
    expect(onNewAgent).toHaveBeenCalled();
  });

  it('search input filters agents by name', async () => {
    const user = userEvent.setup();
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search agents/i);
    await user.type(searchInput, 'Research');

    // Wait for debounce
    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });
  });

  it('search shows no-results state for unmatched query', async () => {
    const user = userEvent.setup();
    // Return no agents so only templates could match
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /agent library/i })).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search agents/i);
    await user.type(searchInput, 'xyznonexistentquery12345');

    await waitFor(() => {
      expect(screen.getAllByText(/no results/i).length).toBeGreaterThan(0);
    });
  });

  it('clicking on an agent card calls onSelectAgent', async () => {
    const user = userEvent.setup();
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });

    const agentCard = screen.getByTitle(/open research assistant/i);
    await user.click(agentCard);

    expect(onSelectAgent).toHaveBeenCalledWith('agent-111');
  });

  it('delete button opens confirmation modal', async () => {
    const user = userEvent.setup();
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });

    // Click the delete button for the first agent
    const deleteButtons = screen.getAllByTitle(/delete agent/i);
    await user.click(deleteButtons[0]);

    // Confirmation modal should appear
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it('cancel in delete modal closes without deleting', async () => {
    const user = userEvent.setup();
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });

    // Open delete modal
    const deleteButtons = screen.getAllByTitle(/delete agent/i);
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });

    // No DELETE fetch was made
    const deleteCalls = mockFetch.mock.calls.filter(([url, opts]) => opts?.method === 'DELETE');
    expect(deleteCalls).toHaveLength(0);
  });

  it('delete confirmation triggers API and removes agent', async () => {
    const user = userEvent.setup();
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    });

    // Set up delete mock
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    // Open delete modal
    const deleteButtons = screen.getAllByTitle(/delete agent/i);
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    // Confirm delete
    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    // Agent should be removed from list
    await waitFor(() => {
      expect(screen.queryByText('Research Assistant')).not.toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      expect(screen.getAllByText(/failed to load agents/i).length).toBeGreaterThan(0);
    });
  });

  it('using a template calls loadDemoPreset and onNewAgent', async () => {
    render(<AgentLibrary onSelectAgent={onSelectAgent} onNewAgent={onNewAgent} />);

    await waitFor(() => {
      // TemplateCard renders "Use Template" buttons
      const useButtons = screen.getAllByRole('button', { name: /use template/i });
      expect(useButtons.length).toBeGreaterThan(0);
    });

    const useButtons = screen.getAllByRole('button', { name: /use template/i });
    await userEvent.click(useButtons[0]);

    expect(mockConsoleState.loadDemoPreset).toHaveBeenCalled();
    expect(onNewAgent).toHaveBeenCalled();
  });
});
