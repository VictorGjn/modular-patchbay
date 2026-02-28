import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import type { ConnectorService, ConnectorDirection } from '../store/knowledgeBase';
import { ConnectorIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check } from 'lucide-react';
import { PickerModal } from './PickerModal';

interface AvailableConnector {
  service: ConnectorService;
  name: string;
  mcpServerId: string;
  description: string;
  directions: ConnectorDirection[];
}

const BUILT_IN_CONNECTORS: AvailableConnector[] = [
  { service: 'notion', name: 'Notion', mcpServerId: 'notion', description: 'Read and write Notion pages and databases', directions: ['read', 'write', 'both'] },
  { service: 'slack', name: 'Slack', mcpServerId: 'slack', description: 'Read channels and send messages', directions: ['read', 'write', 'both'] },
  { service: 'hubspot', name: 'HubSpot', mcpServerId: 'HubSpotDev', description: 'CRM contacts, companies, and deals', directions: ['read', 'write', 'both'] },
  { service: 'granola', name: 'Granola', mcpServerId: 'granola', description: 'Meeting transcripts and notes', directions: ['read'] },
  { service: 'github', name: 'GitHub', mcpServerId: 'mcp-github', description: 'Repos, issues, and pull requests', directions: ['read', 'write', 'both'] },
  { service: 'google-drive', name: 'Google Drive', mcpServerId: 'mcp-gdrive', description: 'Documents, sheets, and files', directions: ['read', 'write', 'both'] },
];

const DIR_COLORS: Record<ConnectorDirection, { color: string; bg: string; bgHover: string }> = {
  read: { color: '#6aafe6', bg: '#3498db10', bgHover: '#3498db1a' },
  write: { color: '#ff8c55', bg: '#FE500010', bgHover: '#FE50001a' },
  both: { color: '#b88ad4', bg: '#9b59b610', bgHover: '#9b59b61a' },
};

export function ConnectorPicker() {
  const showConnectorPicker = useConsoleStore((s) => s.showConnectorPicker);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const connectors = useConsoleStore((s) => s.connectors);
  const addConnector = useConsoleStore((s) => s.addConnector);
  const t = useTheme();

  const mcpServers = useMcpStore.getState().servers;
  const builtInIds = new Set(BUILT_IN_CONNECTORS.map((c) => c.mcpServerId));
  const extraMcpConnectors: AvailableConnector[] = mcpServers
    .filter((s) => !builtInIds.has(s.id))
    .map((s) => ({
      service: s.id as ConnectorService,
      name: s.name,
      mcpServerId: s.id,
      description: s.command || `MCP server: ${s.id}`,
      directions: ['read', 'write', 'both'] as ConnectorDirection[],
    }));
  const AVAILABLE_CONNECTORS = [...BUILT_IN_CONNECTORS, ...extraMcpConnectors];

  const handleAdd = (ac: AvailableConnector, direction: ConnectorDirection) => {
    const id = `conn-${ac.service}-${Date.now()}`;
    addConnector({
      id,
      service: ac.service,
      name: ac.name,
      mcpServerId: ac.mcpServerId,
      direction,
      enabled: true,
      config: {},
      status: 'configured',
      authMethod: 'api-key',
    });
  };

  const isAdded = (service: ConnectorService) => connectors.some((c) => c.service === service);

  return (
    <PickerModal
      open={showConnectorPicker}
      onClose={() => setShowConnectorPicker(false)}
      title="Add Connector"
      searchPlaceholder="Search connectors..."
    >
      {(filter) => {
        const filtered = AVAILABLE_CONNECTORS.filter((c) => {
          if (!filter) return true;
          const f = filter.toLowerCase();
          return c.name.toLowerCase().includes(f) || c.description.toLowerCase().includes(f);
        });

        return filtered.map((ac) => {
          const added = isAdded(ac.service);
          return (
            <div
              key={ac.service}
              className="flex items-center gap-3 px-5 py-2.5 hover-row cursor-default"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: t.surfaceElevated }}
              >
                <ConnectorIcon service={ac.service} size={16} style={{ color: t.textSecondary }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: t.textPrimary }}>{ac.name}</span>
                  <div className="flex gap-1">
                    {ac.directions.map((dir) => (
                      <span
                        key={dir}
                        className="text-[8px] px-1.5 py-0.5 rounded-full uppercase"
                        style={{
                          background: DIR_COLORS[dir].bg,
                          color: DIR_COLORS[dir].color,
                          fontFamily: "'Space Mono', monospace",
                          fontWeight: 600,
                        }}
                      >
                        {dir}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs" style={{ color: t.textDim }}>{ac.description}</span>
              </div>

              {added ? (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
                  <Check size={12} /> Added
                </span>
              ) : (
                <div className="flex gap-1">
                  {ac.directions.filter((d) => d !== 'both').map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => handleAdd(ac, dir)}
                      className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md cursor-pointer border-none uppercase"
                      style={{
                        color: DIR_COLORS[dir].color,
                        background: DIR_COLORS[dir].bg,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = DIR_COLORS[dir].bgHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = DIR_COLORS[dir].bg; }}
                      aria-label={`Add ${ac.name} as ${dir}`}
                    >
                      <Plus size={10} /> {dir}
                    </button>
                  ))}
                  {ac.directions.includes('both') && (
                    <button
                      type="button"
                      onClick={() => handleAdd(ac, 'both')}
                      className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md cursor-pointer border-none uppercase"
                      style={{
                        color: DIR_COLORS.both.color,
                        background: DIR_COLORS.both.bg,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = DIR_COLORS.both.bgHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = DIR_COLORS.both.bg; }}
                      aria-label={`Add ${ac.name} as both`}
                    >
                      <Plus size={10} /> Both
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        });
      }}
    </PickerModal>
  );
}
