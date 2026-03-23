/**
 * ConnectorPicker — Native API Connectors (Tier 1)
 *
 * Sources from connectorRegistry.ts (NOT MCP registry).
 * Each connector has direct REST API integration via server/routes/connectors/.
 * MCP servers are handled separately by ConnectionPicker.
 */
import { useState, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import type { ConnectorService } from '../store/knowledgeBase';
import { useTheme } from '../theme';
import { Plus, Check, Loader2, Key, CheckCircle, XCircle } from 'lucide-react';
import { PickerModal } from './PickerModal';
import { CONNECTOR_REGISTRY, type ConnectorRegistryEntry } from '../store/connectorRegistry';
import { API_BASE } from '../config';

export function ConnectorPicker() {
  const showConnectorPicker = useConsoleStore((s) => s.showConnectorPicker);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const connectors = useConsoleStore((s) => s.connectors);
  const addConnector = useConsoleStore((s) => s.addConnector);
  const t = useTheme();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, 'idle' | 'ok' | 'error'>>({});
  const [testError, setTestError] = useState<Record<string, string>>({});

  const isAdded = (service: ConnectorService) => connectors.some(c => c.service === service);

  const handleTest = useCallback(async (entry: ConnectorRegistryEntry) => {
    const data = formData[entry.id] ?? {};
    setTesting(p => ({ ...p, [entry.id]: true }));
    setTestResult(p => ({ ...p, [entry.id]: 'idle' }));
    setTestError(p => ({ ...p, [entry.id]: '' }));

    try {
      const resp = await fetch(`${API_BASE}/connectors/v2/${entry.routeId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await resp.json();
      if (json.status === 'ok') {
        setTestResult(p => ({ ...p, [entry.id]: 'ok' }));
      } else {
        setTestResult(p => ({ ...p, [entry.id]: 'error' }));
        setTestError(p => ({ ...p, [entry.id]: json.error || 'Test failed' }));
      }
    } catch {
      setTestResult(p => ({ ...p, [entry.id]: 'error' }));
      setTestError(p => ({ ...p, [entry.id]: 'Network error' }));
    } finally {
      setTesting(p => ({ ...p, [entry.id]: false }));
    }
  }, [formData]);

  const handleAdd = useCallback((entry: ConnectorRegistryEntry) => {
    addConnector({
      id: `conn-${entry.id}-${Date.now()}`,
      service: entry.id as ConnectorService,
      name: entry.name,
      mcpServerId: '',
      direction: 'both',
      enabled: true,
      config: formData[entry.id] ?? {},
      status: 'connected',
      authMethod: entry.authMethod,
      surfaces: entry.supportedSurfaces,
    });
    setExpandedId(null);
    setTestResult(p => ({ ...p, [entry.id]: 'idle' }));
  }, [addConnector, formData]);

  const renderEntry = (entry: ConnectorRegistryEntry) => {
    const added = isAdded(entry.id as ConnectorService);
    const isExpanded = expandedId === entry.id;
    const isTesting = testing[entry.id];
    const result = testResult[entry.id];
    const error = testError[entry.id];
    const isOAuth = entry.authMethod === 'oauth';

    return (
      <div key={entry.id}>
        <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
          onClick={() => !added && setExpandedId(isExpanded ? null : entry.id)}
          style={{ opacity: added ? 0.5 : 1 }}
        >
          <span className="text-xl">{entry.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{entry.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase"
                style={{
                  background: entry.authMethod === 'api-key' ? '#3498db10' : '#FE500010',
                  color: entry.authMethod === 'api-key' ? '#3498db' : '#FE5000',
                  fontFamily: "'Geist Mono', monospace",
                  fontWeight: 600,
                }}>
                {entry.authMethod === 'api-key' ? 'API Key' : 'OAuth'}
              </span>
              {entry.supportedSurfaces.map(s => (
                <span key={s} className="text-[9px] px-1 py-0.5 rounded"
                  style={{ background: t.isDark ? '#ffffff10' : '#00000008', color: t.textFaint }}>
                  {s}
                </span>
              ))}
            </div>
            <span className="text-[11px]" style={{ color: t.textDim }}>{entry.description}</span>
          </div>
          {added ? (
            <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ color: '#2ecc71', background: '#2ecc7110' }}>
              <Check size={12} /> Connected
            </span>
          ) : (
            <span className="text-[11px] px-2 py-1 rounded" style={{ color: t.textDim, background: t.surfaceElevated }}>
              {isExpanded ? '▾' : 'Configure'}
            </span>
          )}
        </div>

        {/* Expanded config form */}
        {isExpanded && !added && (
          <div className="px-4 py-3 mx-4 mb-2 rounded-lg space-y-3" style={{ background: t.surfaceElevated }}>
            {isOAuth ? (
              <div className="text-[12px]" style={{ color: t.textDim }}>
                OAuth connectors require server-side configuration. Coming soon.
              </div>
            ) : (
              <>
                {entry.authFields.map(field => (
                  <div key={field.key}>
                    <label className="text-[11px] font-medium" style={{ color: t.textDim }}>
                      {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={formData[entry.id]?.[field.key] ?? ''}
                      onChange={e => setFormData(p => ({
                        ...p,
                        [entry.id]: { ...p[entry.id], [field.key]: e.target.value },
                      }))}
                      className="w-full mt-1 px-2.5 py-1.5 text-[12px] rounded border outline-none"
                      style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTest(entry)}
                    disabled={isTesting || entry.authFields.some(f => f.required && !formData[entry.id]?.[f.key])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold border-none cursor-pointer"
                    style={{ background: '#2ecc71', color: '#fff', opacity: isTesting ? 0.6 : 1 }}
                  >
                    {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                    Test Connection
                  </button>
                  {result === 'ok' && (
                    <button
                      type="button"
                      onClick={() => handleAdd(entry)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold border-none cursor-pointer"
                      style={{ background: '#FE5000', color: '#fff' }}
                    >
                      <Plus size={12} /> Add Connector
                    </button>
                  )}
                </div>
                {result === 'ok' && (
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: '#2ecc71' }}>
                    <CheckCircle size={12} /> Connection verified
                  </div>
                )}
                {result === 'error' && error && (
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: '#ef4444' }}>
                    <XCircle size={12} /> {error}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <PickerModal
      open={showConnectorPicker}
      onClose={() => { setShowConnectorPicker(false); setExpandedId(null); }}
      title="Connect API Service"
      searchPlaceholder="Search connectors..."
    >
      {(filter) => {
        const f = filter?.toLowerCase() ?? '';
        const filtered = CONNECTOR_REGISTRY.filter(e =>
          !f || e.name.toLowerCase().includes(f) || e.description.toLowerCase().includes(f) || e.id.includes(f)
        );

        const apiKey = filtered.filter(e => e.authMethod === 'api-key');
        const oauth = filtered.filter(e => e.authMethod === 'oauth');

        return (
          <>
            {apiKey.length > 0 && (
              <>
                <div className="px-5 pt-3 pb-1 text-[11px] tracking-[0.12em] uppercase"
                  style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                  API Key Authentication
                </div>
                {apiKey.map(renderEntry)}
              </>
            )}
            {oauth.length > 0 && (
              <>
                <div className="px-5 pt-3 pb-1 text-[11px] tracking-[0.12em] uppercase"
                  style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                  OAuth (Coming Soon)
                </div>
                {oauth.map(renderEntry)}
              </>
            )}
          </>
        );
      }}
    </PickerModal>
  );
}
