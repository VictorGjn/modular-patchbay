import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Plug, Zap, Download, Search, ExternalLink } from 'lucide-react';
import { useTheme } from '../theme';
import { PickerModal } from './PickerModal';
import { Tabs } from './ds/Tabs';
import { Spinner } from './ds/Spinner';
import { API_BASE } from '../config';
import { useConsoleStore } from '../store/consoleStore';
import { SecurityBadges } from './SecurityBadges';

export interface LibraryItem {
  id: string;
  name: string;
  description?: string;
  source?: string;        // 'claude' | 'registry' | 'project'
  status?: string;        // MCP: 'connected' | 'disconnected' | 'deferred' | 'disabled'
  mcpStatus?: string;     // from Claude config
  toolCount?: number;     // MCP: number of tools
  type?: string;          // MCP: 'stdio' | 'sse' | 'http'
}

interface LibraryPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: LibraryItem[];
  activeIds: Set<string>;
  onToggle: (id: string) => void;
  kind: 'skills' | 'mcp';
}

interface MarketplaceResult {
  id: string;
  name: string;
  repo: string;
  installs: string;
  url: string;
}

function getStatusColor(status: string | undefined, t: ReturnType<typeof useTheme>): string {
  if (status === 'connected') return t.statusSuccess;
  if (status === 'connecting') return t.statusWarning;
  if (status === 'error') return t.statusError;
  return t.textDim;
}

function useMarketplaceSearch(open: boolean) {
  const upsertSkill = useConsoleStore((s) => s.upsertSkill);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketplaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<Set<string>>(() => new Set<string>());
  const [installed, setInstalled] = useState<Set<string>>(() => new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/skills/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: MarketplaceResult[]; error?: string };
        setResults(json.data);
        setError(json.error || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const installSkill = useCallback(async (skillId: string, skillName?: string, repo?: string, skillUrl?: string) => {
    setInstalling((prev) => new Set(prev).add(skillId));
    try {
      const res = await fetch(`${API_BASE}/skills/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInstalled((prev) => new Set(prev).add(skillId));
      upsertSkill({
        id: skillId,
        name: skillName || skillId,
        description: repo ? `Installed from skills.sh (${repo})` : 'Installed from skills.sh',
        skillUrl,
      });
    } catch {
      // silent — button stays available for retry
    } finally {
      setInstalling((prev) => { const next = new Set(prev); next.delete(skillId); return next; });
    }
  }, [upsertSkill]);

  return { query, setQuery, results, loading, error, installing, installed, installSkill };
}

function MarketplaceTab({ search }: { search: ReturnType<typeof useMarketplaceSearch> }) {
  const t = useTheme();
  const { query, setQuery, results, loading, error, installing, installed, installSkill } = search;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search input */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${t.borderSubtle}` }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textDim }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills.sh marketplace..."
            style={{
              width: '100%',
              outline: 'none',
              fontSize: 17,
              paddingLeft: 36,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              fontFamily: "'Geist Sans', sans-serif",
            }}
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <Spinner size="sm" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && !error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <span style={{ fontSize: 17, color: t.textFaint }}>No skills found for &ldquo;{query}&rdquo;</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <span style={{ fontSize: 17, color: t.statusError }}>Search unavailable</span>
          </div>
        )}

        {!loading && query.length < 2 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <span style={{ fontSize: 17, color: t.textFaint }}>Type at least 2 characters to search</span>
          </div>
        )}

        {!loading && results.map((skill) => {
          const isInstalling = installing.has(skill.id);
          const isInstalled = installed.has(skill.id);
          const skillPath = skill.url.replace('https://skills.sh/', '');
          return (
            <div
              key={skill.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 20px',
                width: '100%',
                minHeight: 64,
                transition: 'background 100ms ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: t.badgeBg
              }}>
                <Zap size={14} style={{ color: t.textDim }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: '8px 0' }}>
                {/* Line 1: skill name + repo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 17,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: t.textPrimary
                  }}>
                    {skill.name}
                  </span>
                  <span style={{
                    fontSize: 14,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: t.textDim
                  }}>
                    {skill.repo}
                  </span>
                </div>
                {/* Line 2: installs badge + security badges + external link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{
                    fontSize: 12,
                    padding: '2px 6px',
                    borderRadius: 9999,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    fontFamily: "'Geist Mono', monospace",
                    fontWeight: 600,
                    background: t.badgeBg,
                    color: t.textMuted
                  }}>
                    {skill.installs}
                  </span>
                  <SecurityBadges skillPath={skillPath} />
                  <a
                    href={skill.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flexShrink: 0, padding: 2, color: t.textDim }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${skill.name} on skills.sh`}
                  >
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              {isInstalled ? (
                <span style={{ flexShrink: 0, color: t.statusSuccess }}><Check size={14} /></span>
              ) : isInstalling ? (
                <Spinner size="sm" />
              ) : (
                <button
                  type="button"
                  onClick={() => installSkill(skill.id, skill.name, skill.repo, skill.url)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: 'none',
                    flexShrink: 0,
                    fontSize: 12,
                    fontFamily: "'Geist Mono', monospace",
                    background: '#FE500020',
                    color: '#FE5000'
                  }}
                  aria-label={`Install ${skill.name}`}
                >
                  <Download size={10} /> Install
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Attribution */}
      <div style={{ padding: '8px 20px', textAlign: 'center', flexShrink: 0, borderTop: `1px solid ${t.borderSubtle}` }}>
        <span style={{
          fontSize: 13,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: t.textFaint,
          fontFamily: "'Geist Mono', monospace"
        }}>
          Powered by skills.sh
        </span>
      </div>
    </div>
  );
}

function LibraryItemRow({ item, isActive, onToggle, kind, t }: {
  item: LibraryItem;
  isActive: boolean;
  onToggle: (id: string) => void;
  kind: 'skills' | 'mcp';
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <button
      key={item.id}
      type="button"
      onClick={() => onToggle(item.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        width: '100%',
        border: 'none',
        cursor: 'pointer',
        background: isActive ? (t.isDark ? 'rgba(0,255,136,0.06)' : 'rgba(0,200,100,0.06)') : 'transparent',
        transition: 'background 100ms ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = isActive ? (t.isDark ? 'rgba(0,255,136,0.1)' : 'rgba(0,200,100,0.1)') : t.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? (t.isDark ? 'rgba(0,255,136,0.06)' : 'rgba(0,200,100,0.06)') : 'transparent'; }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: t.badgeBg
      }}>
        {isActive ? (
          <Check size={16} style={{ color: t.statusSuccess }} />
        ) : kind === 'mcp' ? (
          <Plug size={14} style={{ color: t.textDim }} />
        ) : (
          <Zap size={14} style={{ color: t.textDim }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 17,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: t.textPrimary
          }}>
            {item.name}
          </span>
          {item.source && (
            <span style={{
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 9999,
              textTransform: 'uppercase',
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 600,
              background: t.badgeBg,
              color: t.textMuted
            }}>
              {item.source}
            </span>
          )}
          {item.mcpStatus && item.mcpStatus !== 'enabled' && (
            <span style={{
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 9999,
              textTransform: 'uppercase',
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 600,
              background: item.mcpStatus === 'deferred' ? t.statusWarningBg : t.statusErrorBg,
              color: item.mcpStatus === 'deferred' ? t.statusWarning : t.statusError,
            }}>
              {item.mcpStatus}
            </span>
          )}
        </div>
        {item.description && (
          <span style={{
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            color: t.textDim
          }}>
            {item.description}
          </span>
        )}
      </div>
      {kind === 'mcp' && item.status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(item.status, t) }} />
          <span style={{
            fontSize: 12,
            fontFamily: "'Geist Mono', monospace",
            color: getStatusColor(item.status, t)
          }}>
            {item.status === 'connected' && item.toolCount ? `${item.toolCount} tools` : item.status}
          </span>
        </div>
      )}
      {kind === 'mcp' && item.type && (
        <span style={{
          fontSize: 12,
          padding: '2px 6px',
          borderRadius: 4,
          textTransform: 'uppercase',
          flexShrink: 0,
          fontFamily: "'Geist Mono', monospace",
          fontWeight: 600,
          background: item.type === 'stdio' ? '#3498db15' : item.type === 'http' ? '#9b59b615' : '#e67e2215',
          color: item.type === 'stdio' ? '#3498db' : item.type === 'http' ? '#9b59b6' : '#e67e22',
        }}>
          {item.type}
        </span>
      )}
    </button>
  );
}

export function LibraryPicker({ open, onClose, title, items, activeIds, onToggle, kind }: LibraryPickerProps) {
  const t = useTheme();
  const [tab, setTab] = useState<string>('installed');
  const search = useMarketplaceSearch(open);

  // Reset tab when modal opens
  useEffect(() => { if (open) setTab('installed'); }, [open]);

  const tabs = kind === 'skills'
    ? [
        { id: 'installed', label: 'Installed', count: items.length },
        { id: 'marketplace', label: 'Marketplace' },
      ]
    : [];

  // MCP mode — no tabs, use original PickerModal directly
  if (kind === 'mcp') {
    return (
      <PickerModal open={open} onClose={onClose} title={title} searchPlaceholder="Search MCP servers...">
        {(filter) => {
          const filtered = items.filter((item) => {
            if (!filter) return true;
            const f = filter.toLowerCase();
            return item.name.toLowerCase().includes(f) || (item.description || '').toLowerCase().includes(f);
          });
          if (filtered.length === 0) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                <span style={{ fontSize: 17, color: t.textFaint }}>
                  {items.length === 0 ? 'No MCP servers found' : 'No matches'}
                </span>
              </div>
            );
          }
          return filtered.map((item) => (
            <LibraryItemRow key={item.id} item={item} isActive={activeIds.has(item.id)} onToggle={onToggle} kind={kind} t={t} />
          ));
        }}
      </PickerModal>
    );
  }

  // Skills mode — tabbed with marketplace search
  return (
    <PickerModal
      open={open}
      onClose={onClose}
      title={title}
      searchPlaceholder={tab === 'installed' ? 'Search installed skills...' : undefined}
      hideSearch={tab === 'marketplace'}
    >
      {(filter) => (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} size="sm" />
          {tab === 'installed' && (() => {
            const filtered = items.filter((item) => {
              if (!filter) return true;
              const f = filter.toLowerCase();
              return item.name.toLowerCase().includes(f) || (item.description || '').toLowerCase().includes(f);
            });
            if (filtered.length === 0) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                  <span style={{ fontSize: 17, color: t.textFaint }}>
                    {items.length === 0 ? 'No skills found' : 'No matches'}
                  </span>
                </div>
              );
            }
            return filtered.map((item) => (
              <LibraryItemRow key={item.id} item={item} isActive={activeIds.has(item.id)} onToggle={onToggle} kind={kind} t={t} />
            ));
          })()}
          {tab === 'marketplace' && <MarketplaceTab search={search} />}
        </>
      )}
    </PickerModal>
  );
}
