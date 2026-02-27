import { memo, useState, useEffect, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { useSkillsStore } from '../store/skillsStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { SkillIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { Zap, Check, X, Loader2, Download, ChevronDown, ChevronRight, LayoutGrid, List, Library, Search } from 'lucide-react';

export const SkillsNode = memo(function SkillsNode() {
  const consoleSkills = useConsoleStore((s) => s.skills);
  const registrySkills = useConsoleStore((s) => s.registrySkills);
  const realSkills = useSkillsStore((s) => s.skills);
  const realLoaded = useSkillsStore((s) => s.loaded);
  const suggestedSkills = useConsoleStore((s) => s.suggestedSkills);
  const acceptSuggestedSkill = useConsoleStore((s) => s.acceptSuggestedSkill);
  const dismissSuggestedSkill = useConsoleStore((s) => s.dismissSuggestedSkill);
  const t = useTheme();

  // Load real skills on mount
  useEffect(() => {
    if (!realLoaded) useSkillsStore.getState().loadSkills();
  }, [realLoaded]);

  // Active skills = only those explicitly activated for this session
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('active-skill-ids');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    try { localStorage.setItem('active-skill-ids', JSON.stringify([...activeSkillIds])); } catch {}
  }, [activeSkillIds]);

  // Build full library (all installed skills)
  const library = [
    ...realSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      source: 'claude' as const,
    })),
    ...registrySkills.filter((s) => s.installed).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      source: 'registry' as const,
    })),
  ];

  const activeSkills = library.filter((s) => activeSkillIds.has(s.id));

  const addSkill = useCallback((id: string) => {
    setActiveSkillIds((prev) => new Set([...prev, id]));
  }, []);

  const removeSkill = useCallback((id: string) => {
    setActiveSkillIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  // Library picker state
  const [showLibrary, setShowLibrary] = useState(false);
  const [libFilter, setLibFilter] = useState('');

  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('skills-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('skills-node-view') as 'card' | 'list') || 'card'; } catch { return 'card'; }
  });

  useEffect(() => { try { localStorage.setItem('skills-node-collapsed', String(nodeCollapsed)); } catch {} }, [nodeCollapsed]);
  useEffect(() => { try { localStorage.setItem('skills-node-view', viewMode); } catch {} }, [viewMode]);

  const filteredLibrary = library.filter((s) => {
    if (!libFilter) return true;
    const f = libFilter.toLowerCase();
    return s.name.toLowerCase().includes(f) || s.description.toLowerCase().includes(f);
  });

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 280, position: 'relative' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.borderSubtle}` }}>
        <button type="button" onClick={() => setNodeCollapsed(!nodeCollapsed)} className="p-0 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}>
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Zap size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 12 }}>
          Skills
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {activeSkills.length}
        </span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setViewMode('card')} className="p-0.5 border-none cursor-pointer nodrag rounded" style={{ background: viewMode === 'card' ? t.badgeBg : 'transparent', color: viewMode === 'card' ? t.textSecondary : t.textFaint }}>
              <LayoutGrid size={12} />
            </button>
            <button type="button" onClick={() => setViewMode('list')} className="p-0.5 border-none cursor-pointer nodrag rounded" style={{ background: viewMode === 'list' ? t.badgeBg : 'transparent', color: viewMode === 'list' ? t.textSecondary : t.textFaint }}>
              <List size={12} />
            </button>
          </div>
        )}
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#f1c40f" id="skills-out" />
      </div>

      {nodeCollapsed ? null : <>
      {/* Active skills */}
      <div className="p-3 overflow-y-auto nowheel" style={{ maxHeight: 280 }}>
        {viewMode === 'card' ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
            {activeSkills.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No skills active</span>
              </div>
            ) : activeSkills.map((skill) => (
              <Tile
                key={skill.id}
                name={skill.name}
                active={true}
                icon={<SkillIcon size={14} />}
                subtitle={skill.description?.slice(0, 40) || ''}
                onClick={() => removeSkill(skill.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {activeSkills.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No skills active</span>
              </div>
            ) : activeSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => removeSkill(skill.id)}
                className="flex items-center gap-2 px-2 rounded-md border-none cursor-pointer nodrag"
                style={{ height: 28, background: 'transparent', transition: 'background 100ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00ff88', boxShadow: '0 0 4px #00ff8866' }} />
                <span className="flex-1 truncate text-[11px]" style={{ color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}>{skill.name}</span>
                <X size={10} style={{ color: t.textDim }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested skills */}
      {suggestedSkills.length > 0 && (
        <div className="px-3 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[11px] tracking-wider font-semibold" style={{ color: '#f1c40f', fontFamily: "'Space Mono', monospace" }}>Suggest</span>
            <JackPort type="target" position={Position.Right} label="SUGGEST" color="#f1c40f" id="skills-feedback-in" />
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-1">
            {suggestedSkills.map((skill) => (
              <div key={skill.id} className="ghost-tile flex items-center gap-2 px-2 py-1.5 rounded-md nodrag" style={{ border: `1px dashed #f1c40f40`, background: t.isDark ? 'rgba(241,196,15,0.04)' : 'rgba(241,196,15,0.06)' }}>
                <span className="flex-1 truncate text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: t.textSecondary }}>{skill.name}</span>
                {skill.installed ? (
                  <span style={{ color: '#00ff88' }}><Check size={12} /></span>
                ) : skill.installing ? (
                  <span style={{ color: '#f1c40f', animation: 'pulse-glow 1s ease-in-out infinite' }}><Loader2 size={12} /></span>
                ) : (
                  <>
                    <button type="button" onClick={() => acceptSuggestedSkill(skill.id)} className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag" style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: 'rgba(241,196,15,0.15)', color: '#f1c40f' }}>
                      <Download size={8} /> Install
                    </button>
                    <button type="button" onClick={() => dismissSuggestedSkill(skill.id)} className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag" style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: 'rgba(255,80,80,0.12)', color: '#ff5050' }}>
                      <X size={8} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestedSkills.length === 0 && (
        <div className="px-3 py-1 flex justify-end">
          <JackPort type="target" position={Position.Right} label="SUGGEST" color="#f1c40f" id="skills-feedback-in" />
        </div>
      )}

      {/* Library button */}
      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => { setShowLibrary(true); setLibFilter(''); }}
          className="w-full py-1.5 rounded-md text-[11px] tracking-wide uppercase cursor-pointer nodrag flex items-center justify-center gap-1.5"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          <Library size={12} /> Library
        </button>
      </div>
      </>}

      {/* Library Picker Overlay */}
      {showLibrary && (
        <div
          className="absolute inset-0 rounded-xl flex flex-col overflow-hidden nodrag nowheel"
          style={{ background: t.surfaceOpaque, zIndex: 10, border: `1px solid ${t.border}` }}
        >
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            <Library size={14} style={{ color: '#FE5000' }} />
            <span className="text-xs font-medium tracking-wide uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}>
              Skill Library
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
              {library.length}
            </span>
            <div className="flex-1" />
            <button type="button" onClick={() => setShowLibrary(false)} className="p-0.5 border-none bg-transparent cursor-pointer rounded nodrag" style={{ color: t.textDim }}>
              <X size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pt-2 pb-1">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
              <input
                type="text"
                value={libFilter}
                onChange={(e) => setLibFilter(e.target.value)}
                placeholder="Filter skills..."
                autoFocus
                className="w-full outline-none text-[11px] pl-7 pr-2 py-1.5 rounded-md nodrag nowheel"
                style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}
              />
            </div>
          </div>

          {/* Skill list */}
          <div className="flex-1 overflow-y-auto p-2 nowheel" style={{ maxHeight: 320 }}>
            {filteredLibrary.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <span className="text-[11px]" style={{ color: t.textFaint }}>{library.length === 0 ? 'No skills installed' : 'No matches'}</span>
              </div>
            ) : filteredLibrary.map((skill) => {
              const isActive = activeSkillIds.has(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => isActive ? removeSkill(skill.id) : addSkill(skill.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md border-none cursor-pointer nodrag w-full"
                  style={{ background: isActive ? (t.isDark ? 'rgba(0,255,136,0.08)' : 'rgba(0,200,100,0.08)') : 'transparent', transition: 'background 100ms ease', textAlign: 'left' }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = t.surfaceHover; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {isActive ? (
                    <Check size={12} style={{ color: '#00ff88', flexShrink: 0 }} />
                  ) : (
                    <span className="w-3 h-3 rounded border flex-shrink-0" style={{ borderColor: t.border }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] truncate" style={{ color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}>{skill.name}</div>
                    {skill.description && (
                      <div className="text-[9px] truncate" style={{ color: t.textDim }}>{skill.description.slice(0, 60)}</div>
                    )}
                  </div>
                  <span className="text-[8px] uppercase px-1 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted, background: t.badgeBg }}>
                    {skill.source}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
