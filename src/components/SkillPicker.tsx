import { useEffect, useMemo, useState } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { type SkillCategory } from '../store/knowledgeBase';
import { useSkillsStore } from '../store/skillsStore';
import { SkillIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Check } from 'lucide-react';
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
  const toggleSkillInStore = useSkillsStore((s) => s.toggleSkill);
  const t = useTheme();

  // Local state for selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (showSkillPicker && !loaded && !loading) {
      void loadSkills();
    }
  }, [showSkillPicker, loaded, loading, loadSkills]);

  useEffect(() => {
    // Reset selection when picker opens
    if (showSkillPicker) {
      setSelectedIds(new Set());
    }
  }, [showSkillPicker]);

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

  const handleToggleSelection = (skillId: string, isAdded: boolean) => {
    if (isAdded) return; // Don't allow selecting already added skills
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(skillId)) {
        newSet.delete(skillId);
      } else {
        newSet.add(skillId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    selectedIds.forEach(id => {
      addSkill(id);
      // Also ensure the skill is enabled in the skillsStore if it exists there
      const skill = installedSkills.find(s => s.id === id);
      if (skill && !skill.enabled) {
        toggleSkillInStore(id);
      }
    });
    setSelectedIds(new Set());
    setShowSkillPicker(false);
  };

  const handleCancel = () => {
    setSelectedIds(new Set());
    setShowSkillPicker(false);
  };

  return (
    <PickerModal
      open={showSkillPicker}
      onClose={handleCancel}
      title="Select Skills"
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

        return (
          <div className="flex flex-col h-full">
            {/* Skills list */}
            <div className="flex-1 overflow-y-auto">
              {grouped.map((group) => (
                <div key={group.category}>
                  <div className="px-5 py-1.5">
                    <span className="text-[12px] font-medium tracking-wider uppercase" style={{ color: t.textDim }}>
                      {group.label}
                    </span>
                  </div>
                  {group.skills.map((skill) => {
                    const isSelected = selectedIds.has(skill.id);
                    const isAdded = skill.added;
                    return (
                      <div
                        key={skill.id}
                        className={`flex items-center gap-3 px-5 py-2.5 ${!isAdded ? 'hover-row cursor-pointer' : 'cursor-default'}`}
                        style={{
                          background: isSelected ? '#FE500012' : 'transparent',
                        }}
                        onClick={() => handleToggleSelection(skill.id, isAdded)}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: t.surfaceElevated }}
                        >
                          <SkillIcon icon={skill.icon} size={16} style={{ color: t.textSecondary }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[17px] font-medium" style={{ color: t.textPrimary }}>{skill.name}</span>
                            {skill.skillUrl?.startsWith('https://skills.sh/') && (
                              <SecurityBadges skillPath={skill.skillUrl.replace('https://skills.sh/', '').split('/').pop() ?? ''} />
                            )}
                          </div>
                          <span className="text-[14px]" style={{ color: t.textDim }}>{skill.description}</span>
                        </div>

                        {isAdded ? (
                          <span className="flex items-center gap-1 text-[14px] px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
                            <Check size={12} /> Added
                          </span>
                        ) : (
                          <div
                            className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                            style={{
                              borderColor: isSelected ? '#FE5000' : t.border,
                              background: isSelected ? '#FE5000' : 'transparent',
                            }}
                          >
                            {isSelected && <Check size={10} style={{ color: '#fff' }} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Sticky footer */}
            <div 
              className="flex items-center justify-end gap-3 px-5 py-3"
              style={{ 
                borderTop: `1px solid ${t.border}`,
                background: t.surfaceOpaque,
              }}
            >
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-[14px] rounded-lg cursor-pointer border"
                style={{
                  background: 'transparent',
                  border: `1px solid ${t.border}`,
                  color: t.textSecondary,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 text-[14px] rounded-lg cursor-pointer border-none"
                style={{
                  background: selectedIds.size > 0 ? '#FE5000' : t.surfaceElevated,
                  color: selectedIds.size > 0 ? '#fff' : t.textDim,
                  opacity: selectedIds.size > 0 ? 1 : 0.5,
                  cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Add {selectedIds.size > 0 ? `${selectedIds.size} skill${selectedIds.size === 1 ? '' : 's'}` : 'skills'}
              </button>
            </div>
          </div>
        );
      }}
    </PickerModal>
  );
}
