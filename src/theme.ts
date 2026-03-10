import { useThemeStore } from './store/themeStore';

const dark = {
  bg: '#111114',
  surface: 'rgba(28, 28, 32, 0.9)',
  surfaceOpaque: '#1c1c20',
  surfaceElevated: '#25252a',
  surfaceHover: '#1f1f24',
  border: '#2a2a30',
  borderSubtle: '#222226',
  textPrimary: '#f0f0f0',
  textSecondary: '#888',
  textMuted: '#666',
  textDim: '#555',
  textFaint: '#444',
  inputBg: '#141417',
  badgeBg: '#25252a',
  dotGrid: '#222228',
  minimapBg: '#111114',
  minimapMask: 'rgba(17,17,20,0.8)',
  minimapNode: '#25252a',
  controlsBg: '#1c1c20',
  controlsBorder: '#2a2a30',
  // Tile
  tileActiveBg: '#25252a',
  tileHoverBg: '#1f1f24',
  tileBg: '#1c1c20',
  tileBorderHover: '#3a3a40',
  // Agent preview
  agentBg: '#151210',
  agentBorder: '#2d2720',
  agentLabel: '#9a8e82',
  agentMeta: '#6d6058',
  agentArrow: '#6d6058',
  agentLineNum: '#2d2720',
  agentText: '#8a7e72',
  // Token budget
  tokenLabel: '#999',
  tokenDivider: '#777',
  tokenTrackBg: '#25252a',
  // Jack port ring in light vs dark
  jackRingBase: '#0a0a0a',
  jackLabelOnRing: '#999',
  jackLabelBeside: '#666',
  // Cable shadow
  cableShadow: 'rgba(0,0,0,0.4)',
  cableHighlight: 'rgba(255,255,255,0.06)',
  // Response
  responseBg: 'rgba(28, 28, 32, 0.9)',
  responseText: '#bbb',
  // Status
  statusSuccess: '#00ff88',
  statusError: '#ff3344',
  statusWarning: '#ffaa00',
  statusInfo: '#3498db',
  statusSuccessBg: 'rgba(0,255,136,0.07)',
  statusErrorBg: 'rgba(255,51,68,0.08)',
  statusWarningBg: 'rgba(255,170,0,0.08)',
  statusSuccessGlow: '0 0 6px rgba(0,255,136,0.5)',
  statusErrorGlow: '0 0 6px rgba(255,51,68,0.5)',
  statusWarningGlow: '0 0 6px rgba(255,170,0,0.5)',
  // Semantic cable/port colors (these are "role" colors, not status)
  cableSkills: '#f1c40f',
  cableMcp: '#2ecc71',
  cableKnowledge: '#e74c3c',
};

const light = {
  bg: '#f0f1f3',
  surface: 'rgba(255,255,255,0.95)',
  surfaceOpaque: '#ffffff',
  surfaceElevated: '#eeeef2',
  surfaceHover: '#f5f5f8',
  border: '#ccccd4',
  borderSubtle: '#dddde2',
  textPrimary: '#1a1a20',
  textSecondary: '#3a3a45',
  textMuted: '#555560',
  textDim: '#5c5c66',
  textFaint: '#71717a',
  inputBg: '#f5f5f8',
  badgeBg: '#e5e5ea',
  dotGrid: '#d0d0d8',
  minimapBg: '#f0f1f3',
  minimapMask: 'rgba(240,241,243,0.8)',
  minimapNode: '#dddde2',
  controlsBg: '#ffffff',
  controlsBorder: '#ccccd4',
  // Tile
  tileActiveBg: '#e8e8ee',
  tileHoverBg: '#f0f0f5',
  tileBg: '#ffffff',
  tileBorderHover: '#bbbbc4',
  // Agent preview
  agentBg: '#f8f8fa',
  agentBorder: '#dddde2',
  agentLabel: '#555560',
  agentMeta: '#888890',
  agentArrow: '#888890',
  agentLineNum: '#ccccd4',
  agentText: '#666670',
  // Token budget
  tokenLabel: '#555560',
  tokenDivider: '#888890',
  tokenTrackBg: '#dddde2',
  // Jack port
  jackRingBase: '#e8e8ee',
  jackLabelOnRing: '#555',
  jackLabelBeside: '#777',
  // Cable shadow
  cableShadow: 'rgba(0,0,0,0.12)',
  cableHighlight: 'rgba(255,255,255,0.3)',
  // Response
  responseBg: 'rgba(255,255,255,0.95)',
  responseText: '#444',
  // Status
  statusSuccess: '#16a34a',
  statusError: '#dc2626',
  statusWarning: '#ca8a04',
  statusInfo: '#2563eb',
  statusSuccessBg: 'rgba(22,163,74,0.08)',
  statusErrorBg: 'rgba(220,38,38,0.08)',
  statusWarningBg: 'rgba(202,138,4,0.08)',
  statusSuccessGlow: '0 0 6px rgba(22,163,74,0.3)',
  statusErrorGlow: '0 0 6px rgba(220,38,38,0.3)',
  statusWarningGlow: '0 0 6px rgba(202,138,4,0.3)',
  // Semantic cable/port colors
  cableSkills: '#B45309',
  cableMcp: '#16a34a',
  cableKnowledge: '#dc2626',
};

export type ThemePalette = typeof dark;

export function useTheme(): ThemePalette & { isDark: boolean } {
  const theme = useThemeStore((s) => s.theme);
  const palette = theme === 'dark' ? dark : light;
  return { ...palette, isDark: theme === 'dark' };
}
