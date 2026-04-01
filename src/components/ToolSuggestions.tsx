/**
 * ToolSuggestions — shows MCP servers, connectors, and skills discovered
 * from the V2 pipeline metaprompt output.
 */
import { useState, useMemo } from 'react';
import { useTheme } from '../theme';
import { useMcpStore } from '../store/mcpStore';
import { useConsoleStore } from '../store/consoleStore';
import { useSkillsStore } from '../store/skillsStore';
import type { DiscoveredTool, NativeToolInfo } from '../services/metapromptV2Client';
import { ChevronDown, ChevronUp, Plus, Link, Download, X } from 'lucide-react';

interface ToolSuggestionsProps {
  tools: DiscoveredTool[];
  /** Native tools always available to the generated agent */
  nativeTools?: NativeToolInfo[];
  onNavigateToKnowledge?: () => void;
  /** When true, skills search is still running — show a spinner */
  skillsLoading?: boolean;
}

const DEFAULT_VISIBLE = 8;

export function ToolSuggestions({ tools, nativeTools, onNavigateToKnowledge, skillsLoading }: ToolSuggestionsProps) {
  const t = useTheme();
  const addServer = useMcpStore((s) => s.addServer);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // F1: subscribe to store state so filtering is reactive to changes
  const mcpServerIds = useMcpStore((s) => new Set(s.servers.map((sv) => sv.id)));
  const connectorIds = useConsoleStore((s) => new Set((s.connectors ?? []).filter((c) => c.enabled).map((c) => c.id)));
  const skillIds = useSkillsStore((s) => new Set(s.skills.filter((sk) => sk.enabled).map((sk) => sk.id)));

  // F1: filter at render time against currently-enabled IDs
  const visibleTools = useMemo(() => {
    return tools.filter((tool) => {
      if (tool.source === 'mcp') return !mcpServerIds.has(tool.id);
      if (tool.source === 'connector') return !connectorIds.has(tool.id);
      if (tool.source === 'skill') return !skillIds.has(tool.id);
      return true;
    });
  }, [tools, mcpServerIds, connectorIds, skillIds]);

  if (dismissed || (visibleTools.length === 0 && (!nativeTools || nativeTools.length === 0) && !skillsLoading)) return null;

  const mcpTools = visibleTools.filter((t) => t.source === 'mcp');
  const connectorTools = visibleTools.filter((t) => t.source === 'connector');
  const skillTools = visibleTools.filter((t) => t.source === 'skill');

  // F5: show-more logic
  const allItems = [...mcpTools, ...connectorTools, ...skillTools];
  const hiddenCount = Math.max(0, allItems.length - DEFAULT_VISIBLE);

  // Determine which items fall in the "hidden" tail per-section
  let remaining = DEFAULT_VISIBLE;
  function sliceSection<T>(items: T[]): { shown: T[]; hidden: T[] } {
    if (showAll || remaining <= 0) {
      if (!showAll) return { shown: [], hidden: items };
      return { shown: items, hidden: [] };
    }
    const shown = items.slice(0, remaining);
    const hidden = items.slice(remaining);
    remaining = Math.max(0, remaining - items.length);
    return { shown, hidden };
  }

  const { shown: mcpShown, hidden: mcpHidden } = sliceSection(mcpTools);
  const { shown: connShown, hidden: connHidden } = sliceSection(connectorTools);
  const { shown: skillShown, hidden: skillHidden } = sliceSection(skillTools);

  const handleAddMcp = async (tool: DiscoveredTool) => {
    if (doneIds.has(tool.id)) return;
    setInstallingIds((prev) => new Set(prev).add(tool.id));
    // F9: log suggestion accepted
    void fetch(`/api/tool-analytics/accepted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId: tool.id, source: tool.source }),
    }).catch(() => {});
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
    // F9: log suggestion accepted
    void fetch(`/api/tool-analytics/accepted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId: tool.id, source: tool.source }),
    }).catch(() => {});
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

  function renderTool(tool: DiscoveredTool) {
    if (tool.source === 'mcp') {
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
    }
    if (tool.source === 'connector') {
      return (
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
      );
    }
    // skill
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
  }

  return (
    <div style={{
      marginTop: 16,
      background: t.surfaceElevated,
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
            {visibleTools.length}
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


          {/* Native Tools (always available) */}
          {nativeTools && nativeTools.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Native Tools
              </div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 500, marginBottom: 8 }}>
                Always available — no setup required
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nativeTools.map((tool) => (
                  <div key={tool.id} style={card}>
                    <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 2, flexShrink: 0 }}>✅</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                          {tool.name}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#10b98120', color: '#10b981', fontWeight: 500 }}>
                          Active
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                        {tool.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* MCP Servers */}
          {mcpShown.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                MCP Servers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mcpShown.map(renderTool)}
              </div>
            </section>
          )}

          {/* Connectors */}
          {connShown.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Connectors
              </div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 500, marginBottom: 8 }}>
                Native — faster than MCP
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {connShown.map(renderTool)}
              </div>
            </section>
          )}

          {/* Skills */}
          {skillShown.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Skills
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {skillShown.map(renderTool)}
              </div>
            </section>
          )}

          {/* F5: Show more button */}
          {!showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                color: t.textSecondary,
                fontSize: 12,
                padding: '6px 12px',
                cursor: 'pointer',
                fontFamily: "'Geist Sans', sans-serif",
                alignSelf: 'flex-start',
              }}
            >
              Show {hiddenCount} more
            </button>
          )}

          {/* Hidden items (shown after expanding) */}
          {showAll && (
            <>
              {mcpHidden.length > 0 && (
                <section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mcpHidden.map(renderTool)}
                  </div>
                </section>
              )}
              {connHidden.length > 0 && (
                <section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {connHidden.map(renderTool)}
                  </div>
                </section>
              )}
              {skillHidden.length > 0 && (
                <section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {skillHidden.map(renderTool)}
                  </div>
                </section>
              )}
            </>
          )}

          {/* F4: Skills loading spinner */}
          {skillsLoading && (
            <div style={{ fontSize: 12, color: t.textDim, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Sans', sans-serif" }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Searching skills marketplace...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
