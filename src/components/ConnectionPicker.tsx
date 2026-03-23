import { useState, useEffect } from 'react';
import { useConsoleStore } from '../store/consoleStore';

import { useMcpStore } from '../store/mcpStore';

import { McpIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { PickerModal } from './PickerModal';

import { startMcpOAuth, getMcpOAuthStatus } from '../services/mcpOAuthClient';
import { MCP_REGISTRY } from '../store/mcp-registry';
import type { McpRegistryEntry } from '../store/mcp-registry';



// Badge colors
const getBadgeColor = (authMethod: string = 'none') => {
  switch (authMethod) {
    case 'oauth': return { bg: '#FE500010', color: '#FE5000', text: 'OAuth' };
    case 'api-key': return { bg: '#3498db10', color: '#3498db', text: 'API Key' };
    default: return { bg: '#2ecc7110', color: '#2ecc71', text: 'Local' };
  }
};

// Status dots
function StatusDot({ status }: { status?: 'disconnected' | 'connecting' | 'connected' | 'error' }) {
  const color =
    status === 'connected' ? '#00cc66' :
    status === 'connecting' ? '#f5a623' :
    status === 'error' ? '#ff4444' :
    '#555';
  const title =
    status === 'connected' ? 'Connected' :
    status === 'connecting' ? 'Connecting…' :
    status === 'error' ? 'Error' :
    'Disconnected';

  return (
    <span
      className={status === 'connecting' ? 'animate-pulse' : ''}
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
      title={title}
    />
  );
}

function SectionHeader({ title, collapsed, onToggle, t }: { 
  title: string; 
  collapsed: boolean; 
  onToggle: () => void; 
  t: ReturnType<typeof useTheme> 
}) {
  return (
    <div
      className="flex items-center gap-2 px-5 py-3 cursor-pointer select-none border-t transition-colors"
      onClick={onToggle}
      style={{ borderColor: t.borderSubtle }}
      onMouseEnter={e => { e.currentTarget.style.background = t.isDark ? '#ffffff08' : '#00000008'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {collapsed ? <ChevronRight size={14} style={{ color: t.textSecondary }} /> : <ChevronDown size={14} style={{ color: t.textSecondary }} />}
      <span
        className="text-[13px] font-semibold"
        style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
      >
        {title}
      </span>
    </div>
  );
}

interface ConfigEntry {
  entry: McpRegistryEntry;
  expanded: boolean;
  configValues: Record<string, string>;
}

export function ConnectionPicker() {
  const showConnectionPicker = useConsoleStore((s) => s.showConnectionPicker);
  const setShowConnectionPicker = useConsoleStore((s) => s.setShowConnectionPicker);
  const connectors = useConsoleStore((s) => s.connectors);
  const upsertMcpServer = useConsoleStore((s) => s.upsertMcpServer);
  const t = useTheme();
  

  const [oauthStatuses, setOauthStatuses] = useState<Record<string, boolean>>({});
  const [oauthLoading, setOauthLoading] = useState<Record<string, boolean>>({});
  const [oauthErrors, setOauthErrors] = useState<Record<string, string>>({});
  const [quickConnectCollapsed, setQuickConnectCollapsed] = useState(false);
  const [mcpLibraryCollapsed, setMcpLibraryCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [configEntries, setConfigEntries] = useState<Record<string, ConfigEntry>>({});

  const mcpServers = useMcpStore((s) => s.servers);
  const mcpStoreAddServer = useMcpStore((s) => s.addServer);

  // OAuth entries from registry
  const oauthEntries = MCP_REGISTRY.filter(
    (e): e is McpRegistryEntry & { url: string } => e.authMethod === 'oauth' && !!e.url
  );

  // Categories from registry
  const categories = ['All', ...Array.from(new Set(MCP_REGISTRY.map(e => e.category)))];

  useEffect(() => {
    if (!showConnectionPicker) return;
    
    // Load OAuth statuses
    oauthEntries.forEach((entry) => {
      getMcpOAuthStatus(entry.url).then((s) => {
        setOauthStatuses((prev) => ({ ...prev, [entry.url]: s.connected }));
      }).catch(() => {});
    });
  }, [showConnectionPicker]);

  const handleOAuthConnect = async (entry: McpRegistryEntry & { url: string }) => {
    setOauthLoading((prev) => ({ ...prev, [entry.url]: true }));
    setOauthErrors((prev) => ({ ...prev, [entry.url]: '' }));
    
    try {
      await startMcpOAuth(entry.url);
      setOauthStatuses((prev) => ({ ...prev, [entry.url]: true }));
      
      // Register MCP server
      await mcpStoreAddServer({
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
      
      // Register in console store
      await upsertMcpServer({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        connected: true,
      });

      // Force refresh the MCP store to show the newly connected server
      const mcpStore = useMcpStore.getState();
      await mcpStore.loadServers();
    } catch (err) {
      setOauthErrors((prev) => ({ ...prev, [entry.url]: (err as Error).message }));
    } finally {
      setOauthLoading((prev) => ({ ...prev, [entry.url]: false }));
    }
  };

  const toggleConfigExpansion = (entryId: string) => {
    const entry = MCP_REGISTRY.find(e => e.id === entryId);
    if (!entry) return;
    
    setConfigEntries(prev => ({
      ...prev,
      [entryId]: {
        entry,
        expanded: !prev[entryId]?.expanded,
        configValues: prev[entryId]?.configValues || {},
      }
    }));
  };

  const updateConfigValue = (entryId: string, key: string, value: string) => {
    setConfigEntries(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        configValues: {
          ...prev[entryId]?.configValues,
          [key]: value,
        },
      }
    }));
  };

  const handleAddWithConfig = async (entry: McpRegistryEntry) => {
    const configEntry = configEntries[entry.id];
    const configValues = configEntry?.configValues || {};
    
    // Register in console store first
    await upsertMcpServer({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      connected: false,
    });
    
    // Always register in backend MCP store
    const env: Record<string, string> = {};
    if (entry.configFields && entry.configFields.length > 0) {
      entry.configFields.forEach(field => {
        const val = configValues[field.key];
        if (val) env[field.key] = val;
      });
    }

    await mcpStoreAddServer({
      id: entry.id,
      name: entry.name,
      type: entry.transport === 'stdio' ? 'stdio' : 'http',
      command: entry.command || '',
      args: entry.defaultArgs || [],
      env,
      autoConnect: true,
      ...(entry.url ? { url: entry.url } : {}),
    });
    
    // Collapse the config section
    setConfigEntries(prev => ({
      ...prev,
      [entry.id]: {
        ...prev[entry.id],
        expanded: false,
      }
    }));
  };

  const isAdded = (entryId: string) => {
    return mcpServers.some(s => s.id === entryId) || connectors.some(c => c.mcpServerId === entryId);
  };

  const getMcpStatus = (entryId: string): 'disconnected' | 'connecting' | 'connected' | 'error' => {
    const server = mcpServers.find(s => s.id === entryId);
    return server?.status ?? 'disconnected';
  };

  const renderOAuthEntry = (entry: McpRegistryEntry & { url: string }) => {
    const connected = oauthStatuses[entry.url] ?? false;
    const loading = oauthLoading[entry.url] ?? false;
    const error = oauthErrors[entry.url];
    const added = isAdded(entry.id);
    const badge = getBadgeColor('oauth');

    return (
      <div key={entry.id} className="flex items-center gap-3 px-4 py-1.5 hover-row cursor-default">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: t.surfaceElevated }}
        >
          <McpIcon icon={entry.icon} size={16} style={{ color: t.textSecondary }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={connected ? 'connected' : 'disconnected'} />
            <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{entry.name}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full uppercase"
              style={{ 
                background: badge.bg, 
                color: badge.color, 
                fontFamily: "'Geist Mono', monospace", 
                fontWeight: 600 
              }}
            >
              {badge.text}
            </span>
          </div>
          <div>
            <span className="text-[11px]" style={{ color: t.textDim }}>{entry.description}</span>
            {error && <span className="text-[10px] ml-2" style={{ color: '#ff4444' }}>{error}</span>}
          </div>
        </div>

        {added && connected ? (
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md" 
                style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
            <Check size={12} /> Connected
          </span>
        ) : (
          <button
            type="button"
            onClick={() => handleOAuthConnect(entry)}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-md cursor-pointer border-none transition-colors"
            style={{ 
              background: '#FE500018', 
              color: '#FE5000', 
              fontWeight: 600, 
              opacity: loading ? 0.7 : 1 
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#FE500030';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#FE500018';
            }}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    );
  };

  const renderMcpEntry = (entry: McpRegistryEntry) => {
    if (entry.authMethod === 'oauth') {
      // Show OAuth button for OAuth entries
      const connected = oauthStatuses[entry.url!] ?? false;
      const badge = getBadgeColor('oauth');
      
      return (
        <div key={entry.id} className="flex items-center gap-3 px-4 py-1.5 hover-row cursor-default">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: t.surfaceElevated }}
          >
            <McpIcon icon={entry.icon} size={16} style={{ color: t.textSecondary }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={connected ? 'connected' : 'disconnected'} />
              <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{entry.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full uppercase"
                style={{
                  background: badge.bg,
                  color: badge.color,
                  fontFamily: "'Geist Mono', monospace",
                  fontWeight: 600
                }}
              >
                {badge.text}
              </span>
            </div>
            <span className="text-[11px]" style={{ color: t.textDim }}>{entry.description}</span>
          </div>

          <button
            type="button"
            onClick={() => entry.url && handleOAuthConnect(entry as McpRegistryEntry & { url: string })}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-md cursor-pointer border-none transition-colors"
            style={{ background: '#FE500018', color: '#FE5000', fontWeight: 600 }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#FE500030';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#FE500018';
            }}
          >
            <Plus size={12} />
            Connect via OAuth
          </button>
        </div>
      );
    }

    const added = isAdded(entry.id);
    const badge = getBadgeColor(entry.authMethod);
    const configEntry = configEntries[entry.id];
    const hasConfig = entry.configFields && entry.configFields.length > 0;

    return (
      <div key={entry.id}>
        <div className="flex items-center gap-3 px-4 py-1.5 hover-row cursor-default">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: t.surfaceElevated }}
          >
            <McpIcon icon={entry.icon} size={16} style={{ color: t.textSecondary }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={getMcpStatus(entry.id)} />
              <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{entry.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full uppercase"
                style={{
                  background: badge.bg,
                  color: badge.color,
                  fontFamily: "'Geist Mono', monospace",
                  fontWeight: 600
                }}
              >
                {badge.text}
              </span>
            </div>
            <span className="text-[11px]" style={{ color: t.textDim }}>{entry.description}</span>
          </div>

          {added ? (
            <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md" 
                  style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
              <Check size={12} /> Added
            </span>
          ) : (
            <button
              type="button"
              onClick={() => hasConfig ? toggleConfigExpansion(entry.id) : handleAddWithConfig(entry)}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-md cursor-pointer border-none"
              style={{ background: '#FE500018', color: '#FE5000', fontWeight: 600 }}
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>

        {/* Inline config section */}
        {hasConfig && configEntry?.expanded && (
          <div className="px-4 py-3 ml-11 mr-4 mb-2 rounded-lg" style={{ background: t.surfaceElevated }}>
            <div className="text-[12px] font-medium mb-2" style={{ color: t.textPrimary }}>
              Configuration
            </div>
            <div className="space-y-2">
              {entry.configFields!.map((field) => (
                <div key={field.key}>
                  <label className="text-[11px]" style={{ color: t.textDim }}>
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type={field.type === 'password' || field.key.toLowerCase().includes('token') || field.key.toLowerCase().includes('key') ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={configEntry.configValues[field.key] || ''}
                    onChange={(e) => updateConfigValue(entry.id, field.key, e.target.value)}
                    className="w-full mt-1 px-2 py-1 text-[12px] rounded border outline-none"
                    style={{
                      background: t.inputBg,
                      border: `1px solid ${t.border}`,
                      color: t.textPrimary,
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => handleAddWithConfig(entry)}
                  disabled={entry.configFields!.some(field => field.required && !configEntry.configValues[field.key])}
                  className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md cursor-pointer border-none"
                  style={{ 
                    background: '#FE5000', 
                    color: 'white', 
                    fontWeight: 600,
                    opacity: entry.configFields!.some(field => field.required && !configEntry.configValues[field.key]) ? 0.5 : 1
                  }}
                >
                  <Check size={12} />
                  Save & Add
                </button>
                <button
                  type="button"
                  onClick={() => toggleConfigExpansion(entry.id)}
                  className="text-[11px] px-3 py-1.5 rounded-md cursor-pointer border-none"
                  style={{ background: t.border, color: t.textDim }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PickerModal
      open={showConnectionPicker}
      onClose={() => setShowConnectionPicker(false)}
      title="Add Connection"
      searchPlaceholder="Search connections..."
      width={600}
    >
      {(filter) => {
        const f = filter?.toLowerCase() ?? '';
        
        // Filter OAuth entries
        const filteredOAuthEntries = oauthEntries.filter(e =>
          !f || e.name.toLowerCase().includes(f) || e.description.toLowerCase().includes(f)
        );

        // Filter MCP library entries
        const filteredMcpEntries = MCP_REGISTRY.filter(e => {
          const matchesFilter = !f || e.name.toLowerCase().includes(f) || e.description.toLowerCase().includes(f) || 
                               (e.tags && e.tags.some(tag => tag.toLowerCase().includes(f)));
          const matchesCategory = activeCategory === 'All' || e.category === activeCategory;
          return matchesFilter && matchesCategory;
        });

        return (
          <>
            {/* Quick Connect Section */}
            {filteredOAuthEntries.length > 0 && (
              <>
                <SectionHeader 
                  title="Quick Connect" 
                  collapsed={quickConnectCollapsed} 
                  onToggle={() => setQuickConnectCollapsed(!quickConnectCollapsed)} 
                  t={t} 
                />
                {!quickConnectCollapsed && (
                  <div className="pb-2">
                    {filteredOAuthEntries.map(renderOAuthEntry)}
                  </div>
                )}
              </>
            )}

            {/* MCP Library Section */}
            <SectionHeader 
              title="MCP Library" 
              collapsed={mcpLibraryCollapsed} 
              onToggle={() => setMcpLibraryCollapsed(!mcpLibraryCollapsed)} 
              t={t} 
            />
            {!mcpLibraryCollapsed && (
              <>
                {/* Category tabs */}
                <div className="flex gap-1 px-5 py-2 overflow-x-auto">
                  {categories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className="text-[11px] px-2 py-1 rounded-md cursor-pointer border-none whitespace-nowrap transition-colors"
                      style={{
                        background: activeCategory === category ? '#FE5000' : 'transparent',
                        color: activeCategory === category ? 'white' : t.textDim,
                        fontFamily: "'Geist Mono', monospace",
                        fontWeight: 600,
                      }}
                      onMouseEnter={e => {
                        if (activeCategory !== category) {
                          e.currentTarget.style.background = '#FE500015';
                          e.currentTarget.style.color = '#FE5000';
                        }
                      }}
                      onMouseLeave={e => {
                        if (activeCategory !== category) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = t.textDim;
                        }
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* MCP entries */}
                <div className="max-h-[400px] overflow-y-auto pb-2">
                  {filteredMcpEntries.map(renderMcpEntry)}
                </div>
              </>
            )}
          </>
        );
      }}
    </PickerModal>
  );
}