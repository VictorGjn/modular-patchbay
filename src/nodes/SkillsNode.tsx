import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

import { useConsoleStore } from '../store/consoleStore';
import { useSkillsStore } from '../store/skillsStore';
import { Tile } from '../components/Tile';
import { Tooltip } from '../components/ds/Tooltip';
import { SkillIcon } from '../components/icons/SectionIcons';
import { LibraryPicker, type LibraryItem } from '../components/LibraryPicker';
import { useTheme } from '../theme';
import { Zap, Check, X, Loader2, Download, ChevronDown, ChevronRight, LayoutGrid, List, Library } from 'lucide-react';
import { useAutoListMode } from '../hooks/useAutoListMode';

const HANDLE: React.CSSProperties = { width: 8, height: 8, border: 'none', borderRadius: '50%' };

export const SkillsNode = memo(function SkillsNode() {
  const registrySkills = useConsoleStore((s) => s.registrySkills);
  const realSkills = useSkillsStore((s) => s.skills);
  const realLoaded = useSkillsStore((s) => s.loaded);
  const suggestedSkills = useConsoleStore((s) => s.suggestedSkills);
  const acceptSuggestedSkill = useConsoleStore((s) => s.acceptSuggestedSkill);
  const dismissSuggestedSkill = useConsoleStore((s) => s.dismissSuggestedSkill);
  const t = useTheme();

  useEffect(() => { if (!realLoaded) useSkillsStore.getState().loadSkills(); }, [realLoaded]);

  // Active skill IDs — persisted
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('active-skill-ids'); return s ? new Set(JSON.parse(s)) : new Set<string>(); } catch { return new Set<string>(); }
  });
  useEffect(() => { try { localStorage.setItem('active-skill-ids', JSON.stringify([...activeSkillIds])); } catch {} }, [activeSkillIds]);

  // Full library
  const library: LibraryItem[] = [
    ...realSkills.map((s) => ({ id: s.id, name: s.name, description: s.description || '', source: 'claude' })),
    ...registrySkills.filter((s) => s.installed).map((s) => ({ id: s.id, name: s.name, description: s.description, source: 'registry' })),
  ];
  const activeSkills = library.filter((s) => activeSkillIds.has(s.id));

  const toggleSkill = useCallback((id: string) => {
    setActiveSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // UI state
  const [showLibrary, setShowLibrary] = useState(false);
  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('skills-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('skills-node-view') as 'card' | 'list') || 'list'; } catch { return 'list'; }
  });
  const { containerRef: cardContainerRef, autoListMode } = useAutoListMode(240);
  const effectiveView = autoListMode ? 'list' : viewMode;

  useEffect(() => { try { localStorage.setItem('skills-node-collapsed', String(nodeCollapsed)); } catch {} }, [nodeCollapsed]);
  useEffect(() => { try { localStorage.setItem('skills-node-view', viewMode); } catch {} }, [viewMode]);

  return (
    <>
    <div
      className="rounded-lg overflow-visible"
      style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`, width: '100%' }}
    >
    <Handle type="target" position={Position.Left} id="skills-feedback-in" style={{ ...HANDLE, background: '#95a5a6', top: '50%', left: -4 }} />
    <Handle type="source" position={Position.Right} id="skills-out" style={{ ...HANDLE, background: '#f1c40f', top: '50%', right: -4 }} />
    <div className="flex flex-col flex-1 min-w-0 overflow-visible rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 shrink-0" style={{ height: 40, background: t.surfaceElevated, borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.border}` }}>
        <button type="button" onClick={() => setNodeCollapsed(!nodeCollapsed)} aria-label={nodeCollapsed ? 'Expand skills panel' : 'Collapse skills panel'} className="p-0 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}>
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Zap size={14} style={{ color: '#f1c40f' }} />
        <Tooltip content="Equip your agent with reusable skill modules for specialized capabilities">
          <span className="font-bold uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 10, letterSpacing: '0.15em' }}>Skills</span>
        </Tooltip>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>{activeSkills.length}</span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setViewMode('card')} aria-label="Card view" className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center" style={{ background: viewMode === 'card' ? '#FE500020' : 'transparent', color: viewMode === 'card' ? '#FE5000' : t.textFaint }}><LayoutGrid size={14} /></button>
            <button type="button" onClick={() => setViewMode('list')} aria-label="List view" className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center" style={{ background: viewMode === 'list' ? '#FE500020' : 'transparent', color: viewMode === 'list' ? '#FE5000' : t.textFaint }}><List size={14} /></button>
          </div>
        )}
      </div>

      {nodeCollapsed ? null : <>
      {/* Active skills */}
      <div ref={cardContainerRef} className="flex-1 p-3 overflow-y-auto nowheel">
        {effectiveView === 'card' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {activeSkills.length === 0 ? (
              <div className="flex items-center justify-center py-3 w-full">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No skills active</span>
              </div>
            ) : activeSkills.map((skill) => (
              <Tile key={skill.id} name={skill.name} active={true} icon={<SkillIcon icon="zap" size={14} />} subtitle={skill.description?.slice(0, 40) || ''} onClick={() => toggleSkill(skill.id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {activeSkills.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No skills active</span>
              </div>
            ) : activeSkills.map((skill) => (
              <button key={skill.id} type="button" onClick={() => toggleSkill(skill.id)} aria-label={`Remove ${skill.name}`} className="flex items-center gap-2 px-2 rounded-md border-none cursor-pointer nodrag nowheel" style={{ height: 28, background: 'transparent', transition: 'background 100ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.statusSuccess, boxShadow: t.statusSuccessGlow }} />
                <span className="flex-1 truncate text-[11px]" style={{ color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}>{skill.name}</span>
                <X size={10} style={{ color: t.textDim }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested skills */}
      {suggestedSkills.length > 0 && (
        <div className="px-5 pt-1 pb-2 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[11px] tracking-wider font-semibold" style={{ color: t.cableSkills, fontFamily: "'Space Mono', monospace" }}>Suggest</span>
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-1">
            {suggestedSkills.map((skill) => (
              <div key={skill.id} className="ghost-tile flex items-center gap-2 px-2 py-1.5 rounded-md nodrag" style={{ border: `1px dashed ${t.cableSkills}40`, background: t.cableSkills + '0a' }}>
                <span className="flex-1 truncate text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: t.textSecondary }}>{skill.name}</span>
                {skill.installed ? (
                  <span style={{ color: t.statusSuccess }}><Check size={12} /></span>
                ) : skill.installing ? (
                  <span style={{ color: t.cableSkills, animation: 'pulse-glow 1s ease-in-out infinite' }}><Loader2 size={12} /></span>
                ) : (
                  <>
                    <button type="button" onClick={() => acceptSuggestedSkill(skill.id)} aria-label={`Install ${skill.name}`} className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag nowheel" style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: t.cableSkills + '26', color: t.cableSkills }}><Download size={8} /> Install</button>
                    <button type="button" onClick={() => dismissSuggestedSkill(skill.id)} aria-label={`Dismiss ${skill.name}`} className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag nowheel" style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: t.statusErrorBg, color: t.statusError }}><X size={8} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Library button */}
      <div className="px-5 pb-3 pt-1 shrink-0">
        <button type="button" onClick={() => setShowLibrary(true)} aria-label="Open skill library" className="w-full min-h-[36px] px-5 py-3 rounded text-[12px] tracking-wide uppercase cursor-pointer nodrag nowheel flex items-center justify-center gap-1.5" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}>
          <Library size={12} /> Library
        </button>
      </div>
      </>}
    </div>
    </div>

    {/* Library picker — modal overlay */}
    <LibraryPicker
      open={showLibrary}
      onClose={() => setShowLibrary(false)}
      title="Skill Library"
      items={library}
      activeIds={activeSkillIds}
      onToggle={toggleSkill}
      kind="skills"
    />
    </>
  );
});

