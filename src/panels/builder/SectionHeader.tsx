import type { ReactNode } from 'react';
import { useTheme } from '../../theme';
import { ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react';

interface SectionHeaderProps {
  label: string;
  color: string;
  collapsed: boolean;
  onToggle: () => void;
  right?: ReactNode;
}

export function SectionHeader({ label, color, collapsed, onToggle, right }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 20px',
      userSelect: 'none', borderTop: '1px solid var(--m-border-subtle)', background: `color-mix(in oklch, ${color} 5%, transparent)`,
    }}>
      <button type="button" onClick={onToggle} aria-expanded={!collapsed}
        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, textAlign: 'left' }}>
        {collapsed ? <ChevronRight size={12} style={{ color: 'var(--m-text-dim)' }} /> : <ChevronDown size={12} style={{ color: 'var(--m-text-dim)' }} />}
        <div style={{ width: 3, height: 14, borderRadius: 2, background: color, opacity: 0.8 }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--m-font-mono)', color: 'var(--m-text-primary)' }}>{label}</span>
      </button>
      {right}
    </div>
  );
}

export function GenerateBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} disabled={loading}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', border: 'none', background: 'var(--m-accent-bg)', color: 'var(--m-accent)', fontFamily: 'var(--m-font-mono)' }}>
      {loading ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={9} />}
      Generate
    </button>
  );
}
