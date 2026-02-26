import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { MARKETPLACE_CATEGORIES, RUNTIME_INFO, REGISTRY_PRESETS, type MarketplaceCategory, type Runtime, type InstallScope, type ConfigField } from '../store/registry';
import { RegistryIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { X, Search, Check, Loader2, ChevronDown, Terminal } from 'lucide-react';

type Tab = 'skills' | 'mcp' | 'presets';

export function Marketplace() {
  const showMarketplace = useConsoleStore((s) => s.showMarketplace);
  const activeTab = useConsoleStore((s) => s.activeMarketplaceTab);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const registrySkills = useConsoleStore((s) => s.registrySkills);
  const registryMcpServers = useConsoleStore((s) => s.registryMcpServers);
  const installRegistrySkill = useConsoleStore((s) => s.installRegistrySkill);
  const installRegistryMcp = useConsoleStore((s) => s.installRegistryMcp);

  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('all');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installDropdown, setInstallDropdown] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTheme();

  useEffect(() => {
    if (showMarketplace) {
      setFilter('');
      setCategory('all');
      setInstallingId(null);
      setInstallDropdown(null);
      setConfiguring(null);
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
  }, [setShowMarketplace]);

  const handleInstall = useCallback((skillId: string, target: Runtime | 'all', scope: InstallScope) => {
    setInstallingId(skillId);
    setInstallDropdown(null);
    // Simulate install delay
    setTimeout(() => {
      installRegistrySkill(skillId, target, scope);
      setInstallingId(null);
    }, 1200);
  }, [installRegistrySkill]);

  const handleMcpInstall = useCallback((mcpId: string) => {
    setInstallingId(mcpId);
    setTimeout(() => {
      installRegistryMcp(mcpId);
      setInstallingId(null);
      setConfiguring(null);
    }, 1000);
  }, [installRegistryMcp]);

  if (!showMarketplace) return null;

  const matchesFilter = (name: string, desc: string) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return name.toLowerCase().includes(f) || desc.toLowerCase().includes(f);
  };

  const filteredSkills = registrySkills.filter((s) =>
    matchesFilter(s.name, s.description) && (category === 'all' || s.category === category)
  );

  const filteredMcp = registryMcpServers.filter((s) =>
    matchesFilter(s.name, s.description) && (category === 'all' || s.category === category)
  );

  const filteredPresets = REGISTRY_PRESETS.filter((p) =>
    matchesFilter(p.name, p.description)
  );

  const tabStyle = (tab: Tab) => ({
    color: activeTab === tab ? '#FE5000' : t.textDim,
    borderBottom: activeTab === tab ? '2px solid #FE5000' : '2px solid transparent',
    background: 'transparent',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowMarketplace(false)}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          width: '90vw',
          maxWidth: 1200,
          height: '80vh',
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-base font-semibold" style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}>
            Marketplace
          </span>

          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search skills, servers, presets..."
              className="w-full outline-none text-sm pl-9 pr-3 py-2 rounded-lg"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                color: t.textPrimary,
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 ml-auto">
            {(['skills', 'mcp', 'presets'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTab(tab)}
                className="px-3 py-1.5 text-xs font-medium tracking-wide uppercase cursor-pointer border-none"
                style={tabStyle(tab)}
              >
                {tab === 'mcp' ? 'MCP Servers' : tab === 'presets' ? 'Presets' : 'Skills'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowMarketplace(false)}
            className="p-1.5 rounded-md cursor-pointer border-none bg-transparent"
            style={{ color: t.textDim }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar (not for presets) */}
          {activeTab !== 'presets' && (
            <div className="flex flex-col gap-1 p-3 overflow-y-auto" style={{ width: 160, borderRight: `1px solid ${t.borderSubtle}` }}>
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className="text-left px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors"
                  style={{
                    background: category === cat.id ? '#FE500018' : 'transparent',
                    color: category === cat.id ? '#FE5000' : t.textSecondary,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Grid content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'skills' && (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {filteredSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    installing={installingId === skill.id}
                    dropdownOpen={installDropdown === skill.id}
                    onToggleDropdown={() => setInstallDropdown(installDropdown === skill.id ? null : skill.id)}
                    onInstall={handleInstall}
                    t={t}
                  />
                ))}
                {filteredSkills.length === 0 && (
                  <div className="col-span-3 flex items-center justify-center py-12">
                    <span className="text-sm" style={{ color: t.textFaint }}>No skills match your search</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {filteredMcp.map((mcp) => (
                  <McpCard
                    key={mcp.id}
                    mcp={mcp}
                    installing={installingId === mcp.id}
                    configuringOpen={configuring === mcp.id}
                    onToggleConfigure={() => setConfiguring(configuring === mcp.id ? null : mcp.id)}
                    onInstall={handleMcpInstall}
                    t={t}
                  />
                ))}
                {filteredMcp.length === 0 && (
                  <div className="col-span-3 flex items-center justify-center py-12">
                    <span className="text-sm" style={{ color: t.textFaint }}>No MCP servers match your search</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'presets' && (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {filteredPresets.map((preset) => (
                  <PresetCard key={preset.id} preset={preset} t={t} onLoad={() => setShowMarketplace(false)} />
                ))}
                {filteredPresets.length === 0 && (
                  <div className="col-span-3 flex items-center justify-center py-12">
                    <span className="text-sm" style={{ color: t.textFaint }}>No presets match your search</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────── Skill Card ──────── */

function SkillCard({ skill, installing, dropdownOpen, onToggleDropdown, onInstall, t }: {
  skill: (typeof import('../store/registry'))['REGISTRY_SKILLS'][number];
  installing: boolean;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onInstall: (id: string, target: Runtime | 'all', scope: InstallScope) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<Runtime | 'all'>('claude');
  const [selectedScope, setSelectedScope] = useState<InstallScope>('project');

  const formatInstalls = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  return (
    <div
      className="flex flex-col rounded-xl p-4 relative"
      style={{
        background: t.surface,
        border: `1px solid ${t.borderSubtle}`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        minHeight: 180,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.surfaceElevated }}>
          <RegistryIcon icon={skill.icon} size={18} style={{ color: t.textSecondary }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: t.textPrimary }}>{skill.name}</div>
          <div className="text-[11px]" style={{ color: t.textDim }}>{skill.author}</div>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ color: t.textDim, background: t.badgeBg }}>
          {formatInstalls(skill.installs)}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed flex-1 mb-3" style={{ color: t.textSecondary, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {skill.description}
      </p>

      {/* Runtime badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        {skill.runtimes.map((rt) => (
          <span key={rt} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: RUNTIME_INFO[rt].color, background: `${RUNTIME_INFO[rt].color}15`, border: `1px solid ${RUNTIME_INFO[rt].color}30` }}>
            {RUNTIME_INFO[rt].label}
          </span>
        ))}
      </div>

      {/* Install button / installed badge */}
      {skill.installed ? (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ color: '#10B981', background: '#10B98115' }}>
            <Check size={12} /> Installed
          </span>
          {skill.installedTarget && (
            <span className="text-[10px]" style={{ color: t.textFaint }}>
              {skill.installedTarget === 'all' ? 'All runtimes' : RUNTIME_INFO[skill.installedTarget]?.label} / {skill.installedScope}
            </span>
          )}
        </div>
      ) : installing ? (
        <button type="button" disabled className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-medium border-none" style={{ background: '#FE5000', color: '#fff', opacity: 0.8 }}>
          <Loader2 size={12} className="animate-spin" /> Installing...
        </button>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={onToggleDropdown}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none"
            style={{ background: '#FE5000', color: '#fff', transition: 'opacity 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Install <ChevronDown size={10} />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              className="absolute left-0 right-0 mt-1 rounded-lg p-3 z-10 flex flex-col gap-2"
              style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
            >
              {/* Target */}
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: t.textDim }}>Target</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(['all', ...skill.runtimes] as (Runtime | 'all')[]).map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => setSelectedTarget(rt)}
                      className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer border-none font-medium"
                      style={{
                        background: selectedTarget === rt ? '#FE5000' : t.surfaceElevated,
                        color: selectedTarget === rt ? '#fff' : t.textSecondary,
                      }}
                    >
                      {rt === 'all' ? 'All' : RUNTIME_INFO[rt].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: t.textDim }}>Scope</span>
                <div className="flex gap-1 mt-1">
                  {(['project', 'global'] as InstallScope[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedScope(s)}
                      className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer border-none font-medium capitalize"
                      style={{
                        background: selectedScope === s ? '#FE5000' : t.surfaceElevated,
                        color: selectedScope === s ? '#fff' : t.textSecondary,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Command preview */}
              <div className="flex items-center gap-1.5 mt-1 px-2 py-1.5 rounded-md" style={{ background: t.inputBg }}>
                <Terminal size={10} style={{ color: t.textDim }} />
                <code className="text-[9px]" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  {skill.installCmd} --target {selectedTarget} --scope {selectedScope}
                </code>
              </div>

              <button
                type="button"
                onClick={() => onInstall(skill.id, selectedTarget, selectedScope)}
                className="w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none mt-1"
                style={{ background: '#FE5000', color: '#fff' }}
              >
                Confirm Install
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────── MCP Server Card ──────── */

function McpCard({ mcp, installing, configuringOpen, onToggleConfigure, onInstall, t }: {
  mcp: (typeof import('../store/registry'))['REGISTRY_MCP_SERVERS'][number];
  installing: boolean;
  configuringOpen: boolean;
  onToggleConfigure: () => void;
  onInstall: (id: string) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <div
      className="flex flex-col rounded-xl p-4 relative"
      style={{
        background: t.surface,
        border: `1px solid ${t.borderSubtle}`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        minHeight: 180,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.surfaceElevated }}>
          <RegistryIcon icon={mcp.icon} size={18} style={{ color: t.textSecondary }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: t.textPrimary }}>{mcp.name}</div>
          <div className="text-[11px]" style={{ color: t.textDim }}>{mcp.author}</div>
        </div>
        {/* Transport badge */}
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase shrink-0" style={{ color: mcp.transport === 'stdio' ? '#3B82F6' : '#F59E0B', background: mcp.transport === 'stdio' ? '#3B82F615' : '#F59E0B15', border: `1px solid ${mcp.transport === 'stdio' ? '#3B82F630' : '#F59E0B30'}` }}>
          {mcp.transport}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed flex-1 mb-3" style={{ color: t.textSecondary, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {mcp.description}
      </p>

      {/* Runtime badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        {mcp.runtimes.map((rt) => (
          <span key={rt} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: RUNTIME_INFO[rt].color, background: `${RUNTIME_INFO[rt].color}15`, border: `1px solid ${RUNTIME_INFO[rt].color}30` }}>
            {RUNTIME_INFO[rt].label}
          </span>
        ))}
      </div>

      {/* Action */}
      {mcp.installed ? (
        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ color: '#10B981', background: '#10B98115' }}>
          <Check size={12} /> Configured
        </span>
      ) : installing ? (
        <button type="button" disabled className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-medium border-none" style={{ background: '#FE5000', color: '#fff', opacity: 0.8 }}>
          <Loader2 size={12} className="animate-spin" /> Configuring...
        </button>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={onToggleConfigure}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none"
            style={{ background: '#FE5000', color: '#fff', transition: 'opacity 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Configure
          </button>

          {/* Inline config form */}
          {configuringOpen && (
            <McpConfigForm mcp={mcp} onInstall={onInstall} t={t} />
          )}
        </div>
      )}
    </div>
  );
}

/* ──────── MCP Config Form ──────── */

function McpConfigForm({ mcp, onInstall, t }: {
  mcp: { id: string; configFields: ConfigField[]; installCmd: string };
  onInstall: (id: string) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <div
      className="absolute left-0 right-0 mt-1 rounded-lg p-3 z-10 flex flex-col gap-2"
      style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      {mcp.configFields.length > 0 ? (
        mcp.configFields.map((field) => (
          <div key={field.key}>
            <label className="text-[10px] font-medium" style={{ color: t.textDim }}>{field.label}</label>
            <input
              type={field.type === 'password' ? 'password' : 'text'}
              placeholder={field.placeholder}
              className="w-full text-xs px-2 py-1.5 rounded-md outline-none mt-0.5"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary }}
            />
          </div>
        ))
      ) : (
        <span className="text-[11px]" style={{ color: t.textMuted }}>No configuration needed</span>
      )}

      {/* Command preview */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: t.inputBg }}>
        <Terminal size={10} style={{ color: t.textDim }} />
        <code className="text-[9px]" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
          {mcp.installCmd}
        </code>
      </div>

      <button
        type="button"
        onClick={() => onInstall(mcp.id)}
        className="w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none"
        style={{ background: '#FE5000', color: '#fff' }}
      >
        Save & Install
      </button>
    </div>
  );
}

/* ──────── Preset Card ──────── */

function PresetCard({ preset, t, onLoad }: {
  preset: (typeof REGISTRY_PRESETS)[number];
  t: ReturnType<typeof useTheme>;
  onLoad: () => void;
}) {
  return (
    <div
      className="flex flex-col rounded-xl p-4"
      style={{
        background: t.surface,
        border: `1px solid ${t.borderSubtle}`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        minHeight: 200,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FE500015', border: '1px solid #FE500030' }}>
          <RegistryIcon icon={preset.icon} size={20} style={{ color: '#FE5000' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: t.textPrimary }}>{preset.name}</div>
          <div className="text-xs mt-0.5" style={{ color: t.textSecondary }}>{preset.description}</div>
        </div>
      </div>

      {/* Mini canvas description */}
      <div className="flex-1 rounded-lg p-2.5 mb-3" style={{ background: t.inputBg, border: `1px solid ${t.borderSubtle}` }}>
        <code className="text-[10px] leading-relaxed" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace", whiteSpace: 'pre-wrap' }}>
          {preset.canvasDescription}
        </code>
      </div>

      {/* Included items */}
      <div className="flex flex-wrap gap-1 mb-3">
        {preset.skills.slice(0, 3).map((s) => (
          <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: '#f1c40f', background: '#f1c40f15' }}>{s}</span>
        ))}
        {preset.mcpServers.slice(0, 2).map((m) => (
          <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: '#2ecc71', background: '#2ecc7115' }}>{m}</span>
        ))}
      </div>

      <button
        type="button"
        onClick={onLoad}
        className="w-full py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none"
        style={{ background: '#FE5000', color: '#fff', transition: 'opacity 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        Load Preset
      </button>
    </div>
  );
}
