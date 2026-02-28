import { useConsoleStore } from '../store/consoleStore';
import { type SkillCategory } from '../store/knowledgeBase';
import { SkillIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check } from 'lucide-react';
import { PickerModal } from './PickerModal';

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  content: 'Content',
  analysis: 'Analysis',
  development: 'Development',
  domain: 'Domain',
};

const CATEGORY_ORDER: SkillCategory[] = ['content', 'analysis', 'development', 'domain'];

export function SkillPicker() {
  const showSkillPicker = useConsoleStore((s) => s.showSkillPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const skills = useConsoleStore((s) => s.skills);
  const addSkill = useConsoleStore((s) => s.addSkill);
  const t = useTheme();

  return (
    <PickerModal
      open={showSkillPicker}
      onClose={() => setShowSkillPicker(false)}
      title="Add Skill"
      searchPlaceholder="Search skills..."
    >
      {(filter) => {
        const filtered = skills.filter((s) => {
          if (!filter) return true;
          const f = filter.toLowerCase();
          return s.name.toLowerCase().includes(f) || s.description.toLowerCase().includes(f);
        });

        const grouped = CATEGORY_ORDER.map((cat) => ({
          category: cat,
          label: CATEGORY_LABELS[cat],
          skills: filtered.filter((s) => s.category === cat),
        })).filter((g) => g.skills.length > 0);

        return grouped.map((group) => (
          <div key={group.category}>
            <div className="px-5 py-1.5">
              <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: t.textDim }}>
                {group.label}
              </span>
            </div>
            {group.skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-3 px-5 py-2.5 hover-row cursor-default"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: t.surfaceElevated }}
                >
                  <SkillIcon icon={skill.icon} size={16} style={{ color: t.textSecondary }} />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: t.textPrimary }}>{skill.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: t.textDim }}>{skill.description}</span>
                  </div>
                </div>

                {skill.added ? (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
                    <Check size={12} /> Added
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addSkill(skill.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md cursor-pointer border-none"
                    style={{
                      color: '#FE5000',
                      background: '#FE500012',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
                    aria-label={`Add ${skill.name}`}
                  >
                    <Plus size={12} /> Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ));
      }}
    </PickerModal>
  );
}
