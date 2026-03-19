import { useCallback, useState, useEffect } from 'react';
import { useTheme } from '../../theme';
import {
  Database, ExternalLink, Settings, CheckCircle, XCircle,
  Clock, Loader2, Key, Zap, RefreshCw, Download, Search
} from 'lucide-react';
import { API_BASE } from '../../config';
import { useConsoleStore } from '../../store/consoleStore';
import type { KnowledgeType } from '../../store/knowledgeBase';

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

interface NotionSearchItem { id: string; title: string; type: string }

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
  const [loading] = useState(false);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, 'idle' | 'ok' | 'error'>>({});
  const [testError, setTestError] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [notionSearch, setNotionSearch] = useState('');
  const [notionSearchResults, setNotionSearchResults] = useState<NotionSearchItem[]>([]);
  const [notionSearching, setNotionSearching] = useState(false);
  const [selectedNotionIds, setSelectedNotionIds] = useState<Set<string>>(new Set());
  const addChannel = useConsoleStore(s => s.addChannel);

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

  const handleNotionTest = useCallback(async (apiKey: string) => {
    setTesting(prev => ({ ...prev, notion: true }));
    try {
      const resp = await fetch(`${API_BASE}/connectors/notion/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const json = await resp.json();
      if (json.status === 'ok') {
        setTestResult(prev => ({ ...prev, notion: 'ok' }));
        setTestError(prev => ({ ...prev, notion: '' }));
      } else {
        setTestResult(prev => ({ ...prev, notion: 'error' }));
        setTestError(prev => ({ ...prev, notion: String(json.error ?? 'Test failed') }));
      }
    } catch {
      setTestResult(prev => ({ ...prev, notion: 'error' }));
      setTestError(prev => ({ ...prev, notion: 'Connection error. Check your network.' }));
    } finally {
      setTesting(prev => ({ ...prev, notion: false }));
    }
  }, []);

  const handleNotionSearch = useCallback(async (apiKey: string, query: string) => {
    setNotionSearching(true);
    setNotionSearchResults([]);
    try {
      const resp = await fetch(`${API_BASE}/connectors/notion/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, query }),
      });
      const json = await resp.json() as { status: string; data?: NotionSearchItem[] };
      if (json.status === 'ok' && Array.isArray(json.data)) {
        setNotionSearchResults(json.data);
        setSelectedNotionIds(new Set());
      }
    } catch { /* ignore */ }
    finally { setNotionSearching(false); }
  }, []);

  const handleNotionFetch = useCallback(async (connectorId: string) => {
    const data = formData[connectorId] ?? {};
    const apiKey = data.apiKey ?? '';
    const databaseIds = data.databaseIds
      ? data.databaseIds.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;
    const pageUrls = data.pageUrls
      ? data.pageUrls.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined;
    setFetching(prev => ({ ...prev, [connectorId]: true }));
    try {
      const resp = await fetch(`${API_BASE}/connectors/notion/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, databaseIds, pageUrls }),
      });
      const json = await resp.json();
      if (json.status === 'ok' && Array.isArray(json.data)) {
        for (const item of json.data) {
          addChannel({
            sourceId: `notion-${String(item.id)}`,
            name: String(item.title),
            path: `notion://${String(item.id)}`,
            category: 'knowledge',
            knowledgeType: 'evidence' as KnowledgeType,
            depth: 100,
            baseTokens: Number(item.tokens) || 0,
            content: String(item.content),
          });
        }
      }
    } catch {
      // network error — silently ignored
    } finally {
      setFetching(prev => ({ ...prev, [connectorId]: false }));
    }
  }, [formData, addChannel]);

  const handleNotionFetchSelected = useCallback(async (apiKey: string) => {
    if (!selectedNotionIds.size) return;
    const pageUrls: string[] = [];
    const databaseIds: string[] = [];
    for (const id of selectedNotionIds) {
      if (notionSearchResults.find(r => r.id === id)?.type === 'database') databaseIds.push(id);
      else pageUrls.push(`https://notion.so/${id.replace(/-/g, '')}`);
    }
    setFetching(prev => ({ ...prev, notion: true }));
    try {
      const resp = await fetch(`${API_BASE}/connectors/notion/fetch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, databaseIds, pageUrls }),
      });
      const json = await resp.json() as { status: string; data?: Array<{ id: unknown; title: unknown; tokens: unknown; content: unknown }> };
      if (json.status === 'ok' && Array.isArray(json.data)) {
        for (const item of json.data) {
          addChannel({ sourceId: `notion-${String(item.id)}`, name: String(item.title), path: `notion://${String(item.id)}`, category: 'knowledge', knowledgeType: 'evidence' as KnowledgeType, depth: 100, baseTokens: Number(item.tokens) || 0, content: String(item.content) });
        }
      }
    } catch { /* ignore */ } finally { setFetching(prev => ({ ...prev, notion: false })); }
  }, [selectedNotionIds, notionSearchResults, addChannel]);

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
          const isComingSoon = connector.authMethod === 'oauth';

          return (
            <div key={connector.id} className="rounded-lg border overflow-hidden"
              style={{
                borderColor: isConnected ? '#2ecc71' : t.border,
                background: t.isDark ? '#ffffff05' : '#00000005',
                opacity: isComingSoon ? 0.6 : 1,
              }}>
              
              {/* Header */}
              <div
                className={isComingSoon ? 'p-4' : 'p-4 cursor-pointer'}
                onClick={() => !isComingSoon && setExpandedConnector(isExpanded ? null : connector.id)}
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
                    {isComingSoon && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: t.isDark ? '#ffffff15' : '#00000015', color: t.textDim }}>
                        Coming soon
                      </span>
                    )}
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
                        
                        <div className="flex gap-2 pt-2 flex-wrap">
                          {connector.id === 'notion' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => { const k = formData[connector.id]?.apiKey; if (k) handleNotionTest(k); }}
                                disabled={isTesting || !formData[connector.id]?.apiKey}
                                className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium"
                                style={{ background: '#2ecc71', color: '#fff', opacity: isTesting || !formData[connector.id]?.apiKey ? 0.5 : 1 }}
                              >
                                {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                                Test
                              </button>
                              {testResult[connector.id] === 'ok' && (
                                <button
                                  type="button"
                                  onClick={() => handleNotionFetch(connector.id)}
                                  disabled={fetching[connector.id]}
                                  className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium"
                                  style={{ background: '#3498db', color: '#fff', opacity: fetching[connector.id] ? 0.5 : 1 }}
                                >
                                  {fetching[connector.id] ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                  Fetch
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { const apiKey = formData[connector.id]?.apiKey; if (apiKey) handleApiKeySubmit(connector.id, apiKey); }}
                              disabled={isTesting || !formData[connector.id]?.apiKey}
                              className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium"
                              style={{ background: '#2ecc71', color: '#fff', opacity: isTesting || !formData[connector.id]?.apiKey ? 0.5 : 1 }}
                            >
                              {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                              Connect
                            </button>
                          )}
                          {isConnected && (
                            <button
                              type="button"
                              onClick={() => handleDisconnect(connector.id)}
                              className="px-4 py-2 rounded text-[12px] font-medium"
                              style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim }}
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                        {testResult[connector.id] === 'ok' && connector.id === 'notion' && (
                          <div className="flex items-center gap-1 mt-2 text-[12px]" style={{ color: '#2ecc71' }}>
                            <CheckCircle size={12} />
                            Connection verified
                          </div>
                        )}
                        {testResult[connector.id] === 'error' && testError[connector.id] && (
                          <p className="mt-2 text-[12px]" style={{ color: '#e74c3c' }}>{testError[connector.id]}</p>
                        )}
                        {testResult[connector.id] === 'ok' && connector.id === 'notion' && (
                          <div className="space-y-2 pt-3 border-t" style={{ borderColor: t.border }}>
                            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: t.textDim }}>Search workspace</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={notionSearch}
                                onChange={e => setNotionSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { handleNotionSearch(formData[connector.id]?.apiKey ?? '', notionSearch); } }}
                                placeholder="Search pages and databases…"
                                className="flex-1 px-3 py-1.5 rounded text-[13px] outline-none"
                                style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary }}
                              />
                              <button
                                type="button"
                                onClick={() => handleNotionSearch(formData[connector.id]?.apiKey ?? '', notionSearch)}
                                disabled={notionSearching}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium"
                                style={{ background: '#3498db', color: '#fff', opacity: notionSearching ? 0.5 : 1 }}
                              >
                                {notionSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                                Search
                              </button>
                            </div>
                            {notionSearchResults.length > 0 && (
                              <div className="space-y-0 max-h-40 overflow-y-auto rounded border" style={{ borderColor: t.border }}>
                                {notionSearchResults.map(r => (
                                  <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                                    style={{ background: selectedNotionIds.has(r.id) ? (t.isDark ? '#ffffff10' : '#00000010') : 'transparent' }}>
                                    <input type="checkbox" checked={selectedNotionIds.has(r.id)} onChange={e => {
                                      const next = new Set(selectedNotionIds);
                                      if (e.target.checked) next.add(r.id); else next.delete(r.id);
                                      setSelectedNotionIds(next);
                                    }} />
                                    <span className="flex-1 text-[12px] truncate" style={{ color: t.textPrimary }}>{r.title}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: t.isDark ? '#ffffff15' : '#00000015', color: t.textDim }}>{r.type}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {selectedNotionIds.size > 0 && (
                              <button
                                type="button"
                                onClick={() => handleNotionFetchSelected(formData[connector.id]?.apiKey ?? '')}
                                disabled={fetching[connector.id]}
                                className="flex items-center gap-2 px-4 py-1.5 rounded text-[12px] font-medium"
                                style={{ background: '#8e44ad', color: '#fff', opacity: fetching[connector.id] ? 0.5 : 1 }}
                              >
                                {fetching[connector.id] ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                Add {selectedNotionIds.size} selected
                              </button>
                            )}
                          </div>
                        )}
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