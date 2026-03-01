import {
  Bot, Brain as BrainIcon, Zap, Flame, Lightbulb, Target, Rocket, Shield,
  Microscope, BarChart3, Palette, FileText, Drama, Star, Gem, Bird, Bug, Cat, Dog, Heart,
} from 'lucide-react';

export const PRESET_AVATARS = [
  { id: 'bot', icon: Bot }, { id: 'brain', icon: BrainIcon }, { id: 'zap', icon: Zap },
  { id: 'flame', icon: Flame }, { id: 'lightbulb', icon: Lightbulb }, { id: 'target', icon: Target },
  { id: 'rocket', icon: Rocket }, { id: 'shield', icon: Shield }, { id: 'microscope', icon: Microscope },
  { id: 'chart', icon: BarChart3 }, { id: 'palette', icon: Palette }, { id: 'file', icon: FileText },
  { id: 'drama', icon: Drama }, { id: 'star', icon: Star }, { id: 'gem', icon: Gem },
  { id: 'bird', icon: Bird }, { id: 'bug', icon: Bug }, { id: 'cat', icon: Cat },
  { id: 'dog', icon: Dog }, { id: 'heart', icon: Heart },
];

export function AvatarIcon({ avatarId, size = 20 }: { avatarId: string; size?: number }) {
  const Icon = PRESET_AVATARS.find(a => a.id === avatarId)?.icon ?? Bot;
  return <Icon size={size} />;
}
