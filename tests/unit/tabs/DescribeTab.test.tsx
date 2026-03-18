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
  useConsoleStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleState);
    }
    return mockConsoleState;
  },
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

    // Check for Quick Start Templates section
    expect(screen.getByText(/quick start templates/i)).toBeInTheDocument();
  });

  it('quick start templates are displayed', () => {
    render(<DescribeTab />);

    // The component uses QUICK_TEMPLATES array with these labels
    expect(screen.getByText(/code review agent/i)).toBeInTheDocument();
    expect(screen.getByText(/research assistant/i)).toBeInTheDocument();

    // Check for template descriptions
    expect(screen.getByText(/reviews code for best practices/i)).toBeInTheDocument();
    expect(screen.getByText(/gathers and synthesizes information/i)).toBeInTheDocument();
  });

  it('selecting a template populates the prompt', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);

    // Find and click on a template
    const codeReviewTemplate = screen.getByRole('radio', { name: /code review agent/i });
    await user.click(codeReviewTemplate);

    // Verify setPrompt was called with the template's prompt
    expect(mockConsoleState.setPrompt).toHaveBeenCalledWith(
      expect.stringContaining('code review agent')
    );
  });

  it('navigate to test button works when conditions are met', async () => {
    const user = userEvent.setup();
    const onNavigateToTest = vi.fn();
    render(<DescribeTab onNavigateToTest={onNavigateToTest} />);

    // Select a template first (which shows the "Jump to Test" button)
    const templateButton = screen.getByRole('radio', { name: /code review agent/i });
    await user.click(templateButton);

    // Find the Jump to Test button
    const jumpButton = screen.getByRole('button', { name: /jump to test/i });
    expect(jumpButton).toBeInTheDocument();

    await user.click(jumpButton);
    expect(onNavigateToTest).toHaveBeenCalled();
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
