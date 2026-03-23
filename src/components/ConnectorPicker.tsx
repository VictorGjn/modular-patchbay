import { useState, useEffect } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import type { ConnectorService, ConnectorDirection } from '../store/knowledgeBase';
import { ConnectorIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check, Loader2 } from 'lucide-react';
import { PickerModal } from './PickerModal';
import { getAuthStatuses } from '../services/connectorAuth';
import type { ConnectorAuthStatus } from '../services/connectorAuth';
import { startMcpOAuth, getMcpOAuthStatus } from '../services/mcpOAuthClient';
import { MCP_REGISTRY } from '../store/mcp-registry';
import type { McpRegistryEntry } from '../store/mcp-registry';

interface AvailableConnector {
  service: ConnectorService;
  name: string;
  mcpServerId: string;
  description: string;
  directions: ConnectorDirection[];
}

// Map MCP registry entries to connector services
const MCP_TO_CONNECTOR_SERVICE: Record<string, ConnectorService> = {
  'mcp-notion': 'notion',
  'notion-remote': 'notion', 
  'mcp-slack': 'slack',
  'mcp-hubspot': 'hubspot',
  'HubSpotDev': 'hubspot',
  'granola': 'granola',
  'mcp-github': 'github',
  'mcp-gdrive': 'google-drive',
  'mcp-google-drive': 'google-drive',
};

// Generate available connectors from MCP registry
const getBuiltInConnectors = (): AvailableConnector[] => {
  return MCP_REGISTRY
    .filter(entry => entry.id in MCP_TO_CONNECTOR_SERVICE)
    .map(entry => ({
      service: MCP_TO_CONNECTOR_SERVICE[entry.id],
      name: entry.name,
      mcpServerId: entry.id,
      description: entry.description,
      directions: ['read', 'write', 'both'] as ConnectorDirection[], // Default to all directions
    }))
    .filter((connector, index, arr) => 
      // Remove duplicates by service (keep first occurrence)
      arr.findIndex(c => c.service === connector.service) === index
    );
};

const DIR_COLORS: Record<ConnectorDirection, { color: string; bg: string; bgHover: string }> = {
  read: { color: '#6aafe6', bg: '#3498db10', bgHover: '#3498db1a' },
  write: { color: '#ff8c55', bg: '#FE500010', bgHover: '#FE50001a' },
  both: { color: '#b88ad4', bg: '#9b59b610', bgHover: '#9b59b61a' },
};

function StatusDot({ auth }: { auth: ConnectorAuthStatus | undefined }) {
  const color = auth?.status === 'connected' ? '#00cc66' : auth?.hasApiKey ? '#ffaa00' : '#555';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
      title={auth?.status === 'connected' ? 'Connected' : auth?.hasApiKey ? 'API key stored' : 'Not configured'}
    />
  );
}

function SectionLabel({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <div
      className="px-5 pt-3 pb-1 text-[11px] tracking-[0.12em] uppercase"
      style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}
    >
      {label}
    </div>
  );
}

export function ConnectorPicker() {
  const showConnectorPicker = useConsoleStore((s) => s.showConnectorPicker);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const connectors = useConsoleStore((s) => s.connectors);
  const addConnector = useConsoleStore((s) => s.addConnector);
  const t = useTheme();
  const [authStatuses, setAuthStatuses] = useState<Record<string, ConnectorAuthStatus>>({});
  const [oauthStatuses, setOauthStatuses] = useState<Record<string, boolean>>({});
  const [oauthLoading, setOauthLoading] = useState<Record<string, boolean>>({});
  const [oauthErrors, setOauthErrors] = useState<Record<string, string>>({});

  const mcpServers = useMcpStore((s) => s.servers);

  const oauthEntries = MCP_REGISTRY.filter(
    (e): e is McpRegistryEntry & { url: string } => e.authMethod === 'oauth' && !!e.url
  );

  useEffect(() => {
    if (!showConnectorPicker) return;
    getAuthStatuses().then(setAuthStatuses).catch(() => {});
    oauthEntries.forEach((entry) => {
      getMcpOAuthStatus(entry.url).then((s) => {
        setOauthStatuses((prev) => ({ ...prev, [entry.url]: s.connected }));
        if (s.connected) {
          const svc = entry.id as ConnectorService;
          if (!useConsoleStore.getState().connectors.some((c) => c.service === svc)) {
            addConnector({
              id: `conn-${entry.id}-oauth`,
              service: svc,
              name: entry.name,
              mcpServerId: entry.id,
              direction: 'both',
              enabled: true,
              config: {},
              status: 'connected',
              authMethod: 'oauth',
            });
          }
        }
      }).catch(() => {});
    });
  }, [showConnectorPicker]); // eslint-disable-line react-hooks/exhaustive-deps

  const builtInConnectors = getBuiltInConnectors();
  const builtInIds = new Set(builtInConnectors.map((c) => c.mcpServerId));

  const extraMcpConnectors: AvailableConnector[] = mcpServers
    .filter((s) => !builtInIds.has(s.id))
    .map((s) => ({
      service: s.id as ConnectorService,
      name: s.name,
      mcpServerId: s.id,
      description: s.command || `MCP server: ${s.id}`,
      directions: ['read', 'write', 'both'] as ConnectorDirection[],
    }));

  // Connected MCP servers (non-built-in) go at the top
  const connectedMcpConnectors = extraMcpConnectors.filter((ac) =>
    mcpServers.find((s) => s.id === ac.mcpServerId)?.status === 'connected'
  );

  // Available = built-in + non-connected extra MCP servers
  const availableConnectors: AvailableConnector[] = [
    ...builtInConnectors,
    ...extraMcpConnectors.filter((ac) =>
      mcpServers.find((s) => s.id === ac.mcpServerId)?.status !== 'connected'
    ),
  ];

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

  const handleOAuthConnect = async (entry: McpRegistryEntry & { url: string }) => {
    setOauthLoading((prev) => ({ ...prev, [entry.url]: true }));
    setOauthErrors((prev) => ({ ...prev, [entry.url]: '' }));
    try {
      await startMcpOAuth(entry.url);
      setOauthStatuses((prev) => ({ ...prev, [entry.url]: true }));
      const svc = entry.id as ConnectorService;
      
      // Register MCP server with mcpStore
      await useMcpStore.getState().addServer({
        id: entry.id,
        name: entry.name,
        type: 'http',
        command: '',
        args: [],
        env: {},
        url: entry.url,
        headers: {},
        autoConnect: true,
      });
      
      if (!connectors.some((c) => c.service === svc)) {
        addConnector({
          id: `conn-${entry.id}-oauth-${Date.now()}`,
          service: svc,
          name: entry.name,
          mcpServerId: entry.id,
          direction: 'both',
          enabled: true,
          config: {},
          status: 'connected',
          authMethod: 'oauth',
        });
      }
    } catch (err) {
      setOauthErrors((prev) => ({ ...prev, [entry.url]: (err as Error).message }));
    } finally {
      setOauthLoading((prev) => ({ ...prev, [entry.url]: false }));
    }
  };

  const renderOAuthRow = (entry: McpRegistryEntry & { url: string }) => {
    const connected = oauthStatuses[entry.url] ?? false;
    const loading = oauthLoading[entry.url] ?? false;
    const error = oauthErrors[entry.url];
    const added = isAdded(entry.id as ConnectorService);

    return (
      <div key={entry.id} className="flex items-center gap-3 px-4 py-1.5 hover-row cursor-default">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: t.surfaceElevated }}
        >
          <ConnectorIcon service={entry.id as ConnectorService} size={16} style={{ color: t.textSecondary }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: connected ? '#00cc66' : '#555',
                flexShrink: 0,
              }}
            />
            <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{entry.name}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full uppercase"
              style={{ background: '#FE500010', color: '#FE5000', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}
            >
              OAuth
            </span>
          </div>
          <div>
            <span className="text-[11px]" style={{ color: t.textDim }}>{entry.description}</span>
            {error && <span className="text-[10px] ml-2" style={{ color: '#ff4444' }}>{error}</span>}
          </div>
        </div>

        {added ? (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
            <Check size={12} /> Connected
          </span>
        ) : (
          <button
            type="button"
            onClick={() => handleOAuthConnect(entry)}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-md cursor-pointer border-none"
            style={{ background: '#FE500018', color: '#FE5000', fontWeight: 600, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    );
  };

  const isAuthenticated = (ac: AvailableConnector) => {
    const auth = authStatuses[ac.service];
    const mcpConnected = mcpServers.find((s) => s.id === ac.mcpServerId)?.status === 'connected';
    return auth?.status === 'connected' || mcpConnected;
  };

  const openSettings = () => {
    useConsoleStore.getState().setShowConnectionPicker(true);
    setShowConnectorPicker(false);
  };

  const renderConnectorRow = (ac: AvailableConnector) => {
    const added = isAdded(ac.service);
    const auth = authStatuses[ac.service];
    const connected = isAuthenticated(ac);

    return (
      <div
        key={`${ac.service}-${ac.mcpServerId}`}
        className="flex items-center gap-3 px-4 py-1.5 hover-row cursor-default"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: t.surfaceElevated }}
        >
          <ConnectorIcon service={ac.service} size={16} style={{ color: t.textSecondary }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot auth={auth} />
            <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{ac.name}</span>
            <div className="flex gap-1">
              {ac.directions.map((dir) => (
                <span
                  key={dir}
                  className="text-[10px] px-1.5 py-0.5 rounded-full uppercase"
                  style={{
                    background: DIR_COLORS[dir].bg,
                    color: DIR_COLORS[dir].color,
                    fontFamily: "'Geist Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  {dir}
                </span>
              ))}
            </div>
          </div>
          <span className="text-[11px]" style={{ color: t.textDim }}>{ac.description}</span>
        </div>

        {added ? (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
            <Check size={12} /> Added
          </span>
        ) : connected ? (
          <div className="flex gap-1">
            {ac.directions.filter((d) => d !== 'both').map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => handleAdd(ac, dir)}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md cursor-pointer border-none uppercase"
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
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md cursor-pointer border-none uppercase"
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
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: t.textFaint }}>Setup required</span>
            <button
              type="button"
              onClick={openSettings}
              className="text-[10px] px-2 py-0.5 rounded cursor-pointer border-none"
              style={{ background: '#FE500012', color: '#FE5000' }}
            >
              Configure in Settings
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PickerModal
      open={showConnectorPicker}
      onClose={() => setShowConnectorPicker(false)}
      title="Add Connector"
      searchPlaceholder="Search connectors..."
    >
      {(filter) => {
        const f = filter?.toLowerCase() ?? '';
        const matchFilter = (ac: AvailableConnector) =>
          !f || ac.name.toLowerCase().includes(f) || ac.description.toLowerCase().includes(f);
        const matchOAuthFilter = (e: McpRegistryEntry) =>
          !f || e.name.toLowerCase().includes(f) || e.description.toLowerCase().includes(f);

        const filteredConnected = connectedMcpConnectors.filter(matchFilter);
        const filteredAvailable = availableConnectors.filter(matchFilter);
        const connectedOAuth = oauthEntries.filter((e) => oauthStatuses[e.url] && matchOAuthFilter(e));
        const availableOAuth = oauthEntries.filter((e) => !oauthStatuses[e.url] && matchOAuthFilter(e));

        return (
          <>
            {(filteredConnected.length > 0 || connectedOAuth.length > 0) && (
              <>
                <SectionLabel label="Connected Services" t={t} />
                {connectedOAuth.map(renderOAuthRow)}
                {filteredConnected.map(renderConnectorRow)}
              </>
            )}
            {(filteredAvailable.length > 0 || availableOAuth.length > 0) && (
              <>
                <SectionLabel label="Available Connectors" t={t} />
                {availableOAuth.map(renderOAuthRow)}
                {filteredAvailable.map(renderConnectorRow)}
              </>
            )}
          </>
        );
      }}
    </PickerModal>
  );
}
