import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
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
    setTimeout(() => {
      installRegistrySkill(skillId, target, scope);
      setInstallingId(null);
    }, 1200);
  }, [installRegistrySkill]);

  const handleMcpInstall = useCallback(async (mcpId: string, envVars: Record<string, string>) => {
    setInstallingId(mcpId);
    const mcpEntry = registryMcpServers.find((m) => m.id === mcpId);
    if (!mcpEntry) { setInstallingId(null); return; }

    // Add server via real MCP store
    const added = await useMcpStore.getState().addServer({
      name: mcpEntry.name,
      command: mcpEntry.command,
      args: mcpEntry.defaultArgs,
      env: envVars,
    });

    // If backend succeeded, auto-connect
    if (added) {
      await useMcpStore.getState().connectServer(added.id);
    }

    // Mark as installed in registry display
    installRegistryMcp(mcpId);
    setInstallingId(null);
    setConfiguring(null);
  }, [installRegistryMcp, registryMcpServers]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowMarketplace(false)}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(4px)', zIndex: 9999 }} />

      <div
        className="relative flex flex-col rounded-md overflow-hidden"
        style={{
          isolation: 'isolate',
          zIndex: 60,
          width: '90vw',
          maxWidth: 1000,
          height: '80vh',
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-sm font-semibold" style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}>
            Marketplace
          </span>

          {/* Search */}
          <div className="flex-1 relative max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search..."
              className="w-full outline-none text-xs pl-8 pr-3 py-1.5 rounded-md"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                color: t.textPrimary,
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>

          {/* Tabs — underline style */}
          <div className="flex items-center gap-2 ml-auto" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            {(['skills', 'mcp', 'presets'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTab(tab)}
                className="px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase cursor-pointer border-none"
                style={{
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

          <button
            type="button"
            onClick={() => setShowMarketplace(false)}
            className="p-1 rounded-md cursor-pointer border-none bg-transparent"
            style={{ color: t.textDim }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar (not for presets) — simple text list */}
          {activeTab !== 'presets' && (
            <div className="flex flex-col gap-0 py-2 overflow-y-auto" style={{ width: 150, borderRight: `1px solid ${t.borderSubtle}` }}>
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className="text-left px-3 py-1.5 text-[11px] font-medium cursor-pointer border-none"
                  style={{
                    background: 'transparent',
                    color: category === cat.id ? '#FE5000' : t.textSecondary,
                    borderLeft: category === cat.id ? '2px solid #FE5000' : '2px solid transparent',
                    transition: 'color 150ms ease, border-color 150ms ease',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* List content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'skills' && (
              <div className="flex flex-col">
                {filteredSkills.map((skill) => (
                  <SkillRow
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
                  <div className="flex items-center justify-center py-12">
                    <span className="text-xs" style={{ color: t.textFaint }}>No skills match your search</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="flex flex-col">
                {filteredMcp.map((mcp) => (
                  <McpRow
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
                  <div className="flex items-center justify-center py-12">
                    <span className="text-xs" style={{ color: t.textFaint }}>No MCP servers match your search</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'presets' && (
              <div className="flex flex-col">
                {filteredPresets.map((preset) => (
                  <PresetRow key={preset.id} preset={preset} t={t} onLoad={() => setShowMarketplace(false)} />
                ))}
                {filteredPresets.length === 0 && (
                  <div className="flex items-center justify-center py-12">
                    <span className="text-xs" style={{ color: t.textFaint }}>No presets match your search</span>
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

/* ──────── Skill Row (list item, 48px) ──────── */

function SkillRow({ skill, installing, dropdownOpen, onToggleDropdown, onInstall, t }: {
  skill: (typeof import('../store/registry'))['REGISTRY_SKILLS'][number];
  installing: boolean;
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onInstall: (id: string, target: Runtime | 'all', scope: InstallScope) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<Runtime | 'all'>('claude');
  const [selectedScope, setSelectedScope] = useState<InstallScope>('project');

  return (
    <div
      className="relative"
      style={{ borderBottom: `1px solid ${t.borderSubtle}` }}
    >
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: 48, transition: 'background 100ms ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Icon */}
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: t.surfaceElevated }}>
          <RegistryIcon icon={skill.icon} size={13} style={{ color: t.textSecondary }} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate" style={{ color: t.textPrimary }} spellCheck={false}>{skill.name}</span>
            <span className="text-[10px] truncate" style={{ color: t.textDim }}>{skill.author}</span>
          </div>
          {/* Runtime bars */}
          <div className="flex gap-0.5 mt-0.5">
            {skill.runtimes.map((rt) => (
              <div key={rt} className="rounded-sm" style={{ width: 16, height: 3, background: RUNTIME_INFO[rt].color }} title={RUNTIME_INFO[rt].label} />
            ))}
          </div>
        </div>

        {/* Description */}
        <span className="text-[11px] truncate shrink-0" style={{ color: t.textMuted, maxWidth: 200 }} title={skill.description} spellCheck={false}>
          {skill.description}
        </span>

        {/* Install button */}
        {skill.installed ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md shrink-0" style={{ color: '#10B981', background: '#10B98110' }}>
            <Check size={10} /> Installed
          </span>
        ) : installing ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md shrink-0" style={{ color: '#FE5000', background: '#FE500010' }}>
            <Loader2 size={10} className="animate-spin" /> Installing
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleDropdown}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer shrink-0"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textSecondary,
              transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { if (!dropdownOpen) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; } }}
          >
            Install <ChevronDown size={9} />
          </button>
        )}
      </div>

      {/* Install dropdown */}
      {dropdownOpen && (
        <div
          className="absolute right-4 mt-0 rounded-md p-3 z-10 flex flex-col gap-2"
          style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', width: 260, top: 48 }}
        >
          <div>
            <span className="text-[10px] font-semibold tracking-wider" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>Target</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(['all', ...skill.runtimes] as (Runtime | 'all')[]).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setSelectedTarget(rt)}
                  className="text-[10px] px-2 py-0.5 rounded-md cursor-pointer border-none font-medium"
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

          <div>
            <span className="text-[10px] font-semibold tracking-wider" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>Scope</span>
            <div className="flex gap-1 mt-1">
              {(['project', 'global'] as InstallScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedScope(s)}
                  className="text-[10px] px-2 py-0.5 rounded-md cursor-pointer border-none font-medium capitalize"
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

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: t.inputBg }}>
            <Terminal size={9} style={{ color: t.textDim }} />
            <code className="text-[9px]" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
              {skill.installCmd} --target {selectedTarget} --scope {selectedScope}
            </code>
          </div>

          <button
            type="button"
            onClick={() => onInstall(skill.id, selectedTarget, selectedScope)}
            className="w-full py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none"
            style={{ background: '#FE5000', color: '#fff' }}
          >
            Confirm Install
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────── MCP Row (list item, 48px) ──────── */

function McpRow({ mcp, installing, configuringOpen, onToggleConfigure, onInstall, t }: {
  mcp: (typeof import('../store/registry'))['REGISTRY_MCP_SERVERS'][number];
  installing: boolean;
  configuringOpen: boolean;
  onToggleConfigure: () => void;
  onInstall: (id: string, envVars: Record<string, string>) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const mcpServers = useMcpStore((s) => s.servers);
  const isInstalled = mcp.installed || mcpServers.some((s) => s.name === mcp.name);
  return (
    <div
      className="relative"
      style={{ borderBottom: `1px solid ${t.borderSubtle}` }}
    >
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: 48, transition: 'background 100ms ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Icon */}
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: t.surfaceElevated }}>
          <RegistryIcon icon={mcp.icon} size={13} style={{ color: t.textSecondary }} />
        </div>

        {/* Name + transport */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate" style={{ color: t.textPrimary }} spellCheck={false}>{mcp.name}</span>
            <span className="text-[10px] truncate" style={{ color: t.textDim }}>{mcp.author}</span>
          </div>
          <div className="flex gap-0.5 mt-0.5">
            {mcp.runtimes.map((rt) => (
              <div key={rt} className="rounded-sm" style={{ width: 16, height: 3, background: RUNTIME_INFO[rt].color }} title={RUNTIME_INFO[rt].label} />
            ))}
            <span className="text-[8px] ml-1 uppercase" style={{ color: mcp.transport === 'stdio' ? '#3B82F6' : '#F59E0B', fontFamily: "'Space Mono', monospace" }}>
              {mcp.transport}
            </span>
          </div>
        </div>

        {/* Description */}
        <span className="text-[11px] truncate shrink-0" style={{ color: t.textMuted, maxWidth: 200 }} title={mcp.description} spellCheck={false}>
          {mcp.description}
        </span>

        {/* Action */}
        {isInstalled ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md shrink-0" style={{ color: '#10B981', background: '#10B98110' }}>
            <Check size={10} /> Installed
          </span>
        ) : installing ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md shrink-0" style={{ color: '#FE5000', background: '#FE500010' }}>
            <Loader2 size={10} className="animate-spin" /> Configuring
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleConfigure}
            className="text-[10px] px-2 py-1 rounded-md cursor-pointer shrink-0"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textSecondary,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { if (!configuringOpen) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; } }}
          >
            Configure
          </button>
        )}
      </div>

      {/* Config form dropdown */}
      {configuringOpen && (
        <McpConfigForm mcp={mcp} onInstall={onInstall} t={t} />
      )}
    </div>
  );
}

/* ──────── MCP Config Form ──────── */

function McpConfigForm({ mcp, onInstall, t }: {
  mcp: { id: string; configFields: ConfigField[]; installCmd: string };
  onInstall: (id: string, envVars: Record<string, string>) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const [envValues, setEnvValues] = useState<Record<string, string>>({});

  return (
    <div
      className="absolute right-4 mt-0 rounded-md p-3 z-10 flex flex-col gap-2"
      style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', width: 260, top: 48 }}
    >
      {mcp.configFields.length > 0 ? (
        mcp.configFields.map((field) => (
          <div key={field.key}>
            <label className="text-[10px] font-medium" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>{field.label}</label>
            <input
              type={field.type === 'password' ? 'password' : 'text'}
              placeholder={field.placeholder}
              value={envValues[field.key] || ''}
              onChange={(e) => setEnvValues({ ...envValues, [field.key]: e.target.value })}
              className="w-full text-[11px] px-2 py-1 rounded-md outline-none mt-0.5"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary }}
            />
          </div>
        ))
      ) : (
        <span className="text-[11px]" style={{ color: t.textMuted }}>No configuration needed</span>
      )}

      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: t.inputBg }}>
        <Terminal size={9} style={{ color: t.textDim }} />
        <code className="text-[9px]" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
          {mcp.installCmd}
        </code>
      </div>

      <button
        type="button"
        onClick={() => onInstall(mcp.id, envValues)}
        className="w-full py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none"
        style={{ background: '#FE5000', color: '#fff' }}
      >
        Save & Install
      </button>
    </div>
  );
}

/* ──────── Preset Row (list item) ──────── */

function PresetRow({ preset, t, onLoad }: {
  preset: (typeof REGISTRY_PRESETS)[number];
  t: ReturnType<typeof useTheme>;
  onLoad: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{
        minHeight: 56,
        borderBottom: `1px solid ${t.borderSubtle}`,
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: '#FE500010' }}>
        <RegistryIcon icon={preset.icon} size={14} style={{ color: '#FE5000' }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: t.textPrimary }}>{preset.name}</div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: t.textMuted }} title={preset.description} spellCheck={false}>{preset.description}</div>
        <div className="flex gap-1 mt-0.5">
          {preset.skills.slice(0, 3).map((s) => (
            <span key={s} className="text-[8px] px-1 rounded-sm" style={{ color: '#f1c40f', background: '#f1c40f10' }}>{s}</span>
          ))}
          {preset.mcpServers.slice(0, 2).map((m) => (
            <span key={m} className="text-[8px] px-1 rounded-sm" style={{ color: '#2ecc71', background: '#2ecc7110' }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Load button */}
      <button
        type="button"
        onClick={onLoad}
        className="text-[10px] px-2 py-1 rounded-md cursor-pointer shrink-0"
        style={{
          background: 'transparent',
          border: `1px solid ${t.border}`,
          color: t.textSecondary,
          whiteSpace: 'nowrap',
          minWidth: 80,
          transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#FE5000'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.background = 'transparent'; }}
      >
        Load Preset
      </button>
    </div>
  );
}
