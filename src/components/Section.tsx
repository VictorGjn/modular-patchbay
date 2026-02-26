import type { ReactNode, ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { SECTION_ICON_MAP } from './icons/SectionIcons';
import { SECTION_COLORS } from '../constants';

interface SectionProps {
  title: string;
  sectionId: string;
  count: number;
  active: boolean;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function Section({ title, sectionId, count, active, children, actionLabel, onAction }: SectionProps) {
  const Icon: ComponentType<LucideProps> | undefined = SECTION_ICON_MAP[sectionId];

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'rgba(28, 28, 32, 0.7)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2a2a30',
        minWidth: 0,
      }}
    >
      {/* Header with jack ports: input (left) + output (right) */}
      <div
        className="flex items-center gap-2 px-2 py-2 shrink-0"
        style={{ borderBottom: '1px solid #222226' }}
      >
        {/* Input jack — top left */}
        <div
          data-jack-port={`${sectionId}-in`}
          data-jack-active={active ? 'true' : 'false'}
          className="rounded-full shrink-0"
          style={{
            width: 22,
            height: 22,
            background: active
              ? `radial-gradient(circle, #0a0a0a 35%, ${SECTION_COLORS[sectionId] ?? '#555'} 50%, #888 58%, #555 68%, #333 100%)`
              : 'radial-gradient(circle, #0a0a0a 40%, #444 55%, #666 60%, #444 70%, #222 100%)',
            boxShadow: active
              ? `inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05), 0 0 6px ${SECTION_COLORS[sectionId] ?? '#555'}40`
              : 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'box-shadow 0.2s ease',
          }}
        />
        {Icon && <Icon size={14} style={{ color: '#888' }} />}
        <span
          className="text-xs font-medium tracking-wide uppercase flex-1"
          style={{ color: '#888' }}
        >
          {title}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: '#555',
            background: '#25252a',
          }}
        >
          {count}
        </span>

        {/* Output jack — top right */}
        <div
          data-jack-port={`${sectionId}-out`}
          data-jack-active={active ? 'true' : 'false'}
          className="rounded-full shrink-0"
          style={{
            width: 22,
            height: 22,
            background: active
              ? `radial-gradient(circle, #0a0a0a 35%, ${SECTION_COLORS[sectionId] ?? '#555'} 50%, #888 58%, #555 68%, #333 100%)`
              : 'radial-gradient(circle, #0a0a0a 40%, #444 55%, #666 60%, #444 70%, #222 100%)',
            boxShadow: active
              ? `inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05), 0 0 6px ${SECTION_COLORS[sectionId] ?? '#555'}40`
              : 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'box-shadow 0.2s ease',
          }}
        />
      </div>

      {/* Content - scrollable grid of tiles */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
        style={{ maxHeight: 240 }}
      >
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          }}
        >
          {children}
        </div>
      </div>

      {/* Action button */}
      {actionLabel && onAction && (
        <div className="px-2 pb-2 pt-1 shrink-0">
          <button
            type="button"
            onClick={onAction}
            className="w-full py-1.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors"
            style={{
              background: 'transparent',
              border: '1px solid #2a2a30',
              color: '#555',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FE5000';
              e.currentTarget.style.color = '#FE5000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a30';
              e.currentTarget.style.color = '#555';
            }}
          >
            {actionLabel}
          </button>
        </div>
      )}


    </div>
  );
}
