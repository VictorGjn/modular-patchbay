// Shared constants — extracted from repeated inline values across components

export const FONT_MONO = "'Geist Mono', monospace";
export const FONT_SANS = "'Geist Sans', sans-serif";

export const COLORS = {
  accent: '#FE5000',
  accentDim: '#CC4000',
  bg: '#111114',
  surface: '#1c1c20',
  surfaceElevated: '#25252a',
  border: '#2a2a30',
  borderSubtle: '#222226',
  textPrimary: '#f0f0f0',
  textSecondary: '#888',
  textMuted: '#555',
  textDark: '#444',
  inputBg: '#141417',
  ledGreen: '#00ff88',
  ledRed: '#ff3344',
  ledAmber: '#ffaa00',
  vuGreen: '#2ecc71',
  vuAmber: '#ffaa00',
} as const;

export const TIMING = {
  vuFlashMs: 500,
  typewriterMs: 12,
  placeholderCycleMs: 4000,
  mockRunDelayMs: 1800,
  copyFeedbackMs: 1500,
  focusDelayMs: 100,
} as const;

export const SIZES = {
  channelStripWidth: 172,
  ghostChannelWidth: 140,
  vuSegments: 12,
} as const;

// Section color mapping for cables
export const SECTION_COLORS: Record<string, string> = {
  knowledge: '#3498db',
  mcp: '#2ecc71',
  skills: '#f1c40f',
  agents: '#9b59b6',
  output: '#FE5000',
} as const;
