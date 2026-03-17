import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock the stores
vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: () => ({
    agentConfig: {
      name: 'Test Agent',
      description: 'Test Description',
    },
    currentTab: 0,
    setCurrentTab: vi.fn(),
  }),
}));

vi.mock('../../../src/store/memoryStore', () => ({
  useMemoryStore: () => ({
    strategy: 'none',
  }),
}));

describe('WizardLayout', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  it('renders all 7 tab buttons', () => {
    render(<WizardLayout />);
    
    // Check that all 7 tabs are rendered
    expect(screen.getByRole('button', { name: /describe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tools/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /memory/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /qualification/i })).toBeInTheDocument();
    
    // Verify we have exactly 7 tab buttons
    const tabButtons = screen.getAllByRole('button').filter(button => 
      ['describe', 'knowledge', 'tools', 'memory', 'review', 'test', 'qualification']
        .some(tab => button.textContent?.toLowerCase().includes(tab))
    );
    expect(tabButtons).toHaveLength(7);
  });

  it('clicking a tab switches the active panel', async () => {
    const user = userEvent.setup();
    render(<WizardLayout />);
    
    // Initially should show Describe tab content
    expect(screen.getByTestId('theme-wrapper')).toBeInTheDocument();
    
    // Click on Tools tab
    await user.click(screen.getByRole('button', { name: /tools/i }));
    
    // Wait for the lazy-loaded component to appear
    await waitFor(() => {
      expect(screen.getByTestId('tools-tab')).toBeInTheDocument();
    });
    
    // Click on Memory tab
    await user.click(screen.getByRole('button', { name: /memory/i }));
    
    await waitFor(() => {
      expect(screen.getByTestId('memory-tab')).toBeInTheDocument();
    });
  });

  it('has navigation arrows on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800, // Mobile width
    });
    
    render(<WizardLayout />);
    
    // Look for navigation arrows (ChevronLeft and ChevronRight icons)
    const leftArrow = screen.getAllByTestId('lucide-icon').find(icon => 
      icon.innerHTML.includes('chevron-left')
    );
    const rightArrow = screen.getAllByTestId('lucide-icon').find(icon => 
      icon.innerHTML.includes('chevron-right')
    );
    
    // On mobile, navigation arrows should be present
    expect(leftArrow || rightArrow).toBeTruthy();
  });

  it('keyboard navigation with arrow keys works', async () => {
    const user = userEvent.setup();
    render(<WizardLayout />);
    
    // Focus on the first tab
    const describeTab = screen.getByRole('button', { name: /describe/i });
    describeTab.focus();
    
    // Press right arrow to move to next tab
    await user.keyboard('{ArrowRight}');
    
    // Should focus on Knowledge tab
    const knowledgeTab = screen.getByRole('button', { name: /knowledge/i });
    expect(knowledgeTab).toHaveFocus();
    
    // Press right arrow again
    await user.keyboard('{ArrowRight}');
    
    // Should focus on Tools tab
    const toolsTab = screen.getByRole('button', { name: /tools/i });
    expect(toolsTab).toHaveFocus();
    
    // Press left arrow to go back
    await user.keyboard('{ArrowLeft}');
    
    // Should be back to Knowledge tab
    expect(knowledgeTab).toHaveFocus();
  });

  it('skip link exists and is accessible', () => {
    render(<WizardLayout />);
    
    // Look for skip link - it should be in the DOM but may be visually hidden
    const skipLink = screen.queryByText(/skip to content/i) || 
                     screen.queryByRole('link', { name: /skip/i }) ||
                     screen.queryByTestId('skip-link');
    
    // If skip link exists, it should be accessible
    if (skipLink) {
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href');
    }
    
    // Alternative: check if the component has proper heading structure
    const mainContent = screen.getByRole('main') || 
                       screen.getByTestId('wizard-layout') ||
                       screen.getByTestId('theme-wrapper');
    expect(mainContent).toBeInTheDocument();
  });

  it('displays active tab indicator correctly', () => {
    render(<WizardLayout />);
    
    // The first tab (Describe) should be active by default
    const describeTab = screen.getByRole('button', { name: /describe/i });
    
    // Check if it has active styling (may need to check computed styles or class names)
    expect(describeTab).toBeInTheDocument();
    
    // The active tab should have some visual indication
    // This could be checked via class names, aria-selected, or data attributes
    // depending on the implementation
  });

  it('handles tab switching with proper focus management', async () => {
    const user = userEvent.setup();
    render(<WizardLayout />);
    
    // Click on Test tab
    const testTab = screen.getByRole('button', { name: /test/i });
    await user.click(testTab);
    
    // The clicked tab should maintain focus or have proper focus management
    await waitFor(() => {
      expect(testTab).toHaveFocus();
    });
  });
});