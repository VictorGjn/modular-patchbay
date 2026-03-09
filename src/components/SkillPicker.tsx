import { useEffect, useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { type SkillCategory } from '../store/knowledgeBase';
import { useSkillsStore } from '../store/skillsStore';
import { SkillIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check } from 'lucide-react';
import { PickerModal } from './PickerModal';
import { SecurityBadges } from './SecurityBadges';

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  content: 'Content',
  analysis: 'Analysis',
  development: 'Development',
  domain: 'Domain',
};

const CATEGORY_ORDER: SkillCategory[] = ['content', 'analysis', 'development', 'domain'];

function inferCategory(name: string, description: string): SkillCategory {
  const text = `${name} ${description}`.toLowerCase();
  if (/analysis|insight|research|intel|feedback/.test(text)) return 'analysis';
  if (/code|dev|api|build|test|automation|github/.test(text)) return 'development';
  if (/content|write|presentation|slides|copy/.test(text)) return 'content';
  return 'domain';
}

export function SkillPicker() {
  const showSkillPicker = useConsoleStore((s) => s.showSkillPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const consoleSkills = useConsoleStore((s) => s.skills);
  const addSkill = useConsoleStore((s) => s.addSkill);
  const upsertSkill = useConsoleStore((s) => s.upsertSkill);
  const installedSkills = useSkillsStore((s) => s.skills);
  const loaded = useSkillsStore((s) => s.loaded);
  const loading = useSkillsStore((s) => s.loading);
  const loadSkills = useSkillsStore((s) => s.loadSkills);
  const t = useTheme();

  useEffect(() => {
    if (showSkillPicker && !loaded && !loading) {
      void loadSkills();
    }
  }, [showSkillPicker, loaded, loading, loadSkills]);

  useEffect(() => {
    if (installedSkills.length === 0) return;
    for (const skill of installedSkills) {
      upsertSkill({ id: skill.id, name: skill.name, description: skill.description || 'Installed skill' });
    }
  }, [installedSkills, upsertSkill]);

  const skills = useMemo(() => {
    const addedSet = new Set(consoleSkills.filter((s) => s.added).map((s) => s.id));
    const byId = new Map(consoleSkills.map((s) => [s.id, s]));

    for (const s of installedSkills) {
      if (!byId.has(s.id)) {
        byId.set(s.id, {
          id: s.id,
          name: s.name,
          icon: 'zap',
          enabled: s.enabled,
          added: addedSet.has(s.id),
          description: s.description || 'Installed skill',
          category: inferCategory(s.name, s.description || ''),
        });
      }
    }

    return Array.from(byId.values());
  }, [consoleSkills, installedSkills]);

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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: t.textPrimary }}>{skill.name}</span>
                    <SecurityBadges gen={skill.gen} socket={skill.socket} snyk={skill.snyk} />
                  </div>
                  <span className="text-xs" style={{ color: t.textDim }}>{skill.description}</span>
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
