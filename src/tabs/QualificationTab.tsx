import { useTheme } from '../theme';
import { QualificationPanel } from '../panels/QualificationPanel';
import { useQualificationStore } from '../store/qualificationStore';

function QualificationSparkline() {
  const t = useTheme();
  const runs = useQualificationStore((s) => s.runs);
  
  // Get last 10 runs, sorted by timestamp
  const recentRuns = [...runs]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-10);

  if (recentRuns.length < 2) {
    return null; // Need at least 2 points for a line
  }

  const width = 120;
  const height = 30;
  const padding = 4;
  
  // Map run scores to SVG coordinates
  const points = recentRuns.map((run, index) => {
    const x = padding + (index / (recentRuns.length - 1)) * (width - 2 * padding);
    const y = padding + ((100 - run.globalScore) / 100) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // Determine trend (green if last score >= first score, red otherwise)
  const isUpTrend = recentRuns[recentRuns.length - 1].globalScore >= recentRuns[0].globalScore;
  const lineColor = isUpTrend ? '#2ecc71' : '#e74c3c';
  
  const latestScore = recentRuns[recentRuns.length - 1].globalScore;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      backgroundColor: t.surface,
      borderRadius: '6px',
      border: `1px solid ${t.border}`
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '11px', color: t.textSecondary, fontWeight: 500 }}>
          Score Trend ({recentRuns.length} runs)
        </span>
        <span style={{ fontSize: '14px', color: t.textPrimary, fontWeight: 600 }}>
          {latestScore.toFixed(1)}%
        </span>
      </div>
      <svg width={width} height={height} style={{ flexShrink: 0 }}>
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function QualificationTab() {
  const t = useTheme();

  return (
    <div className="space-y-6">
      {/* Header with Sparkline */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
          <div>
            <h2 className="text-2xl font-semibold mb-2 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
              Qualification & Testing
            </h2>
            <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
              Run comprehensive test suites to validate your agent's performance, reliability, and adherence to requirements before production deployment.
            </p>
          </div>
          <QualificationSparkline />
        </div>
      </div>

      {/* QualificationPanel Content */}
      <QualificationPanel />
    </div>
  );
}