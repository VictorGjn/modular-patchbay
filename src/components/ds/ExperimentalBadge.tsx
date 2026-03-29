/**
 * ExperimentalBadge — Reusable badge + tooltip for experimental features.
 *
 * Usage:
 *   <ExperimentalBadge feature="teamRunner" />
 *   <ExperimentalBadge feature="teamRunner" inline />
 *   <ExperimentalBadge feature="advancedMemoryBackends" disabled />
 *
 * Issue #136
 */
import { type CSSProperties } from 'react';
import { FlaskConical } from 'lucide-react';
import { useFeatureFlags, FLAG_META, type FeatureFlags } from '../../store/featureFlags';
import { useTheme } from '../../theme';

interface ExperimentalBadgeProps {
  /** Which feature flag this badge represents */
  feature: keyof FeatureFlags;
  /** Inline mode: smaller, no background */
  inline?: boolean;
  /** Force disabled appearance (e.g., for non-functional memory backends) */
  disabled?: boolean;
  /** Custom label override */
  label?: string;
}

export function ExperimentalBadge({ feature, inline, disabled, label }: ExperimentalBadgeProps) {
  const isEnabled = useFeatureFlags((s) => s[feature]);
  const t = useTheme();
  const meta = FLAG_META[feature];

  if (isEnabled && !disabled) return null; // Feature is enabled, no badge needed

  const badgeLabel = label ?? (disabled ? 'Coming soon' : 'Experimental');
  const tooltipText = disabled
    ? `${meta.label}: Not yet functional. ${meta.description}`
    : `${meta.label}: ${meta.description} Enable in Settings → Experimental Features.`;

  const baseStyle: CSSProperties = inline
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        color: disabled ? t.textFaint : '#f59e0b',
        cursor: 'help',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase' as const,
        padding: '2px 8px',
        borderRadius: 4,
        color: disabled ? t.textFaint : '#f59e0b',
        background: disabled ? `${t.textFaint}12` : '#f59e0b14',
        border: `1px solid ${disabled ? `${t.textFaint}20` : '#f59e0b30'}`,
        cursor: 'help',
      };

  return (
    <span style={baseStyle} title={tooltipText} aria-label={tooltipText}>
      <FlaskConical size={inline ? 10 : 12} />
      {badgeLabel}
    </span>
  );
}

/**
 * ExperimentalGate — Wraps content that should only show when a feature flag is enabled.
 *
 * Usage:
 *   <ExperimentalGate feature="teamRunner" fallback={<p>Enable in Settings</p>}>
 *     <TeamRunnerPanel />
 *   </ExperimentalGate>
 */
interface ExperimentalGateProps {
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  /** What to show when the feature is disabled */
  fallback?: React.ReactNode;
}

export function ExperimentalGate({ feature, children, fallback }: ExperimentalGateProps) {
  const isEnabled = useFeatureFlags((s) => s[feature]);

  if (isEnabled) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const meta = FLAG_META[feature];
  const t = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 24,
        color: t.textDim,
        textAlign: 'center',
      }}
    >
      <FlaskConical size={24} style={{ color: '#f59e0b', opacity: 0.5 }} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{meta.label}</span>
      <span style={{ fontSize: 11, maxWidth: 300 }}>{meta.description}</span>
      <span style={{ fontSize: 10, opacity: 0.6 }}>Enable in Settings → Experimental Features</span>
    </div>
  );
}
