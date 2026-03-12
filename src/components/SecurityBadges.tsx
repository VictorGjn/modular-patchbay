import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../theme';
import { API_BASE } from '../config';

interface SkillAuditResult {
  id: string;
  name: string;
  path: string;
  version: string | null;
  hasPackageJson: boolean;
  dependencies: number;
  outdatedDeps: string[];
  securityIssues: string[];
  lastModified: number | null;
  size: number;
  status: 'ok' | 'warning' | 'error';
}

// Module-level cache — survives re-renders, avoids duplicate fetches
const auditCache = new Map<string, SkillAuditResult>();
const notFound = new Set<string>();
const installedSkills = new Set<string>();
let installedLoaded = false;
let installedLoadingPromise: Promise<void> | null = null;

function normalizeSkillPath(skillPath: string): string {
  // Strip scope prefix: 'global:audit-website' -> 'audit-website'
  const afterColon = skillPath.includes(':') ? skillPath.split(':').pop()! : skillPath;
  // Strip URL segments: 'foo/bar/baz' -> 'baz'
  return afterColon.includes('/') ? afterColon.split('/').pop()! : afterColon;
}

function loadInstalledSkills(): Promise<void> {
  if (installedLoaded) return Promise.resolve();
  if (installedLoadingPromise) return installedLoadingPromise;
  installedLoadingPromise = fetch(`${API_BASE}/health/skills`)
    .then((r) => r.json())
    .then((resp: { status: string; data?: { id: string }[] }) => {
      if (resp.status === 'ok' && Array.isArray(resp.data)) {
        resp.data.forEach((s) => installedSkills.add(s.id));
      }
      installedLoaded = true;
    })
    .catch(() => { installedLoaded = true; });
  return installedLoadingPromise;
}

interface SecurityBadgesProps {
  skillPath: string; // skill directory name, e.g. 'frontend-design'
}

function statusColor(status: SkillAuditResult['status'] | null): string {
  if (status === 'ok') return '#2ecc71';
  if (status === 'warning') return '#f39c12';
  if (status === 'error') return '#e74c3c';
  return '#888';
}

export function SecurityBadges({ skillPath }: SecurityBadgesProps) {
  const t = useTheme();
  const normalized = normalizeSkillPath(skillPath);
  const [result, setResult] = useState<SkillAuditResult | null>(() => auditCache.get(normalized) ?? null);
  const [loading, setLoading] = useState(() => !auditCache.has(normalized) && !notFound.has(normalized));
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (auditCache.has(normalized)) {
      setResult(auditCache.get(normalized)!);
      setLoading(false);
      return;
    }
    if (notFound.has(normalized)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadInstalledSkills().then(() => {
      if (cancelled) return;
      if (!installedSkills.has(normalized)) {
        notFound.add(normalized);
        setLoading(false);
        return;
      }
      fetch(`${API_BASE}/health/skills/${encodeURIComponent(normalized)}`)
        .then((r) => {
          if (r.status === 404) {
            notFound.add(normalized);
            if (!cancelled) setLoading(false);
            return null;
          }
          return r.json();
        })
        .then((resp: { status: string; data?: SkillAuditResult } | null) => {
          if (cancelled || resp === null) return;
          if (resp.status === 'ok' && resp.data) {
            auditCache.set(normalized, resp.data);
            setResult(resp.data);
          }
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [normalized]);

  // Don't render anything if fetch is done and no data found
  if (!loading && result === null) return null;

  const isLoading = loading && result === null;
  const isUndocumented = result?.securityIssues.some(s => s.includes('undocumented')) ?? false;

  const badges = [
    {
      key: 'SEC',
      label: 'SEC',
      color: result ? (result.securityIssues.length === 0 ? '#2ecc71' : '#e74c3c') : '#888',
      tooltip: result
        ? result.securityIssues.length === 0
          ? 'Security: No issues'
          : `Security: ${result.securityIssues.length} issue${result.securityIssues.length > 1 ? 's' : ''}`
        : 'Security: Loading...',
    },
    {
      key: 'DEP',
      label: 'DEP',
      color: result ? (result.outdatedDeps.length === 0 ? '#2ecc71' : '#f39c12') : '#888',
      tooltip: result
        ? result.outdatedDeps.length === 0
          ? 'Dependencies: Up to date'
          : `Dependencies: ${result.outdatedDeps.length} outdated`
        : 'Dependencies: Loading...',
    },
    {
      key: 'DOC',
      label: 'DOC',
      color: result ? (isUndocumented ? '#e74c3c' : '#2ecc71') : '#888',
      tooltip: result
        ? isUndocumented ? 'Docs: Missing SKILL.md / README' : 'Docs: Present'
        : 'Docs: Loading...',
    },
  ];

  const dotColor = statusColor(result?.status ?? null);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {isLoading ? (
        <Loader2 size={8} style={{ color: '#888' }} className="animate-spin" />
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {badges.map((b) => (
        <div
          key={b.key}
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'default' }}
          onMouseEnter={() => setTooltip(b.key)}
          onMouseLeave={() => setTooltip(null)}
        >
          <span
            style={{
              fontSize: 12,
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 600,
              color: isLoading ? '#888' : b.color,
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
              {b.tooltip}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
