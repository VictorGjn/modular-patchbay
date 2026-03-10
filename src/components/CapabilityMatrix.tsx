import { useTheme } from '../theme';
import { type CapabilityMatrix as CapabilityMatrixType, CAPABILITY_KEYS, CAPABILITY_LABELS } from '../capabilities';
import { CapabilityBadge } from './CapabilityBadge';
import { Shield } from 'lucide-react';

export interface CapabilityMatrixProps {
  matrix: CapabilityMatrixType;
  providerName?: string;
}

export function CapabilityMatrixDisplay({ matrix, providerName }: CapabilityMatrixProps) {
  const t = useTheme();
  const supported = CAPABILITY_KEYS.filter((k) => matrix[k].status === 'supported').length;
  const degraded = CAPABILITY_KEYS.filter((k) => matrix[k].status === 'degraded').length;
  const unsupported = CAPABILITY_KEYS.filter((k) => matrix[k].status === 'unsupported').length;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.surfaceOpaque }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
        <Shield size={11} style={{ color: '#FE5000' }} />
        <span className="text-[13px] font-bold tracking-[0.12em] uppercase flex-1" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>
          {providerName ? `${providerName} Capabilities` : 'Runtime Capabilities'}
        </span>
        <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
          {supported}✓ {degraded > 0 ? `${degraded}◐ ` : ''}{unsupported > 0 ? `${unsupported}✗` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {CAPABILITY_KEYS.map((key) => (
          <CapabilityBadge key={key} label={CAPABILITY_LABELS[key]} status={matrix[key].status} note={matrix[key].note} />
        ))}
      </div>
    </div>
  );
}
