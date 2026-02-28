// Output Template definitions — structured output schemas for specific targets
// See docs/OUTPUT-AND-MEMORY-ARCHITECTURE.md for the full spec

export type OutputTarget = 'notion' | 'html-slides' | 'slack' | 'email';

// ─── Property Source Types ───────────────────────────────────────────
export type PropertySource = 'agent' | 'fixed' | 'context' | 'input' | 'computed';

export type NotionPropertyType = 'title' | 'select' | 'multi_select' | 'date' | 'rich_text' | 'number';

export interface NotionPropertyMapping {
  type: NotionPropertyType;
  value: string; // fixed value or mapping expression
  source: PropertySource;
  options?: string[]; // for select/multi_select
}

// ─── A) Notion Output Template ───────────────────────────────────────
export interface NotionTemplateConfig {
  target: 'notion';
  database_id: string;
  template: 'bug-report' | 'feature-request' | 'meeting-notes' | 'custom';
  properties: Record<string, NotionPropertyMapping>;
  content: 'template' | 'agent';
}

export const NOTION_TEMPLATES: { id: NotionTemplateConfig['template']; label: string; icon: string }[] = [
  { id: 'bug-report', label: 'Bug Report', icon: '🐛' },
  { id: 'feature-request', label: 'Feature Request', icon: '✨' },
  { id: 'meeting-notes', label: 'Meeting Notes', icon: '📝' },
  { id: 'custom', label: 'Custom', icon: '⚙️' },
];

export const NOTION_PROPERTY_TYPES: { id: NotionPropertyType; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'select', label: 'Select' },
  { id: 'multi_select', label: 'Multi-select' },
  { id: 'date', label: 'Date' },
  { id: 'rich_text', label: 'Rich Text' },
  { id: 'number', label: 'Number' },
];

export function defaultNotionConfig(): NotionTemplateConfig {
  return {
    target: 'notion',
    database_id: '',
    template: 'bug-report',
    properties: {
      Title: { type: 'title', value: '', source: 'agent' },
      Status: { type: 'select', value: 'New', source: 'fixed', options: ['New', 'In Progress', 'Done'] },
      Priority: { type: 'select', value: '', source: 'agent', options: ['P0', 'P1', 'P2', 'P3'] },
    },
    content: 'agent',
  };
}

// ─── B) HTML Slides Output Template ──────────────────────────────────
export type SlideStyle = 'neobrutalism' | 'minimal' | 'corporate' | 'dark' | 'glassmorphism';

export interface SlideSectionDef {
  type: 'title' | 'agenda' | 'content' | 'summary' | 'cta';
  title: string;
  bullets?: string[];
}

export interface HtmlSlidesTemplateConfig {
  target: 'html-slides';
  slideCount: number;
  style: SlideStyle;
  colors: { primary: string; secondary: string; accent: string };
  fonts: string; // font pairing key
  sections: SlideSectionDef[];
}

export const SLIDE_STYLES: { id: SlideStyle; label: string }[] = [
  { id: 'neobrutalism', label: 'Neobrutalism' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'dark', label: 'Dark' },
  { id: 'glassmorphism', label: 'Glassmorphism' },
];

export const FONT_PAIRINGS: { id: string; label: string }[] = [
  { id: 'space-mono-inter', label: 'Space Mono + Inter' },
  { id: 'playfair-source-sans', label: 'Playfair + Source Sans' },
  { id: 'jetbrains-mono-dm-sans', label: 'JetBrains Mono + DM Sans' },
  { id: 'outfit-inter', label: 'Outfit + Inter' },
  { id: 'bebas-neue-open-sans', label: 'Bebas Neue + Open Sans' },
];

export const SECTION_TYPES: { id: SlideSectionDef['type']; label: string }[] = [
  { id: 'title', label: 'Title Slide' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'content', label: 'Content' },
  { id: 'summary', label: 'Summary' },
  { id: 'cta', label: 'Call to Action' },
];

export function defaultHtmlSlidesConfig(): HtmlSlidesTemplateConfig {
  return {
    target: 'html-slides',
    slideCount: 8,
    style: 'neobrutalism',
    colors: { primary: '#FE5000', secondary: '#1a1a2e', accent: '#FFB800' },
    fonts: 'space-mono-inter',
    sections: [
      { type: 'title', title: 'Title Slide' },
      { type: 'agenda', title: 'Agenda' },
      { type: 'content', title: 'Key Findings' },
      { type: 'content', title: 'Analysis' },
      { type: 'summary', title: 'Summary' },
      { type: 'cta', title: 'Next Steps' },
    ],
  };
}

// ─── C) Slack / Email Output Template ────────────────────────────────
export type MessageTone = 'formal' | 'casual' | 'urgent';
export type MessageTemplate = 'weekly-update' | 'bug-alert' | 'release-notes' | 'custom';

export interface SlackEmailTemplateConfig {
  target: 'slack' | 'email';
  channel: string;
  thread: 'new' | 'reply';
  tone: MessageTone;
  template: MessageTemplate;
}

export const MESSAGE_TONES: { id: MessageTone; label: string }[] = [
  { id: 'formal', label: 'Formal' },
  { id: 'casual', label: 'Casual' },
  { id: 'urgent', label: 'Urgent' },
];

export const MESSAGE_TEMPLATES: { id: MessageTemplate; label: string; icon: string }[] = [
  { id: 'weekly-update', label: 'Weekly Update', icon: '📅' },
  { id: 'bug-alert', label: 'Bug Alert', icon: '🐛' },
  { id: 'release-notes', label: 'Release Notes', icon: '🚀' },
  { id: 'custom', label: 'Custom', icon: '✏️' },
];

export function defaultSlackEmailConfig(target: 'slack' | 'email'): SlackEmailTemplateConfig {
  return {
    target,
    channel: '',
    thread: 'new',
    tone: 'casual',
    template: 'weekly-update',
  };
}

// ─── Union type for all template configs ─────────────────────────────
export type OutputTemplateConfig = NotionTemplateConfig | HtmlSlidesTemplateConfig | SlackEmailTemplateConfig;

// ─── Target-to-default mapping ───────────────────────────────────────
export function defaultConfigForTarget(target: OutputTarget): OutputTemplateConfig {
  switch (target) {
    case 'notion': return defaultNotionConfig();
    case 'html-slides': return defaultHtmlSlidesConfig();
    case 'slack': return defaultSlackEmailConfig('slack');
    case 'email': return defaultSlackEmailConfig('email');
  }
}

// ─── Serializable output schema (for export) ─────────────────────────
export function templateConfigToSchema(config: OutputTemplateConfig): Record<string, unknown> {
  return { ...config };
}
