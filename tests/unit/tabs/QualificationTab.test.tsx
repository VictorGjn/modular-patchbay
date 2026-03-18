import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render, setupTestEnvironment } from '../test-utils';
import { QualificationTab } from '../../../src/tabs/QualificationTab';

// Mock the QualificationPanel — it's complex and has its own tests implicitly
vi.mock('../../../src/panels/QualificationPanel', () => ({
  QualificationPanel: () => (
    <div data-testid="qualification-panel">
      <div>Test Suite</div>
      <button>Run Tests</button>
    </div>
  ),
}));

// Mock qualificationStore with selector support
const mockQualificationState = {
  runs: [],
  status: 'not-started' as const,
  suite: {
    name: 'Test Suite',
    missionBrief: '',
    testCases: [],
    scoringDimensions: [],
    passThreshold: 70,
  },
  recordRun: vi.fn(),
  setStatus: vi.fn(),
  addCase: vi.fn(),
  updateCase: vi.fn(),
  removeCase: vi.fn(),
};

vi.mock('../../../src/store/qualificationStore', () => ({
  useQualificationStore: (selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockQualificationState);
    }
    return mockQualificationState;
  },
}));

describe('QualificationTab', () => {
  beforeEach(() => {
    setupTestEnvironment();
    vi.clearAllMocks();
    mockQualificationState.runs = [];
  });

  it('renders the Qualification heading', () => {
    render(<QualificationTab />);

    expect(screen.getByText(/qualification & testing/i)).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<QualificationTab />);

    expect(screen.getByText(/run comprehensive test suites/i)).toBeInTheDocument();
  });

  it('renders the QualificationPanel', () => {
    render(<QualificationTab />);

    expect(screen.getByTestId('qualification-panel')).toBeInTheDocument();
  });

  it('does NOT render the sparkline with fewer than 2 runs', () => {
    // Only 1 run — sparkline needs at least 2 data points
    mockQualificationState.runs = [
      {
        id: 'run-1',
        timestamp: Date.now(),
        globalScore: 85,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 5,
        failed: 0,
        total: 5,
      },
    ];

    render(<QualificationTab />);

    // Sparkline renders an SVG with a polyline — with only 1 run, it should not render
    const svgElements = document.querySelectorAll('polyline');
    expect(svgElements).toHaveLength(0);
  });

  it('renders sparkline SVG with 2+ runs', () => {
    mockQualificationState.runs = [
      {
        id: 'run-1',
        timestamp: Date.now() - 60000,
        globalScore: 75,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 4,
        failed: 1,
        total: 5,
      },
      {
        id: 'run-2',
        timestamp: Date.now(),
        globalScore: 90,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 5,
        failed: 0,
        total: 5,
      },
    ];

    render(<QualificationTab />);

    // With 2 runs, the sparkline renders
    const polyline = document.querySelector('polyline');
    expect(polyline).not.toBeNull();
  });

  it('shows score percentage in sparkline for 2+ runs', () => {
    mockQualificationState.runs = [
      {
        id: 'run-1',
        timestamp: Date.now() - 60000,
        globalScore: 80,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 4,
        failed: 1,
        total: 5,
      },
      {
        id: 'run-2',
        timestamp: Date.now(),
        globalScore: 90,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 5,
        failed: 0,
        total: 5,
      },
    ];

    render(<QualificationTab />);

    // Latest score is shown with "%" unit
    expect(screen.getByText('90.0%')).toBeInTheDocument();
  });

  it('shows run count in sparkline label', () => {
    const runs = Array.from({ length: 5 }, (_, i) => ({
      id: `run-${i}`,
      timestamp: Date.now() - i * 60000,
      globalScore: 70 + i * 5,
      dimensionScores: {},
      testResults: [],
      status: 'passed' as const,
      passed: 5,
      failed: 0,
      total: 5,
    }));
    mockQualificationState.runs = runs;

    render(<QualificationTab />);

    // Sparkline label shows run count
    expect(screen.getByText(/5 runs/i)).toBeInTheDocument();
  });

  it('sparkline uses green color for upward trend', () => {
    mockQualificationState.runs = [
      {
        id: 'run-1',
        timestamp: Date.now() - 60000,
        globalScore: 60,
        dimensionScores: {},
        testResults: [],
        status: 'needs-work' as const,
        passed: 3,
        failed: 2,
        total: 5,
      },
      {
        id: 'run-2',
        timestamp: Date.now(),
        globalScore: 90,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 5,
        failed: 0,
        total: 5,
      },
    ];

    render(<QualificationTab />);

    // Polyline should have green stroke for upward trend
    const polyline = document.querySelector('polyline');
    expect(polyline?.getAttribute('stroke')).toBe('#2ecc71');
  });

  it('sparkline uses red color for downward trend', () => {
    mockQualificationState.runs = [
      {
        id: 'run-1',
        timestamp: Date.now() - 60000,
        globalScore: 90,
        dimensionScores: {},
        testResults: [],
        status: 'passed' as const,
        passed: 5,
        failed: 0,
        total: 5,
      },
      {
        id: 'run-2',
        timestamp: Date.now(),
        globalScore: 60,
        dimensionScores: {},
        testResults: [],
        status: 'needs-work' as const,
        passed: 3,
        failed: 2,
        total: 5,
      },
    ];

    render(<QualificationTab />);

    // Polyline should have red stroke for downward trend
    const polyline = document.querySelector('polyline');
    expect(polyline?.getAttribute('stroke')).toBe('#e74c3c');
  });
});
