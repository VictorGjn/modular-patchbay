import { useProviderStore } from '../../store/providerStore';
import { useConsoleStore } from '../../store/consoleStore';
import { Settings, AlertTriangle, Zap } from 'lucide-react';
import { useTheme } from '../../theme';

/**
 * Prominent banner shown when no LLM provider is configured.
 * Displayed at the top of the wizard layout until at least one provider has models.
 */
export function ProviderOnboarding() {
  const t = useTheme();
  const providers = useProviderStore(s => s.providers);
  const setShowSettings = useConsoleStore(s => s.setShowSettings);

  const hasWorkingProvider = providers.some(
    p => p.models && p.models.length > 0 && (p.status === 'connected' || p.authMethod === 'claude-agent-sdk')
  );

  if (hasWorkingProvider) return null;

  return (
    <div
      style={{
        margin: '0 0 16px',
        padding: '14px 20px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #FE500015 0%, #FE500008 100%)',
        border: '1px solid #FE500030',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: '#FE500020',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={20} style={{ color: '#FE5000' }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, marginBottom: 2 }}>
          Set up an AI provider to get started
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary }}>
          Add an API key for Anthropic, OpenAI, or any compatible provider. Or use Claude Code for zero-config access.
        </div>
      </div>

      <button
        onClick={() => setShowSettings(true, 'providers')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          border: 'none',
          background: '#FE5000',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Settings size={14} />
        Configure Provider
      </button>

      <button
        onClick={() => setShowSettings(true, 'providers')}
        title="Quick: use Claude Code (no API key needed)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: 'transparent',
          color: t.textSecondary,
          fontSize: 12,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Zap size={12} />
        Claude Code
      </button>
    </div>
  );
}
