import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../theme';
import { API_BASE } from '../config';

interface AuditResult {
  gen: string;
  socket: string;
  snyk: string;
}

// Module-level cache — survives re-renders, avoids duplicate fetches
const auditCache = new Map<string, AuditResult>();

interface SecurityBadgesProps {
  skillPath: string; // e.g. 'anthropics/skills/frontend-design'
}

function badgeColor(value: string | null): string {
  if (value === 'Pass') return '#2ecc71';
  if (value === 'Fail') return '#e74c3c';
  return '#888';
}

const FULL_LABELS: Record<string, string> = {
  GEN: 'Gen Agent Trust Hub',
  SOC: 'Socket',
  SNK: 'Snyk',
};

export function SecurityBadges({ skillPath }: SecurityBadgesProps) {
  const t = useTheme();
  const [result, setResult] = useState<AuditResult | null>(() => auditCache.get(skillPath) ?? null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (auditCache.has(skillPath)) {
      setResult(auditCache.get(skillPath)!);
      return;
    }

    let cancelled = false;
    fetch(`${API_BASE}/skills/audit/${skillPath}`)
      .then((r) => r.json())
      .then((data: AuditResult) => {
        if (cancelled) return;
        auditCache.set(skillPath, data);
        setResult(data);
      })
      .catch(() => {
        if (cancelled) return;
        const pending: AuditResult = { gen: 'Pending', socket: 'Pending', snyk: 'Pending' };
        auditCache.set(skillPath, pending);
        setResult(pending);
      });
    return () => { cancelled = true; };
  }, [skillPath]);

  const badges = [
    { key: 'gen', label: 'GEN', value: result?.gen ?? null },
    { key: 'soc', label: 'SOC', value: result?.socket ?? null },
    { key: 'snk', label: 'SNK', value: result?.snyk ?? null },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {badges.map((b) => {
        const isLoading = result === null;
        const color = isLoading ? '#888' : badgeColor(b.value);
        const tooltipText = isLoading
          ? `${FULL_LABELS[b.label]}: Loading...`
          : `${FULL_LABELS[b.label]}: ${b.value ?? 'Pending'}`;
        return (
          <div
            key={b.key}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'default' }}
            onMouseEnter={() => setTooltip(b.key)}
            onMouseLeave={() => setTooltip(null)}
          >
            {isLoading ? (
              <Loader2 size={8} style={{ color: '#888' }} className="animate-spin" />
            ) : (
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
            )}
            <span
              style={{
                fontSize: 12,
                fontFamily: "'Geist Mono', monospace",
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
                  fontSize: 12,
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
