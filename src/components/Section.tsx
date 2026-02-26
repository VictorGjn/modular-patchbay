import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  emoji: string;
  count: number;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function Section({ title, emoji, count, children, actionLabel, onAction }: SectionProps) {
  return (
    <div
      className="flex flex-col rounded-md overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #161311, #131110)',
        border: '1px solid #2d2720',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid #1e1a17' }}
      >
        <span style={{ fontSize: 12 }}>{emoji}</span>
        <span
          className="text-[9px] tracking-[1.5px] uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
        >
          {title}
        </span>
        <span
          className="text-[8px] px-1.5 py-0.5 rounded-full ml-1"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: '#5a4e42',
            background: '#1e1a17',
          }}
        >
          {count}
        </span>
      </div>

      {/* Content - scrollable grid of tiles */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
        style={{ maxHeight: 220 }}
      >
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
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
            className="w-full py-1.5 rounded text-[9px] tracking-[1.5px] uppercase cursor-pointer transition-colors"
            style={{
              fontFamily: "'Space Mono', monospace",
              background: 'transparent',
              border: '1px solid #2d2720',
              color: '#5a4e42',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#FE5000';
              e.currentTarget.style.color = '#FE5000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2d2720';
              e.currentTarget.style.color = '#5a4e42';
            }}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
