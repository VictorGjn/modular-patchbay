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
  gen?: string;
  socket?: string;
  snyk?: string;
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

  const installSkill = useCallback(async (skillId: string, skillName?: string, repo?: string, gen?: string, socket?: string, snyk?: string) => {
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
        gen,
        socket,
        snyk,
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
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills.sh marketplace..."
            className="w-full outline-none text-sm pl-9 pr-3 py-2 rounded-lg"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              fontFamily: "'Inter', sans-serif",
            }}
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && !error && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm" style={{ color: t.textFaint }}>No skills found for &ldquo;{query}&rdquo;</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm" style={{ color: t.statusError }}>Search unavailable</span>
          </div>
        )}

        {!loading && query.length < 2 && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm" style={{ color: t.textFaint }}>Type at least 2 characters to search</span>
          </div>
        )}

        {!loading && results.map((skill) => {
          const isInstalling = installing.has(skill.id);
          const isInstalled = installed.has(skill.id);
          return (
            <div
              key={skill.id}
              className="flex items-center gap-3 px-5 py-2.5 w-full"
              style={{ transition: 'background 100ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.badgeBg }}>
                <Zap size={14} style={{ color: t.textDim }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{skill.name}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase" style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, background: t.badgeBg, color: t.textMuted }}>
                    {skill.installs}
                  </span>
                  <SecurityBadges gen={skill.gen} socket={skill.socket} snyk={skill.snyk} />
                </div>
                <span className="text-xs truncate block" style={{ color: t.textDim }}>{skill.repo}</span>
              </div>
              <a
                href={skill.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1"
                style={{ color: t.textDim }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`View ${skill.name} on skills.sh`}
              >
                <ExternalLink size={12} />
              </a>
              {isInstalled ? (
                <span className="shrink-0" style={{ color: t.statusSuccess }}><Check size={14} /></span>
              ) : isInstalling ? (
                <Spinner size="sm" />
              ) : (
                <button
                  type="button"
                  onClick={() => installSkill(skill.id, skill.name, skill.repo, skill.gen, skill.socket, skill.snyk)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer border-none shrink-0"
                  style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", background: '#FE500020', color: '#FE5000' }}
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
      <div className="px-5 py-2 text-center shrink-0" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
        <span className="text-[9px] tracking-wider uppercase" style={{ color: t.textFaint, fontFamily: "'Space Mono', monospace" }}>
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
      className="flex items-center gap-3 px-5 py-2.5 w-full border-none cursor-pointer"
      style={{
        background: isActive ? (t.isDark ? 'rgba(0,255,136,0.06)' : 'rgba(0,200,100,0.06)') : 'transparent',
        transition: 'background 100ms ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = isActive ? (t.isDark ? 'rgba(0,255,136,0.1)' : 'rgba(0,200,100,0.1)') : t.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? (t.isDark ? 'rgba(0,255,136,0.06)' : 'rgba(0,200,100,0.06)') : 'transparent'; }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.badgeBg }}>
        {isActive ? (
          <Check size={16} style={{ color: t.statusSuccess }} />
        ) : kind === 'mcp' ? (
          <Plug size={14} style={{ color: t.textDim }} />
        ) : (
          <Zap size={14} style={{ color: t.textDim }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{item.name}</span>
          {item.source && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase" style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, background: t.badgeBg, color: t.textMuted }}>
              {item.source}
            </span>
          )}
          {item.mcpStatus && item.mcpStatus !== 'enabled' && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase" style={{
              fontFamily: "'Space Mono', monospace", fontWeight: 600,
              background: item.mcpStatus === 'deferred' ? t.statusWarningBg : t.statusErrorBg,
              color: item.mcpStatus === 'deferred' ? t.statusWarning : t.statusError,
            }}>
              {item.mcpStatus}
            </span>
          )}
        </div>
        {item.description && (
          <span className="text-xs truncate block" style={{ color: t.textDim }}>{item.description}</span>
        )}
      </div>
      {kind === 'mcp' && item.status && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full" style={{ background: getStatusColor(item.status, t) }} />
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: getStatusColor(item.status, t) }}>
            {item.status === 'connected' && item.toolCount ? `${item.toolCount} tools` : item.status}
          </span>
        </div>
      )}
      {kind === 'mcp' && item.type && (
        <span className="text-[8px] px-1.5 py-0.5 rounded uppercase shrink-0" style={{
          fontFamily: "'Space Mono', monospace", fontWeight: 600,
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
              <div className="flex items-center justify-center py-8">
                <span className="text-sm" style={{ color: t.textFaint }}>
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
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm" style={{ color: t.textFaint }}>
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
