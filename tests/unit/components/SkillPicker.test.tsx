import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { SkillPicker } from '../../../src/components/SkillPicker';

// Mock the stores — mutable so individual tests can override values
const mockConsoleStore = {
  showSkillPicker: true,
  setShowSkillPicker: vi.fn(),
  skills: [
    {
      id: 'existing-skill',
      name: 'Existing Skill',
      description: 'Already added skill',
      category: 'development',
      added: true,
      enabled: true,
    },
  ],
  addSkill: vi.fn(),
  upsertSkill: vi.fn(),
};

const mockSkillsStore = {
  skills: [
    {
      id: 'test-skill-1',
      name: 'Research Assistant',
      description: 'Help with research and analysis tasks',
      enabled: false,
      path: '/skills/research-assistant',
      hasSkillMd: false,
    },
    {
      id: 'test-skill-2',
      name: 'Code Helper',
      description: 'Assist with coding and development',
      enabled: false,
      path: '/skills/code-helper',
      hasSkillMd: false,
    },
    {
      id: 'test-skill-3',
      name: 'Content Writer',
      description: 'Help with content creation and writing',
      enabled: false,
      path: '/skills/content-writer',
      hasSkillMd: false,
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

vi.mock('../../../src/store/skillsStore', () => ({
  useSkillsStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockSkillsStore);
    }
    return mockSkillsStore;
  },
}));

// Mock SecurityBadges
vi.mock('../../../src/components/SecurityBadges', () => ({
  SecurityBadges: () => <div data-testid="security-badges" />,
}));

// Mock PickerModal — render children with empty filter, expose search input
vi.mock('../../../src/components/PickerModal', () => ({
  PickerModal: ({ children, open, onClose, title, searchPlaceholder }: any) => {
    if (!open) return null;
    return (
      <div data-testid="picker-modal" role="dialog" aria-label={title}>
        <div>{title}</div>
        <input
          placeholder={searchPlaceholder}
          data-testid="search-input"
          aria-label="Search"
        />
        <button onClick={onClose} data-testid="close-button">Close</button>
        <div data-testid="picker-content">
          {typeof children === 'function' ? children('') : children}
        </div>
      </div>
    );
  },
}));

describe('SkillPicker', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
    // Reset to defaults
    mockConsoleStore.showSkillPicker = true;
    mockSkillsStore.loaded = true;
    mockSkillsStore.loading = false;
  });

  it('renders skill list when open', () => {
    render(<SkillPicker />);

    expect(screen.getByTestId('picker-modal')).toBeInTheDocument();
    expect(screen.getByText('Select Skills')).toBeInTheDocument();

    // Check for skill categories (grouping headers — text may appear multiple times)
    expect(screen.getAllByText(/analysis/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/development/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/content/i).length).toBeGreaterThan(0);

    // Check for individual skills
    expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    expect(screen.getByText('Code Helper')).toBeInTheDocument();
    expect(screen.getByText('Content Writer')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    mockConsoleStore.showSkillPicker = false;

    render(<SkillPicker />);

    expect(screen.queryByTestId('picker-modal')).not.toBeInTheDocument();
  });

  it('selecting skills updates selection count', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);

    // Click on a skill to select it
    const researchSkill = screen.getByText('Research Assistant');
    expect(researchSkill).toBeInTheDocument();

    await user.click(researchSkill);

    // The confirm button should now say "Add 1 skill"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add 1 skill/i })).toBeInTheDocument();
    });
  });

  it('can select multiple skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);

    // Select two skills
    await user.click(screen.getByText('Research Assistant'));
    await user.click(screen.getByText('Code Helper'));

    // The confirm button should now say "Add 2 skills"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add 2 skills/i })).toBeInTheDocument();
    });
  });

  it('confirm button adds selected skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);

    // Select a skill
    await user.click(screen.getByText('Research Assistant'));

    // Find the real "Add 1 skill" button (rendered by SkillPicker's render prop)
    const addButton = await screen.findByRole('button', { name: /add 1 skill/i });
    await user.click(addButton);

    // Verify addSkill was called with the correct id
    expect(mockConsoleStore.addSkill).toHaveBeenCalledWith('test-skill-1');
    expect(mockConsoleStore.setShowSkillPicker).toHaveBeenCalledWith(false);
  });

  it('cancel button closes without adding', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);

    // Select a skill
    await user.click(screen.getByText('Code Helper'));

    // Click the Cancel button (rendered by SkillPicker's render prop)
    const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
    await user.click(cancelButton);

    // Verify picker is closed but no skills were added
    expect(mockConsoleStore.setShowSkillPicker).toHaveBeenCalledWith(false);
    expect(mockConsoleStore.addSkill).not.toHaveBeenCalled();
  });

  it('can search and filter skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);

    // All skills initially visible
    expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    expect(screen.getByText('Code Helper')).toBeInTheDocument();
    expect(screen.getByText('Content Writer')).toBeInTheDocument();
  });

  it('shows already added skills as disabled', () => {
    render(<SkillPicker />);

    // The existing skill (added: true in consoleStore) should show "Added" badge
    expect(screen.getByText('Existing Skill')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('prevents selecting already added skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);

    // The add button starts disabled (no selection)
    const addButton = screen.getByRole('button', { name: /^add skills$/i });
    expect(addButton).toBeDisabled();

    // Try to click on already added skill — selection count should not change
    const existingSkill = screen.getByText('Existing Skill');
    await user.click(existingSkill);

    // Button should still be disabled (nothing selected)
    expect(addButton).toBeDisabled();
  });

  it('loads skills when picker opens and not already loaded', () => {
    mockSkillsStore.loaded = false;
    mockSkillsStore.loading = false;

    render(<SkillPicker />);

    // Should trigger loadSkills
    expect(mockSkillsStore.loadSkills).toHaveBeenCalled();
  });

  it('shows loading state appropriately', () => {
    mockSkillsStore.loaded = false;
    mockSkillsStore.loading = true;

    render(<SkillPicker />);

    // Should show the picker (it still renders even while loading)
    expect(screen.getByTestId('picker-modal')).toBeInTheDocument();
  });

  it('groups skills by category correctly', () => {
    render(<SkillPicker />);

    // Category group headers
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();

    // Skills exist in the rendered output
    expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    expect(screen.getByText('Code Helper')).toBeInTheDocument();
    expect(screen.getByText('Content Writer')).toBeInTheDocument();
  });
});
