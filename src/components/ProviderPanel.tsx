import { useState } from 'react';
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Plus,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Bot,
  Sparkles,
  Gem,
  Route,
  Server,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '../theme';
import {
  useProviderStore,
  type ProviderConfig,
  type ProviderStatus,
  DEFAULT_PROVIDERS,
} from '../store/providerStore';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Bot,
  Sparkles,
  Gem,
  Route,
  Server,
};

function StatusDot({ status, color }: { status: ProviderStatus; color: string }) {
  const fill =
    status === 'connected' ? '#22c55e' :
    status === 'expired' ? color :
    '#666';
  return (
    <Circle
      size={8}
      fill={fill}
      stroke="none"
      style={{ flexShrink: 0 }}
    />
  );
}

function ProviderRow({ provider }: { provider: ProviderConfig }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const { setProviderKey, setProviderBaseUrl, setProviderStatus } = useProviderStore();

  const Icon = ICON_MAP[provider.icon] || Server;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate a connection test
    await new Promise((r) => setTimeout(r, 1200));
    if (provider.apiKey && provider.apiKey.length > 4) {
      setProviderStatus(provider.id, 'connected');
      setTestResult('ok');
    } else {
      setProviderStatus(provider.id, 'disconnected');
      setTestResult('fail');
    }
    setTesting(false);
    setTimeout(() => setTestResult(null), 3000);
  };

  const inputStyle: React.CSSProperties = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
    outline: 'none',
    width: '100%',
  };

  return (
    <div
      style={{
        background: expanded ? t.surfaceElevated : 'transparent',
        borderRadius: 10,
        transition: 'background 0.15s',
      }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="nodrag nowheel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 10,
          color: t.textPrimary,
        }}
      >
        {expanded ? (
          <ChevronDown size={12} style={{ color: t.textDim, flexShrink: 0 }} />
        ) : (
          <ChevronRight size={12} style={{ color: t.textDim, flexShrink: 0 }} />
        )}
        <Icon size={14} style={{ color: provider.color, flexShrink: 0 }} />
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            flex: 1,
            textAlign: 'left',
          }}
        >
          {provider.name}
        </span>
        <StatusDot status={provider.status} color={provider.color} />
      </button>

      {/* Expanded config */}
      {expanded && (
        <div
          className="nodrag nowheel"
          style={{
            padding: '0 12px 12px 34px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* API Key */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: t.textMuted,
              }}
            >
              API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={provider.apiKey || ''}
                onChange={(e) => setProviderKey(provider.id, e.target.value)}
                placeholder="sk-..."
                className="nodrag nowheel"
                style={{ ...inputStyle, paddingRight: 32 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="nodrag nowheel"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.textDim,
                  padding: 2,
                }}
              >
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: t.textMuted,
              }}
            >
              Base URL
            </label>
            <input
              type="text"
              value={provider.baseUrl}
              onChange={(e) => setProviderBaseUrl(provider.id, e.target.value)}
              className="nodrag nowheel"
              style={inputStyle}
            />
          </div>

          {/* Models */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: t.textMuted,
              }}
            >
              Models
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {provider.models.map((m) => (
                <span
                  key={m.id}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: t.badgeBg,
                    color: t.textSecondary,
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Auth note */}
          {provider.headerNote && (
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                color: t.textFaint,
                fontStyle: 'italic',
              }}
            >
              {provider.headerNote}
            </span>
          )}

          {/* Actions row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="nodrag nowheel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                padding: '5px 12px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.surfaceHover,
                color: t.textSecondary,
                cursor: testing ? 'default' : 'pointer',
                opacity: testing ? 0.7 : 1,
              }}
            >
              {testing ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : testResult === 'ok' ? (
                <CheckCircle2 size={12} style={{ color: '#22c55e' }} />
              ) : testResult === 'fail' ? (
                <XCircle size={12} style={{ color: '#ef4444' }} />
              ) : (
                <Zap size={12} />
              )}
              {testing ? 'Testing...' : testResult === 'ok' ? 'Connected' : testResult === 'fail' ? 'Failed' : 'Test Connection'}
            </button>

            {provider.docsUrl && (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="nodrag nowheel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  color: t.textDim,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={10} /> Docs
              </a>
            )}

            {provider.keyPageUrl && (
              <a
                href={provider.keyPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="nodrag nowheel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  color: t.textDim,
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={10} /> Get Key
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProviderPanel() {
  const t = useTheme();
  const providers = useProviderStore((s) => s.providers);

  const handleAddCustom = () => {
    const customTemplate = DEFAULT_PROVIDERS[DEFAULT_PROVIDERS.length - 1];
    const id = `custom-${Date.now()}`;
    const newProvider: ProviderConfig = {
      ...customTemplate,
      id,
      name: 'Custom Provider',
      status: 'disconnected',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
    };
    // Add via direct store mutation + persist
    useProviderStore.setState((state) => ({
      providers: [...state.providers, newProvider],
    }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: t.textMuted,
          padding: '4px 12px 8px',
        }}
      >
        Providers
      </div>

      {/* Provider list */}
      {providers.map((p) => (
        <ProviderRow key={p.id} provider={p} />
      ))}

      {/* Add custom */}
      <button
        type="button"
        onClick={handleAddCustom}
        className="nodrag nowheel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 4,
          padding: '8px 12px',
          borderRadius: 10,
          border: `1px dashed ${t.border}`,
          background: 'transparent',
          color: t.textDim,
          cursor: 'pointer',
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
        }}
      >
        <Plus size={12} />
        Add Custom Provider
      </button>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
