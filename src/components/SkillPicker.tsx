import { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { type SkillCategory, MOCK_AGENTS } from '../store/knowledgeBase';
import { SkillIcon } from './icons/SectionIcons';
import { X, Search, Plus, Check } from 'lucide-react';

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  content: 'Content',
  analysis: 'Analysis',
  development: 'Development',
  domain: 'Domain',
};

const CATEGORY_ORDER: SkillCategory[] = ['content', 'analysis', 'development', 'domain'];

function getLinkedAgents(skillId: string): string[] {
  return MOCK_AGENTS
    .filter((a) => a.linkedSkills?.includes(skillId))
    .map((a) => a.name);
}

export function SkillPicker() {
  const showSkillPicker = useConsoleStore((s) => s.showSkillPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const skills = useConsoleStore((s) => s.skills);
  const addSkill = useConsoleStore((s) => s.addSkill);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSkillPicker) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showSkillPicker]);

  useEffect(() => {
    if (!showSkillPicker) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSkillPicker(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSkillPicker, setShowSkillPicker]);

  if (!showSkillPicker) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowSkillPicker(false)}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        className="relative w-[520px] max-h-[70vh] flex flex-col rounded-xl overflow-hidden"
        style={{
          background: '#1c1c20',
          border: '1px solid #2a2a30',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2a2a30' }}>
          <span className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
            Add Skill
          </span>
          <button
            type="button"
            onClick={() => setShowSkillPicker(false)}
            className="p-1 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
            style={{ color: '#555' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b" style={{ borderColor: '#222226' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search skills..."
              className="w-full outline-none text-sm pl-9 pr-3 py-2 rounded-lg"
              style={{
                background: '#141417',
                border: '1px solid #2a2a30',
                color: '#f0f0f0',
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto py-2">
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="px-5 py-1.5">
                <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: '#555' }}>
                  {group.label}
                </span>
              </div>
              {group.skills.map((skill) => {
                const linkedAgents = getLinkedAgents(skill.id);
                return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-3 px-5 py-2.5 hover-row cursor-default"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: '#25252a' }}
                    >
                      <SkillIcon icon={skill.icon} size={16} style={{ color: '#888' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{skill.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#555' }}>{skill.description}</span>
                        {linkedAgents.length > 0 && (
                          <span className="text-[10px]" style={{ color: '#888' }}>
                            Used by: {linkedAgents.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {skill.added ? (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md" style={{ color: '#00ff88', background: '#00ff8812' }}>
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
                      >
                        <Plus size={12} /> Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
