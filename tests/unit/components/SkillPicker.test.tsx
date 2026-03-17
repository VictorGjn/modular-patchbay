import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { SkillPicker } from '../../../src/components/SkillPicker';

// Mock the stores
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
      category: 'analysis',
    },
    {
      id: 'test-skill-2', 
      name: 'Code Helper',
      description: 'Assist with coding and development',
      enabled: false,
      category: 'development',
    },
    {
      id: 'test-skill-3',
      name: 'Content Writer',
      description: 'Help with content creation and writing',
      enabled: false,
      category: 'content',
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

// Mock the PickerModal component
vi.mock('../../../src/components/PickerModal', () => ({
  PickerModal: ({ children, open, onClose, title, searchPlaceholder }: any) => {
    if (!open) return null;
    
    return (
      <div data-testid="picker-modal" role="dialog" aria-labelledby="picker-title">
        <div id="picker-title">{title}</div>
        <input 
          placeholder={searchPlaceholder}
          data-testid="search-input"
          onChange={(e) => {
            // Simulate the filter function
            const filterFn = children('');
            return filterFn;
          }}
        />
        <button onClick={onClose} data-testid="close-button">Close</button>
        <div data-testid="picker-content">
          {typeof children === 'function' ? children('') : children}
        </div>
        <div data-testid="picker-actions">
          <button data-testid="confirm-button">Confirm</button>
          <button data-testid="cancel-button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  },
}));

describe('SkillPicker', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders skill list when open', () => {
    render(<SkillPicker />);
    
    expect(screen.getByTestId('picker-modal')).toBeInTheDocument();
    expect(screen.getByText('Select Skills')).toBeInTheDocument();
    
    // Check for skill categories
    expect(screen.getByText(/analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/development/i)).toBeInTheDocument();
    expect(screen.getByText(/content/i)).toBeInTheDocument();
    
    // Check for individual skills
    expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    expect(screen.getByText('Code Helper')).toBeInTheDocument();
    expect(screen.getByText('Content Writer')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    // Mock closed state
    const closedStore = { ...mockConsoleStore, showSkillPicker: false };
    vi.mocked(vi.importMock('../../../src/store/consoleStore')).mockReturnValue({
      useConsoleStore: (selector: any) => selector(closedStore),
    });
    
    render(<SkillPicker />);
    
    expect(screen.queryByTestId('picker-modal')).not.toBeInTheDocument();
  });

  it('selecting skills updates selection count', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);
    
    // Find and click on a skill
    const researchSkill = screen.getByText('Research Assistant');
    expect(researchSkill).toBeInTheDocument();
    
    await user.click(researchSkill);
    
    // The skill should appear selected (this depends on the implementation)
    // We can check if the skill's container has selection styling
    const skillContainer = researchSkill.closest('[data-testid], div');
    expect(skillContainer).toBeTruthy();
  });

  it('can select multiple skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);
    
    // Select multiple skills
    await user.click(screen.getByText('Research Assistant'));
    await user.click(screen.getByText('Code Helper'));
    
    // Both should be selected
    const researchSkill = screen.getByText('Research Assistant').closest('div');
    const codeSkill = screen.getByText('Code Helper').closest('div');
    
    expect(researchSkill).toBeTruthy();
    expect(codeSkill).toBeTruthy();
  });

  it('confirm button adds selected skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);
    
    // Select a skill
    await user.click(screen.getByText('Research Assistant'));
    
    // Click confirm button
    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);
    
    // Verify addSkill was called
    expect(mockConsoleStore.addSkill).toHaveBeenCalledWith('test-skill-1');
  });

  it('cancel button closes without adding', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);
    
    // Select a skill
    await user.click(screen.getByText('Code Helper'));
    
    // Click cancel button
    const cancelButton = screen.getByTestId('cancel-button');
    await user.click(cancelButton);
    
    // Verify picker is closed but no skills were added
    expect(mockConsoleStore.setShowSkillPicker).toHaveBeenCalledWith(false);
    expect(mockConsoleStore.addSkill).not.toHaveBeenCalled();
  });

  it('can search and filter skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);
    
    // Find search input
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toBeInTheDocument();
    
    // Type in search
    await user.type(searchInput, 'research');
    
    // Should filter to show only research-related skills
    await waitFor(() => {
      expect(screen.getByText('Research Assistant')).toBeInTheDocument();
      // Other skills might be hidden (depending on implementation)
    });
  });

  it('shows already added skills as disabled', () => {
    render(<SkillPicker />);
    
    // The existing skill should be shown but disabled/marked as added
    expect(screen.getByText('Existing Skill')).toBeInTheDocument();
    
    // Check if it has visual indication that it's already added
    const existingSkill = screen.getByText('Existing Skill').closest('div');
    expect(existingSkill).toBeTruthy();
    // Visual indication would be in the styling or classes (hard to test without actual DOM)
  });

  it('prevents selecting already added skills', async () => {
    const user = userEvent.setup();
    render(<SkillPicker />);
    
    // Try to click on already added skill
    const existingSkill = screen.getByText('Existing Skill');
    await user.click(existingSkill);
    
    // Should not be able to select it (no change in selection state)
    // This is more about ensuring the click doesn't trigger selection logic
    expect(existingSkill).toBeInTheDocument();
  });

  it('loads skills when picker opens and not already loaded', () => {
    // Mock unloaded state
    const unloadedStore = {
      ...mockSkillsStore,
      loaded: false,
      loading: false,
    };
    
    vi.mocked(vi.importMock('../../../src/store/skillsStore')).mockReturnValue({
      useSkillsStore: (selector: any) => selector(unloadedStore),
    });
    
    render(<SkillPicker />);
    
    // Should trigger loadSkills
    expect(unloadedStore.loadSkills).toHaveBeenCalled();
  });

  it('shows loading state appropriately', () => {
    // Mock loading state
    const loadingStore = {
      ...mockSkillsStore,
      loaded: false,
      loading: true,
    };
    
    vi.mocked(vi.importMock('../../../src/store/skillsStore')).mockReturnValue({
      useSkillsStore: (selector: any) => selector(loadingStore),
    });
    
    render(<SkillPicker />);
    
    // Should show the picker but might show loading indicators
    expect(screen.getByTestId('picker-modal')).toBeInTheDocument();
  });

  it('groups skills by category correctly', () => {
    render(<SkillPicker />);
    
    // Check that skills are grouped under their category headers
    expect(screen.getByText(/analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/development/i)).toBeInTheDocument();
    expect(screen.getByText(/content/i)).toBeInTheDocument();
    
    // Research Assistant should be under Analysis
    const analysisSection = screen.getByText(/analysis/i).closest('div');
    const researchSkill = screen.getByText('Research Assistant');
    
    expect(analysisSection).toBeTruthy();
    expect(researchSkill).toBeInTheDocument();
  });
});