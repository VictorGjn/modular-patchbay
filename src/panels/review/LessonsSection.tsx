import { useState } from 'react';
import { BookOpen, Check, X, Trash2, Pencil } from 'lucide-react';
import { useTheme } from '../../theme';
import { useLessonStore } from '../../store/lessonStore';
import type { Lesson, InstinctDomain } from '../../store/lessonStore';
import { useVersionStore } from '../../store/versionStore';
import { useConsoleStore } from '../../store/consoleStore';
import { Section } from '../../components/ds/Section';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function confidenceColor(confidence: number): string {
  if (confidence < 0.5) return '#e74c3c';
  if (confidence < 0.7) return '#f39c12';
  return '#2ecc71';
}

const DOMAIN_LABELS: Record<InstinctDomain, string> = {
  accuracy: 'Accuracy',
  'output-style': 'Output Style',
  safety: 'Safety',
  workflow: 'Workflow',
  general: 'General',
};

interface LessonRowProps {
  lesson: Lesson;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  onEdit?: (rule: string) => void;
  showMeta?: boolean;
}

function LessonRow({ lesson, onApprove, onReject, onRemove, onEdit, showMeta = false }: LessonRowProps) {
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

  const conf = lesson.confidence;
  const confColor = confidenceColor(conf);
  const confPct = Math.round(conf * 100);

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
      {showMeta && (
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 60, height: 4, background: t.isDark ? '#2a2a2e' : '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${confPct}%`, height: '100%', background: confColor, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span className="text-[11px] tabular-nums" style={{ color: confColor }}>{confPct}%</span>
          </div>
          <span className="text-[11px]" style={{ color: t.textDim }}>
            seen {lesson.evidence.length}×
          </span>
          {lesson.lastSeenAt && (
            <span className="text-[11px]" style={{ color: t.textDim }}>
              last: {relativeTime(lesson.lastSeenAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface LessonsSectionProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function LessonsSection({ collapsed, onToggle }: LessonsSectionProps) {
  const t = useTheme();
  const agentId = useVersionStore((s) => s.agentId) ?? '';
  const lessons = useLessonStore((s) => s.lessons);
  const approveLesson = useLessonStore((s) => s.approveLesson);
  const rejectLesson = useLessonStore((s) => s.rejectLesson);
  const removeLesson = useLessonStore((s) => s.removeLesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);
  const archiveLessons = useLessonStore((s) => s.archiveLessons);
  const addChannel = useConsoleStore((s) => s.addChannel);

  const [promoteToast, setPromoteToast] = useState<string | null>(null);

  const pending = lessons.filter((l) => l.agentId === agentId && l.status === 'pending');
  const active = lessons.filter((l) => l.agentId === agentId && l.status === 'approved' && l.confidence >= 0.5);
  const tentative = lessons.filter((l) => l.agentId === agentId && l.status === 'approved' && l.confidence < 0.5);
  // totalApplied available for future use: active.reduce((sum, l) => sum + l.appliedCount, 0)

  // Group active lessons by domain
  const byDomain = active.reduce<Record<string, Lesson[]>>((acc, l) => {
    const key = l.domain ?? 'general';
    acc[key] = acc[key] ?? [];
    acc[key].push(l);
    return acc;
  }, {});

  // PROMOTE: domains with 2+ lessons where all have confidence > 0.7
  const promoteDomains = new Set(
    Object.entries(byDomain)
      .filter(([, ls]) => ls.length >= 2 && ls.every((l) => l.confidence > 0.7))
      .map(([domain]) => domain),
  );

  // F12: Promote high-confidence instincts in a domain to a Knowledge guideline item
  const handlePromoteToKnowledge = (domain: string, domainLessons: Lesson[]) => {
    const content = domainLessons.map((l) => `- ${l.rule}`).join('\n');
    const sourceId = `instinct-${domain}-${crypto.randomUUID().slice(0, 8)}`;
    addChannel({
      sourceId,
      name: `Guideline: ${DOMAIN_LABELS[domain as InstinctDomain] ?? domain}`,
      path: '',
      category: 'knowledge',
      knowledgeType: 'guideline',
      depth: 80,
      baseTokens: Math.ceil(content.length / 4),
      content,
    });
    archiveLessons(domainLessons.map((l) => l.id));
    setPromoteToast(`Promoted ${domainLessons.length} instinct${domainLessons.length !== 1 ? 's' : ''} to Knowledge`);
    setTimeout(() => setPromoteToast(null), 3000);
  };

  if (pending.length === 0 && active.length === 0 && tentative.length === 0) return null;

  const badge = pending.length > 0
    ? `${pending.length} pending`
    : active.length > 0
      ? `${active.length} active`
      : undefined;

  return (
    <>
      {/* F12: Promote success toast */}
      {promoteToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: '#2ecc71', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontFamily: "'Geist Sans', sans-serif", boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          ✓ {promoteToast}
        </div>
      )}
      <Section
        icon={BookOpen}
        label="Learned Behaviors"
        color="#be67cc"
        badge={badge}
        collapsed={collapsed}
        onToggle={onToggle}
      >
        <div className="space-y-4">
          {/* Pending Review */}
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
                  showMeta
                />
              ))}
            </div>
          )}

          {/* Active — grouped by domain */}
          {Object.keys(byDomain).length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide m-0" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                Active
              </p>
              {(Object.entries(byDomain) as [InstinctDomain, Lesson[]][]).map(([domain, domainLessons]) => (
                <div key={domain} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      {DOMAIN_LABELS[domain] ?? domain}
                    </span>
                    <div style={{ flex: 1, height: 1, background: t.border }} />
                  </div>
                  {domainLessons.map((l) => (
                    <LessonRow
                      key={l.id}
                      lesson={l}
                      onEdit={(rule) => updateLesson(l.id, rule)}
                      onRemove={() => removeLesson(l.id)}
                      showMeta
                    />
                  ))}
                  {promoteDomains.has(domain) && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded text-[11px]"
                      style={{ background: '#FE500008', border: `1px dashed #FE500040`, color: t.textDim }}
                    >
                      <span>💡 These could merge into a Knowledge item.</span>
                      <button
                        type="button"
                        className="ml-auto text-[11px] font-medium border-none bg-transparent cursor-pointer"
                        style={{ color: '#FE5000' }}
                        onClick={() => handlePromoteToKnowledge(domain, domainLessons)}
                      >
                        Promote to Knowledge →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TENTATIVE — approved but below confidence threshold */}
          {tentative.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide m-0" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                Tentative
              </p>
              {tentative.map((l) => {
                const needed = Math.max(1, Math.ceil((0.5 - l.confidence) / 0.2));
                return (
                  <div key={l.id} className="space-y-1">
                    <LessonRow
                      lesson={l}
                      onEdit={(rule) => updateLesson(l.id, rule)}
                      onRemove={() => removeLesson(l.id)}
                      showMeta
                    />
                    <p className="text-[10px] m-0 ml-1" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      Needs {needed} more confirmation{needed !== 1 ? 's' : ''} to activate
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
