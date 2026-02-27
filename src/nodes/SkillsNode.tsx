import { memo, useState, useEffect, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { useConsoleStore } from '../store/consoleStore';
import { useSkillsStore } from '../store/skillsStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { SkillIcon } from '../components/icons/SectionIcons';
import { LibraryPicker, type LibraryItem } from '../components/LibraryPicker';
import { useTheme } from '../theme';
import { Zap, Check, X, Loader2, Download, ChevronDown, ChevronRight, LayoutGrid, List, Library } from 'lucide-react';

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
  useEffect(() => { try { localStorage.setItem('skills-node-collapsed', String(nodeCollapsed)); } catch {} }, [nodeCollapsed]);
  useEffect(() => { try { localStorage.setItem('skills-node-view', viewMode); } catch {} }, [viewMode]);

  return (
    <>
    <ResizeHandle minWidth={240} minHeight={120} />
    <div
      className="rounded-xl overflow-hidden h-full flex flex-col"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, minWidth: 240 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.borderSubtle}` }}>
        <button type="button" onClick={() => setNodeCollapsed(!nodeCollapsed)} aria-label={nodeCollapsed ? 'Expand skills panel' : 'Collapse skills panel'} className="p-0 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}>
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Zap size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 12 }}>Skills</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>{activeSkills.length}</span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setViewMode('card')} aria-label="Card view" className="p-0.5 border-none cursor-pointer nodrag rounded min-w-[28px] min-h-[28px]" style={{ background: viewMode === 'card' ? t.badgeBg : 'transparent', color: viewMode === 'card' ? t.textSecondary : t.textFaint }}><LayoutGrid size={12} /></button>
            <button type="button" onClick={() => setViewMode('list')} aria-label="List view" className="p-0.5 border-none cursor-pointer nodrag rounded min-w-[28px] min-h-[28px]" style={{ background: viewMode === 'list' ? t.badgeBg : 'transparent', color: viewMode === 'list' ? t.textSecondary : t.textFaint }}><List size={12} /></button>
          </div>
        )}
        <JackPort type="source" position={Position.Right} label="OUTPUT" color={t.cableSkills} id="skills-out" />
      </div>

      {nodeCollapsed ? null : <>
      {/* Active skills */}
      <div className="flex-1 p-3 overflow-y-auto nowheel">
        {viewMode === 'card' ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
            {activeSkills.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-3">
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
        <div className="px-3 pt-1 pb-2 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[11px] tracking-wider font-semibold" style={{ color: t.cableSkills, fontFamily: "'Space Mono', monospace" }}>Suggest</span>
            <JackPort type="target" position={Position.Right} label="SUGGEST" color={t.cableSkills} id="skills-feedback-in" />
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

      {suggestedSkills.length === 0 && (
        <div className="px-3 py-1 flex justify-end shrink-0">
          <JackPort type="target" position={Position.Right} label="SUGGEST" color={t.cableSkills} id="skills-feedback-in" />
        </div>
      )}

      {/* Library button */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        <button type="button" onClick={() => setShowLibrary(true)} aria-label="Open skill library" className="w-full min-h-[32px] px-3 py-1.5 rounded-md text-[11px] tracking-wide uppercase cursor-pointer nodrag nowheel flex items-center justify-center gap-1.5" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}>
          <Library size={12} /> Library
        </button>
      </div>
      </>}
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
