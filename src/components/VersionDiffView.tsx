import { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../theme';
import type { AgentVersion } from '../store/versionStore';
import { computeVersionDiff } from '../utils/versionDiff';
import type { ChangeSet, DiffCategory, VersionDiff } from '../utils/versionDiff';

const CATEGORY_LABELS: Record<DiffCategory, string> = {
  meta: 'Model & Config',
  persona: 'Persona & Objectives',
  constraints: 'Constraints',
  workflow: 'Workflow',
  knowledge: 'Knowledge',
  tools: 'Tools & MCP',
};

const TYPE_STYLES: Record<string, { bg: string; text: string; prefix: string }> = {
  added:    { bg: 'rgba(0,200,100,0.08)',  text: '#00c864', prefix: '+' },
  removed:  { bg: 'rgba(255,60,60,0.08)',  text: '#ff4444', prefix: '−' },
  modified: { bg: 'rgba(255,160,0,0.1)',   text: '#ffa000', prefix: '~' },
};

const ALL_CATEGORIES: DiffCategory[] = ['meta', 'persona', 'constraints', 'workflow', 'knowledge', 'tools'];

interface Props {
  versionA: AgentVersion;
  versionB: AgentVersion;
  onClose: () => void;
}

function renderValue(val: unknown): string {
  if (val === undefined || val === null) return '(empty)';
  if (typeof val === 'boolean') return val ? 'on' : 'off';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

function DiffRow({ change, t }: { change: ChangeSet; t: ReturnType<typeof useTheme> }) {
  const style = TYPE_STYLES[change.type] ?? TYPE_STYLES.modified;
  return (
    <div className="rounded-md p-2.5 mb-1.5" style={{ background: style.bg }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-bold font-mono" style={{ color: style.text }}>{style.prefix}</span>
        <span className="text-[12px] font-medium" style={{ color: t.textPrimary }}>{change.description}</span>
      </div>
      {change.type === 'modified' && (
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div className="rounded p-1.5" style={{ background: 'rgba(255,60,60,0.06)' }}>
            <div className="text-[10px] mb-0.5" style={{ color: t.textFaint }}>BEFORE</div>
            <div className="text-[11px] font-mono break-all" style={{ color: '#ff6666' }}>{renderValue(change.before)}</div>
          </div>
          <div className="rounded p-1.5" style={{ background: 'rgba(0,200,100,0.06)' }}>
            <div className="text-[10px] mb-0.5" style={{ color: t.textFaint }}>AFTER</div>
            <div className="text-[11px] font-mono break-all" style={{ color: '#00c864' }}>{renderValue(change.after)}</div>
          </div>
        </div>
      )}
      {change.type === 'added' && change.after !== undefined && (
        <div className="mt-1 text-[11px] font-mono break-all" style={{ color: '#00c864' }}>{renderValue(change.after)}</div>
      )}
      {change.type === 'removed' && change.before !== undefined && (
        <div className="mt-1 text-[11px] font-mono break-all" style={{ color: '#ff6666' }}>{renderValue(change.before)}</div>
      )}
    </div>
  );
}

function CategorySection({ category, changes, collapsed, onToggle, t }: {
  category: DiffCategory;
  changes: ChangeSet[];
  collapsed: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  const hasChanges = changes.length > 0;
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer border-none"
        style={{ background: hasChanges ? t.surfaceElevated : t.surface }}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="text-[12px] font-semibold" style={{ color: t.textPrimary }}>{CATEGORY_LABELS[category]}</span>
          {hasChanges && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#FE5000', color: 'white' }}>
              {changes.length}
            </span>
          )}
        </div>
        {!hasChanges && <span className="text-[11px]" style={{ color: t.textFaint }}>No changes</span>}
      </button>
      {!collapsed && hasChanges && (
        <div className="px-3 py-2" style={{ background: t.surface }}>
          {changes.map((c) => <DiffRow key={`${c.category}-${c.field}`} change={c} t={t} />)}
        </div>
      )}
    </div>
  );
}

function DiffSummaryBar({ diff, t }: { diff: VersionDiff; t: ReturnType<typeof useTheme> }) {
  const { totalChanges, changeTypes } = diff.summary;
  if (totalChanges === 0) {
    return <p className="text-[12px]" style={{ color: t.textFaint }}>These versions are identical.</p>;
  }
  return (
    <div className="flex items-center gap-3 text-[12px]">
      <span style={{ color: t.textSecondary }}>{totalChanges} change{totalChanges !== 1 ? 's' : ''}</span>
      {changeTypes.added > 0 && <span style={{ color: '#00c864' }}>+{changeTypes.added} added</span>}
      {changeTypes.removed > 0 && <span style={{ color: '#ff4444' }}>−{changeTypes.removed} removed</span>}
      {changeTypes.modified > 0 && <span style={{ color: '#ffa000' }}>{changeTypes.modified} modified</span>}
    </div>
  );
}

export function VersionDiffView({ versionA, versionB, onClose }: Props) {
  const t = useTheme();
  const [collapsed, setCollapsed] = useState<Set<DiffCategory>>(new Set());

  const diff = useMemo(
    () => computeVersionDiff(versionA.snapshot, versionB.snapshot, versionA.version, versionB.version),
    [versionA, versionB]
  );

  const toggleSection = (cat: DiffCategory) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[600px] max-h-[80vh] flex flex-col rounded-xl border shadow-2xl" style={{ background: t.surface, borderColor: t.border }}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: t.border }}>
          <div>
            <div className="text-[13px] font-bold" style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
              v{versionA.version} → v{versionB.version}
            </div>
            <DiffSummaryBar diff={diff} t={t} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none bg-transparent"
            style={{ color: t.textMuted }}
            aria-label="Close diff view"
          >
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
          {ALL_CATEGORIES.map(cat => (
            <CategorySection
              key={cat}
              category={cat}
              changes={diff.changes.filter(c => c.category === cat)}
              collapsed={collapsed.has(cat)}
              onToggle={() => toggleSection(cat)}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
