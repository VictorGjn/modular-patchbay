/**
 * ToolSuggestions — shows MCP servers, connectors, and skills discovered
 * from the V2 pipeline metaprompt output.
 */
import { useState } from 'react';
import { useTheme } from '../theme';
import { useMcpStore } from '../store/mcpStore';
import type { DiscoveredTool } from '../services/metapromptV2Client';
import { ChevronDown, ChevronUp, Plus, Link, Download, X } from 'lucide-react';

interface ToolSuggestionsProps {
  tools: DiscoveredTool[];
  onNavigateToKnowledge?: () => void;
}

export function ToolSuggestions({ tools, onNavigateToKnowledge }: ToolSuggestionsProps) {
  const t = useTheme();
  const addServer = useMcpStore((s) => s.addServer);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  if (dismissed || tools.length === 0) return null;

  const mcpTools = tools.filter((t) => t.source === 'mcp');
  const connectorTools = tools.filter((t) => t.source === 'connector');
  const skillTools = tools.filter((t) => t.source === 'skill');

  const handleAddMcp = async (tool: DiscoveredTool) => {
    if (doneIds.has(tool.id)) return;
    setInstallingIds((prev) => new Set(prev).add(tool.id));
    try {
      await addServer({
        id: tool.id,
        name: tool.name,
        command: 'npx',
        args: ['-y', tool.npmPackage ?? tool.id],
        env: {},
      });
      setDoneIds((prev) => new Set(prev).add(tool.id));
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  const handleInstallSkill = async (tool: DiscoveredTool) => {
    if (doneIds.has(tool.id)) return;
    setInstallingIds((prev) => new Set(prev).add(tool.id));
    try {
      await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: tool.id }),
      });
      setDoneIds((prev) => new Set(prev).add(tool.id));
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  const card = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  };

  const actionBtn = (variant: 'primary' | 'ghost') => ({
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    border: `1px solid ${variant === 'primary' ? '#FE5000' : t.border}`,
    background: variant === 'primary' ? '#FE500015' : 'transparent',
    color: variant === 'primary' ? '#FE5000' : t.textSecondary,
    cursor: 'pointer',
    fontFamily: "'Geist Sans', sans-serif",
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  });

  return (
    <div style={{
      marginTop: 16,
      background: t.surfaceAlt,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: collapsed ? 'none' : `1px solid ${t.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔌</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
            Suggested Tools
          </span>
          <span style={{
            fontSize: 11,
            padding: '2px 7px',
            borderRadius: 10,
            background: '#FE500020',
            color: '#FE5000',
            fontWeight: 600,
          }}>
            {tools.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: 4, display: 'flex', alignItems: 'center' }}
            title="Dismiss all suggestions"
          >
            <X size={13} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: 4, display: 'flex', alignItems: 'center' }}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* MCP Servers */}
          {mcpTools.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                MCP Servers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mcpTools.map((tool) => {
                  const needsApiKey = tool.configFields?.some((f) => f.required);
                  const isDone = doneIds.has(tool.id);
                  const isInstalling = installingIds.has(tool.id);
                  return (
                    <div key={tool.id} style={card}>
                      <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 2, flexShrink: 0 }}>🔧</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                            {tool.name}
                          </span>
                          {needsApiKey && (
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fbbf2420', color: '#f59e0b', fontWeight: 500 }}>
                              Requires API key
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                          {tool.description}
                        </div>
                        <div style={{ fontSize: 11, color: t.textDim, marginTop: 4 }}>
                          {tool.matchReason}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isDone || isInstalling}
                        onClick={() => handleAddMcp(tool)}
                        style={{
                          ...actionBtn('primary'),
                          opacity: isDone || isInstalling ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isDone ? '✓ Added' : isInstalling ? '…' : <><Plus size={11} /> Add to MCP</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Connectors */}
          {connectorTools.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Connectors
              </div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 500, marginBottom: 8 }}>
                Native — faster than MCP
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {connectorTools.map((tool) => (
                  <div key={tool.id} style={card}>
                    <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 2, flexShrink: 0 }}>🔗</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                        {tool.name}
                      </span>
                      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                        {tool.description}
                      </div>
                      <div style={{ fontSize: 11, color: t.textDim, marginTop: 4 }}>
                        {tool.matchReason}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateToKnowledge?.()}
                      style={{
                        ...actionBtn('primary'),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Link size={11} /> Connect
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {skillTools.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Skills
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {skillTools.map((tool) => {
                  const isDone = doneIds.has(tool.id);
                  const isInstalling = installingIds.has(tool.id);
                  return (
                    <div key={tool.id} style={card}>
                      <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 2, flexShrink: 0 }}>⚡</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                            {tool.name}
                          </span>
                          {tool.installs && tool.installs !== '0' && (
                            <span style={{ fontSize: 10, color: t.textDim }}>
                              {tool.installs} installs
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                          {tool.description}
                        </div>
                        <div style={{ fontSize: 11, color: t.textDim, marginTop: 4 }}>
                          {tool.matchReason}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isDone || isInstalling}
                        onClick={() => handleInstallSkill(tool)}
                        style={{
                          ...actionBtn('primary'),
                          opacity: isDone || isInstalling ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isDone ? '✓ Installed' : isInstalling ? '…' : <><Download size={11} /> Install</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
