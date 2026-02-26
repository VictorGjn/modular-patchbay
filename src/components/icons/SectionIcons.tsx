import { BookOpen, Plug, Zap, Bot, ArrowUpRight, FileText, Presentation, Mail, Code, Table2, Braces, GitFork, MessageSquare, Mic, Cloud, BarChart3, Anchor, GitBranch, Palette, Hash, Flame, Database, Hexagon, Users, HardDrive, Search, Image, Map, Sparkles, Compass, Waves, Box, Layout, Wrench, Cpu, PenTool, Target, Workflow, ClipboardList, Globe, Folder, Shield, Brain, Triangle, type LucideProps } from 'lucide-react';
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

// Unified icon map used by marketplace and all icon resolvers
export const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  // Skills
  presentation: Presentation,
  mic: Mic,
  cloud: Cloud,
  code: Code,
  'bar-chart-3': BarChart3,
  anchor: Anchor,
  'git-branch': GitBranch,
  palette: Palette,
  search: Search,
  image: Image,
  'book-open': BookOpen,
  hexagon: Hexagon,
  workflow: Workflow,
  map: Map,
  sparkles: Sparkles,
  compass: Compass,
  waves: Waves,
  box: Box,
  layout: Layout,
  wrench: Wrench,
  cpu: Cpu,
  triangle: Triangle,
  'pen-tool': PenTool,
  // MCP servers
  mail: Mail,
  hash: Hash,
  github: GitBranch,
  'file-text': FileText,
  flame: Flame,
  database: Database,
  globe: Globe,
  folder: Folder,
  target: Target,
  'clipboard-list': ClipboardList,
  'hard-drive': HardDrive,
  shield: Shield,
  brain: Brain,
};

// Legacy maps (kept for backward compat with existing nodes)
export const SKILL_ICON_MAP = ICON_MAP;
export const MCP_ICON_MAP = ICON_MAP;

export function McpIcon({ icon, size = 14, ...props }: { icon: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = ICON_MAP[icon];
  if (!Icon) return <Plug size={size} {...props} />;
  return <Icon size={size} {...props} />;
}

export function SkillIcon({ icon, size = 14, ...props }: { icon: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = ICON_MAP[icon];
  if (!Icon) return <Zap size={size} {...props} />;
  return <Icon size={size} {...props} />;
}

export function OutputIcon({ formatId, size = 14, ...props }: { formatId: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = OUTPUT_ICON_MAP[formatId];
  if (!Icon) return <FileText size={size} {...props} />;
  return <Icon size={size} {...props} />;
}

// Connector service icons
export const CONNECTOR_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  notion: BookOpen,
  slack: MessageSquare,
  hubspot: Users,
  granola: FileText,
  github: GitBranch,
  'google-drive': HardDrive,
  custom: Plug,
};

export function ConnectorIcon({ service, size = 14, ...props }: { service: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = CONNECTOR_ICON_MAP[service];
  if (!Icon) return <Plug size={size} {...props} />;
  return <Icon size={size} {...props} />;
}

/** Generic icon resolver — used by Marketplace */
export function RegistryIcon({ icon, size = 14, ...props }: { icon: string; size?: number } & Omit<LucideProps, 'size'>) {
  const Icon = ICON_MAP[icon];
  if (!Icon) return <Zap size={size} {...props} />;
  return <Icon size={size} {...props} />;
}
