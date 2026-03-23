import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { DescribeTab } from '../../../src/tabs/DescribeTab';

// Mock generateAgent to avoid async AI calls
vi.mock('../../../src/utils/generateAgent', () => ({
  generateFullAgent: vi.fn().mockResolvedValue({
    agentMeta: { name: 'Generated Agent', description: 'Generated' },
    workflowSteps: [],
    skillIds: [],
    mcpServerIds: [],
    knowledgeGaps: [],
  }),
}));

// Mock ghostSuggestions utility
vi.mock('../../../src/utils/ghostSuggestions', () => ({
  getGhostSuggestions: vi.fn().mockReturnValue([]),
}));

// Store state for consoleStore mock
const mockConsoleState = {
  prompt: '',
  setPrompt: vi.fn(),
  updateInstruction: vi.fn(),
  hydrateFromGenerated: vi.fn(),
  setKnowledgeGaps: vi.fn(),
  channels: [],
  mcpServers: [],
  skills: [],
};

vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockConsoleState);
      }
      return mockConsoleState;
    },
    {
      getState: () => mockConsoleState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    },
  ),
}));

const mockMemoryState = {
  setSessionConfig: vi.fn(),
};

vi.mock('../../../src/store/memoryStore', () => ({
  useMemoryStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockMemoryState);
    }
    return mockMemoryState;
  },
}));

describe('DescribeTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
    // Reset prompt state
    mockConsoleState.prompt = '';
    mockConsoleState.channels = [];
  });

  it('renders with empty state', () => {
    render(<DescribeTab />);

    // Check for main heading
    expect(screen.getByText(/describe your agent/i)).toBeInTheDocument();

    // Check for textarea (Agent Description)
    expect(screen.getByLabelText(/agent description/i)).toBeInTheDocument();

    // Check for Writing Tips section
    expect(screen.getByText(/writing tips/i)).toBeInTheDocument();
  });

  it('writing tips section is displayed', () => {
    render(<DescribeTab />);

    // Writing Tips section exists
    expect(screen.getByText(/writing tips/i)).toBeInTheDocument();

    // Check for tip content
    expect(screen.getByText(/be specific about the agent/i)).toBeInTheDocument();
    expect(screen.getByText(/types of inputs and outputs/i)).toBeInTheDocument();
  });

  it('selecting prompt text shows character count update', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);

    // Find the description textarea
    const descriptionInput = screen.getByLabelText(/agent description/i);

    // Type in the textarea
    await user.type(descriptionInput, 'Hello');

    // Verify setPrompt was called
    expect(mockConsoleState.setPrompt).toHaveBeenCalled();
  });

  it('onNavigateToNext callback is accepted as prop', () => {
    const onNavigateToNext = vi.fn();
    // Component accepts onNavigateToNext prop without crashing
    render(<DescribeTab onNavigateToNext={onNavigateToNext} />);

    // Component renders correctly with the prop
    expect(screen.getByLabelText(/agent description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate agent/i })).toBeInTheDocument();
  });

  it('handles agent description textarea correctly', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);

    // Find the description textarea
    const descriptionInput = screen.getByLabelText(/agent description/i);
    expect(descriptionInput).toBeInTheDocument();

    // Type in the textarea
    await user.type(descriptionInput, 'My custom agent description');

    // Verify setPrompt was called
    expect(mockConsoleState.setPrompt).toHaveBeenCalled();
  });

  it('handles description input correctly', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);

    // Find the description textarea
    const descriptionInput = screen.getByLabelText(/agent description/i);
    expect(descriptionInput).toBeInTheDocument();

    // Type in the input
    await user.type(descriptionInput, 'A helpful AI assistant');

    // Verify the store update function was called
    await waitFor(() => {
      expect(mockConsoleState.setPrompt).toHaveBeenCalled();
    });
  });

  it('shows generate agent button', () => {
    render(<DescribeTab />);

    // The Generate Agent button is always present
    const generateButton = screen.getByRole('button', { name: /generate agent/i });
    expect(generateButton).toBeInTheDocument();
  });

  it('generate button is disabled when prompt is empty', () => {
    render(<DescribeTab />);

    // Generate button should be disabled when prompt is empty
    const generateButton = screen.getByRole('button', { name: /generate agent/i });
    expect(generateButton).toBeDisabled();
  });

  it('shows character count for description', () => {
    render(<DescribeTab />);

    // Character count should show "0 / 10000"
    expect(screen.getByText(/0 \/ 10000/)).toBeInTheDocument();
  });

  it('ghost suggestions are not shown with empty prompt', () => {
    render(<DescribeTab />);

    // With empty prompt, no ghost suggestions should be shown
    expect(screen.queryByText(/suggested knowledge sources/i)).not.toBeInTheDocument();
  });
});
