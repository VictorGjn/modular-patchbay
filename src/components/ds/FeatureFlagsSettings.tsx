import { useFeatureFlags, FLAG_META, type FeatureFlags } from '../../store/featureFlags';
import { useTheme } from '../../theme';
import { FlaskConical } from 'lucide-react';

const FLAG_KEYS: (keyof FeatureFlags)[] = [
  'teamRunner', 'contrastiveRetrieval', 'costIntelligence',
  'analytics', 'advancedMemoryBackends', 'skillsMarketplace',
];

export function FeatureFlagsSettings() {
  const flags = useFeatureFlags();
  const t = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <FlaskConical size={16} style={{ color: '#f59e0b' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>Experimental Features</span>
      </div>
      <p style={{ fontSize: 12, color: t.textDim, margin: 0 }}>
        These features are under development. Enable them to preview upcoming functionality.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FLAG_KEYS.map((key) => {
          const meta = FLAG_META[key];
          const enabled = flags[key];
          return (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 8,
              background: enabled ? '#f59e0b0a' : 'transparent',
              border: `1px solid ${enabled ? '#f59e0b30' : t.borderSubtle}`,
              cursor: 'pointer',
            }}>
              <input type="checkbox" checked={enabled} onChange={() => flags.toggle(key)}
                style={{ accentColor: '#f59e0b', width: 16, height: 16, cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{meta.label}</div>
                <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{meta.description}</div>
              </div>
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={() => flags.enableAll()}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${t.borderSubtle}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer' }}>
          Enable All
        </button>
        <button type="button" onClick={() => flags.disableAll()}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${t.borderSubtle}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer' }}>
          Disable All
        </button>
      </div>
    </div>
  );
}
