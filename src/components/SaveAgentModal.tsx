import { useState, useEffect, useRef, useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';
import {
  X, Brain, Code, Search, BarChart3, PenTool, FileText, Globe, Layers,
  Zap, Database, Shield, Settings, Sparkles, Target, BookOpen, Lightbulb,
  Copy, Download, Check,
  type LucideIcon,
} from 'lucide-react';
import { exportAsAgent, exportAsJSON, exportAsYAML, downloadAgentFile, type ExportConfig } from '../utils/agentExport';

const ICON_OPTIONS: { id: string; Icon: LucideIcon }[] = [
  { id: 'brain', Icon: Brain },
  { id: 'code', Icon: Code },
  { id: 'search', Icon: Search },
  { id: 'bar-chart-3', Icon: BarChart3 },
  { id: 'pen-tool', Icon: PenTool },
  { id: 'file-text', Icon: FileText },
  { id: 'globe', Icon: Globe },
  { id: 'layers', Icon: Layers },
  { id: 'zap', Icon: Zap },
  { id: 'database', Icon: Database },
  { id: 'shield', Icon: Shield },
  { id: 'settings', Icon: Settings },
  { id: 'sparkles', Icon: Sparkles },
  { id: 'target', Icon: Target },
  { id: 'book-open', Icon: BookOpen },
  { id: 'lightbulb', Icon: Lightbulb },
];

const CATEGORIES = [
  'coding', 'research', 'analysis', 'writing', 'data', 'design', 'domain-specific', 'general',
] as const;

type ExportFormat = 'md' | 'json' | 'yaml';

export function SaveAgentModal() {
  const showSaveModal = useConsoleStore((s) => s.showSaveModal);
  const setShowSaveModal = useConsoleStore((s) => s.setShowSaveModal);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const setAgentMeta = useConsoleStore((s) => s.setAgentMeta);
  const channels = useConsoleStore((s) => s.channels);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const prompt = useConsoleStore((s) => s.prompt);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);

  const [exportFormat, setExportFormat] = useState<ExportFormat>('md');
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const t = useTheme();

  useEffect(() => {
    if (showSaveModal) {
      setVisible(true);
      setTimeout(() => nameRef.current?.focus(), 100);
    } else {
      setVisible(false);
    }
  }, [showSaveModal]);

  useEffect(() => {
    if (!showSaveModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSaveModal(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSaveModal, setShowSaveModal]);

  const config: ExportConfig = useMemo(() => ({
    channels,
    selectedModel,
    outputFormat,
    outputFormats,
    prompt,
    tokenBudget,
    mcpServers,
    skills,
    agentMeta,
  }), [channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta]);

  const preview = useMemo(() => {
    switch (exportFormat) {
      case 'md': return exportAsAgent(config);
      case 'json': return JSON.stringify(exportAsJSON(config), null, 2);
      case 'yaml': return exportAsYAML(config);
    }
  }, [config, exportFormat]);

  const handleSave = () => {
    const name = agentMeta.name || 'modular-agent';
    const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const extMap: Record<ExportFormat, string> = { md: '.md', json: '.json', yaml: '.yaml' };
    downloadAgentFile(preview, safeName, extMap[exportFormat]);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showSaveModal) return null;

  const selectedIcon = ICON_OPTIONS.find((i) => i.id === agentMeta.icon);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowSaveModal(false)}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      />

      {/* Modal */}
      <div
        className="relative flex rounded-xl overflow-hidden"
        style={{
          width: 780,
          maxHeight: '80vh',
          background: t.surface,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.97)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left panel - Form */}
        <div className="flex flex-col" style={{ width: 360, borderRight: `1px solid ${t.borderSubtle}` }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            <span
              className="text-xs font-bold tracking-[3px] uppercase"
              style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
            >
              SAVE AS AGENT
            </span>
            <button
              type="button"
              onClick={() => setShowSaveModal(false)}
              className="p-1 rounded-md cursor-pointer border-none"
              style={{ background: 'transparent', color: t.textMuted }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Agent Name */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
              >
                Agent Name
              </label>
              <input
                ref={nameRef}
                type="text"
                value={agentMeta.name}
                onChange={(e) => setAgentMeta({ name: e.target.value })}
                placeholder="my-analysis-agent"
                className="w-full outline-none text-sm rounded-lg px-3 py-2 nodrag"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
              >
                Description
              </label>
              <textarea
                value={agentMeta.description}
                onChange={(e) => setAgentMeta({ description: e.target.value })}
                placeholder="Deep research and synthesis agent..."
                className="w-full outline-none text-sm rounded-lg px-3 py-2 resize-none"
                rows={3}
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Icon picker */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
              >
                Icon
              </label>
              <div className="grid grid-cols-8 gap-1">
                {ICON_OPTIONS.map(({ id, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAgentMeta({ icon: id })}
                    className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer border-none"
                    style={{
                      background: agentMeta.icon === id ? '#FE500020' : 'transparent',
                      border: agentMeta.icon === id ? '1px solid #FE500040' : `1px solid transparent`,
                      color: agentMeta.icon === id ? '#FE5000' : t.textMuted,
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
              >
                Category
              </label>
              <select
                value={agentMeta.category}
                onChange={(e) => setAgentMeta({ category: e.target.value })}
                className="w-full outline-none text-sm rounded-lg px-3 py-2 cursor-pointer"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Export format toggle */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
              >
                Format
              </label>
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: t.inputBg, border: `1px solid ${t.border}` }}>
                {(['md', 'json', 'yaml'] as ExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-md cursor-pointer border-none uppercase tracking-wider"
                    style={{
                      background: exportFormat === fmt ? '#FE500018' : 'transparent',
                      color: exportFormat === fmt ? '#FE5000' : t.textMuted,
                      fontFamily: "'Space Mono', monospace",
                      transition: 'all 0.1s ease',
                    }}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer border-none"
              style={{
                background: '#FE5000',
                color: '#fff',
                boxShadow: '0 0 8px rgba(254,80,0,0.25)',
              }}
            >
              <Download size={13} />
              Save
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer"
              style={{
                background: 'transparent',
                border: `1px solid ${t.border}`,
                color: copied ? '#00ff88' : t.textSecondary,
                transition: 'color 0.15s ease',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex flex-col flex-1" style={{ background: t.isDark ? '#0d0d10' : '#f5f5f8' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            <div className="flex items-center gap-2">
              {selectedIcon && <selectedIcon.Icon size={14} style={{ color: '#FE5000' }} />}
              <span
                className="text-xs font-bold tracking-[2px] uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}
              >
                Preview
              </span>
            </div>
            <span
              className="text-[10px]"
              style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
            >
              {preview.split('\n').length} lines
            </span>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap break-all m-0"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: t.textSecondary,
              }}
            >
              {preview.split('\n').map((line, i) => (
                <div key={i} className="flex">
                  <span
                    className="inline-block text-right select-none shrink-0"
                    style={{ width: 32, color: t.textFaint, marginRight: 12 }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: colorizeLine(line, t) }}>
                    {line || ' '}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function colorizeLine(line: string, t: ReturnType<typeof useTheme>): string {
  if (line === '---') return '#FE5000';
  if (line.startsWith('##') || line.startsWith('# ')) return t.textPrimary;
  if (/^\w[\w_-]*:/.test(line)) return t.isDark ? '#c8a050' : '#8a6020';
  if (line.startsWith('  - ')) return t.textSecondary;
  return t.textMuted;
}
