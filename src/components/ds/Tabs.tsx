import { type ReactNode, useRef, useCallback } from 'react';
import { useTheme } from '../../theme';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
}

export function Tabs({ tabs, active, onChange, size = 'sm' }: TabsProps) {
  const t = useTheme();
  const fontSize = size === 'sm' ? 11 : 12;
  const py = size === 'sm' ? 6 : 8;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = index === 0 ? tabs.length - 1 : index - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = index === tabs.length - 1 ? 0 : index + 1;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
    }
    if (nextIndex !== null) {
      tabRefs.current[nextIndex]?.focus();
      onChange(tabs[nextIndex].id);
    }
  }, [tabs, onChange]);

  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto shrink-0"
      style={{ borderBottom: `1px solid ${t.borderSubtle}`, scrollbarWidth: 'none' }}
    >
      {tabs.map((tab, index) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            ref={el => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="flex items-center gap-1 justify-center px-3 cursor-pointer border-none bg-transparent whitespace-nowrap nodrag"
            style={{
              paddingTop: py,
              paddingBottom: py,
              fontSize,
              fontFamily: 'var(--m-font-mono)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--m-accent)' : t.textDim,
              borderBottom: isActive ? '2px solid var(--m-accent)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-[12px] px-1 rounded-full" style={{
                background: isActive ? 'var(--m-accent-bg)' : t.badgeBg,
                color: isActive ? 'var(--m-accent)' : t.textMuted,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
