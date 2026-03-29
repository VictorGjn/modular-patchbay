import { useState, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { MCP_REGISTRY } from '../store/mcp-registry';
import { type McpCategory } from '../store/knowledgeBase';
import { McpIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check, Settings, X } from 'lucide-react';
import { PickerModal } from './PickerModal';

const CATEGORY_LABELS: Record<McpCategory, string> = {
  communication: 'Communication',
  development: 'Development',
  data: 'Data',
  productivity: 'Productivity',
};

const CATEGORY_ORDER: McpCategory[] = ['communication', 'development', 'data', 'productivity'];

/**
 * McpPicker — Browse and add MCP servers from the registry.
 *
 * Fix #140: When adding an MCP server, we now:
 * 1. Look up the MCP_REGISTRY entry for real command/args
 * 2. Show a config form for required configFields (API keys, paths, etc.)
 * 3. Pass actual values to mcpStore.addServer (not empty strings)
 * 4. Sync state properly between consoleStore and mcpStore
 */
export function McpPicker() {
  const showMcpPicker = useConsoleStore((s) => s.showMcpPicker);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const addMcp = useConsoleStore((s) => s.addMcp);
  const mcpStoreAddServer = useMcpStore((s) => s.addServer);
  const mcpStoreConnectServer = useMcpStore((s) => s.connectServer);
  const t = useTheme();

  // Config form state: which server is being configured
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configError, setConfigError] = useState<string | null>(null);

  const handleStartAdd = useCallback((serverId: string) => {
    // Look up the registry entry to check if config fields are needed
    const registryEntry = MCP_REGISTRY.find((e) => e.id === serverId);
    const requiredFields = registryEntry?.configFields?.filter((f) => f.required) ?? [];

    if (requiredFields.length > 0) {
      // Show config form for required fields
      setConfiguring(serverId);
      setConfigValues({});
      setConfigError(null);
    } else {
      // No config needed — add directly with registry defaults
      handleConfirmAdd(serverId, {});
    }
  }, []);

  const handleConfirmAdd = useCallback(async (serverId: string, fieldValues: Record<string, string>) => {
    const registryEntry = MCP_REGISTRY.find((e) => e.id === serverId);

    // Mark as added in the wizard (consoleStore)
    addMcp(serverId);

    // Build env from config field values
    const env: Record<string, string> = {};
    if (registryEntry?.configFields) {
      for (const field of registryEntry.configFields) {
        if (fieldValues[field.key]) {
          env[field.key] = fieldValues[field.key];
        }
      }
    }

    // Add to mcpStore with REAL command/args from registry
    const serverConfig = {
      id: serverId,
      name: registryEntry?.name ?? serverId,
      type: registryEntry?.transport === 'sse' ? 'sse' as const :
            registryEntry?.transport === 'streamable-http' ? 'sse' as const : 'stdio' as const,
      command: registryEntry?.command ?? 'npx',
      args: registryEntry?.defaultArgs ?? [],
      env,
      autoConnect: true,
      url: registryEntry?.url,
    };

    const added = await mcpStoreAddServer(serverConfig);

    // Auto-connect if the server was added with a valid command
    if (added && serverConfig.command) {
      mcpStoreConnectServer(serverId).catch(() => {
        // Connection may fail (missing deps, etc.) — not blocking
      });
    }

    // Clear config form
    setConfiguring(null);
    setConfigValues({});
    setConfigError(null);
  }, [addMcp, mcpStoreAddServer, mcpStoreConnectServer]);

  const handleCancelConfig = useCallback(() => {
    setConfiguring(null);
    setConfigValues({});
    setConfigError(null);
  }, []);

  return (
    <PickerModal
      open={showMcpPicker}
      onClose={() => { setShowMcpPicker(false); handleCancelConfig(); }}
      title="Add MCP Server"
      searchPlaceholder="Search servers..."
    >
      {(filter) => {
        // If configuring a server, show the config form
        if (configuring) {
          const registryEntry = MCP_REGISTRY.find((e) => e.id === configuring);
          const fields = registryEntry?.configFields ?? [];

          return (
            <div className="px-5 py-4" key="config-form">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleCancelConfig}
                  className="p-1 rounded border-none cursor-pointer"
                  style={{ color: t.textDim, background: 'transparent' }}
                  aria-label="Back"
                >
                  <X size={14} />
                </button>
                <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>
                  Configure {registryEntry?.name ?? configuring}
                </span>
              </div>

              <p className="text-[11px] mb-3" style={{ color: t.textDim }}>
                {registryEntry?.description}
              </p>

              <div className="text-[10px] font-mono mb-3 px-2 py-1 rounded" style={{ color: t.textDim, background: t.surfaceElevated }}>
                {registryEntry?.command} {registryEntry?.defaultArgs?.join(' ')}
              </div>

              {fields.map((field) => (
                <div key={field.key} className="mb-3">
                  <label className="block text-[11px] font-medium mb-1" style={{ color: t.textSecondary }}>
                    {field.label} {field.required && <span style={{ color: '#FE5000' }}>*</span>}
                  </label>
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={configValues[field.key] ?? ''}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded text-[12px] border-none outline-none"
                    style={{ background: t.surfaceElevated, color: t.textPrimary }}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    autoFocus={fields.indexOf(field) === 0}
                  />
                </div>
              ))}

              {configError && (
                <p className="text-[11px] mb-2" style={{ color: t.statusError }}>{configError}</p>
              )}

              <button
                type="button"
                onClick={() => {
                  // Validate required fields
                  const required = fields.filter((f) => f.required);
                  const missing = required.filter((f) => !configValues[f.key]?.trim());
                  if (missing.length > 0) {
                    setConfigError(`Required: ${missing.map((f) => f.label).join(', ')}`);
                    return;
                  }
                  handleConfirmAdd(configuring, configValues);
                }}
                className="w-full py-2 rounded text-[12px] font-medium cursor-pointer border-none"
                style={{ background: '#FE5000', color: '#fff' }}
              >
                Add {registryEntry?.name ?? 'Server'}
              </button>
            </div>
          );
        }

        // Normal picker view
        const filtered = mcpServers.filter((s) => {
          if (!filter) return true;
          const f = filter.toLowerCase();
          return s.name.toLowerCase().includes(f) || s.description.toLowerCase().includes(f);
        });

        const grouped = CATEGORY_ORDER.map((cat) => ({
          category: cat,
          label: CATEGORY_LABELS[cat],
          servers: filtered.filter((s) => s.category === cat),
        })).filter((g) => g.servers.length > 0);

        return grouped.map((group) => (
          <div key={group.category}>
            <div className="px-5 py-1.5">
              <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: t.textDim }}>
                {group.label}
              </span>
            </div>
            {group.servers.map((server) => {
              const registryEntry = MCP_REGISTRY.find((e) => e.id === server.id);
              const hasConfig = registryEntry?.configFields?.some((f) => f.required);

              return (
                <div
                  key={server.id}
                  className="flex items-center gap-3 px-4 py-1.5 hover-row cursor-default"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: t.surfaceElevated }}
                  >
                    <McpIcon icon={server.icon} size={16} style={{ color: t.textSecondary }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{server.name}</span>
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: server.connected ? t.statusSuccess : t.statusError,
                          boxShadow: server.connected ? t.statusSuccessGlow : t.statusErrorGlow,
                        }}
                      />
                    </div>
                    <span className="text-[11px]" style={{ color: t.textDim }}>{server.description}</span>
                  </div>

                  {server.added ? (
                    <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
                      <Check size={12} /> Added
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartAdd(server.id)}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md cursor-pointer border-none"
                      style={{
                        color: '#FE5000',
                        background: '#FE500012',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
                      aria-label={`Add ${server.name}${hasConfig ? ' (requires config)' : ''}`}
                    >
                      {hasConfig ? <Settings size={12} /> : <Plus size={12} />}
                      {hasConfig ? 'Configure' : 'Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ));
      }}
    </PickerModal>
  );
}
