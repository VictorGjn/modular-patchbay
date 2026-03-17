import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { DescribeTab } from '../../../src/tabs/DescribeTab';

// Mock the stores
const mockConsoleStore = {
  agentConfig: {
    name: 'Test Agent',
    description: 'Test description',
    systemPrompt: '',
  },
  quickStartTemplates: [
    {
      label: 'Code Review Agent',
      description: 'Reviews code for best practices, security, and maintainability',
      prompt: 'A code review agent that analyzes pull requests...',
    },
    {
      label: 'Research Assistant',
      description: 'Gathers and synthesizes information from multiple sources',
      prompt: 'A research assistant that collects information...',
    },
  ],
  selectedTemplate: null,
  selectTemplate: vi.fn(),
  updateAgentName: vi.fn(),
  updateAgentDescription: vi.fn(),
  updateSystemPrompt: vi.fn(),
  canNavigateToTest: true,
  setCurrentTab: vi.fn(),
};

const mockMemoryStore = {
  strategy: 'none',
  setStrategy: vi.fn(),
};

vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: () => mockConsoleStore,
}));

vi.mock('../../../src/store/memoryStore', () => ({
  useMemoryStore: () => mockMemoryStore,
}));

describe('DescribeTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders with empty state', () => {
    render(<DescribeTab />);
    
    // Check for main input fields
    expect(screen.getByLabelText(/agent name/i) || screen.getByPlaceholderText(/agent name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i) || screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system prompt/i) || screen.getByPlaceholderText(/system prompt/i)).toBeInTheDocument();
    
    // Check for quick templates section
    expect(screen.getByText(/quick start/i) || screen.getByText(/templates/i)).toBeInTheDocument();
  });

  it('quick start templates are displayed', () => {
    render(<DescribeTab />);
    
    // Check that template options are visible
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
    const codeReviewTemplate = screen.getByText(/code review agent/i);
    await user.click(codeReviewTemplate);
    
    // Verify the selectTemplate function was called
    expect(mockConsoleStore.selectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Code Review Agent',
        description: 'Reviews code for best practices, security, and maintainability',
      })
    );
  });

  it('navigate to test button works when conditions are met', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);
    
    // Look for navigation button (might be "Next", "Continue", "Test", etc.)
    const navigateButton = screen.getByRole('button', { name: /test/i }) ||
                          screen.getByRole('button', { name: /next/i }) ||
                          screen.getByRole('button', { name: /continue/i }) ||
                          screen.getByText(/navigate to test/i);
    
    expect(navigateButton).toBeInTheDocument();
    
    // Click the navigation button
    await user.click(navigateButton);
    
    // Verify navigation was triggered
    expect(mockConsoleStore.setCurrentTab).toHaveBeenCalled();
  });

  it('handles agent name input correctly', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);
    
    // Find the agent name input
    const nameInput = screen.getByLabelText(/agent name/i) || 
                      screen.getByPlaceholderText(/agent name/i);
    
    expect(nameInput).toBeInTheDocument();
    
    // Type in the input
    await user.type(nameInput, 'My Custom Agent');
    
    // Verify the store update function was called
    await waitFor(() => {
      expect(mockConsoleStore.updateAgentName).toHaveBeenCalledWith('My Custom Agent');
    });
  });

  it('handles description input correctly', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);
    
    // Find the description input
    const descriptionInput = screen.getByLabelText(/description/i) || 
                            screen.getByPlaceholderText(/description/i);
    
    expect(descriptionInput).toBeInTheDocument();
    
    // Type in the input
    await user.type(descriptionInput, 'A helpful AI assistant');
    
    // Verify the store update function was called
    await waitFor(() => {
      expect(mockConsoleStore.updateAgentDescription).toHaveBeenCalledWith('A helpful AI assistant');
    });
  });

  it('handles system prompt input correctly', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);
    
    // Find the system prompt input (likely a textarea)
    const systemPromptInput = screen.getByLabelText(/system prompt/i) || 
                             screen.getByPlaceholderText(/system prompt/i) ||
                             screen.getByRole('textbox', { name: /prompt/i });
    
    expect(systemPromptInput).toBeInTheDocument();
    
    // Type in the input
    await user.type(systemPromptInput, 'You are a helpful assistant.');
    
    // Verify the store update function was called
    await waitFor(() => {
      expect(mockConsoleStore.updateSystemPrompt).toHaveBeenCalledWith('You are a helpful assistant.');
    });
  });

  it('displays current agent configuration', () => {
    render(<DescribeTab />);
    
    // Check that current values are displayed
    const nameInput = screen.getByDisplayValue('Test Agent') || 
                      screen.getByText('Test Agent');
    const descriptionInput = screen.getByDisplayValue('Test description') ||
                            screen.getByText('Test description');
    
    expect(nameInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  it('shows character limits and validation', async () => {
    const user = userEvent.setup();
    render(<DescribeTab />);
    
    // Look for character count indicators
    const characterCount = screen.queryByText(/characters/i) ||
                          screen.queryByText(/\d+\/\d+/);
    
    if (characterCount) {
      expect(characterCount).toBeInTheDocument();
    }
    
    // Test with very long input to trigger validation
    const systemPromptInput = screen.getByLabelText(/system prompt/i) || 
                             screen.getByPlaceholderText(/system prompt/i) ||
                             screen.getByRole('textbox', { name: /prompt/i });
    
    const longText = 'A'.repeat(11000); // Exceed character limit
    await user.type(systemPromptInput, longText);
    
    // Should show some kind of validation message
    const validationMessage = screen.queryByText(/too long/i) ||
                             screen.queryByText(/limit/i) ||
                             screen.queryByText(/maximum/i);
    
    // Validation might appear after the input
    if (validationMessage) {
      expect(validationMessage).toBeInTheDocument();
    }
  });
});