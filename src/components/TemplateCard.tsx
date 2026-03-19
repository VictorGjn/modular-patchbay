import { useTheme } from '../theme';
import { Sparkles } from 'lucide-react';

export interface TemplateCardProps {
  id: string;
  name: string;
  description: string;
  tags: string[];
  onUse: (id: string) => void;
}

const TEMPLATE_BORDER = 'rgba(99,102,241,0.4)';
const TEMPLATE_ACCENT = '#6366f1';
const TEMPLATE_BG = 'rgba(99,102,241,0.12)';

export function TemplateCard({ id, name, description, tags, onUse }: TemplateCardProps) {
  const t = useTheme();

  const cardStyle = {
    background: t.surfaceOpaque,
    border: `1px dashed ${TEMPLATE_BORDER}`,
    boxShadow: `0 2px 8px ${t.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)'}`,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      title={`Use ${name} template`}
      className="cursor-pointer rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg"
      onClick={() => onUse(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onUse(id); }}
      style={cardStyle}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEMPLATE_ACCENT; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = TEMPLATE_BORDER; }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: TEMPLATE_BG }}>
              <Sparkles size={14} style={{ color: TEMPLATE_ACCENT }} />
            </div>
            <h3 className="text-base font-semibold truncate" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
              {name}
            </h3>
          </div>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded shrink-0 ml-2 font-medium uppercase tracking-wide"
            style={{ background: TEMPLATE_BG, color: TEMPLATE_ACCENT, fontFamily: "'Geist Mono', monospace" }}
          >
            Template
          </span>
        </div>

        <p className="text-sm line-clamp-2 mb-3" style={{ color: t.textSecondary }}>
          {description || 'No description'}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-1.5 py-0.5 rounded"
                style={{ background: t.surfaceElevated, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: t.surfaceElevated, color: t.textFaint }}>
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
