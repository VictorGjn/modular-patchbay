import { useState } from 'react';
import { BookOpen, Check, X, Trash2, Pencil } from 'lucide-react';
import { useTheme } from '../../theme';
import { useLessonStore } from '../../store/lessonStore';
import type { Lesson } from '../../store/lessonStore';
import { useVersionStore } from '../../store/versionStore';

interface LessonRowProps {
  lesson: Lesson;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  onEdit?: (rule: string) => void;
}

function LessonRow({ lesson, onApprove, onReject, onRemove, onEdit }: LessonRowProps) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lesson.rule);

  const handleSave = () => {
    if (draft.trim()) onEdit?.(draft.trim());
    setEditing(false);
  };

  const rowStyle = {
    background: t.isDark ? '#1c1c20' : '#f9fafb',
    borderRadius: 6,
    padding: '8px 10px',
  };

  return (
    <div className="space-y-1" style={rowStyle}>
      <div className="flex items-start gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: '#FE500015', color: '#FE5000' }}>
          {lesson.category}
        </span>
        {editing ? (
          <input
            className="flex-1 text-[12px] bg-transparent border-b outline-none"
            style={{ color: t.textPrimary, borderColor: t.border }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        ) : (
          <span className="flex-1 text-[12px]" style={{ color: t.textPrimary }}>{lesson.rule}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {onApprove && (
            <button type="button" onClick={onApprove} title="Approve" className="border-none bg-transparent cursor-pointer p-1" style={{ color: '#2ecc71' }}>
              <Check size={13} />
            </button>
          )}
          {onReject && (
            <button type="button" onClick={onReject} title="Reject" className="border-none bg-transparent cursor-pointer p-1" style={{ color: t.textDim }}>
              <X size={13} />
            </button>
          )}
          {onEdit && !onApprove && (
            editing
              ? <button type="button" onClick={handleSave} title="Save" className="border-none bg-transparent cursor-pointer p-1" style={{ color: '#2ecc71' }}><Check size={13} /></button>
              : <button type="button" onClick={() => setEditing(true)} title="Edit" className="border-none bg-transparent cursor-pointer p-1" style={{ color: t.textDim }}><Pencil size={13} /></button>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} title="Remove" className="border-none bg-transparent cursor-pointer p-1" style={{ color: t.textDim }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LessonsSection() {
  const t = useTheme();
  const agentId = useVersionStore((s) => s.agentId) ?? '';
  const lessons = useLessonStore((s) => s.lessons);
  const approveLesson = useLessonStore((s) => s.approveLesson);
  const rejectLesson = useLessonStore((s) => s.rejectLesson);
  const removeLesson = useLessonStore((s) => s.removeLesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);

  const [collapsed, setCollapsed] = useState(false);

  const pending = lessons.filter((l) => l.agentId === agentId && l.status === 'pending');
  const active = lessons.filter((l) => l.agentId === agentId && l.status === 'approved');
  const totalApplied = active.reduce((sum, l) => sum + l.appliedCount, 0);

  if (pending.length === 0 && active.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} style={{ color: '#FE5000' }} />
          <h4 className="text-sm font-semibold m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
            Auto-Lessons
          </h4>
          {pending.length > 0 && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: '#FE500015', color: '#FE5000' }}>
              {pending.length} pending
            </span>
          )}
          {active.length > 0 && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: t.isDark ? '#1c1c20' : '#f3f4f6', color: t.textDim }}>
              {active.length} active, applied {totalApplied} time{totalApplied !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs border-none bg-transparent cursor-pointer"
          style={{ color: t.textDim }}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide m-0" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                Pending Review
              </p>
              {pending.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  onApprove={() => approveLesson(l.id)}
                  onReject={() => rejectLesson(l.id)}
                />
              ))}
            </div>
          )}

          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide m-0" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                Active
              </p>
              {active.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  onEdit={(rule) => updateLesson(l.id, rule)}
                  onRemove={() => removeLesson(l.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
