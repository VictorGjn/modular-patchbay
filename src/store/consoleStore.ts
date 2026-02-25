import { create } from 'zustand';
import { type ChannelConfig, type Preset, PRESETS, DEPTH_LEVELS, KNOWLEDGE_TYPES, type OutputFormat, type KnowledgeType, detectOutputFormat } from './knowledgeBase';

export interface ConsoleState {
  channels: ChannelConfig[];
  prompt: string;
  selectedModel: string;
  selectedPreset: string;
  outputFormat: OutputFormat;
  tokenBudget: number;
  running: boolean;
  showFilePicker: boolean;
  mockResponse: string;

  // Computed
  totalTokens: () => number;

  // Actions
  loadPreset: (presetId: string) => void;
  setOutputFormat: (format: OutputFormat) => void;
  cycleKnowledgeType: (sourceId: string) => void;
  addChannel: (channel: Omit<ChannelConfig, 'enabled'>) => void;
  removeChannel: (sourceId: string) => void;
  toggleChannel: (sourceId: string) => void;
  setChannelDepth: (sourceId: string, depth: number) => void;
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setTokenBudget: (budget: number) => void;
  setShowFilePicker: (show: boolean) => void;
  run: () => void;
  clearChannels: () => void;
}

function getEffectiveTokens(ch: ChannelConfig): number {
  if (!ch.enabled) return 0;
  const level = DEPTH_LEVELS[ch.depth] ?? DEPTH_LEVELS[0];
  return Math.round(ch.baseTokens * level.pct);
}

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  channels: [],
  prompt: '',
  selectedModel: 'claude-opus-4',
  selectedPreset: '',
  outputFormat: 'markdown' as OutputFormat,
  tokenBudget: 200000,
  running: false,
  showFilePicker: false,
  mockResponse: '',

  totalTokens: () => {
    const { channels, prompt } = get();
    const channelTokens = channels.reduce((sum, ch) => sum + getEffectiveTokens(ch), 0);
    const promptTokens = Math.ceil(prompt.length / 4);
    return channelTokens + promptTokens;
  },

  loadPreset: (presetId: string) => {
    const preset: Preset | undefined = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const channels: ChannelConfig[] = preset.channels.map((ch) => ({ ...ch, enabled: true }));
    set({ channels, selectedPreset: presetId, mockResponse: '' });
  },

  setOutputFormat: (format: OutputFormat) => set({ outputFormat: format }),

  cycleKnowledgeType: (sourceId: string) => {
    const types: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
    set({
      channels: get().channels.map((ch) => {
        if (ch.sourceId !== sourceId) return ch;
        const idx = types.indexOf(ch.knowledgeType);
        return { ...ch, knowledgeType: types[(idx + 1) % types.length] };
      }),
    });
  },

  addChannel: (channel) => {
    const { channels } = get();
    if (channels.some((ch) => ch.sourceId === channel.sourceId)) return;
    set({ channels: [...channels, { ...channel, enabled: true }], selectedPreset: '' });
  },

  removeChannel: (sourceId: string) => {
    set({ channels: get().channels.filter((ch) => ch.sourceId !== sourceId), selectedPreset: '' });
  },

  toggleChannel: (sourceId: string) => {
    set({
      channels: get().channels.map((ch) =>
        ch.sourceId === sourceId ? { ...ch, enabled: !ch.enabled } : ch,
      ),
    });
  },

  setChannelDepth: (sourceId: string, depth: number) => {
    set({
      channels: get().channels.map((ch) =>
        ch.sourceId === sourceId ? { ...ch, depth: Math.max(0, Math.min(4, depth)) } : ch,
      ),
    });
  },

  setPrompt: (prompt: string) => {
    const detected = detectOutputFormat(prompt);
    set({ prompt, outputFormat: detected });
  },
  setModel: (model: string) => set({ selectedModel: model }),
  setTokenBudget: (budget: number) => set({ tokenBudget: budget }),
  setShowFilePicker: (show: boolean) => set({ showFilePicker: show }),

  run: () => {
    const { running, prompt, channels } = get();
    if (running) return;
    set({ running: true, mockResponse: '' });

    const activeChannels = channels.filter((ch) => ch.enabled);
    const sourceList = activeChannels.map((ch) => `  - ${KNOWLEDGE_TYPES[ch.knowledgeType].icon} ${ch.name} (${DEPTH_LEVELS[ch.depth].label}, ${KNOWLEDGE_TYPES[ch.knowledgeType].label})`).join('\n');
    const format = get().outputFormat;

    setTimeout(() => {
      set({
        running: false,
        mockResponse: `## Response from ${get().selectedModel}\n\n**Output format:** ${format}\n**Context loaded:** ${activeChannels.length} sources, ~${get().totalTokens().toLocaleString()} tokens\n\n**Sources (with epistemic weight):**\n${sourceList}\n\n**Prompt:** ${prompt || '(empty)'}\n\n---\n\n_This is a mock response. In production, each source would be injected with its knowledge type instruction (e.g., "${activeChannels[0] ? KNOWLEDGE_TYPES[activeChannels[0].knowledgeType].instruction : 'N/A'}")._`,
      });
    }, 1800);
  },

  clearChannels: () => set({ channels: [], selectedPreset: '', mockResponse: '' }),
}));

export { getEffectiveTokens };
