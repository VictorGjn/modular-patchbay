import { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import type { ConnectorService, ConnectorDirection } from '../store/knowledgeBase';
import { ConnectorIcon } from './icons/SectionIcons';
import { X, Search, Plus, Check } from 'lucide-react';

interface AvailableConnector {
  service: ConnectorService;
  name: string;
  mcpServerId: string;
  description: string;
  directions: ConnectorDirection[];
}

const AVAILABLE_CONNECTORS: AvailableConnector[] = [
  { service: 'notion', name: 'Notion', mcpServerId: 'mcp-notion', description: 'Read and write Notion pages and databases', directions: ['read', 'write', 'both'] },
  { service: 'slack', name: 'Slack', mcpServerId: 'mcp-slack', description: 'Read channels and send messages', directions: ['read', 'write', 'both'] },
  { service: 'hubspot', name: 'HubSpot', mcpServerId: 'mcp-hubspot', description: 'CRM contacts, companies, and deals', directions: ['read', 'write', 'both'] },
  { service: 'granola', name: 'Granola', mcpServerId: 'mcp-granola', description: 'Meeting transcripts and notes', directions: ['read'] },
  { service: 'github', name: 'GitHub', mcpServerId: 'mcp-github', description: 'Repos, issues, and pull requests', directions: ['read', 'write', 'both'] },
  { service: 'google-drive', name: 'Google Drive', mcpServerId: 'mcp-gdrive', description: 'Documents, sheets, and files', directions: ['read', 'write', 'both'] },
];

export function ConnectorPicker() {
  const showConnectorPicker = useConsoleStore((s) => s.showConnectorPicker);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const connectors = useConsoleStore((s) => s.connectors);
  const addConnector = useConsoleStore((s) => s.addConnector);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showConnectorPicker) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showConnectorPicker]);

  useEffect(() => {
    if (!showConnectorPicker) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowConnectorPicker(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showConnectorPicker, setShowConnectorPicker]);

  if (!showConnectorPicker) return null;

  const filtered = AVAILABLE_CONNECTORS.filter((c) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return c.name.toLowerCase().includes(f) || c.description.toLowerCase().includes(f);
  });

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowConnectorPicker(false)}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        className="relative w-[520px] max-h-[70vh] flex flex-col rounded-xl overflow-hidden"
        style={{
          background: '#1c1c20',
          border: '1px solid #2a2a30',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2a2a30' }}>
          <span className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
            Add Connector
          </span>
          <button
            type="button"
            onClick={() => setShowConnectorPicker(false)}
            className="p-1 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
            style={{ color: '#555' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b" style={{ borderColor: '#222226' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search connectors..."
              className="w-full outline-none text-sm pl-9 pr-3 py-2 rounded-lg"
              style={{
                background: '#141417',
                border: '1px solid #2a2a30',
                color: '#f0f0f0',
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Connector list */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.map((ac) => {
            const added = isAdded(ac.service);
            return (
              <div
                key={ac.service}
                className="flex items-center gap-3 px-5 py-2.5 hover-row cursor-default"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#25252a' }}
                >
                  <ConnectorIcon service={ac.service} size={16} style={{ color: '#888' }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{ac.name}</span>
                    {/* Direction options */}
                    <div className="flex gap-1">
                      {ac.directions.map((dir) => (
                        <span
                          key={dir}
                          className="text-[8px] px-1.5 py-0.5 rounded-full uppercase"
                          style={{
                            background: dir === 'read' ? '#3498db30' : dir === 'write' ? '#FE500030' : '#9b59b630',
                            color: dir === 'read' ? '#3498db' : dir === 'write' ? '#FE5000' : '#9b59b6',
                            fontFamily: "'Space Mono', monospace",
                            fontWeight: 600,
                          }}
                        >
                          {dir}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: '#555' }}>{ac.description}</span>
                </div>

                {added ? (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md" style={{ color: '#00ff88', background: '#00ff8812' }}>
                    <Check size={12} /> Added
                  </span>
                ) : (
                  <div className="flex gap-1">
                    {ac.directions.filter((d) => d !== 'both').map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => handleAdd(ac, dir)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none uppercase"
                        style={{
                          color: dir === 'read' ? '#3498db' : '#FE5000',
                          background: dir === 'read' ? '#3498db12' : '#FE500012',
                          fontWeight: 600,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = dir === 'read' ? '#3498db25' : '#FE500025'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = dir === 'read' ? '#3498db12' : '#FE500012'; }}
                      >
                        <Plus size={10} /> {dir}
                      </button>
                    ))}
                    {ac.directions.includes('both') && (
                      <button
                        type="button"
                        onClick={() => handleAdd(ac, 'both')}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none uppercase"
                        style={{
                          color: '#9b59b6',
                          background: '#9b59b612',
                          fontWeight: 600,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#9b59b625'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#9b59b612'; }}
                      >
                        <Plus size={10} /> Both
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
