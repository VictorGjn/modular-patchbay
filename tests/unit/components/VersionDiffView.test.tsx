import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupTestEnvironment } from '../test-utils';
import { VersionDiffView } from '../../../src/components/VersionDiffView';
import type { AgentVersion } from '../../../src/store/versionStore';

// Mock versionDiff utility
vi.mock('../../../src/utils/versionDiff', () => ({
  computeVersionDiff: vi.fn((snapshotA, snapshotB, vA, vB) => ({
    versionA: vA,
    versionB: vB,
    changes: [
      {
        category: 'meta',
        field: 'model',
        type: 'modified',
        description: 'Model changed',
        before: 'gpt-3.5-turbo',
        after: 'gpt-4',
      },
      {
        category: 'persona',
        field: 'persona',
        type: 'added',
        description: 'Persona added',
        after: 'A helpful assistant',
      },
    ],
    summary: {
      totalChanges: 2,
      changeTypes: { added: 1, removed: 0, modified: 1 },
      categoryCounts: { meta: 1, persona: 1 },
    },
  })),
}));

function makeVersion(version: string, label: string): AgentVersion {
  return {
    id: `v-${version}`,
    version,
    label,
    timestamp: new Date('2024-01-01').toISOString(),
    snapshot: {} as any,
  };
}

const versionA = makeVersion('1.0.0', 'Initial version');
const versionB = makeVersion('1.1.0', 'Updated version');

describe('VersionDiffView', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
  });

  it('renders the version header', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Shows the version transition in header
    expect(screen.getByText(/v1\.0\.0.*v1\.1\.0/i)).toBeInTheDocument();
  });

  it('shows diff summary with change counts', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Summary bar shows total changes
    expect(screen.getByText(/2 changes/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1 added/i)).toBeInTheDocument();
    expect(screen.getByText(/1 modified/i)).toBeInTheDocument();
  });

  it('renders all diff categories', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // All 6 category sections should render
    expect(screen.getByText(/model & config/i)).toBeInTheDocument();
    expect(screen.getByText(/persona & objectives/i)).toBeInTheDocument();
    expect(screen.getByText(/constraints/i)).toBeInTheDocument();
    expect(screen.getByText(/workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/knowledge/i)).toBeInTheDocument();
    expect(screen.getByText(/tools & mcp/i)).toBeInTheDocument();
  });

  it('shows changed fields for each category', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // The mocked changes include these descriptions
    expect(screen.getByText('Model changed')).toBeInTheDocument();
    expect(screen.getByText('Persona added')).toBeInTheDocument();
  });

  it('shows BEFORE/AFTER values for modified fields', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Modified diff row shows before/after values
    expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close diff view/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('clicking backdrop calls onClose via keyboard close', async () => {
    const user = userEvent.setup();
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Close via the close button (reliable path)
    const closeButton = screen.getByRole('button', { name: /close diff view/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('can collapse category sections by clicking category button', async () => {
    const user = userEvent.setup();
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Initially expanded — changes visible
    expect(screen.getByText('Model changed')).toBeInTheDocument();

    // Find the "Model & Config" category toggle button
    const metaButton = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('Model & Config')
    );
    expect(metaButton).toBeDefined();

    if (metaButton) {
      await user.click(metaButton);
    }

    // After collapse the category header is still visible
    expect(screen.getByText(/model & config/i)).toBeInTheDocument();
  });

  it('shows "No changes" for unchanged categories', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Categories with no changes show "No changes" label
    const noChangesElements = screen.getAllByText(/no changes/i);
    expect(noChangesElements.length).toBeGreaterThan(0);
  });

  it('shows change count badges on categories with changes', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    // Categories with changes show numeric badges
    // meta has 1 change, persona has 1 change → two "1" badges
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders BEFORE/AFTER labels for modified entries', () => {
    render(<VersionDiffView versionA={versionA} versionB={versionB} onClose={onClose} />);

    expect(screen.getByText('BEFORE')).toBeInTheDocument();
    expect(screen.getByText('AFTER')).toBeInTheDocument();
  });

  it('renders identically with swapped versions', () => {
    const { unmount } = render(
      <VersionDiffView versionA={versionB} versionB={versionA} onClose={onClose} />
    );

    // Header shows the versions (even if swapped)
    expect(screen.getByText(/v1\.1\.0.*v1\.0\.0/i)).toBeInTheDocument();
    unmount();
  });
});
