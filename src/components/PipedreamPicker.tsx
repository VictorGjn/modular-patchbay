import { useState, useEffect, useCallback } from 'react';
import { usePipedreamStore } from '../store/pipedreamStore';
import { useTheme } from '../theme';
import { Search, Plus, Trash2, Settings } from 'lucide-react';

export function PipedreamPicker() {
  const { configured, accounts, apps, loading, checkStatus, loadAccounts, searchApps, disconnectAccount } = usePipedreamStore();
  const [query, setQuery] = useState('');
  const t = useTheme();

  useEffect(() => { checkStatus(); }, []);
  useEffect(() => { if (configured) loadAccounts(); }, [configured]);

  const handleSearch = useCallback(async () => {
    if (query.trim()) await searchApps(query.trim());
  }, [query, searchApps]);

  if (!configured) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: t.textDim }}>
        <Settings size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p style={{ fontSize: 13, margin: 0 }}>Pipedream not configured.</p>
        <p style={{ fontSize: 11, margin: '4px 0 0' }}>Add credentials in Settings to connect 2000+ apps.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: t.inputBg, border: `1px solid ${t.border}` }}>
          <Search size={14} style={{ color: t.textDim }} />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search apps (notion, figma, slack...)"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: t.textPrimary, fontSize: 12 }} />
        </div>
        <button type="button" onClick={handleSearch}
          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#FE5000', color: '#fff', border: 'none', cursor: 'pointer' }}>Search</button>
      </div>
      {accounts.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: t.textDim, marginBottom: 6 }}>Connected</div>
          {accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#22c55e' }} />
              <span style={{ flex: 1, fontSize: 12, color: t.textPrimary }}>{acc.app}</span>
              <span style={{ fontSize: 10, color: t.textDim }}>{acc.name}</span>
              <button type="button" onClick={() => disconnectAccount(acc.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.textFaint, padding: 2 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {apps.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: t.textDim, marginBottom: 6 }}>Available</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {apps.slice(0, 12).map(app => (
              <div key={app.name_slug} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.borderSubtle}`, cursor: 'pointer' }}>
                {app.img_src && <img src={app.img_src} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />}
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
                <Plus size={14} style={{ color: '#FE5000' }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', fontSize: 11, color: t.textDim, padding: 8 }}>Loading...</div>}
    </div>
  );
}
