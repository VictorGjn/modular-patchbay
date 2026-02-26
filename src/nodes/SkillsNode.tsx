import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { MOCK_AGENTS } from '../store/knowledgeBase';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { SkillIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { Zap } from 'lucide-react';

const getLinkedAgents = (skillId: string): string[] =>
  MOCK_AGENTS.filter((a) => a.linkedSkills?.includes(skillId)).map((a) => a.name);

export const SkillsNode = memo(function SkillsNode() {
  const skills = useConsoleStore((s) => s.skills);
  const toggleSkill = useConsoleStore((s) => s.toggleSkill);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
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
