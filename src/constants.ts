// Shared constants — extracted from repeated inline values across components

export const FONT_MONO = "'Space Mono', monospace";

export const COLORS = {
  accent: '#FE5000',
  accentDim: '#CC4000',
  borderPanel: '#2d2720',
  textLabel: '#b5a898',
  textMuted: '#5a4e42',
  textDark: '#3d3730',
  textDarkest: '#2d2720',
  textSecondary: '#8a7e72',
  textPrimary: '#e8e0d8',
  inputBg: '#0a0a0a',
  surfaceDark: '#1a1a1a',
  surface: '#111',
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
