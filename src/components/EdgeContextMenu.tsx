import { Trash2 } from 'lucide-react';
import { useTheme } from '../theme';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

export function EdgeContextMenu({ x, y, onDelete, onClose }: EdgeContextMenuProps) {
  const t = useTheme();

  return (
    <div
      className="fixed z-50"
      style={{ top: y, left: x }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="relative rounded-lg shadow-xl overflow-hidden"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          minWidth: 140,
        }}
      >
        <button
          className="nodrag nowheel flex items-center gap-2 w-full px-3 py-2 text-[14px] transition-colors"
          style={{ color: t.textPrimary }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => { onDelete(); onClose(); }}
        >
          <Trash2 size={13} style={{ color: t.statusError }} />
          <span>Delete cable</span>
        </button>
      </div>
    </div>
  );
}
