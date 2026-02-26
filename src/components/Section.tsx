import type { ReactNode, ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { SECTION_ICON_MAP } from './icons/SectionIcons';

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
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid #222226' }}
      >
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

      {/* Jack port */}
      <div className="flex justify-center pb-2">
        <div
          data-jack-port={sectionId}
          data-jack-active={active ? 'true' : 'false'}
          className="w-3 h-3 rounded-full border-2 transition-all"
          style={{
            borderColor: active ? '#888' : '#333',
            background: active ? '#555' : '#222',
            boxShadow: active ? '0 0 6px rgba(136,136,136,0.3)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
