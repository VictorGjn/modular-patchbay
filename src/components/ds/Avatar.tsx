import { useTheme } from '../../theme';

export interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
  src?: string;
  alt?: string;
  emoji?: string;
  initials?: string;
  className?: string;
}

export function Avatar({ size = 'md', src, alt, emoji, initials, className = '' }: AvatarProps) {
  const t = useTheme();

  const sizes = {
    sm: 24,
    md: 32,
    lg: 48,
  };

  const textSizes = {
    sm: 10,
    md: 12,
    lg: 16,
  };

  const avatarSize = sizes[size];
  const textSize = textSizes[size];

  return (
    <div
      className={`flex items-center justify-center rounded-full overflow-hidden shrink-0 ${className}`}
      style={{
        width: avatarSize,
        height: avatarSize,
        background: t.surfaceElevated,
        border: `1px solid ${t.border}`,
        fontSize: textSize,
        fontFamily: "'Space Mono', monospace",
        color: t.textSecondary,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || 'Avatar'}
          className="w-full h-full object-cover"
        />
      ) : emoji ? (
        <span>{emoji}</span>
      ) : initials ? (
        <span className="font-semibold uppercase">{initials.slice(0, 2)}</span>
      ) : (
        <span>?</span>
      )}
    </div>
  );
}