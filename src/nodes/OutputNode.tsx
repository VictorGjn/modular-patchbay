import { memo, useState, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { JackPort } from '../components/JackPort';
import { ConnectorTile } from '../components/ConnectorTile';
import { OutputIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { ArrowUpRight, ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react';

export const OutputNode = memo(function OutputNode() {
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const toggleOutputFormat = useConsoleStore((s) => s.toggleOutputFormat);
  const connectors = useConsoleStore((s) => s.connectors);
  const toggleConnector = useConsoleStore((s) => s.toggleConnector);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const t = useTheme();

  const writeConnectors = connectors.filter((c) => c.direction === 'write' || c.direction === 'both');

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

  return (
    <>
    <ResizeHandle minWidth={220} minHeight={100} />
    <div
      className="rounded-xl overflow-hidden h-full flex flex-col"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, minWidth: 220 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.borderSubtle}` }}>
        <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="output-in" />
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
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 12 }}>
          Output
        </span>
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

      {/* Destinations section */}
      {writeConnectors.length > 0 && (
        <div className="px-3 pt-1 pb-2">
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
                status={c.status}
                enabled={c.enabled}
                showDirection="write"
                onClick={() => toggleConnector(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add connector button */}
      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowConnectorPicker(true)}
          aria-label="Add output connector"
          className="w-full min-h-[36px] px-4 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer nodrag nowheel"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add Connector
        </button>
      </div>
      </>}
    </div>
    </>
  );
});

