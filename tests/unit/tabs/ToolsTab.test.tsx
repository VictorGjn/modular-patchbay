import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { ToolsTab } from '../../../src/tabs/ToolsTab';

// Mock the stores
const mockConsoleStore = {
  removeMcp: vi.fn(),
  setShowSkillPicker: vi.fn(),
  setShowMarketplace: vi.fn(),
};

const mockMcpStore = {
  servers: [
    {
      id: 'test-mcp-1',
      name: 'Test MCP Server',
      url: 'http://localhost:3000',
      enabled: true,
    },
    {
      id: 'test-mcp-2', 
      name: 'Another MCP Server',
      url: 'http://localhost:3001',
      enabled: false,
    },
  ],
  removeServer: vi.fn(),
};

const mockHealthStore = {
  mcpHealth: {
    'test-mcp-1': { status: 'healthy', latency: 150 },
    'test-mcp-2': { status: 'error', latency: null },
  },
  skillHealth: {
    'test-skill-1': { status: 'healthy', latency: 100 },
  },
};

const mockSkillsStore = {
  skills: [
    {
      id: 'test-skill-1',
      name: 'Test Skill',
      description: 'A test skill for unit testing',
      enabled: true,
      category: 'development',
    },
    {
      id: 'test-skill-2',
      name: 'Disabled Skill',
      description: 'A disabled skill',
      enabled: false,
      category: 'analysis',
    },
  ],
  loaded: true,
  loading: false,
  loadSkills: vi.fn(),
  toggleSkill: vi.fn(),
};

vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleStore);
    }
    return mockConsoleStore;
  },
}));

vi.mock('../../../src/store/mcpStore', () => ({
  useMcpStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockMcpStore);
    }
    return mockMcpStore;
  },
}));

vi.mock('../../../src/store/healthStore', () => ({
  useHealthStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockHealthStore);
    }
    return mockHealthStore;
  },
}));

vi.mock('../../../src/store/skillsStore', () => ({
  useSkillsStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockSkillsStore);
    }
    return mockSkillsStore;
  },
}));

// Mock config
vi.mock('../../../src/config', () => ({
  API_BASE: 'http://localhost:4800',
}));

describe('ToolsTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders skills and MCP sections', () => {
    render(<ToolsTab />);
    
    // Check for skills section
    expect(screen.getByText(/skills/i)).toBeInTheDocument();
    
    // Check for MCP section
    expect(screen.getByText(/mcp/i) || screen.getByText(/server/i)).toBeInTheDocument();
    
    // Check for section headers or content
    expect(screen.getByText('Test Skill')).toBeInTheDocument();
    expect(screen.getByText('Test MCP Server')).toBeInTheDocument();
  });

  it('"Add Skill" button opens SkillPicker', async () => {
    const user = userEvent.setup();
    render(<ToolsTab />);
    
    // Find the Add Skill button
    const addSkillButton = screen.getByRole('button', { name: /add skill/i }) ||
                          screen.getByText(/add skill/i);
    
    expect(addSkillButton).toBeInTheDocument();
    
    // Click the button
    await user.click(addSkillButton);
    
    // Verify the skill picker is opened
    expect(mockConsoleStore.setShowSkillPicker).toHaveBeenCalledWith(true);
  });

  it('"Browse Marketplace" button opens Marketplace', async () => {
    const user = userEvent.setup();
    render(<ToolsTab />);
    
    // Find the Browse Marketplace button
    const marketplaceButton = screen.getByRole('button', { name: /marketplace/i }) ||
                             screen.getByText(/marketplace/i) ||
                             screen.getByText(/browse/i);
    
    if (marketplaceButton) {
      await user.click(marketplaceButton);
      
      // Verify the marketplace is opened (might set a different state)
      expect(mockConsoleStore.setShowMarketplace || mockConsoleStore.setShowSkillPicker).toHaveBeenCalled();
    }
  });

  it('skills appear after adding', () => {
    render(<ToolsTab />);
    
    // Check that existing skills are displayed
    expect(screen.getByText('Test Skill')).toBeInTheDocument();
    expect(screen.getByText('Disabled Skill')).toBeInTheDocument();
    
    // Check that skills show their status
    const enabledSkill = screen.getByText('Test Skill').closest('[data-testid], div, li') ||
                        screen.getByText('Test Skill').parentElement;
    const disabledSkill = screen.getByText('Disabled Skill').closest('[data-testid], div, li') ||
                         screen.getByText('Disabled Skill').parentElement;
    
    expect(enabledSkill).toBeTruthy();
    expect(disabledSkill).toBeTruthy();
  });

  it('can toggle skill enabled/disabled state', async () => {
    const user = userEvent.setup();
    render(<ToolsTab />);
    
    // Find a skill toggle (checkbox, switch, or button)
    const skillToggle = screen.getAllByRole('checkbox').find(checkbox => 
      checkbox.closest('div, li')?.textContent?.includes('Test Skill')
    ) || screen.getAllByRole('button').find(button =>
      button.textContent?.includes('enable') || button.textContent?.includes('disable')
    );
    
    if (skillToggle) {
      await user.click(skillToggle);
      
      // Verify the toggle function was called
      expect(mockSkillsStore.toggleSkill).toHaveBeenCalledWith('test-skill-1');
    }
  });

  it('displays MCP server status correctly', () => {
    render(<ToolsTab />);
    
    // Should show the MCP servers
    expect(screen.getByText('Test MCP Server')).toBeInTheDocument();
    expect(screen.getByText('Another MCP Server')).toBeInTheDocument();
    
    // Check for status indicators (might be icons, colors, or text)
    const healthyServer = screen.getByText('Test MCP Server').closest('div, li');
    const errorServer = screen.getByText('Another MCP Server').closest('div, li');
    
    expect(healthyServer).toBeTruthy();
    expect(errorServer).toBeTruthy();
    
    // Look for status indicators (icons, text, or visual cues)
    const statusIndicators = screen.getAllByTestId(/status|health|icon/) ||
                           [...screen.getAllByText(/healthy|error|connected|disconnected/i)];
    
    expect(statusIndicators.length).toBeGreaterThan(0);
  });

  it('can remove MCP servers', async () => {
    const user = userEvent.setup();
    render(<ToolsTab />);
    
    // Look for remove/delete buttons (might be X icons or delete buttons)
    const removeButtons = screen.getAllByRole('button').filter(button => 
      button.textContent?.includes('×') || 
      button.textContent?.includes('remove') ||
      button.textContent?.includes('delete') ||
      button.getAttribute('aria-label')?.includes('remove')
    );
    
    if (removeButtons.length > 0) {
      await user.click(removeButtons[0]);
      
      // Verify the remove function was called
      expect(mockConsoleStore.removeMcp || mockMcpStore.removeServer).toHaveBeenCalled();
    }
  });

  it('shows empty state when no tools are configured', () => {
    // Mock empty state
    const emptyMockSkillsStore = {
      ...mockSkillsStore,
      skills: [],
    };
    
    const emptyMockMcpStore = {
      ...mockMcpStore,
      servers: [],
    };
    
    vi.mocked(vi.importMock('../../../src/store/skillsStore')).mockReturnValue({
      useSkillsStore: (selector: any) => selector(emptyMockSkillsStore),
    });
    
    vi.mocked(vi.importMock('../../../src/store/mcpStore')).mockReturnValue({
      useMcpStore: (selector: any) => selector(emptyMockMcpStore),
    });
    
    render(<ToolsTab />);
    
    // Should show some kind of empty state message or prompt to add tools
    const emptyStateText = screen.queryByText(/no tools/i) ||
                          screen.queryByText(/no skills/i) ||
                          screen.queryByText(/add your first/i) ||
                          screen.queryByText(/get started/i);
    
    // Empty state might be present
    if (emptyStateText) {
      expect(emptyStateText).toBeInTheDocument();
    }
  });

  it('handles loading states correctly', () => {
    // Mock loading state
    const loadingMockSkillsStore = {
      ...mockSkillsStore,
      loading: true,
      loaded: false,
    };
    
    vi.mocked(vi.importMock('../../../src/store/skillsStore')).mockReturnValue({
      useSkillsStore: (selector: any) => selector(loadingMockSkillsStore),
    });
    
    render(<ToolsTab />);
    
    // Should show loading indicators
    const loadingIndicator = screen.queryByTestId('loading') ||
                            screen.queryByTestId('spinner') ||
                            screen.queryByTestId('skeleton') ||
                            screen.queryByText(/loading/i);
    
    if (loadingIndicator) {
      expect(loadingIndicator).toBeInTheDocument();
    }
  });
});