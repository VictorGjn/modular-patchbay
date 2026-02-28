import { useState, useEffect, useRef, useMemo, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useConsoleStore, type ExportTarget } from '../store/consoleStore';
import { useTheme } from '../theme';
import {
  X, Brain, Code, Search, BarChart3, PenTool, FileText, Globe, Layers,
  Zap, Database, Shield, Settings, Sparkles, Target, BookOpen, Lightbulb,
  Copy, Download, Check, Terminal, Box, LayoutGrid, Cpu, Package,
  type LucideIcon,
} from 'lucide-react';
import { exportForTarget, downloadAgentFile, downloadAllTargets, TARGET_META, type ExportConfig } from '../utils/agentExport';
import { exportAgentYaml } from '../utils/agentExportYaml';

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
  { id: 'terminal', Icon: Terminal },
  { id: 'box', Icon: Box },
  { id: 'layout-grid', Icon: LayoutGrid },
  { id: 'cpu', Icon: Cpu },
];

const CATEGORIES = [
  'coding', 'research', 'analysis', 'writing', 'data', 'design', 'domain-specific', 'general',
] as const;

interface TargetCard {
  id: ExportTarget;
  name: string;
  ext: string;
  Icon: LucideIcon;
}

const TARGETS: TargetCard[] = [
  { id: 'claude', name: 'Claude Code', ext: '.md', Icon: Terminal },
  { id: 'amp', name: 'Amp', ext: '.yaml', Icon: Zap },
  { id: 'codex', name: 'Codex', ext: '.json', Icon: Cpu },
  { id: 'vibe-kanban', name: 'Vibe Kanban', ext: '.json', Icon: LayoutGrid },
  { id: 'openclaw', name: 'OpenClaw', ext: '.yaml', Icon: Package },
  { id: 'generic', name: 'Generic JSON', ext: '.json', Icon: Box },
];

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
  const exportTarget = useConsoleStore((s) => s.exportTarget);
  const setExportTarget = useConsoleStore((s) => s.setExportTarget);
  const agentConfig = useConsoleStore((s) => s.agentConfig);
  const connectors = useConsoleStore((s) => s.connectors);

  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const [previewFade, setPreviewFade] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  const handleFocusTrap = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

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
    agentConfig,
    connectors,
  }), [channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta, agentConfig, connectors]);

  const preview = useMemo(() => {
    return exportForTarget(exportTarget, config);
  }, [config, exportTarget]);

  // Fade animation on target switch
  const handleTargetSwitch = (target: ExportTarget) => {
    setPreviewFade(false);
    setExportTarget(target);
    setTimeout(() => setPreviewFade(true), 30);
  };

  const handleSave = () => {
    const name = agentMeta.name || 'modular-agent';
    const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const meta = TARGET_META[exportTarget];
    downloadAgentFile(preview, safeName, meta.ext);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportAll = () => {
    downloadAllTargets(config);
  };

  const handleExportYaml = () => {
    const yamlContent = exportAgentYaml();
    const name = agentMeta.name || 'modular-agent';
    const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!showSaveModal) return null;

  const selectedIcon = ICON_OPTIONS.find((i) => i.id === agentMeta.icon);
  const currentTarget = TARGETS.find((t) => t.id === exportTarget)!;

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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Save as agent"
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 880,
          maxHeight: '85vh',
          background: t.surface,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.97)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleFocusTrap}
      >
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
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Target selector row */}
        <div className="flex gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          {TARGETS.map((target) => {
            const isActive = exportTarget === target.id;
            return (
              <button
                key={target.id}
                type="button"
                onClick={() => handleTargetSwitch(target.id)}
                className="flex flex-col items-center gap-1 rounded-lg cursor-pointer border-none"
                style={{
                  width: 80,
                  padding: '8px 4px',
                  background: isActive ? '#FE500012' : 'transparent',
                  border: isActive ? '1.5px solid #FE5000' : `1.5px solid ${t.borderSubtle}`,
                  transition: 'all 0.12s ease',
                }}
              >
                <target.Icon size={18} style={{ color: isActive ? '#FE5000' : t.textMuted }} />
                <span
                  className="text-[10px] font-semibold leading-tight text-center"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    color: isActive ? '#FE5000' : t.textSecondary,
                  }}
                >
                  {target.name}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    background: isActive ? '#FE500020' : t.badgeBg,
                    color: isActive ? '#FE5000' : t.textDim,
                  }}
                >
                  {target.ext}
                </span>
              </button>
            );
          })}
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Form */}
          <div className="flex flex-col" style={{ width: 340, borderRight: `1px solid ${t.borderSubtle}` }}>
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
                <div className="grid grid-cols-10 gap-1">
                  {ICON_OPTIONS.map(({ id, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAgentMeta({ icon: id })}
                      className="flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none"
                      style={{
                        background: agentMeta.icon === id ? '#FE500020' : 'transparent',
                        border: agentMeta.icon === id ? '1px solid #FE500040' : `1px solid transparent`,
                        color: agentMeta.icon === id ? '#FE5000' : t.textMuted,
                        transition: 'all 0.1s ease',
                      }}
                    >
                      <Icon size={14} />
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
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
              <div className="flex gap-2">
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
                  Download
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${t.border}`,
                    color: copied ? t.statusSuccess : t.textSecondary,
                    transition: 'color 0.15s ease',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleExportAll}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer"
                style={{
                  background: 'transparent',
                  border: `1px solid ${t.borderSubtle}`,
                  color: t.textMuted,
                }}
              >
                <Package size={13} />
                Export All Targets
              </button>
              <button
                type="button"
                onClick={handleExportYaml}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer"
                style={{
                  background: 'transparent',
                  border: `1px solid ${t.borderSubtle}`,
                  color: t.textMuted,
                }}
              >
                <FileText size={13} />
                Export as YAML
              </button>
            </div>
          </div>

          {/* Right panel - Preview */}
          <div className="flex flex-col flex-1" style={{ background: t.isDark ? '#0d0d10' : '#f5f5f8' }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
              <div className="flex items-center gap-2">
                {selectedIcon && <selectedIcon.Icon size={14} style={{ color: '#FE5000' }} />}
                <span
                  className="text-xs font-bold tracking-[2px] uppercase"
                  style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}
                >
                  Preview
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    background: '#FE500018',
                    color: '#FE5000',
                  }}
                >
                  {currentTarget.name} {currentTarget.ext}
                </span>
              </div>
              <span
                className="text-[10px]"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                {preview.split('\n').length} lines
              </span>
            </div>

            <div
              className="flex-1 overflow-auto p-4"
              style={{
                opacity: previewFade ? 1 : 0,
                transition: 'opacity 0.12s ease',
              }}
            >
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
                    <span
                      dangerouslySetInnerHTML={{ __html: colorizeLine(line, exportTarget, t) }}
                    />
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function colorizeLine(line: string, target: ExportTarget, t: ReturnType<typeof useTheme>): string {
  const escaped = escapeHtml(line);
  if (!escaped.trim()) return ' ';

  const isJson = target === 'codex' || target === 'vibe-kanban' || target === 'generic';

  if (isJson) {
    // JSON syntax coloring
    return escaped
      .replace(/^(\s*)"(\w[\w_-]*)"\s*:/gm, (_, ws, key) =>
        `${ws}<span style="color:#67d4e8">"${key}"</span>:`)
      .replace(/:\s*"([^"]*)"(,?)$/gm, (_, val, comma) =>
        `: <span style="color:#a8d4a0">"${val}"</span>${comma}`)
      .replace(/:\s*(\d+\.?\d*)(,?)$/gm, (_, num, comma) =>
        `: <span style="color:#d4a86a">${num}</span>${comma}`)
      .replace(/:\s*(true|false|null)(,?)$/gm, (_, kw, comma) =>
        `: <span style="color:#d4a86a">${kw}</span>${comma}`);
  }

  // YAML / Markdown syntax coloring
  if (escaped === '---') return `<span style="color:#FE5000">${escaped}</span>`;
  if (escaped.startsWith('##') || escaped.startsWith('# '))
    return `<span style="color:${t.textPrimary}">${escaped}</span>`;
  if (/^\s*#/.test(escaped))
    return `<span style="color:${t.isDark ? '#666' : '#999'}">${escaped}</span>`;
  if (/^\w[\w_-]*\s*:/.test(escaped)) {
    const colonIdx = escaped.indexOf(':');
    const key = escaped.slice(0, colonIdx);
    const rest = escaped.slice(colonIdx);
    return `<span style="color:#67d4e8">${key}</span>${rest}`;
  }
  if (/^\s{2,}\w[\w_-]*\s*:/.test(escaped)) {
    const match = escaped.match(/^(\s+)(\w[\w_-]*)(:.*)/);
    if (match) return `${match[1]}<span style="color:#67d4e8">${match[2]}</span>${match[3]}`;
  }
  if (/^\s+-\s/.test(escaped))
    return `<span style="color:${t.textSecondary}">${escaped}</span>`;
  if (/^\d+\./.test(escaped))
    return `<span style="color:${t.textSecondary}">${escaped}</span>`;
  return `<span style="color:${t.textMuted}">${escaped}</span>`;
}
