import { useTheme } from '../theme';
import { type CapabilityKey, type CapabilityMatrix, validateAgentCapabilities } from '../capabilities';
import { AlertTriangle, XCircle } from 'lucide-react';

export interface CapabilityGateProps {
  matrix: CapabilityMatrix;
  requiredCapabilities: CapabilityKey[];
}

export function CapabilityGate({ matrix, requiredCapabilities }: CapabilityGateProps) {
  const t = useTheme();
  if (requiredCapabilities.length === 0) return null;
  const validations = validateAgentCapabilities(matrix, requiredCapabilities);
  const errors = validations.filter((v) => v.level === 'error');
  const warnings = validations.filter((v) => v.level === 'warning');
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {errors.map((v) => (
        <div key={v.capability} className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: t.statusErrorBg, color: t.statusError, border: `1px solid ${t.statusError}30` }} role="alert">
          <XCircle size={12} className="shrink-0 mt-0.5" />
          <span>{v.message}</span>
        </div>
      ))}
      {warnings.map((v) => (
        <div key={v.capability} className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: t.statusWarningBg, color: t.statusWarning, border: `1px solid ${t.statusWarning}30` }} role="status">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{v.message}</span>
        </div>
      ))}
    </div>
  );
}
