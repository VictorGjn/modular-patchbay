import { useTheme } from '../../theme';

export interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  variant?: 'rectangular' | 'circular' | 'text';
  lines?: number;
  className?: string;
}

export function SkeletonLoader({
  width = '100%',
  height = 16,
  variant = 'rectangular',
  lines = 1,
  className = ''
}: SkeletonLoaderProps) {
  const t = useTheme();

  const baseStyles: React.CSSProperties = {
    background: `linear-gradient(90deg, ${t.badgeBg} 25%, ${t.surfaceElevated} 50%, ${t.badgeBg} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'skeleton-loading 1.5s ease-in-out infinite',
    opacity: 0.8,
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'circular':
        return {
          borderRadius: '50%',
          width: typeof width === 'number' ? width : 32,
          height: typeof height === 'number' ? height : 32,
        };
      case 'text':
        return {
          borderRadius: 4,
          height: 16,
          width,
        };
      default: // rectangular
        return {
          borderRadius: 6,
          width,
          height,
        };
    }
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            style={{
              ...baseStyles,
              ...getVariantStyles(),
              width: index === lines - 1 ? '75%' : '100%', // Last line is shorter
            }}
            className={className}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        ...baseStyles,
        ...getVariantStyles(),
      }}
      className={className}
      aria-label="Loading..."
      role="progressbar"
    />
  );
}

// Add the CSS keyframes animation to the global styles if not already present
// This should be added to src/styles/modules.css:
/*
@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
*/