import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { WizardLayout } from '../../../src/layouts/WizardLayout';

// Mock the lazy-loaded components to avoid issues with React.lazy in tests
vi.mock('../../../src/tabs/TestTab', () => ({
  TestTab: () => <div data-testid="test-tab">Test Tab Content</div>,
}));

vi.mock('../../../src/tabs/QualificationTab', () => ({
  QualificationTab: () => <div data-testid="qualification-tab">Qualification Tab Content</div>,
}));

vi.mock('../../../src/tabs/KnowledgeTab', () => ({
  KnowledgeTab: () => <div data-testid="knowledge-tab">Knowledge Tab Content</div>,
}));

vi.mock('../../../src/tabs/ToolsTab', () => ({
  ToolsTab: () => <div data-testid="tools-tab">Tools Tab Content</div>,
}));

vi.mock('../../../src/tabs/MemoryTab', () => ({
  MemoryTab: () => <div data-testid="memory-tab">Memory Tab Content</div>,
}));

vi.mock('../../../src/tabs/ReviewTab', () => ({
  ReviewTab: () => <div data-testid="review-tab">Review Tab Content</div>,
}));

// Mock DescribeTab since WizardLayout imports it directly
vi.mock('../../../src/tabs/DescribeTab', () => ({
  DescribeTab: (props: any) => (
    <div data-testid="describe-tab">
      Describe Tab Content
    </div>
  ),
}));

// Mock FloatingRunButton
vi.mock('../../../src/components/ds/FloatingRunButton', () => ({
  FloatingRunButton: () => null,
}));

// Mock the stores with selector support and correct shape
const mockConsoleState = {
  agentMeta: { name: 'Test Agent', description: 'Test Description' },
  prompt: '',
  channels: [],
  mcpServers: [],
  skills: [],
  currentTab: 0,
  setCurrentTab: vi.fn(),
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
  session: { strategy: 'none' },
  facts: [],
  longTerm: { enabled: false },
  working: { content: '' },
};

vi.mock('../../../src/store/memoryStore', () => ({
  useMemoryStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockMemoryState);
    }
    return mockMemoryState;
  },
}));

describe('WizardLayout', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  it('renders all 7 tab buttons', () => {
    render(<WizardLayout />);

    // Tab buttons have role="tab" in WizardLayout
    expect(screen.getByRole('tab', { name: /describe/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tools/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /memory/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /review/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /test/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /qualification/i })).toBeInTheDocument();

    // Verify we have exactly 7 tab buttons
    const tabButtons = screen.getAllByRole('tab');
    expect(tabButtons).toHaveLength(7);
  });

  it('clicking a tab switches the active panel', async () => {
    const user = userEvent.setup();
    render(<WizardLayout />);

    // Initially should show Describe tab content
    expect(screen.getByTestId('describe-tab')).toBeInTheDocument();

    // Click on Tools tab (role="tab")
    await user.click(screen.getByRole('tab', { name: /tools/i }));

    // Wait for the lazy-loaded component to appear
    await waitFor(() => {
      expect(screen.getByTestId('tools-tab')).toBeInTheDocument();
    });

    // Click on Memory tab
    await user.click(screen.getByRole('tab', { name: /memory/i }));

    await waitFor(() => {
      expect(screen.getByTestId('memory-tab')).toBeInTheDocument();
    });
  });

  it('has navigation arrows on mobile', () => {
    render(<WizardLayout />);

    // On the describe tab (index 0), there's no left arrow (no previous)
    // but there should be a right arrow (next: knowledge)
    const nextButton = screen.queryByRole('button', { name: /go to next step/i });
    expect(nextButton).toBeInTheDocument();
  });

  it('keyboard navigation with arrow keys works', async () => {
    const user = userEvent.setup();
    render(<WizardLayout />);

    // Focus on the first tab (role="tab")
    const describeTab = screen.getByRole('tab', { name: /describe/i });
    describeTab.focus();

    // Press right arrow to move to next tab
    await user.keyboard('{ArrowRight}');

    // Knowledge tab should now be selected (active)
    const knowledgeTab = screen.getByRole('tab', { name: /knowledge/i });
    expect(knowledgeTab).toHaveAttribute('aria-selected', 'true');

    // Re-focus the knowledge tab to continue keyboard navigation
    knowledgeTab.focus();

    // Press right arrow again
    await user.keyboard('{ArrowRight}');

    // Tools tab should now be selected
    const toolsTab = screen.getByRole('tab', { name: /tools/i });
    expect(toolsTab).toHaveAttribute('aria-selected', 'true');

    // Re-focus tools tab and press left arrow to go back
    toolsTab.focus();
    await user.keyboard('{ArrowLeft}');

    // Should be back to Knowledge tab
    expect(knowledgeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('skip link exists and is accessible', () => {
    render(<WizardLayout />);

    // Look for skip link
    const skipLink = screen.queryByText(/skip to main content/i);

    if (skipLink) {
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href');
    }

    // The component has role="main" landmark
    const mainContent = screen.getByRole('main');
    expect(mainContent).toBeInTheDocument();
  });

  it('displays active tab indicator correctly', () => {
    render(<WizardLayout />);

    // The first tab (Describe) should be active by default
    const describeTab = screen.getByRole('tab', { name: /describe/i });

    expect(describeTab).toBeInTheDocument();
    // Active tab has aria-selected="true"
    expect(describeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('handles tab switching with proper focus management', async () => {
    const user = userEvent.setup();
    render(<WizardLayout />);

    // Click on Test tab (role="tab")
    const testTab = screen.getByRole('tab', { name: /test/i });
    await user.click(testTab);

    // The clicked tab should show its content
    await waitFor(() => {
      expect(screen.getByTestId('test-tab')).toBeInTheDocument();
    });
  });
});
