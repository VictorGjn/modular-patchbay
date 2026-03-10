import {
  Bot, Brain, Zap, Flame, Lightbulb, Target, Rocket, Shield,
  Microscope, BarChart3, Palette, FileText, Drama, Star, Gem,
  Bird, Bug, Cat, Dog, Heart,
} from 'lucide-react';
import { useTheme } from '../../theme';

const AVATAR_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  bot: Bot, brain: Brain, zap: Zap, flame: Flame, lightbulb: Lightbulb,
  target: Target, rocket: Rocket, shield: Shield, microscope: Microscope,
  chart: BarChart3, palette: Palette, file: FileText, drama: Drama,
  star: Star, gem: Gem, bird: Bird, bug: Bug, cat: Cat, dog: Dog, heart: Heart,
};

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

  const sizes = { sm: 24, md: 32, lg: 48 };
  const iconSizes = { sm: 12, md: 16, lg: 22 };
  const textSizes = { sm: 10, md: 12, lg: 16 };

  const avatarSize = sizes[size];
  const iconSize = iconSizes[size];
  const textSize = textSizes[size];

  // Check if emoji is actually an icon ID
  const IconComponent = emoji ? AVATAR_ICONS[emoji] : undefined;

  return (
    <div
      className={`flex items-center justify-center rounded-full overflow-hidden shrink-0 ${className}`}
      style={{
        width: avatarSize,
        height: avatarSize,
        background: t.surfaceElevated,
        border: `1px solid ${t.border}`,
        fontSize: textSize,
        fontFamily: "'Geist Mono', monospace",
        color: t.textSecondary,
      }}
    >
      {src ? (
        <img src={src} alt={alt || 'Avatar'} className="w-full h-full object-cover" />
      ) : IconComponent ? (
        <IconComponent size={iconSize} />
      ) : emoji ? (
        <span>{emoji}</span>
      ) : initials ? (
        <span className="font-semibold uppercase">{initials.slice(0, 2)}</span>
      ) : (
        <Bot size={iconSize} />
      )}
    </div>
  );
}