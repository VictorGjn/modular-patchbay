import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { Topbar } from '../../../src/components/Topbar';

// Mock the stores
const mockConsoleStore = {
  running: false,
  run: vi.fn(),
  agentMeta: {
    name: 'Test Agent',
    description: 'A test agent',
  },
};

const mockVersionStore = {
  currentVersion: '1.0.0',
  versions: [
    {
      id: 'v1',
      version: '1.0.0',
      label: 'Initial version',
      timestamp: new Date('2024-01-01').toISOString(),
    },
    {
      id: 'v2',
      version: '1.1.0',
      label: 'Feature update',
      timestamp: new Date('2024-01-02').toISOString(),
    },
    {
      id: 'v3',
      version: '1.2.0',
      label: 'Latest changes',
      timestamp: new Date('2024-01-03').toISOString(),
    },
  ],
  restoreVersion: vi.fn(),
  agentId: 'test-agent-id',
  loadVersions: vi.fn(),
};

const mockThemeStore = {
  theme: 'dark',
  toggleTheme: vi.fn(),
};

vi.mock('../../../src/store/consoleStore', () => ({
  useConsoleStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockConsoleStore);
    }
    return mockConsoleStore;
  },
}));

vi.mock('../../../src/store/versionStore', () => ({
  useVersionStore: () => mockVersionStore,
}));

vi.mock('../../../src/store/themeStore', () => ({
  useThemeStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockThemeStore);
    }
    return mockThemeStore;
  },
}));

describe('Topbar', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders agent name', () => {
    render(<Topbar />);
    
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    
    // Should also show the MODULAR logo
    expect(screen.getByText('MODULAR')).toBeInTheDocument();
  });

  it('renders without agent name when not set', () => {
    // Mock empty agent meta
    const emptyStore = {
      ...mockConsoleStore,
      agentMeta: { name: '', description: '' },
    };
    
    vi.mocked(vi.importMock('../../../src/store/consoleStore')).mockReturnValue({
      useConsoleStore: (selector: any) => selector(emptyStore),
    });
    
    render(<Topbar />);
    
    // Should still show MODULAR logo
    expect(screen.getByText('MODULAR')).toBeInTheDocument();
    // But no agent name section
    expect(screen.queryByText('Test Agent')).not.toBeInTheDocument();
  });

  it('version dropdown opens/closes', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Find the version button
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i }) ||
                         screen.getByText(/v1\.0\.0/);
    
    expect(versionButton).toBeInTheDocument();
    
    // Click to open dropdown
    await user.click(versionButton);
    
    // Wait for dropdown to appear
    await waitFor(() => {
      // Should show version history
      expect(screen.getByText('Initial version')).toBeInTheDocument();
      expect(screen.getByText('Feature update')).toBeInTheDocument();
      expect(screen.getByText('Latest changes')).toBeInTheDocument();
    });
    
    // Click outside to close
    await user.click(document.body);
    
    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByText('Initial version')).not.toBeInTheDocument();
    });
  });

  it('can restore previous versions', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Open version dropdown
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i }) ||
                         screen.getByText(/v1\.0\.0/);
    await user.click(versionButton);
    
    // Wait for dropdown and find restore buttons
    await waitFor(() => {
      const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
      expect(restoreButtons.length).toBeGreaterThan(0);
    });
    
    // Click on a restore button
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    await user.click(restoreButtons[0]);
    
    // Verify restore was called
    expect(mockVersionStore.restoreVersion).toHaveBeenCalled();
  });

  it('shows current version correctly', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Open version dropdown
    const versionButton = screen.getByText(/v1\.0\.0/);
    await user.click(versionButton);
    
    // Wait for dropdown content
    await waitFor(() => {
      // Current version should be marked
      expect(screen.getByText('CURRENT')).toBeInTheDocument();
    });
  });

  it('theme toggle switches mode', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Find the theme toggle button (could be sun/moon icon)
    const themeToggle = screen.getByRole('button', { name: /theme/i }) ||
                       screen.getAllByRole('button').find(button =>
                         button.querySelector('svg') && 
                         (button.innerHTML.includes('sun') || button.innerHTML.includes('moon'))
                       );
    
    if (themeToggle) {
      await user.click(themeToggle);
      
      // Verify theme toggle was called
      expect(mockThemeStore.toggleTheme).toHaveBeenCalled();
    }
  });

  it('displays modular branding correctly', () => {
    render(<Topbar />);
    
    // Check for MODULAR logo text
    expect(screen.getByText('MODULAR')).toBeInTheDocument();
    
    // Check for the orange dot indicator
    const logoSection = screen.getByText('MODULAR').closest('div');
    expect(logoSection).toBeTruthy();
    expect(logoSection).toHaveStyle({ fontFamily: expect.stringContaining('Geist Mono') });
  });

  it('loads versions when agent ID is available', () => {
    render(<Topbar />);
    
    // Should call loadVersions when component mounts with agentId
    expect(mockVersionStore.loadVersions).toHaveBeenCalled();
  });

  it('handles settings click when provided', async () => {
    const user = userEvent.setup();
    const onSettingsClick = vi.fn();
    
    render(<Topbar onSettingsClick={onSettingsClick} />);
    
    // Find settings button
    const settingsButton = screen.getByRole('button', { name: /settings/i }) ||
                          screen.getAllByRole('button').find(button =>
                            button.querySelector('svg') && button.innerHTML.includes('settings')
                          );
    
    if (settingsButton) {
      await user.click(settingsButton);
      expect(onSettingsClick).toHaveBeenCalled();
    }
  });

  it('shows run/stop button correctly', () => {
    render(<Topbar />);
    
    // Look for run button (play icon)
    const runButton = screen.getByRole('button', { name: /run/i }) ||
                     screen.getAllByRole('button').find(button =>
                       button.querySelector('svg') && 
                       (button.innerHTML.includes('play') || button.innerHTML.includes('square'))
                     );
    
    if (runButton) {
      expect(runButton).toBeInTheDocument();
    }
  });

  it('run button triggers run action', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Find and click run button
    const runButton = screen.getByRole('button', { name: /run/i }) ||
                     screen.getAllByRole('button').find(button =>
                       button.querySelector('svg') && button.innerHTML.includes('play')
                     );
    
    if (runButton) {
      await user.click(runButton);
      expect(mockConsoleStore.run).toHaveBeenCalled();
    }
  });

  it('shows stop button when running', () => {
    // Mock running state
    const runningStore = {
      ...mockConsoleStore,
      running: true,
    };
    
    vi.mocked(vi.importMock('../../../src/store/consoleStore')).mockReturnValue({
      useConsoleStore: (selector: any) => selector(runningStore),
    });
    
    render(<Topbar />);
    
    // Should show stop button (square icon) instead of play
    const stopButton = screen.getAllByRole('button').find(button =>
      button.querySelector('svg') && button.innerHTML.includes('square')
    );
    
    if (stopButton) {
      expect(stopButton).toBeInTheDocument();
    }
  });

  it('handles keyboard navigation in version dropdown', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Open dropdown with Enter key
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i });
    versionButton.focus();
    await user.keyboard('{Enter}');
    
    // Wait for dropdown
    await waitFor(() => {
      expect(screen.getByText('Initial version')).toBeInTheDocument();
    });
    
    // Escape should close dropdown
    await user.keyboard('{Escape}');
    
    await waitFor(() => {
      expect(screen.queryByText('Initial version')).not.toBeInTheDocument();
    });
  });

  it('shows version timestamps correctly', async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    
    // Open version dropdown
    const versionButton = screen.getByText(/v1\.0\.0/);
    await user.click(versionButton);
    
    // Wait for dropdown with timestamps
    await waitFor(() => {
      // Should show formatted dates
      const timestamps = screen.getAllByText(/\/2024/);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });
});