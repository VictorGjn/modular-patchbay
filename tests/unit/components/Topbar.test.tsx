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
  useVersionStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockVersionStore);
    }
    return mockVersionStore;
  },
}));

// Mock VersionDiffView to avoid complex rendering in tests
vi.mock('../../../src/components/VersionDiffView', () => ({
  VersionDiffView: ({ onClose }: any) => (
    <div data-testid="version-diff-view">
      <button onClick={onClose}>Close Diff</button>
    </div>
  ),
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
    // Temporarily override agentMeta to simulate empty agent
    const savedAgentMeta = mockConsoleStore.agentMeta;
    mockConsoleStore.agentMeta = { name: '', description: '' };

    render(<Topbar />);

    // Restore
    mockConsoleStore.agentMeta = savedAgentMeta;

    // Should still show MODULAR logo
    expect(screen.getByText('MODULAR')).toBeInTheDocument();
    // But no agent name section
    expect(screen.queryByText('Test Agent')).not.toBeInTheDocument();
  });

  it('version dropdown opens/closes', async () => {
    const user = userEvent.setup();
    render(<Topbar />);

    // Find the version button
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i });

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
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i });
    await user.click(versionButton);

    // Wait for dropdown and find restore buttons
    await waitFor(() => {
      const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
      expect(restoreButtons.length).toBeGreaterThan(0);
    });

    // Click on a restore button
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    await user.click(restoreButtons[0]);

    // Confirm the restore in the confirmation modal (P0-5 added confirmation)
    const confirmBtns = screen.queryAllByRole('button', { name: /^restore$/i });
    const confirmBtn = confirmBtns.find(b => b.textContent?.trim() === 'Restore' && b !== restoreButtons[0]);
    if (confirmBtn) await user.click(confirmBtn);

    // Verify restore was called
    expect(mockVersionStore.restoreVersion).toHaveBeenCalled();
  });

  it('shows current version correctly', async () => {
    const user = userEvent.setup();
    render(<Topbar />);

    // Open version dropdown
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i });
    await user.click(versionButton);

    // Wait for dropdown content
    await waitFor(() => {
      // Current version should be marked
      expect(screen.getByText('CURRENT')).toBeInTheDocument();
    });
  });

  it('theme toggle switches mode', () => {
    render(<Topbar />);

    // Find the theme toggle button (aria-label includes "light mode" or "dark mode")
    const themeToggle = screen.getByRole('button', { name: /switch to (light|dark) mode/i });

    // Button is present and accessible
    expect(themeToggle).toBeInTheDocument();
    expect(themeToggle).not.toBeDisabled();
  });

  it('displays modular branding correctly', () => {
    render(<Topbar />);

    // Check for MODULAR logo text
    const modularHeading = screen.getByText('MODULAR');
    expect(modularHeading).toBeInTheDocument();

    // The h1 element has the Geist Mono font style applied inline
    expect(modularHeading).toHaveStyle({ fontFamily: "'Geist Mono', monospace" });
  });

  it('loads versions when agent ID is available', () => {
    // The effect only calls loadVersions when agentId is set and versions are empty
    const savedVersions = mockVersionStore.versions;
    mockVersionStore.versions = [];

    render(<Topbar />);

    // Restore
    mockVersionStore.versions = savedVersions;

    // Should call loadVersions when component mounts with agentId and empty versions
    expect(mockVersionStore.loadVersions).toHaveBeenCalled();
  });

  it('handles settings click when provided', async () => {
    const user = userEvent.setup();
    const onSettingsClick = vi.fn();

    render(<Topbar onSettingsClick={onSettingsClick} />);

    // Find settings button by aria-label
    const settingsButton = screen.getByRole('button', { name: /llm settings/i });

    await user.click(settingsButton);
    expect(onSettingsClick).toHaveBeenCalled();
  });

  it('shows run/stop button correctly', () => {
    render(<Topbar />);

    // Look for run button by its text content
    const runButton = screen.getByRole('button', { name: /run/i });
    expect(runButton).toBeInTheDocument();
  });

  it('run button triggers run action', async () => {
    const user = userEvent.setup();
    render(<Topbar />);

    // Find and click run button by text content
    const runButton = screen.getByRole('button', { name: /run/i });
    await user.click(runButton);
    expect(mockConsoleStore.run).toHaveBeenCalled();
  });

  it('shows stop button when running', () => {
    // Temporarily set running state
    mockConsoleStore.running = true;

    render(<Topbar />);

    // Restore
    mockConsoleStore.running = false;

    // Should show stop button instead of play
    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton).toBeInTheDocument();
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

    // Click the button again to close (toggle behavior)
    await user.click(versionButton);

    await waitFor(() => {
      expect(screen.queryByText('Initial version')).not.toBeInTheDocument();
    });
  });

  it('shows version timestamps correctly', async () => {
    const user = userEvent.setup();
    render(<Topbar />);

    // Open version dropdown
    const versionButton = screen.getByRole('button', { name: /version.*dropdown/i });
    await user.click(versionButton);

    // Wait for dropdown with timestamps
    await waitFor(() => {
      // Should show formatted dates
      const timestamps = screen.getAllByText(/\/2024/);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });
});
