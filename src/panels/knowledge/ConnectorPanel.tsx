import { useCallback, useState, useEffect } from 'react';
import { useTheme } from '../../theme';
import { 
  Database, ExternalLink, Settings, CheckCircle, XCircle, 
  Clock, Loader2, Key, Zap, RefreshCw
} from 'lucide-react';
import { API_BASE } from '../../config';

interface ConnectorAuth {
  service: string;
  method: 'api-key' | 'oauth' | 'none';
  status: 'connected' | 'expired' | 'configured' | 'unconfigured';
  hasApiKey: boolean;
  hasOAuth: boolean;
  lastChecked?: number;
}

interface ConnectorConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  authMethod: 'api-key' | 'oauth';
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'select';
    placeholder: string;
    required: boolean;
    options?: string[];
  }>;
  testEndpoint?: string;
}

const CONNECTORS: ConnectorConfig[] = [
  {
    id: 'notion',
    name: 'Notion',
    icon: '📄',
    description: 'Import databases, pages, and workspaces',
    authMethod: 'api-key',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'secret_...', required: true },
      { key: 'databaseIds', label: 'Database IDs', type: 'text', placeholder: 'id1,id2,id3 (comma separated)', required: false },
      { key: 'pageUrls', label: 'Page URLs', type: 'text', placeholder: 'https://notion.so/... (one per line)', required: false },
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: '🧲',
    description: 'Sync CRM objects: contacts, deals, tickets',
    authMethod: 'oauth',
    fields: [
      { key: 'objectTypes', label: 'Object Types', type: 'select', placeholder: '', required: true, options: ['contacts', 'deals', 'tickets', 'companies'] },
      { key: 'filters', label: 'Filters', type: 'text', placeholder: 'property filters (optional)', required: false },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Import messages and channels',
    authMethod: 'oauth',
    fields: [
      { key: 'channels', label: 'Channels', type: 'text', placeholder: '#general,#product (comma separated)', required: false },
      { key: 'keywords', label: 'Keywords', type: 'text', placeholder: 'filter by keywords', required: false },
      { key: 'dateRange', label: 'Date Range', type: 'text', placeholder: 'last 30 days', required: false },
    ],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    description: 'Access documents and folders',
    authMethod: 'oauth',
    fields: [
      { key: 'folderIds', label: 'Folder IDs', type: 'text', placeholder: 'folder1,folder2 (comma separated)', required: false },
      { key: 'fileTypes', label: 'File Types', type: 'select', placeholder: '', required: false, options: ['docs', 'sheets', 'slides', 'pdf', 'all'] },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Repository issues, PRs, and discussions',
    authMethod: 'api-key',
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true },
      { key: 'repos', label: 'Repositories', type: 'text', placeholder: 'owner/repo1,owner/repo2', required: true },
      { key: 'includeIssues', label: 'Include Issues', type: 'select', placeholder: '', required: false, options: ['yes', 'no'] },
      { key: 'includePRs', label: 'Include PRs', type: 'select', placeholder: '', required: false, options: ['yes', 'no'] },
    ],
  },
];

export function ConnectorPanel() {
  const t = useTheme();
  const [connectorAuth, setConnectorAuth] = useState<Record<string, ConnectorAuth>>({});
  const [loading, setLoading] = useState(false);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  // Load connector auth status
  const loadAuthStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/connectors/auth`);
      const json = await resp.json();
      if (json.status === 'ok') {
        setConnectorAuth(json.data || {});
      }
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    loadAuthStatus();
  }, [loadAuthStatus]);

  const handleApiKeySubmit = useCallback(async (service: string, apiKey: string) => {
    setTesting({ ...testing, [service]: true });
    try {
      const resp = await fetch(`${API_BASE}/connectors/auth/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, apiKey }),
      });
      const json = await resp.json();
      if (json.status === 'ok') {
        await loadAuthStatus(); // Refresh status
        setExpandedConnector(null); // Close form
      }
    } catch {
      // Handle error
    } finally {
      setTesting({ ...testing, [service]: false });
    }
  }, [testing, loadAuthStatus]);

  const handleOAuthStart = useCallback(async (service: string, clientId: string, clientSecret?: string) => {
    setTesting({ ...testing, [service]: true });
    try {
      const params = new URLSearchParams({ clientId });
      if (clientSecret) params.set('clientSecret', clientSecret);
      
      const resp = await fetch(`${API_BASE}/connectors/oauth/start/${service}?${params}`);
      const json = await resp.json();
      if (json.status === 'ok') {
        // Open OAuth window
        window.open(json.data.redirectUrl, '_blank', 'width=600,height=700');
        // Poll for completion
        const interval = setInterval(async () => {
          await loadAuthStatus();
          const auth = connectorAuth[service];
          if (auth?.status === 'connected') {
            clearInterval(interval);
            setExpandedConnector(null);
          }
        }, 2000);
      }
    } catch {
      // Handle error
    } finally {
      setTesting({ ...testing, [service]: false });
    }
  }, [testing, loadAuthStatus, connectorAuth]);

  const handleTestConnection = useCallback(async (service: string) => {
    setTesting({ ...testing, [service]: true });
    try {
      const resp = await fetch(`${API_BASE}/connectors/auth/test/${service}`, { method: 'POST' });
      const json = await resp.json();
      if (json.status === 'ok') {
        await loadAuthStatus(); // Refresh status
      }
    } catch {
      // Handle error
    } finally {
      setTesting({ ...testing, [service]: false });
    }
  }, [testing, loadAuthStatus]);

  const handleDisconnect = useCallback(async (service: string) => {
    try {
      const resp = await fetch(`${API_BASE}/connectors/auth/${service}`, { method: 'DELETE' });
      if (resp.ok) {
        await loadAuthStatus(); // Refresh status
      }
    } catch {
      // Handle error
    }
  }, [loadAuthStatus]);

  const handleSync = useCallback(async (service: string) => {
    setTesting({ ...testing, [service]: true });
    // TODO: Implement sync logic that calls appropriate endpoints
    // This would create knowledge channels from the synced data
    setTimeout(() => {
      setTesting({ ...testing, [service]: false });
    }, 2000);
  }, [testing]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle size={16} style={{ color: '#2ecc71' }} />;
      case 'expired': return <XCircle size={16} style={{ color: '#e74c3c' }} />;
      case 'configured': return <Clock size={16} style={{ color: '#f1c40f' }} />;
      default: return <Settings size={16} style={{ color: t.textDim }} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'expired': return 'Expired';
      case 'configured': return 'Configured';
      default: return 'Not configured';
    }
  };

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={20} className="animate-spin" style={{ color: t.textDim }} />
        </div>
      )}

      {/* Connector grid */}
      <div className="space-y-3">
        {CONNECTORS.map(connector => {
          const auth = connectorAuth[connector.id];
          const isExpanded = expandedConnector === connector.id;
          const isConnected = auth?.status === 'connected';
          const isTesting = testing[connector.id];

          return (
            <div key={connector.id} className="rounded-lg border overflow-hidden"
              style={{ 
                borderColor: isConnected ? '#2ecc71' : t.border,
                background: t.isDark ? '#ffffff05' : '#00000005'
              }}>
              
              {/* Header */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedConnector(isExpanded ? null : connector.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{connector.icon}</span>
                    <div>
                      <h3 className="font-medium text-[14px]" style={{ color: t.textPrimary }}>
                        {connector.name}
                      </h3>
                      <p className="text-[12px]" style={{ color: t.textDim }}>
                        {connector.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {auth && (
                      <>
                        {getStatusIcon(auth.status)}
                        <span className="text-[12px]" style={{ color: t.textDim }}>
                          {getStatusText(auth.status)}
                        </span>
                      </>
                    )}
                    
                    {isConnected && (
                      <div className="flex gap-1">
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleTestConnection(connector.id); }}
                          disabled={isTesting}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: t.textDim }}
                          title="Test connection"
                        >
                          <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleSync(connector.id); }}
                          disabled={isTesting}
                          className="p-1.5 rounded transition-colors"
                          style={{ 
                            background: '#2ecc71',
                            color: '#fff'
                          }}
                          title="Sync now"
                        >
                          <Zap size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Setup form */}
              {isExpanded && (
                <div className="border-t p-4" style={{ borderColor: t.border, background: t.isDark ? '#ffffff08' : '#00000008' }}>
                  <div className="space-y-3">
                    {connector.authMethod === 'api-key' ? (
                      /* API Key Form */
                      <div className="space-y-3">
                        {connector.fields.map(field => (
                          <div key={field.key} className="space-y-1">
                            <label className="text-[12px] font-medium" style={{ color: t.textDim }}>
                              {field.label} {field.required && <span style={{ color: '#e74c3c' }}>*</span>}
                            </label>
                            
                            {field.type === 'select' ? (
                              <select
                                value={formData[connector.id]?.[field.key] || ''}
                                onChange={e => setFormData({
                                  ...formData,
                                  [connector.id]: {
                                    ...formData[connector.id],
                                    [field.key]: e.target.value
                                  }
                                })}
                                className="w-full px-3 py-2 rounded text-[13px] outline-none"
                                style={{ 
                                  background: t.inputBg, 
                                  border: `1px solid ${t.border}`, 
                                  color: t.textPrimary
                                }}
                              >
                                <option value="">{field.placeholder}</option>
                                {field.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type}
                                value={formData[connector.id]?.[field.key] || ''}
                                onChange={e => setFormData({
                                  ...formData,
                                  [connector.id]: {
                                    ...formData[connector.id],
                                    [field.key]: e.target.value
                                  }
                                })}
                                placeholder={field.placeholder}
                                className="w-full px-3 py-2 rounded text-[13px] outline-none"
                                style={{ 
                                  background: t.inputBg, 
                                  border: `1px solid ${t.border}`, 
                                  color: t.textPrimary
                                }}
                              />
                            )}
                          </div>
                        ))}
                        
                        <div className="flex gap-2 pt-2">
                          <button 
                            type="button" 
                            onClick={() => {
                              const apiKey = formData[connector.id]?.apiKey;
                              if (apiKey) handleApiKeySubmit(connector.id, apiKey);
                            }}
                            disabled={isTesting || !formData[connector.id]?.apiKey}
                            className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium"
                            style={{ 
                              background: '#2ecc71',
                              color: '#fff',
                              opacity: isTesting || !formData[connector.id]?.apiKey ? 0.5 : 1
                            }}
                          >
                            {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                            Connect
                          </button>

                          {isConnected && (
                            <button 
                              type="button" 
                              onClick={() => handleDisconnect(connector.id)}
                              className="px-4 py-2 rounded text-[12px] font-medium"
                              style={{ 
                                background: 'transparent',
                                border: `1px solid ${t.border}`,
                                color: t.textDim
                              }}
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* OAuth Form */
                      <div className="space-y-3">
                        <p className="text-[12px]" style={{ color: t.textDim }}>
                          Click "Connect with OAuth" to authorize access to your {connector.name} account.
                        </p>
                        
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={() => handleOAuthStart(connector.id, 'your-client-id')} // TODO: Get from config
                            disabled={isTesting}
                            className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium"
                            style={{ 
                              background: '#2ecc71',
                              color: '#fff',
                              opacity: isTesting ? 0.5 : 1
                            }}
                          >
                            {isTesting ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                            Connect with OAuth
                          </button>

                          {isConnected && (
                            <button 
                              type="button" 
                              onClick={() => handleDisconnect(connector.id)}
                              className="px-4 py-2 rounded text-[12px] font-medium"
                              style={{ 
                                background: 'transparent',
                                border: `1px solid ${t.border}`,
                                color: t.textDim
                              }}
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {Object.keys(connectorAuth).length === 0 && (
        <div className="text-center py-8">
          <Database size={32} style={{ color: t.textFaint, margin: '0 auto 12px' }} />
          <p className="text-sm mb-2" style={{ color: t.textDim }}>
            Connect to external services
          </p>
          <p className="text-xs" style={{ color: t.textFaint }}>
            Import data from Notion, HubSpot, Slack and other platforms.
          </p>
        </div>
      )}
    </div>
  );
}