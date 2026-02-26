import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { MOCK_AGENTS } from '../store/knowledgeBase';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { SkillIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { Zap, Check, X, Loader2, Download } from 'lucide-react';

const getLinkedAgents = (skillId: string): string[] =>
  MOCK_AGENTS.filter((a) => a.linkedSkills?.includes(skillId)).map((a) => a.name);

export const SkillsNode = memo(function SkillsNode() {
  const skills = useConsoleStore((s) => s.skills);
  const toggleSkill = useConsoleStore((s) => s.toggleSkill);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const suggestedSkills = useConsoleStore((s) => s.suggestedSkills);
  const acceptSuggestedSkill = useConsoleStore((s) => s.acceptSuggestedSkill);
  const dismissSuggestedSkill = useConsoleStore((s) => s.dismissSuggestedSkill);
  const t = useTheme();

  const addedSkills = skills.filter((s) => s.added);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <Zap size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: t.textSecondary }}>
          Skills
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {addedSkills.filter((s) => s.enabled).length}
        </span>
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#f1c40f" id="skills-out" />
      </div>

      {/* Tiles */}
      <div className="p-4 overflow-y-auto nowheel" style={{ maxHeight: 280 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
          {addedSkills.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-3">
              <span className="text-xs" style={{ color: t.textFaint }}>No skills added</span>
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
      </div>

      {/* Suggested skills ghost tiles */}
      {suggestedSkills.length > 0 && (
        <div className="px-4 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[9px] tracking-wider uppercase" style={{ color: '#f1c40f', fontFamily: "'Space Mono', monospace" }}>Suggest</span>
            <JackPort type="target" position={Position.Right} label="SUGGEST" color="#f1c40f" id="skills-feedback-in" />
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-1.5">
            {suggestedSkills.map((skill) => (
              <div
                key={skill.id}
                className="ghost-tile flex items-center gap-2 px-2.5 py-1.5 rounded-md nodrag"
                style={{
                  border: `1px dashed #f1c40f40`,
                  background: t.isDark ? 'rgba(241,196,15,0.04)' : 'rgba(241,196,15,0.06)',
                  animation: skill.installed ? 'none' : undefined,
                  opacity: skill.installed ? 1 : undefined,
                }}
              >
                <span
                  className="flex-1 truncate text-[10px]"
                  style={{ fontFamily: "'Inter', sans-serif", color: t.textSecondary }}
                >
                  {skill.name}
                </span>
                <span
                  className="text-[8px] truncate"
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
                      style={{
                        height: 16,
                        fontSize: 9,
                        fontFamily: "'Space Mono', monospace",
                        background: 'rgba(241,196,15,0.15)',
                        color: '#f1c40f',
                      }}
                    >
                      <Download size={8} /> Install
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissSuggestedSkill(skill.id)}
                      className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                      style={{
                        height: 16,
                        fontSize: 9,
                        fontFamily: "'Space Mono', monospace",
                        background: 'rgba(255,80,80,0.12)',
                        color: '#ff5050',
                      }}
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
        <div className="px-4 py-1 flex justify-end">
          <JackPort type="target" position={Position.Right} label="SUGGEST" color="#f1c40f" id="skills-feedback-in" />
        </div>
      )}

      {/* Add button */}
      <div className="px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowSkillPicker(true)}
          className="w-full py-1.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add
        </button>
      </div>
    </div>
  );
});
