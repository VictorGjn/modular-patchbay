import { memo, useState, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { useSkillsStore } from '../store/skillsStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { SkillIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { Zap, Check, X, Loader2, Download, ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react';

export const SkillsNode = memo(function SkillsNode() {
  const consoleSkills = useConsoleStore((s) => s.skills);
  const toggleConsoleSkill = useConsoleStore((s) => s.toggleSkill);
  const realSkills = useSkillsStore((s) => s.skills);
  const realLoaded = useSkillsStore((s) => s.loaded);
  const toggleRealSkill = useSkillsStore((s) => s.toggleSkill);

  // Load real skills on mount
  useEffect(() => {
    if (!realLoaded) {
      useSkillsStore.getState().loadSkills();
    }
  }, [realLoaded]);

  // Merge: real Claude skills + registry skills
  const skills = [
    ...realSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || 'Installed skill',
      added: true,
      enabled: s.enabled,
      source: 'claude' as const,
    })),
    ...consoleSkills.filter((s) => s.added).map((s) => ({
      ...s,
      source: 'registry' as const,
    })),
  ];

  const toggleSkill = (id: string) => {
    if (realSkills.find((s) => s.id === id)) {
      toggleRealSkill(id);
    } else {
      toggleConsoleSkill(id);
    }
  };
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const suggestedSkills = useConsoleStore((s) => s.suggestedSkills);
  const acceptSuggestedSkill = useConsoleStore((s) => s.acceptSuggestedSkill);
  const dismissSuggestedSkill = useConsoleStore((s) => s.dismissSuggestedSkill);
  const t = useTheme();

  const addedSkills = skills.filter((s) => s.added || s.source === 'claude');

  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('skills-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('skills-node-view') as 'card' | 'list') || 'card'; } catch { return 'card'; }
  });

  useEffect(() => {
    try { localStorage.setItem('skills-node-collapsed', String(nodeCollapsed)); } catch {}
  }, [nodeCollapsed]);
  useEffect(() => {
    try { localStorage.setItem('skills-node-view', viewMode); } catch {}
  }, [viewMode]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.borderSubtle}` }}>
        <button
          type="button"
          onClick={() => setNodeCollapsed(!nodeCollapsed)}
          className="p-0 border-none bg-transparent cursor-pointer nodrag"
          style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}
        >
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Zap size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 12 }}>
          Skills
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {addedSkills.filter((s) => s.enabled).length}
        </span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className="p-0.5 border-none cursor-pointer nodrag rounded"
              style={{ background: viewMode === 'card' ? t.badgeBg : 'transparent', color: viewMode === 'card' ? t.textSecondary : t.textFaint }}
            >
              <LayoutGrid size={12} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-0.5 border-none cursor-pointer nodrag rounded"
              style={{ background: viewMode === 'list' ? t.badgeBg : 'transparent', color: viewMode === 'list' ? t.textSecondary : t.textFaint }}
            >
              <List size={12} />
            </button>
          </div>
        )}
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#f1c40f" id="skills-out" />
      </div>

      {nodeCollapsed ? null : <>
      {/* Content */}
      <div className="p-3 overflow-y-auto nowheel" style={{ maxHeight: 280 }}>
        {viewMode === 'card' ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
            {addedSkills.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No skills added</span>
              </div>
            ) : addedSkills.map((skill) => {
              const linked = getLinkedAgents(skill.id);
              return (
                <Tile
                  key={skill.id}
                  name={skill.name}
                  active={skill.enabled}
                  icon={<SkillIcon icon={skill.icon} size={14} />}
                  subtitle={linked.length > 0 ? `Used by: ${linked.join(', ')}` : skill.description}
                  onClick={() => toggleSkill(skill.id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {addedSkills.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No skills added</span>
              </div>
            ) : addedSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                className="flex items-center gap-2 px-2 rounded-md border-none cursor-pointer nodrag"
                style={{
                  height: 28,
                  background: 'transparent',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: skill.enabled ? '#00ff88' : t.textFaint, boxShadow: skill.enabled ? '0 0 4px #00ff8866' : 'none' }}
                />
                <span className="flex-1 truncate text-[11px]" style={{ color: skill.enabled ? t.textPrimary : t.textDim, fontFamily: "'Inter', sans-serif" }}>
                  {skill.name}
                </span>
                <span className="text-[10px]" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
                  {skill.description?.slice(0, 20)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested skills ghost tiles */}
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
              <div
                key={skill.id}
                className="ghost-tile flex items-center gap-2 px-2 py-1.5 rounded-md nodrag"
                style={{
                  border: `1px dashed #f1c40f40`,
                  background: t.isDark ? 'rgba(241,196,15,0.04)' : 'rgba(241,196,15,0.06)',
                }}
              >
                <span
                  className="flex-1 truncate text-[10px]"
                  style={{ fontFamily: "'Inter', sans-serif", color: t.textSecondary }}
                >
                  {skill.name}
                </span>
                <span
                  className="text-[11px] truncate"
                  style={{ color: t.textDim, fontFamily: "'Space Mono', monospace", maxWidth: 90 }}
                  title={skill.installCmd}
                >
                  {skill.installCmd}
                </span>
                {skill.installed ? (
                  <span style={{ color: '#00ff88' }}><Check size={12} /></span>
                ) : skill.installing ? (
                  <span style={{ color: '#f1c40f', animation: 'pulse-glow 1s ease-in-out infinite' }}><Loader2 size={12} /></span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => acceptSuggestedSkill(skill.id)}
                      className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                      style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: 'rgba(241,196,15,0.15)', color: '#f1c40f' }}
                    >
                      <Download size={8} /> Install
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissSuggestedSkill(skill.id)}
                      className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                      style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: 'rgba(255,80,80,0.12)', color: '#ff5050' }}
                    >
                      <X size={8} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback input port (shown when no suggestions yet) */}
      {suggestedSkills.length === 0 && (
        <div className="px-3 py-1 flex justify-end">
          <JackPort type="target" position={Position.Right} label="SUGGEST" color="#f1c40f" id="skills-feedback-in" />
        </div>
      )}

      {/* Add button */}
      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowMarketplace(true, 'skills')}
          className="w-full py-1.5 rounded-md text-[11px] tracking-wide uppercase cursor-pointer nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add
        </button>
      </div>
      </>}
    </div>
  );
});
