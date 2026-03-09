import { useState } from 'react';
import { useTheme } from '../theme';

interface SecurityBadgesProps {
  gen?: string;
  socket?: string;
  snyk?: string;
}

function securityColor(value: string | undefined, dimColor: string): string {
  if (!value) return dimColor;
  const v = value.toLowerCase();
  if (v === 'safe' || v === '0 alerts' || v === 'low risk') return '#2ecc71';
  if (v === 'med risk' || v.startsWith('1 ')) return '#f39c12';
  if (v === 'high risk') return '#e67e22';
  if (v === 'critical') return '#e74c3c';
  return dimColor;
}

export function SecurityBadges({ gen, socket, snyk }: SecurityBadgesProps) {
  const t = useTheme();
  const [tooltip, setTooltip] = useState<string | null>(null);

  if (!gen && !socket && !snyk) return null;

  const badges = [
    { key: 'gen', label: 'GEN', value: gen },
    { key: 'soc', label: 'SOC', value: socket },
    { key: 'snk', label: 'SNK', value: snyk },
  ];

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}
    >
      {badges.map((b) => {
        const color = securityColor(b.value, t.textDim);
        const tooltipText = b.value ? `${b.label}: ${b.value}` : `${b.label}: Pending`;
        return (
          <div
            key={b.key}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'default' }}
            onMouseEnter={() => setTooltip(b.key)}
            onMouseLeave={() => setTooltip(null)}
          >
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 8,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 600,
                color,
                lineHeight: 1,
              }}
            >
              {b.label}
            </span>
            {tooltip === b.key && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 4,
                  background: t.surfaceOpaque,
                  border: `1px solid ${t.border}`,
                  borderRadius: 4,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                  color: t.textPrimary,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  zIndex: 100,
                  pointerEvents: 'none',
                }}
              >
                {tooltipText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
