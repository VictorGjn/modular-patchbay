import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { type McpCategory } from '../store/knowledgeBase';
import { McpIcon } from './icons/SectionIcons';
import { useTheme } from '../theme';
import { Plus, Check } from 'lucide-react';
import { PickerModal } from './PickerModal';

const CATEGORY_LABELS: Record<McpCategory, string> = {
  communication: 'Communication',
  development: 'Development',
  data: 'Data',
  productivity: 'Productivity',
};

const CATEGORY_ORDER: McpCategory[] = ['communication', 'development', 'data', 'productivity'];

export function McpPicker() {
  const showMcpPicker = useConsoleStore((s) => s.showMcpPicker);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const addMcp = useConsoleStore((s) => s.addMcp);
  const mcpStoreAddServer = useMcpStore((s) => s.addServer);
  const t = useTheme();

  const handleAddMcp = async (serverId: string) => {
    // Add to consoleStore (persistent config)
    addMcp(serverId);
    
    // Also add to mcpStore (runtime connection)
    const server = mcpServers.find((s) => s.id === serverId);
    if (server) {
      await mcpStoreAddServer({
        id: server.id,
        name: server.name,
        type: server.type,
        command: server.command,
        args: server.args,
        env: server.env,
        autoConnect: server.autoConnect,
        url: server.url,
        headers: server.headers,
      });
    }
  };

  return (
    <PickerModal
      open={showMcpPicker}
      onClose={() => setShowMcpPicker(false)}
      title="Add MCP Server"
      searchPlaceholder="Search servers..."
    >
      {(filter) => {
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
              <span className="text-[12px] font-medium tracking-wider uppercase" style={{ color: t.textDim }}>
                {group.label}
              </span>
            </div>
            {group.servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center gap-3 px-5 py-2.5 hover-row cursor-default"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: t.surfaceElevated }}
                >
                  <McpIcon icon={server.icon} size={16} style={{ color: t.textSecondary }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-medium" style={{ color: t.textPrimary }}>{server.name}</span>
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: server.connected ? t.statusSuccess : t.statusError,
                        boxShadow: server.connected ? t.statusSuccessGlow : t.statusErrorGlow,
                      }}
                    />
                  </div>
                  <span className="text-[14px]" style={{ color: t.textDim }}>{server.description}</span>
                </div>

                {server.added ? (
                  <span className="flex items-center gap-1 text-[14px] px-2.5 py-1 rounded-md" style={{ color: t.statusSuccess, background: t.statusSuccessBg }}>
                    <Check size={12} /> Added
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddMcp(server.id)}
                    className="flex items-center gap-1 text-[14px] px-2.5 py-1 rounded-md cursor-pointer border-none"
                    style={{
                      color: '#FE5000',
                      background: '#FE500012',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
                    aria-label={`Add ${server.name}`}
                  >
                    <Plus size={12} /> Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ));
      }}
    </PickerModal>
  );
}
