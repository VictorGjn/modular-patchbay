import { useTheme } from '../../theme';

export interface StatusIndicatorProps {
  status: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  label?: string;
  showDots?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  showDots = false,
  size = 'md',
  className = ''
}: StatusIndicatorProps) {
  const t = useTheme();

  const sizeMap = {
    sm: { dot: 6, font: 10, gap: 4 },
    md: { dot: 8, font: 12, gap: 6 },
    lg: { dot: 10, font: 14, gap: 8 }
  };

  const colors = {
    idle: t.textDim,
    loading: t.statusWarning,
    success: t.statusSuccess,
    error: t.statusError,
    warning: t.statusWarning
  };

  const backgrounds = {
    idle: t.textDim + '20',
    loading: t.statusWarningBg,
    success: t.statusSuccessBg,
    error: t.statusErrorBg,
    warning: t.statusWarningBg
  };

  const currentSize = sizeMap[size];
  const color = colors[status];
  const bg = backgrounds[status];

  const dotStyle: React.CSSProperties = {
    width: currentSize.dot,
    height: currentSize.dot,
    borderRadius: '50%',
    background: color,
    animation: status === 'loading' ? 'status-pulse 1.5s ease-in-out infinite' : undefined,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: currentSize.gap,
    padding: label ? '4px 8px' : '4px',
    borderRadius: 4,
    background: bg,
    border: `1px solid ${color}30`,
  };

  return (
    <div style={containerStyle} className={className}>
      <div style={dotStyle} />
      {showDots && status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{ ...dotStyle, animationDelay: '0.1s' }} />
          <div style={{ ...dotStyle, animationDelay: '0.2s' }} />
          <div style={{ ...dotStyle, animationDelay: '0.3s' }} />
        </div>
      )}
      {label && (
        <span style={{
          fontSize: currentSize.font,
          fontWeight: 500,
          color,
          fontFamily: "'Geist Mono', monospace"
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

// Multi-phase status indicator for complex operations
export interface MultiPhaseStatusProps {
  phases: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
  }>;
  className?: string;
}

export function MultiPhaseStatus({ phases, className = '' }: MultiPhaseStatusProps) {
  const t = useTheme();

  const getStatusColor = (status: MultiPhaseStatusProps['phases'][0]['status']) => {
    switch (status) {
      case 'pending': return t.textDim;
      case 'active': return t.statusWarning;
      case 'completed': return t.statusSuccess;
      case 'error': return t.statusError;
      default: return t.textDim;
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className={className}>
      {phases.map((phase, index) => (
        <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getStatusColor(phase.status),
              animation: phase.status === 'active' ? 'status-pulse 1.5s ease-in-out infinite' : undefined,
            }}
          />
          <span style={{
            fontSize: 12,
            fontWeight: phase.status === 'active' ? 600 : 400,
            color: getStatusColor(phase.status),
            fontFamily: "'Geist Mono', monospace"
          }}>
            {phase.label}
          </span>
          {index < phases.length - 1 && (
            <div style={{
              width: 16,
              height: 1,
              background: phase.status === 'completed' ? t.statusSuccess : t.borderSubtle,
              marginLeft: 8,
              marginRight: 8
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// Add this to src/styles/modules.css:
/*
@keyframes status-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}
*/