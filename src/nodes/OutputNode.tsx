import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS, type OutputFormat } from '../store/knowledgeBase';
import { Tooltip } from '../components/ds/Tooltip';
import { ConnectorTile } from '../components/ConnectorTile';
import { OutputIcon } from '../components/icons/SectionIcons';
import { Select } from '../components/ds/Select';
import { Input } from '../components/ds/Input';
import { Toggle } from '../components/ds/Toggle';
import { Chip } from '../components/ds/Chip';
import { Badge } from '../components/ds/Badge';
import { useTheme } from '../theme';
import { ArrowUpRight, ChevronDown, ChevronRight, LayoutGrid, List, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import {
  type OutputTarget,
  type OutputTemplateConfig,
  NOTION_TEMPLATES,
  NOTION_PROPERTY_TYPES,
  SLIDE_STYLES,
  FONT_PAIRINGS,
  SECTION_TYPES,
  MESSAGE_TONES,
  MESSAGE_TEMPLATES,

  type NotionTemplateConfig,
  type HtmlSlidesTemplateConfig,
  type SlackEmailTemplateConfig,
  type NotionPropertyType,
  type SlideSectionDef,
} from '../store/outputTemplates';

// ─── Template Config Sub-Components ──────────────────────────────────

function NotionConfig({ config, onChange }: { config: NotionTemplateConfig; onChange: (c: OutputTemplateConfig) => void }) {
  const t = useTheme();
  const [newPropName, setNewPropName] = useState('');

  return (
    <div className="flex flex-col gap-2 nodrag nowheel">
      <Input
        label="Database ID"
        placeholder="paste-database-id"
        value={config.database_id}
        onChange={(e) => onChange({ ...config, database_id: e.target.value })}
      />
      <Select
        label="Template"
        options={NOTION_TEMPLATES.map((nt) => ({ value: nt.id, label: `${nt.icon} ${nt.label}` }))}
        value={config.template}
        onChange={(v) => onChange({ ...config, template: v as NotionTemplateConfig['template'] })}
        size="sm"
      />

      {/* Property mapper */}
      <div className="flex flex-col gap-1 mt-1">
        <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Properties</span>
        {Object.entries(config.properties).map(([name, prop]) => (
          <div key={name} className="flex items-center gap-1 nodrag nowheel">
            <span className="text-[10px] truncate flex-1" style={{ color: t.textSecondary, fontFamily: "'Space Mono', monospace" }}>{name}</span>
            <select
              value={prop.type}
              onChange={(e) => {
                const newProps = { ...config.properties };
                newProps[name] = { ...prop, type: e.target.value as NotionPropertyType };
                onChange({ ...config, properties: newProps });
              }}
              className="text-[9px] px-1 py-0.5 rounded border-none outline-none nodrag"
              style={{ background: t.inputBg, color: t.textSecondary, fontFamily: "'Space Mono', monospace" }}
            >
              {NOTION_PROPERTY_TYPES.map((pt) => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
            </select>
            <Chip variant={prop.source === 'agent' ? 'info' : 'default'}>
              {prop.source}
            </Chip>
            <button
              type="button"
              onClick={() => {
                const newProps = { ...config.properties };
                delete newProps[name];
                onChange({ ...config, properties: newProps });
              }}
              className="p-0.5 border-none bg-transparent cursor-pointer nodrag"
              style={{ color: t.textFaint }}
              aria-label={`Remove ${name}`}
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1 mt-0.5">
          <input
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
            placeholder="Add property..."
            className="flex-1 text-[10px] px-2 py-1 rounded border-none outline-none nodrag nowheel"
            style={{ background: t.inputBg, color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}
          />
          <button
            type="button"
            onClick={() => {
              if (!newPropName.trim()) return;
              const newProps = { ...config.properties };
              newProps[newPropName.trim()] = { type: 'rich_text', value: '', source: 'agent' };
              onChange({ ...config, properties: newProps });
              setNewPropName('');
            }}
            className="p-1 border-none bg-transparent cursor-pointer nodrag"
            style={{ color: '#FE5000' }}
            aria-label="Add property"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Content mode */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Content</span>
        <Toggle
          checked={config.content === 'agent'}
          onChange={(v) => onChange({ ...config, content: v ? 'agent' : 'template' })}
          label={config.content === 'agent' ? 'Agent writes' : 'Template body'}
          size="sm"
        />
      </div>
    </div>
  );
}

function HtmlSlidesConfig({ config, onChange }: { config: HtmlSlidesTemplateConfig; onChange: (c: OutputTemplateConfig) => void }) {
  const t = useTheme();

  return (
    <div className="flex flex-col gap-2 nodrag nowheel">
      <div className="flex items-center gap-2">
        <span className="text-[9px] tracking-wider uppercase font-semibold flex-1" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Slides</span>
        <Badge>{config.slideCount}</Badge>
        <input
          type="range"
          min={3}
          max={20}
          value={config.slideCount}
          onChange={(e) => onChange({ ...config, slideCount: Number(e.target.value) })}
          className="w-16 nodrag nowheel"
          style={{ accentColor: '#FE5000' }}
        />
      </div>

      <Select
        label="Style"
        options={SLIDE_STYLES.map((s) => ({ value: s.id, label: s.label }))}
        value={config.style}
        onChange={(v) => onChange({ ...config, style: v as HtmlSlidesTemplateConfig['style'] })}
        size="sm"
      />

      <Select
        label="Font Pairing"
        options={FONT_PAIRINGS.map((f) => ({ value: f.id, label: f.label }))}
        value={config.fonts}
        onChange={(v) => onChange({ ...config, fonts: v })}
        size="sm"
      />

      {/* Brand colors */}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Brand Colors</span>
        <div className="flex items-center gap-2">
          {(['primary', 'secondary', 'accent'] as const).map((key) => (
            <div key={key} className="flex items-center gap-1 nodrag nowheel">
              <input
                type="color"
                value={config.colors[key]}
                onChange={(e) => onChange({ ...config, colors: { ...config.colors, [key]: e.target.value } })}
                className="w-5 h-5 border-none cursor-pointer rounded nodrag nowheel"
                style={{ padding: 0 }}
              />
              <span className="text-[8px] uppercase" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>{key.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Sections</span>
        {config.sections.map((sec, i) => (
          <div key={i} className="flex items-center gap-1 nodrag nowheel">
            <select
              value={sec.type}
              onChange={(e) => {
                const sections = [...config.sections];
                sections[i] = { ...sec, type: e.target.value as SlideSectionDef['type'] };
                onChange({ ...config, sections });
              }}
              className="text-[9px] px-1 py-0.5 rounded border-none outline-none nodrag"
              style={{ background: t.inputBg, color: t.textSecondary, fontFamily: "'Space Mono', monospace" }}
            >
              {SECTION_TYPES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
            <input
              value={sec.title}
              onChange={(e) => {
                const sections = [...config.sections];
                sections[i] = { ...sec, title: e.target.value };
                onChange({ ...config, sections });
              }}
              className="flex-1 text-[10px] px-1.5 py-0.5 rounded border-none outline-none nodrag nowheel"
              style={{ background: t.inputBg, color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}
            />
            <button
              type="button"
              onClick={() => {
                const sections = config.sections.filter((_, j) => j !== i);
                onChange({ ...config, sections });
              }}
              className="p-0.5 border-none bg-transparent cursor-pointer nodrag"
              style={{ color: t.textFaint }}
              aria-label="Remove section"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...config, sections: [...config.sections, { type: 'content', title: 'New Slide' }] })}
          className="text-[9px] px-2 py-1 rounded border-none cursor-pointer nodrag nowheel"
          style={{ background: '#FE500010', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}
        >
          + Add Section
        </button>
      </div>
    </div>
  );
}

function SlackEmailConfig({ config, onChange }: { config: SlackEmailTemplateConfig; onChange: (c: OutputTemplateConfig) => void }) {
  return (
    <div className="flex flex-col gap-2 nodrag nowheel">
      <Input
        label={config.target === 'slack' ? 'Channel' : 'Recipient'}
        placeholder={config.target === 'slack' ? '#channel-name' : 'email@example.com'}
        value={config.channel}
        onChange={(e) => onChange({ ...config, channel: e.target.value })}
      />
      <Select
        label="Thread Mode"
        options={[
          { value: 'new', label: 'New Thread' },
          { value: 'reply', label: 'Reply' },
        ]}
        value={config.thread}
        onChange={(v) => onChange({ ...config, thread: v as 'new' | 'reply' })}
        size="sm"
      />
      <Select
        label="Tone"
        options={MESSAGE_TONES.map((mt) => ({ value: mt.id, label: mt.label }))}
        value={config.tone}
        onChange={(v) => onChange({ ...config, tone: v as SlackEmailTemplateConfig['tone'] })}
        size="sm"
      />
      <Select
        label="Template"
        options={MESSAGE_TEMPLATES.map((mt) => ({ value: mt.id, label: `${mt.icon} ${mt.label}` }))}
        value={config.template}
        onChange={(v) => onChange({ ...config, template: v as SlackEmailTemplateConfig['template'] })}
        size="sm"
      />
    </div>
  );
}

// ─── Template Config Panel ───────────────────────────────────────────

function TemplateConfigPanel({ target }: { target: OutputTarget }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [brainDump, setBrainDump] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const outputTemplateConfig = useConsoleStore((s) => s.outputTemplateConfig);
  const setConfig = useConsoleStore((s) => s.setOutputTemplateConfig);

  const config = outputTemplateConfig[target] ?? null;

  const handleChange = (newConfig: OutputTemplateConfig) => {
    setConfig(target, newConfig);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const { generateOutputTemplate } = await import('../utils/refineOutputTemplate');
      const generated = await generateOutputTemplate(target, brainDump || 'Generate a sensible default');
      setConfig(target, generated);
      setHasGenerated(true);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const targetLabels: Record<OutputTarget, string> = {
    notion: 'Notion',
    'html-slides': 'HTML Slides',
    slack: 'Slack',
    email: 'Email',
  };

  const placeholders: Record<OutputTarget, string> = {
    notion: 'e.g. "Bug tracking database with severity, component, assignee, and resolution date"',
    'html-slides': 'e.g. "Q3 product review for executives, 10 slides, professional but modern"',
    slack: 'e.g. "Weekly standup summary to #engineering, casual tone"',
    email: 'e.g. "Client update email, formal, include metrics and next steps"',
  };

  return (
    <div className="flex flex-col" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-5 py-1.5 border-none bg-transparent cursor-pointer nodrag"
        style={{ color: t.textSecondary }}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000' }}>
          {targetLabels[target]} Config
        </span>
        {config && <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: '#22c55e15', color: '#22c55e', fontFamily: "'Space Mono', monospace" }}>configured</span>}
      </button>
      {expanded && (
        <div className="px-5 pb-2 flex flex-col gap-2">
          {/* Generate section — shown when no config exists or user wants to regenerate */}
          {(!config || !hasGenerated) && (
            <div className="flex flex-col gap-1.5 nodrag nowheel">
              <textarea
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                placeholder={placeholders[target]}
                rows={2}
                className="w-full text-[10px] px-2 py-1.5 rounded border-none outline-none resize-none nodrag nowheel"
                style={{
                  background: t.inputBg || t.surfaceElevated,
                  color: t.textPrimary,
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1.4,
                }}
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-semibold tracking-wide uppercase cursor-pointer border-none nodrag nowheel"
                style={{
                  background: generating ? '#FE500030' : '#FE500018',
                  color: '#FE5000',
                  fontFamily: "'Space Mono', monospace",
                  opacity: generating ? 0.7 : 1,
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => { if (!generating) e.currentTarget.style.background = '#FE500028'; }}
                onMouseLeave={(e) => { if (!generating) e.currentTarget.style.background = '#FE500018'; }}
              >
                {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {generating ? 'Generating...' : 'Generate ✨'}
              </button>
              {genError && (
                <span className="text-[9px]" style={{ color: t.statusError }}>{genError}</span>
              )}
            </div>
          )}

          {/* Editable config — shown after generation or when config exists */}
          {config && (
            <>
              {config.target === 'notion' && <NotionConfig config={config as NotionTemplateConfig} onChange={handleChange} />}
              {config.target === 'html-slides' && <HtmlSlidesConfig config={config as HtmlSlidesTemplateConfig} onChange={handleChange} />}
              {(config.target === 'slack' || config.target === 'email') && <SlackEmailConfig config={config as SlackEmailTemplateConfig} onChange={handleChange} />}

              {/* Regenerate button */}
              <div className="flex items-center gap-2 pt-1" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
                <button
                  type="button"
                  onClick={() => { setHasGenerated(false); }}
                  className="text-[9px] px-2 py-1 rounded border-none cursor-pointer nodrag nowheel"
                  style={{ background: 'transparent', color: t.textDim, fontFamily: "'Space Mono', monospace" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FE5000'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = t.textDim; }}
                >
                  ✨ Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    useConsoleStore.getState().removeOutputTemplateConfig(target);
                    setHasGenerated(false);
                    setBrainDump('');
                  }}
                  className="text-[9px] px-2 py-1 rounded border-none cursor-pointer nodrag nowheel"
                  style={{ background: 'transparent', color: t.textFaint, fontFamily: "'Space Mono', monospace" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = t.statusError; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = t.textFaint; }}
                >
                  Reset
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Determine which template targets are active ─────────────────────

const FORMAT_TO_TARGET: Partial<Record<OutputFormat, OutputTarget>> = {
  'html-slides': 'html-slides',
  slack: 'slack',
  email: 'email',
};

function useActiveTemplateTargets(): OutputTarget[] {
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const connectors = useConsoleStore((s) => s.connectors);

  const targets: OutputTarget[] = [];

  for (const fmt of outputFormats) {
    const target = FORMAT_TO_TARGET[fmt];
    if (target && !targets.includes(target)) targets.push(target);
  }

  const writeConnectors = connectors.filter((c) => (c.direction === 'write' || c.direction === 'both') && c.enabled);
  for (const c of writeConnectors) {
    if (c.service === 'notion' && !targets.includes('notion')) targets.push('notion');
    if (c.service === 'slack' && !targets.includes('slack')) targets.push('slack');
  }

  return targets;
}

// ─── Main OutputNode ─────────────────────────────────────────────────

export const OutputNode = memo(function OutputNode() {
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const toggleOutputFormat = useConsoleStore((s) => s.toggleOutputFormat);
  const connectors = useConsoleStore((s) => s.connectors);
  const toggleConnector = useConsoleStore((s) => s.toggleConnector);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const t = useTheme();

  const writeConnectors = connectors.filter((c) => c.direction === 'write' || c.direction === 'both');
  const activeTargets = useActiveTemplateTargets();

  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('output-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('output-node-view') as 'card' | 'list') || 'list'; } catch { return 'list'; }
  });

  useEffect(() => {
    try { localStorage.setItem('output-node-collapsed', String(nodeCollapsed)); } catch {}
  }, [nodeCollapsed]);
  useEffect(() => {
    try { localStorage.setItem('output-node-view', viewMode); } catch {}
  }, [viewMode]);

  const HANDLE: React.CSSProperties = { width: 8, height: 8, border: 'none', borderRadius: '50%' };

  return (
    <>
    <ResizeHandle minWidth={220} minHeight={100} />
    <div
      className="rounded-lg overflow-visible"
      style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.25)', width: 320, minWidth: 220 }}
    >
      <Handle type="target" position={Position.Left} id="output-in" style={{ ...HANDLE, top: '50%', left: -4, background: '#FE5000' }} />
      <Handle type="source" position={Position.Right} id="output-out" style={{ ...HANDLE, top: '50%', right: -4, background: '#FE5000' }} />

      <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-5" style={{ height: 40, background: t.surfaceElevated, borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.border}`, borderRadius: '8px 8px 0 0' }}>
        <button
          type="button"
          onClick={() => setNodeCollapsed(!nodeCollapsed)}
          aria-label={nodeCollapsed ? 'Expand output panel' : 'Collapse output panel'}
          className="p-0 border-none bg-transparent cursor-pointer nodrag"
          style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}
        >
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <ArrowUpRight size={14} style={{ color: t.textSecondary }} />
        <Tooltip content="Choose output format and destination connectors for your agent's responses">
          <span className="font-bold uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary, fontSize: 10, letterSpacing: '0.15em' }}>
            Output
          </span>
        </Tooltip>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {outputFormats.length}
        </span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              aria-label="Card view"
              className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ background: viewMode === 'card' ? '#FE500020' : 'transparent', color: viewMode === 'card' ? '#FE5000' : t.textFaint }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ background: viewMode === 'list' ? '#FE500020' : 'transparent', color: viewMode === 'list' ? '#FE5000' : t.textFaint }}
            >
              <List size={14} />
            </button>
          </div>
        )}
      </div>

      {nodeCollapsed ? null : <>
      {/* Format checkboxes */}
      <div className="p-3 overflow-y-auto nowheel flex-1 min-h-0">
        {viewMode === 'list' ? (
          <div className="flex flex-col gap-0.5">
            {OUTPUT_FORMATS.map((fmt) => {
              const active = outputFormats.includes(fmt.id);
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => toggleOutputFormat(fmt.id)}
                  aria-label={`${active ? 'Disable' : 'Enable'} ${fmt.label} format`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border-none text-left nodrag nowheel"
                  style={{
                    background: active ? t.surfaceElevated : 'transparent',
                    border: active ? '1px solid rgba(254,80,0,0.25)' : '1px solid transparent',
                    transition: 'background 120ms ease, border-color 120ms ease',
                  }}
                >
                  <div
                    className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: active ? '#FE5000' : 'transparent',
                      border: active ? '1px solid #FE5000' : `1px solid ${t.textFaint}`,
                      transition: 'background 120ms ease, border-color 120ms ease',
                    }}
                  >
                    {active && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{ color: active ? t.textSecondary : t.textDim }}>
                    <OutputIcon formatId={fmt.id} size={13} />
                  </div>
                  <span
                    className="text-[11px]"
                    style={{
                      color: active ? t.textPrimary : t.textSecondary,
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {fmt.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))' }}>
            {OUTPUT_FORMATS.map((fmt) => {
              const active = outputFormats.includes(fmt.id);
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => toggleOutputFormat(fmt.id)}
                  aria-label={`${active ? 'Disable' : 'Enable'} ${fmt.label} format`}
                  className="flex flex-col items-center gap-1 p-2 rounded-md cursor-pointer border-none nodrag nowheel"
                  style={{
                    background: active ? t.surfaceElevated : 'transparent',
                    border: active ? '1px solid rgba(254,80,0,0.25)' : `1px solid ${t.borderSubtle}`,
                    transition: 'background 120ms ease',
                  }}
                >
                  <div style={{ color: active ? '#FE5000' : t.textDim }}>
                    <OutputIcon formatId={fmt.id} size={16} />
                  </div>
                  <span className="text-[10px]" style={{ color: active ? t.textPrimary : t.textDim, fontFamily: "'Space Mono', monospace" }}>
                    {fmt.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Template config panels — shown when a target format is active */}
      {activeTargets.length > 0 && (
        <div className="overflow-y-auto nowheel max-h-[300px]">
          {activeTargets.map((target) => (
            <TemplateConfigPanel key={target} target={target} />
          ))}
        </div>
      )}

      {/* Destinations section */}
      {writeConnectors.length > 0 && (
        <div className="px-5 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[11px] tracking-wider font-semibold" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>Destinations</span>
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-0.5">
            {writeConnectors.map((c) => (
              <ConnectorTile
                key={c.id}
                service={c.service}
                name={c.name}
                mcpServerId={c.mcpServerId}
                status={c.status}
                enabled={c.enabled}
                showDirection="write"
                scope={c.hint}
                onClick={() => toggleConnector(c.id)}
                onScopeChange={(scope) => useConsoleStore.getState().updateConnectorScope(c.id, scope)}
                onOpenSettings={() => useConsoleStore.getState().setShowSettings(true, 'mcp')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add connector button */}
      <div className="px-5 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowConnectorPicker(true)}
          aria-label="Add output connector"
          className="w-full min-h-[36px] px-5 py-3 rounded text-[12px] tracking-wide uppercase cursor-pointer nodrag nowheel"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add Connector
        </button>
      </div>
      </>}
      </div>
    </div>
    </>
  );
});
