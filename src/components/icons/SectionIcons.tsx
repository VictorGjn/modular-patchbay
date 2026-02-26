import { BookOpen, Plug, Zap, Bot, ArrowUpRight, FileText, Presentation, Mail, Code, Table2, Braces, GitFork, MessageSquare, Mic, Cloud, BarChart3, Anchor, GitBranch, Palette, Hash, Flame, Database, Hexagon, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

// Section header icons
export const SECTION_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  knowledge: BookOpen,
  mcp: Plug,
  skills: Zap,
  agents: Bot,
  output: ArrowUpRight,
};

// Output format icons
export const OUTPUT_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  markdown: FileText,
  'html-slides': Presentation,
  email: Mail,
  code: Code,
  csv: Table2,
  json: Braces,
  diagram: GitFork,
  slack: MessageSquare,
};

// Skill icons
export const SKILL_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  presentation: Presentation,
  mic: Mic,
  cloud: Cloud,
  code: Code,
  'bar-chart-3': BarChart3,
  anchor: Anchor,
  'git-branch': GitBranch,
  palette: Palette,
};

// MCP server icons
export const MCP_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  mail: Mail,
  hash: Hash,
  github: GitBranch,
  'file-text': FileText,
  hexagon: Hexagon,
  flame: Flame,
  database: Database,
};

export function McpIcon({ icon, size = 14, ...props }: { icon: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = MCP_ICON_MAP[icon];
  if (!Icon) return <Plug size={size} {...props} />;
  return <Icon size={size} {...props} />;
}

export function SkillIcon({ icon, size = 14, ...props }: { icon: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = SKILL_ICON_MAP[icon];
  if (!Icon) return <Zap size={size} {...props} />;
  return <Icon size={size} {...props} />;
}

export function OutputIcon({ formatId, size = 14, ...props }: { formatId: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = OUTPUT_ICON_MAP[formatId];
  if (!Icon) return <FileText size={size} {...props} />;
  return <Icon size={size} {...props} />;
}
