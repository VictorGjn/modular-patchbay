import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent, type CSSProperties } from 'react';
import { useConsoleStore } from '../store/consoleStore';
// useMcpStore removed — MCP tab now redirects to ConnectionPicker
import { MARKETPLACE_CATEGORIES, RUNTIME_INFO, REGISTRY_PRESETS, type MarketplaceCategory, type Runtime, type InstallScope } from '../store/registry';
import { RegistryIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { X, Search, Check, Loader2, ChevronDown, ChevronUp, Terminal, ExternalLink, Download, Zap } from 'lucide-react';
import { API_BASE } from '../config';
import { SecurityBadges } from './SecurityBadges';
import { Tooltip } from './ds/Tooltip';

type Tab = 'skills' | 'mcp' | 'presets';
type SkillSearchResult = {
  id: string;
  name: string;
  repo: string;
  installs: string;
  url: string;
};

export function Marketplace() {
  const showMarketplace = useConsoleStore((s) => s.showMarketplace);
  const activeTab = useConsoleStore((s) => s.activeMarketplaceTab);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const registrySkills = useConsoleStore((s) => s.registrySkills);
  const installRegistrySkill = useConsoleStore((s) => s.installRegistrySkill);
  const upsertSkill = useConsoleStore((s) => s.upsertSkill);
  const librarySkills = useConsoleStore((s) => s.skills);

  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('all');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [remoteInstallingId, setRemoteInstallingId] = useState<string | null>(null);
  const [remoteInstalledIds, setRemoteInstalledIds] = useState<Set<string>>(() => new Set<string>());
  const [remoteResults, setRemoteResults] = useState<SkillSearchResult[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [installDropdown, setInstallDropdown] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  const librarySkillIds = new Set<string>(
    Array.isArray(librarySkills)
      ? (librarySkills as { id?: string; added?: boolean }[]).filter((s) => s.added).map((s) => s.id ?? '')
      : []
  );

  const handleFocusTrap = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  useEffect(() => {
    if (showMarketplace) {
      setFilter('');
      setCategory('all');
      setInstallingId(null);
      setRemoteInstallingId(null);
      setRemoteResults([]);
      setRemoteLoading(false);
      setRemoteError(null);
      setInstallDropdown(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showMarketplace]);

  useEffect(() => {
    if (!showMarketplace) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMarketplace(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showMarketplace, setShowMarketplace]);

  const setTab = useCallback((tab: Tab) => {
    setShowMarketplace(true, tab);
    setFilter('');
    setCategory('all');
    setRemoteResults([]);
    setRemoteError(null);
    setRemoteLoading(false);
  }, [setShowMarketplace]);

  const handleInstall = useCallback((skillId: string, target: Runtime | 'all', scope: InstallScope) => {
    setInstallingId(skillId);
    setInstallDropdown(null);
    setTimeout(() => {
      installRegistrySkill(skillId, target, scope);
      setInstallingId(null);
    }, 1200);
  }, [installRegistrySkill]);

  const handleRemoteInstall = useCallback(async (skill: SkillSearchResult) => {
    setRemoteInstallingId(skill.id);
    try {
      const res = await fetch(`${API_BASE}/skills/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRemoteInstalledIds((prev) => new Set(prev).add(skill.id));
      upsertSkill({
        id: skill.id,
        name: skill.name,
        description: `Installed from skills.sh (${skill.repo})`,
        skillUrl: skill.url,
      });
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setRemoteInstallingId(null);
    }
  }, [upsertSkill]);



  useEffect(() => {
    if (!showMarketplace || activeTab !== 'skills') {
      setRemoteLoading(false);
      setRemoteResults([]);
      setRemoteError(null);
      return;
    }
    const query = filter.trim();
    if (query.length < 2) {
      setRemoteLoading(false);
      setRemoteResults([]);
      setRemoteError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRemoteLoading(true);
      setRemoteError(null);
      try {
        const res = await fetch(`${API_BASE}/skills/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data?: SkillSearchResult[]; error?: string };
        setRemoteResults(Array.isArray(json.data) ? json.data : []);
        setRemoteError(json.error ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRemoteResults([]);
        setRemoteError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (!controller.signal.aborted) setRemoteLoading(false);
      }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeTab, filter, showMarketplace]);

  // Responsive grid columns calculation — hooks must be before any early return
  const getGridColumns = () => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width <= 1024) return 2;
    if (width <= 1440) return 3;
    return 4;
  };

  const [gridColumns, setGridColumns] = useState(getGridColumns);

  useEffect(() => {
    const handleResize = () => setGridColumns(getGridColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!showMarketplace) return null;

  const matchesFilter = (name: string, desc: string) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return name.toLowerCase().includes(f) || desc.toLowerCase().includes(f);
  };

  const filteredSkills = registrySkills.filter((s) =>
    matchesFilter(s.name, s.description) && (category === 'all' || s.category === category)
  );

  const filteredPresets = REGISTRY_PRESETS.filter((p) => matchesFilter(p.name, p.description));

  const skillGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
    gap: 12,
    padding: 16,
    alignContent: 'start',
  };

  return (
    <>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => setShowMarketplace(false)}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Marketplace"
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            overflow: 'hidden',
            isolation: 'isolate',
            zIndex: 1,
            width: '90vw',
            maxWidth: 1600,
            height: '80vh',
            background: t.surface,
            border: `1px solid ${t.border}`,
            boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            animation: 'modal-in 0.2s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleFocusTrap}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 17, fontWeight: 600, flexShrink: 0, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
              Marketplace
            </span>

            {/* Search */}
            <div style={{ position: 'relative', width: 240, flexShrink: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.textDim }} />
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%',
                  outline: 'none',
                  fontSize: 14,
                  paddingLeft: 32,
                  paddingRight: 12,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 6,
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  fontFamily: "'Geist Sans', sans-serif",
                }}
              />
            </div>

            {/* Main tabs */}
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', borderBottom: `1px solid ${t.borderSubtle}` }}>
              {(['skills', 'mcp', 'presets'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTab(tab)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: '0.025em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    border: 'none',
                    color: activeTab === tab ? '#FE5000' : t.textDim,
                    borderBottom: activeTab === tab ? '2px solid #FE5000' : '2px solid transparent',
                    background: 'transparent',
                    marginBottom: -1,
                    transition: 'color 150ms ease',
                  }}
                >
                  {tab === 'mcp' ? 'MCP Servers' : tab === 'presets' ? 'Presets' : 'Skills'}
                </button>
              ))}
            </div>

            <Tooltip content="Close marketplace (Esc)">
              <button
                type="button"
                onClick={() => setShowMarketplace(false)}
                className="transition-colors"
                style={{
                  padding: 4,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  flexShrink: 0,
                  color: t.textDim
                }}
                aria-label="Close marketplace"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#ef444420';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = t.textDim;
                }}
              >
                <X size={16} />
              </button>
            </Tooltip>
          </div>

          {/* Sub-header: category pills + provider legend (skills) */}
          {activeTab === 'skills' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: `1px solid ${t.borderSubtle}`,
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                {MARKETPLACE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      fontSize: 12,
                      padding: '2px 10px',
                      borderRadius: 9999,
                      cursor: 'pointer',
                      border: 'none',
                      fontWeight: 500,
                      background: category === cat.id ? '#FE5000' : t.surfaceElevated,
                      color: category === cat.id ? '#fff' : t.textSecondary,
                      transition: 'background 150ms ease, color 150ms ease',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {/* Provider legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {(Object.entries(RUNTIME_INFO) as [Runtime, { label: string; color: string }][]).map(([rt, info]) => (
                  <span key={rt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: t.textDim }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: info.color, display: 'inline-block', flexShrink: 0 }} />
                    {info.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sub-header: category pills only (mcp) */}
          {activeTab === 'mcp' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                gap: 4,
                flexWrap: 'wrap',
                borderBottom: `1px solid ${t.borderSubtle}`
              }}
            >
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  style={{
                    fontSize: 12,
                    padding: '2px 10px',
                    borderRadius: 9999,
                    cursor: 'pointer',
                    border: 'none',
                    fontWeight: 500,
                    background: category === cat.id ? '#FE5000' : t.surfaceElevated,
                    color: category === cat.id ? '#fff' : t.textSecondary,
                    transition: 'background 150ms ease, color 150ms ease',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'skills' && (
              <>
                {filteredSkills.length > 0 && (
                  <div style={skillGridStyle}>
                    {filteredSkills.map((skill) => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        isInLibrary={librarySkillIds.has(skill.id)}
                        installing={installingId === skill.id}
                        dropdownOpen={installDropdown === skill.id}
                        onToggleDropdown={() => setInstallDropdown(installDropdown === skill.id ? null : skill.id)}
                        onInstall={handleInstall}
                        t={t}
                      />
                    ))}
                  </div>
                )}
                {filteredSkills.length === 0 && !remoteLoading && !remoteError && remoteResults.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                    <span style={{ fontSize: 14, color: t.textFaint }}>No skills match your search</span>
                  </div>
                )}

                {(filter.trim().length >= 2 || remoteLoading || remoteError || remoteResults.length > 0) && (
                  <div style={{ padding: '16px 16px 8px', borderTop: `1px solid ${t.borderSubtle}` }}>
                    <span style={{ fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      From skill.sh
                    </span>
                  </div>
                )}
                {remoteLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.textDim }}>
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      Searching skill.sh...
                    </span>
                  </div>
                )}
                {!remoteLoading && remoteError && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
                    <span style={{ fontSize: 13, color: t.statusError }}>
                      skill.sh search unavailable
                    </span>
                  </div>
                )}
                {!remoteLoading && !remoteError && remoteResults.length > 0 && (
                  <div style={{ ...skillGridStyle, paddingTop: 0 }}>
                    {remoteResults.map((skill) => (
                      <RemoteSkillCard
                        key={skill.id}
                        skill={skill}
                        installing={remoteInstallingId === skill.id}
                        installed={remoteInstalledIds.has(skill.id)}
                        onInstall={() => handleRemoteInstall(skill)}
                        t={t}
                      />
                    ))}
                  </div>
                )}
                {!remoteLoading && !remoteError && filter.trim().length >= 2 && remoteResults.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
                    <span style={{ fontSize: 13, color: t.textFaint }}>No results from skill.sh</span>
                  </div>
                )}
              </>
            )}

            {activeTab === 'mcp' && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ color: t.textDim, marginBottom: 12 }}>Browse and connect MCP servers</p>
                <button
                  onClick={() => { setShowMarketplace(false); useConsoleStore.getState().setShowConnectionPicker(true); }}
                  style={{
                    background: '#FE5000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontFamily: "'Geist Mono', monospace"
                  }}
                >
                  Open Connection Picker
                </button>
              </div>
            )}

            {activeTab === 'presets' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredPresets.map((preset) => (
                  <PresetRow key={preset.id} preset={preset} t={t} onLoad={() => setShowMarketplace(false)} />
                ))}
                {filteredPresets.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                    <span style={{ fontSize: 14, color: t.textFaint }}>No presets match your search</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ──────── Skill Card ──────── */

function SkillCard({ skill, isInLibrary, installing, dropdownOpen, onToggleDropdown, onInstall, t }: {
  skill: (typeof import('../store/registry'))['REGISTRY_SKILLS'][number];
  isInLibrary: boolean;
  installing: boolean;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onInstall: (id: string, target: Runtime | 'all', scope: InstallScope) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Runtime | 'all'>('claude');
  const [selectedScope, setSelectedScope] = useState<InstallScope>('project');
  const isDisabled = isInLibrary || skill.installed;

  return (
    <div
      style={{
        background: t.surfaceElevated,
        border: `1px solid ${isDisabled ? t.borderSubtle : t.border}`,
        borderRadius: 6,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        opacity: isDisabled ? 0.55 : 1,
        position: 'relative',
        transition: 'border-color 150ms ease',
        minHeight: 120,
      }}
      onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget as HTMLDivElement).style.borderColor = '#FE500050'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = isDisabled ? t.borderSubtle : t.border; }}
    >
      {/* Row 1: name + installs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: t.textPrimary,
          fontFamily: "'Geist Mono', monospace",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {skill.name}
        </span>
        <span style={{
          fontSize: 13,
          color: t.textDim,
          background: t.badgeBg,
          borderRadius: 3,
          padding: '1px 4px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontFamily: "'Geist Mono', monospace",
        }}>
          {skill.installs >= 1000 ? `${(skill.installs / 1000).toFixed(1)}k` : skill.installs}↓
        </span>
      </div>

      {/* Row 2: author (dim) */}
      <span style={{
        fontSize: 12,
        color: t.textDim,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: "'Geist Sans', sans-serif",
      }}>
        {skill.author}
      </span>

      {/* Row 3: description with expand toggle */}
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontSize: 12,
            color: t.textMuted,
            fontFamily: "'Geist Sans', sans-serif",
            lineHeight: 1.4,
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
            overflow: expanded ? 'visible' : 'hidden',
          } as React.CSSProperties}
        >
          {skill.description}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.textDim, display: 'inline-flex', alignItems: 'center', marginTop: 1 }}
        >
          {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
        </button>
      </div>

      {/* Row 4: SecurityBadges */}
      <SecurityBadges skillPath={skill.id} />

      {/* Row 5: runtime dots + install button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {skill.runtimes.map((rt) => (
            <span
              key={rt}
              title={RUNTIME_INFO[rt].label}
              style={{ width: 7, height: 7, borderRadius: '50%', background: RUNTIME_INFO[rt].color, display: 'inline-block', flexShrink: 0 }}
            />
          ))}
        </div>

        {isDisabled ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: t.statusSuccess, background: t.statusSuccessBg, borderRadius: 4, padding: '2px 6px' }}>
            <Check size={9} /> In Library
          </span>
        ) : installing ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: '#FE5000', background: '#FE500010', borderRadius: 4, padding: '2px 6px' }}>
            <Loader2 size={9} className="animate-spin" /> Installing
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleDropdown}
            style={{
              fontSize: 13,
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              border: `1px solid ${dropdownOpen ? '#FE5000' : t.border}`,
              color: dropdownOpen ? '#FE5000' : t.textSecondary,
              background: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { if (!dropdownOpen) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; } }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onBlur={(e) => { if (!dropdownOpen) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; } }}
          >
            Install <ChevronDown size={8} />
          </button>
        )}
      </div>

      {/* Install dropdown */}
      {dropdownOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 4px)',
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          borderRadius: 6,
          padding: 10,
          zIndex: 100,
          width: 220,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.textDim, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {(['all', ...skill.runtimes] as (Runtime | 'all')[]).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setSelectedTarget(rt)}
                  style={{
                    fontSize: 13, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', border: 'none',
                    background: selectedTarget === rt ? '#FE5000' : t.surfaceElevated,
                    color: selectedTarget === rt ? '#fff' : t.textSecondary,
                    fontWeight: 500,
                  }}
                >
                  {rt === 'all' ? 'All' : RUNTIME_INFO[rt].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.textDim, fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope</span>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {(['project', 'global'] as InstallScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedScope(s)}
                  style={{
                    fontSize: 13, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', border: 'none',
                    background: selectedScope === s ? '#FE5000' : t.surfaceElevated,
                    color: selectedScope === s ? '#fff' : t.textSecondary,
                    fontWeight: 500, textTransform: 'capitalize',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: t.inputBg, borderRadius: 4, padding: '4px 6px' }}>
            <Terminal size={9} style={{ color: t.textDim, flexShrink: 0 }} />
            <code style={{ fontSize: 12, color: t.textMuted, fontFamily: "'Geist Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {skill.installCmd} --target {selectedTarget} --scope {selectedScope}
            </code>
          </div>

          <button
            type="button"
            onClick={() => onInstall(skill.id, selectedTarget, selectedScope)}
            style={{ width: '100%', padding: '6px', borderRadius: 4, border: 'none', background: '#FE5000', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Confirm Install
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────── Remote Skill Card ──────── */

function RemoteSkillCard({ skill, installing, installed, onInstall, t }: {
  skill: SkillSearchResult;
  installing: boolean;
  installed: boolean;
  onInstall: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  const [expanded, setExpanded] = useState(false);
  const skillPath = skill.url.replace('https://skills.sh/', '');

  return (
    <div
      style={{
        background: t.surfaceElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        position: 'relative',
        transition: 'border-color 150ms ease',
        minHeight: 120,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#FE500050'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = t.border; }}
    >
      {/* Row 1: name + installs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {skill.name}
        </span>
        <span style={{ fontSize: 13, color: t.textDim, background: t.badgeBg, borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Geist Mono', monospace" }}>
          {skill.installs}↓
        </span>
      </div>

      {/* Row 2: repo (dim) + external link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12, color: t.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontFamily: "'Geist Sans', sans-serif" }}>
          {skill.repo}
        </span>
        <Tooltip content="View on skills.sh">
          <a
            href={skill.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.textDim, flexShrink: 0, display: 'inline-flex' }}
            aria-label={`Open ${skill.name} on skills.sh`}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.textDim; }}
            onFocus={(e) => { e.currentTarget.style.color = '#FE5000'; }}
            onBlur={(e) => { e.currentTarget.style.color = t.textDim; }}
          >
            <ExternalLink size={10} />
          </a>
        </Tooltip>
      </div>

      {/* Row 3: description with expand */}
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontSize: 12, color: t.textMuted, fontFamily: "'Geist Sans', sans-serif", lineHeight: 1.4,
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
            overflow: expanded ? 'visible' : 'hidden',
          } as React.CSSProperties}
        >
          {skill.url}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.textDim, display: 'inline-flex', alignItems: 'center', marginTop: 1 }}
        >
          {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
        </button>
      </div>

      {/* Row 4: SecurityBadges */}
      <SecurityBadges skillPath={skillPath} />

      {/* Row 5: zap icon + install button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Zap size={10} style={{ color: t.textDim }} />

        {installed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: t.statusSuccess, background: t.statusSuccessBg, borderRadius: 4, padding: '2px 6px' }}>
            <Check size={9} /> Installed
          </span>
        ) : installing ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: '#FE5000', background: '#FE500010', borderRadius: 4, padding: '2px 6px' }}>
            <Loader2 size={9} className="animate-spin" /> Installing
          </span>
        ) : (
          <button
            type="button"
            onClick={onInstall}
            style={{
              fontSize: 13, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${t.border}`, color: '#FE5000', background: '#FE500010',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}
          >
            <Download size={9} /> Install
          </button>
        )}
      </div>
    </div>
  );
}

/* McpRow and McpConfigForm removed — MCP tab now redirects to ConnectionPicker */

/* ──────── Preset Row (list item) ──────── */

function PresetRow({ preset, t, onLoad }: {
  preset: (typeof REGISTRY_PRESETS)[number];
  t: ReturnType<typeof useTheme>;
  onLoad: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        minHeight: 56,
        borderBottom: `1px solid ${t.borderSubtle}`,
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Icon */}
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: '#FE500010'
      }}>
        <RegistryIcon icon={preset.icon} size={14} style={{ color: '#FE5000' }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.textPrimary }}>{preset.name}</div>
        <div style={{
          fontSize: 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 2,
          color: t.textMuted
        }} title={preset.description} spellCheck={false}>
          {preset.description}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          {preset.skills.slice(0, 3).map((s) => (
            <span key={s} style={{
              fontSize: 12,
              padding: '0 4px',
              borderRadius: 2,
              color: t.cableSkills,
              background: t.cableSkills + '10'
            }}>
              {s}
            </span>
          ))}
          {preset.mcpServers.slice(0, 2).map((m) => (
            <span key={m} style={{
              fontSize: 12,
              padding: '0 4px',
              borderRadius: 2,
              color: t.cableMcp,
              background: t.cableMcp + '10'
            }}>
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Load button */}
      <button
        type="button"
        onClick={onLoad}
        style={{
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 6,
          cursor: 'pointer',
          flexShrink: 0,
          background: 'transparent',
          border: `1px solid ${t.border}`,
          color: t.textSecondary,
          whiteSpace: 'nowrap',
          minWidth: 80,
          transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#FE5000'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.background = 'transparent'; }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#FE5000'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.background = 'transparent'; }}
      >
        Load Preset
      </button>
    </div>
  );
}
