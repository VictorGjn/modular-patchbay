import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
}

export function Select({ options, value, onChange, label, placeholder = 'Select...', size = 'md' }: SelectProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, w: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  const heights = { sm: 28, md: 32 };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const handleOpen = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ x: rect.left, y: rect.bottom + 4, w: rect.width });
    setOpen(!open);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        className="flex items-center justify-between gap-2 w-full rounded-lg cursor-pointer border outline-none nodrag"
        style={{
          height: heights[size],
          padding: '0 10px',
          fontSize: 13,
          fontFamily: "'Geist Mono', monospace",
          background: t.inputBg,
          borderColor: t.border,
          color: selected ? t.textPrimary : t.textMuted,
        }}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected?.icon}
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={12} style={{ color: t.textDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && createPortal(
        <div
          className="fixed z-[250] rounded-lg overflow-hidden py-1"
          style={{
            left: coords.x, top: coords.y, width: coords.w,
            background: t.surfaceElevated,
            border: `1px solid ${t.border}`,
            boxShadow: `0 8px 24px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'}`,
            maxHeight: 200, overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left cursor-pointer border-none bg-transparent"
              style={{
                fontFamily: "'Geist Mono', monospace",
                color: opt.value === value ? '#FE5000' : t.textSecondary,
                background: opt.value === value ? '#FE500008' : 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = t.isDark ? '#ffffff08' : '#00000005'}
              onMouseLeave={(e) => e.currentTarget.style.background = opt.value === value ? '#FE500008' : 'transparent'}
            >
              {opt.icon}
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && <Check size={10} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
