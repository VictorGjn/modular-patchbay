import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { KNOWLEDGE_TREE, type KnowledgeSource, type Category, CATEGORY_COLORS } from '../store/knowledgeBase';
import { X, Search, BookOpen, FolderOpen, Check } from 'lucide-react';

function flatten(sources: KnowledgeSource[], result: KnowledgeSource[] = []): KnowledgeSource[] {
  for (const s of sources) {
    result.push(s);
    if (s.children) flatten(s.children, result);
  }
  return result;
}

const ALL_SOURCES = flatten(KNOWLEDGE_TREE);

const CATEGORY_LABELS: Record<Category, string> = {
  knowledge: 'Knowledge',
  discovery: 'Discovery',
  intel: 'Intel',
  agents: 'Agents',
};

export function LibraryPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const channels = useConsoleStore((s) => s.channels);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState<Category | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFilter('');
      setCatFilter(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const installedIds = new Set(channels.map((c) => c.sourceId));

  const filtered = ALL_SOURCES.filter((s) => {
    if (catFilter && s.category !== catFilter) return false;
    if (!filter) return true;
    const f = filter.toLowerCase();
    return s.name.toLowerCase().includes(f) || s.path.toLowerCase().includes(f);
  });

  const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        className="relative w-[560px] max-h-[75vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.6)', animation: 'modal-in 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: t.textSecondary }} />
            <span className="text-sm font-semibold" style={{ color: t.textPrimary }}>Knowledge Library</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md cursor-pointer border-none bg-transparent" style={{ color: t.textDim }}>
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b" style={{ borderColor: t.borderSubtle }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search knowledge sources..."
              className="w-full outline-none text-sm pl-9 pr-3 py-2 rounded-lg"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}
            />
          </div>
          {/* Category filter pills */}
          <div className="flex gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => setCatFilter(null)}
              className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer border-none"
              style={{
                background: catFilter === null ? t.surfaceElevated : 'transparent',
                color: catFilter === null ? t.textPrimary : t.textDim,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              All
            </button>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer border-none"
                style={{
                  background: catFilter === cat ? `${CATEGORY_COLORS[cat]}20` : 'transparent',
                  color: catFilter === cat ? CATEGORY_COLORS[cat] : t.textDim,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Source list */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs" style={{ color: t.textFaint }}>No sources found</span>
            </div>
          ) : (
            filtered.map((source) => {
              const installed = installedIds.has(source.id);
              const hasChildren = source.children && source.children.length > 0;
              return (
                <div key={source.id} className="flex items-center gap-3 px-5 py-2 hover-row cursor-default">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.surfaceElevated }}>
                    {hasChildren ? (
                      <FolderOpen size={14} style={{ color: CATEGORY_COLORS[source.category] }} />
                    ) : (
                      <BookOpen size={14} style={{ color: CATEGORY_COLORS[source.category] }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{source.name}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase shrink-0" style={{ background: `${CATEGORY_COLORS[source.category]}20`, color: CATEGORY_COLORS[source.category], fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>
                        {source.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] truncate" style={{ color: t.textDim }}>{source.path}</span>
                      <span className="text-[10px] shrink-0" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>{fmtTokens(source.tokenEstimate)} tok</span>
                    </div>
                  </div>
                  {installed && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md shrink-0" style={{ color: '#00ff88', background: '#00ff8812' }}>
                      <Check size={10} /> Loaded
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: t.borderSubtle }}>
          <span className="text-[10px]" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
            {filtered.length} sources · {installedIds.size} loaded
          </span>
        </div>
      </div>
    </div>
  );
}
