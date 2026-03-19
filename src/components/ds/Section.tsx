import { useTheme } from '../../theme';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SectionProps {
  icon: React.ElementType;
  label: string;
  color: string;
  badge?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  id?: string;
}

export function Section({
  icon: Icon, 
  label, 
  color, 
  badge, 
  collapsed, 
  onToggle, 
  children,
  id
}: SectionProps) {
  const t = useTheme();
  const sectionId = id || `section-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const contentId = `${sectionId}-content`;

  return (
    <section 
      role="region" 
      aria-labelledby={`${sectionId}-heading`}
      className="mb-6" 
      style={{ border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}
    >
      <h3 
        id={`${sectionId}-heading`}
        className="m-0"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          className="flex items-center gap-2 w-full px-5 py-3.5 border-none cursor-pointer select-none transition-colors"
          style={{ background: t.surfaceElevated }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          <Icon size={16} style={{ color, flexShrink: 0 }} />
          {collapsed
            ? <ChevronRight size={12} style={{ color: t.textDim }} aria-hidden="true" />
            : <ChevronDown size={12} style={{ color: t.textDim }} aria-hidden="true" />}
          <span
            className="text-sm font-semibold flex-1 text-left"
            style={{ fontFamily: "'Geist Sans', sans-serif", color: t.textPrimary }}
          >
            {label}
          </span>
          {badge && (
            <span
              className="text-[13px] px-2 py-1 rounded-full"
              style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, background: t.badgeBg }}
              aria-label={`${label} status: ${badge}`}
            >
              {badge}
            </span>
          )}
          <span className="sr-only">
            {collapsed ? 'Expand' : 'Collapse'} {label} section
          </span>
        </button>
      </h3>
      {!collapsed && (
        <div 
          id={contentId}
          className="px-5 pb-4"
          role="region"
          aria-labelledby={`${sectionId}-heading`}
        >
          {children}
        </div>
      )}
    </section>
  );
}