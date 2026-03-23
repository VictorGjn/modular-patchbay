import { useTheme } from '../theme';
import { QualificationPanel } from '../panels/QualificationPanel';
import { useQualificationStore } from '../store/qualificationStore';
import { useLessonStore } from '../store/lessonStore';
import { useVersionStore } from '../store/versionStore';

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

function LearningVelocitySection() {
  const t = useTheme();
  const agentId = useVersionStore((s) => s.agentId) ?? '';
  const lessons = useLessonStore((s) => s.lessons);

  const agentLessons = lessons.filter((l) => l.agentId === agentId);
  const approved = agentLessons.filter((l) => l.status === 'approved');
  const avgConf = approved.length > 0
    ? approved.reduce((s, l) => s + l.confidence, 0) / approved.length
    : 0;

  // Sort approved lessons by lastSeenAt for confidence progression bar chart
  const sorted = [...approved].sort((a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime());

  if (agentLessons.length === 0) return null;

  const barWidth = 10;
  const barGap = 3;
  const chartHeight = 40;
  const chartWidth = Math.max(100, sorted.length * (barWidth + barGap));

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: t.surface, border: `1px solid ${t.border}`, fontFamily: "'Geist Sans', sans-serif" }}
    >
      <h4 className="text-sm font-semibold m-0" style={{ color: t.textPrimary }}>
        Learning Velocity
      </h4>
      <div className="flex gap-6 flex-wrap">
        <div>
          <div className="text-[11px]" style={{ color: t.textDim }}>Corrections Retained</div>
          <div className="text-lg font-semibold tabular-nums" style={{ color: t.textPrimary }}>{approved.length}</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: t.textDim }}>Repeated Mistakes</div>
          <div className="text-lg font-semibold tabular-nums" style={{ color: t.textPrimary }}>0</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: t.textDim }}>Avg Confidence</div>
          <div className="text-lg font-semibold tabular-nums" style={{ color: t.textPrimary }}>
            {approved.length > 0 ? `${Math.round(avgConf * 100)}%` : '—'}
          </div>
        </div>
      </div>

      {sorted.length > 0 && (
        <div>
          <div className="text-[11px] mb-1" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            CONFIDENCE BY LESSON (oldest → newest)
          </div>
          <svg width={chartWidth} height={chartHeight} style={{ display: 'block', overflow: 'visible' }}>
            {sorted.map((l, i) => {
              const barH = Math.max(2, Math.round(l.confidence * (chartHeight - 4)));
              const x = i * (barWidth + barGap);
              const y = chartHeight - barH;
              const color = l.confidence < 0.5 ? '#e74c3c' : l.confidence < 0.7 ? '#f39c12' : '#2ecc71';
              return (
                <rect key={l.id} x={x} y={y} width={barWidth} height={barH} rx={2} fill={color} opacity={0.85}>
                  <title>{`${Math.round(l.confidence * 100)}% — ${l.rule.slice(0, 40)}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
      )}
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

      {/* Learning Velocity */}
      <LearningVelocitySection />

      {/* QualificationPanel Content */}
      <QualificationPanel />
    </div>
  );
}