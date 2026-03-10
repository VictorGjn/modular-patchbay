import { type ReactNode } from 'react';
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
  const fontSize = size === 'sm' ? 9 : 10;
  const py = size === 'sm' ? 6 : 8;

  return (
    <div className="flex gap-1 overflow-x-auto shrink-0" style={{ borderBottom: `1px solid ${t.borderSubtle}`, scrollbarWidth: 'none' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className="flex items-center gap-1 justify-center px-3 cursor-pointer border-none bg-transparent whitespace-nowrap tracking-wider uppercase font-semibold nodrag"
          style={{
            paddingTop: py,
            paddingBottom: py,
            fontSize,
            fontFamily: "'Geist Mono', monospace",
            color: active === tab.id ? '#FE5000' : t.textDim,
            borderBottom: active === tab.id ? '2px solid #FE5000' : '2px solid transparent',
            transition: 'color 0.15s',
          }}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-[12px] px-1 rounded-full" style={{
              background: active === tab.id ? '#FE500020' : t.badgeBg,
              color: active === tab.id ? '#FE5000' : t.textMuted,
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
