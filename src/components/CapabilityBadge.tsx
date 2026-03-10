import { type CapabilityStatus } from '../capabilities';
import { Tooltip } from './ds/Tooltip';

export interface CapabilityBadgeProps {
  label: string;
  status: CapabilityStatus;
  note?: string;
}

const STATUS_CONFIG: Record<CapabilityStatus, { icon: string; color: string; bg: string }> = {
  supported:   { icon: '✓', color: '#2ecc71', bg: '#2ecc7115' },
  degraded:    { icon: '◐', color: '#f1c40f', bg: '#f1c40f15' },
  unsupported: { icon: '✗', color: '#e74c3c', bg: '#e74c3c15' },
};

export function CapabilityBadge({ label, status, note }: CapabilityBadgeProps) {
  const config = STATUS_CONFIG[status];
  const badge = (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-semibold uppercase tracking-wider"
      style={{ background: config.bg, color: config.color, fontFamily: "'Geist Mono', monospace", border: `1px solid ${config.color}25` }}
      aria-label={`${label}: ${status}${note ? ` — ${note}` : ''}`}
    >
      <span>{config.icon}</span>
      <span>{label}</span>
    </span>
  );
  if (note) return <Tooltip content={note}>{badge}</Tooltip>;
  return badge;
}
