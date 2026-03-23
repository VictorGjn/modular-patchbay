import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../theme';
import { useMemoryStore, type MemoryDomain, type StoreBackend, type SessionStrategy, type SandboxIsolation, type MemoryScope, type EmbeddingModel, type RecallStrategy, type WriteMode, type ExtractType } from '../store/memoryStore';
import { generateMemoryConfig } from '../utils/generateSection';
import { Input } from '../components/ds/Input';
import { Toggle } from '../components/ds/Toggle';
import { Select } from '../components/ds/Select';
import { Section } from '../components/ds/Section';
import { GenerateBtn } from '../components/ds/GenerateBtn';
import {
  Brain, Plus, X, Database, CheckCircle, XCircle, AlertCircle, Loader, Zap, Trash2
} from 'lucide-react';



function SliderRow({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  const t = useTheme();
  const display = suffix === 'K' ? `${(value / 1000).toFixed(0)}K` : `${value}`;
  const sliderId = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const valueId = `${sliderId}-value`;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
      <label 
        htmlFor={sliderId}
        className="text-sm font-medium shrink-0 sm:w-32" 
        style={{ color: t.textPrimary }}
      >
        {label}
      </label>
      <div className="flex items-center gap-3 flex-1">
        <input 
          id={sliderId}
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          title={`Adjust ${label.toLowerCase()}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${display}${suffix ? ' ' + suffix.toLowerCase() : ''}`}
          aria-describedby={valueId}
          className="flex-1" 
          style={{ accentColor: '#FE5000' }} 
        />
        <span 
          id={valueId}
          className="text-sm w-12 text-right" 
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}
          aria-live="polite"
        >
          {display}
        </span>
      </div>
    </div>
  );
}

const STRATEGY_OPTIONS = [
  { value: 'full', label: 'Full History', description: 'Keep all conversation messages in memory' },
  { value: 'sliding_window', label: 'Sliding Window', description: 'Keep only the most recent messages' },
  { value: 'summarize_and_recent', label: 'Summarize + Recent', description: 'Summarize old messages, keep recent ones' },
  { value: 'rag', label: 'RAG over History', description: 'Retrieve relevant messages from searchable storage' },
];

const STORE_OPTIONS = [
  { value: 'local_sqlite', label: 'SQLite (local)', disabled: false },
  { value: 'postgres', label: 'PostgreSQL', disabled: false },
  { value: 'hindsight', label: 'Hindsight', disabled: false },
  { value: 'redis', label: 'Redis (coming soon)', disabled: true },
  { value: 'chromadb', label: 'ChromaDB (coming soon)', disabled: true },
  { value: 'pinecone', label: 'Pinecone (coming soon)', disabled: true },
  { value: 'custom', label: 'Custom (coming soon)', disabled: true },
];

const EMBEDDING_OPTIONS = [
  { value: 'text-embedding-3-small', label: 'Ada 3 Small' },
  { value: 'text-embedding-3-large', label: 'Ada 3 Large' },
  { value: 'voyage-3', label: 'Voyage 3' },
  { value: 'custom', label: 'Custom' },
];

const RECALL_OPTIONS = [
  { value: 'top_k', label: 'Top-K' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'hybrid', label: 'Hybrid' },
];

const WRITE_MODE_OPTIONS = [
  { value: 'auto_extract', label: 'Auto Extract' },
  { value: 'explicit', label: 'Explicit Only' },
  { value: 'both', label: 'Both' },
];

const SCOPE_OPTIONS = [
  { value: 'per_user', label: 'Per User' },
  { value: 'per_agent', label: 'Per Agent' },
  { value: 'global', label: 'Global' },
];

const EXTRACT_TYPES: Array<{ value: ExtractType; label: string; color: string }> = [
  { value: 'user_preferences', label: 'Preferences', color: '#3498db' },
  { value: 'decisions', label: 'Decisions', color: '#e67e22' },
  { value: 'facts', label: 'Facts', color: '#2ecc71' },
  { value: 'feedback', label: 'Feedback', color: '#9b59b6' },
  { value: 'entities', label: 'Entities', color: '#f1c40f' },
];

const SANDBOX_OPTIONS = [
  { value: 'reset_each_run', label: 'Reset Each Run' },
  { value: 'persistent_sandbox', label: 'Persistent Sandbox' },
  { value: 'clone_from_shared', label: 'Clone from Shared' },
];

const DOMAIN_COLORS: Record<string, string> = {
  shared: '#2ecc71',
  agent_private: '#3498db',
  run_scratchpad: '#e67e22',
};

const FACT_TYPE_COLORS: Record<string, string> = {
  preference: '#3498db',
  decision: '#e67e22',
  fact: '#2ecc71',
  entity: '#f1c40f',
  custom: '#999',
};

// Layout handled via Tailwind: grid grid-cols-1 lg:grid-cols-2 gap-6

const factItemStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.875rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.25rem',
};

const factDomainBadgeStyles = {
  fontSize: '0.75rem',
  padding: '0.25rem 0.5rem',
  borderRadius: '9999px',
  fontFamily: "'Geist Mono', monospace",
};

const factTagStyles = {
  fontSize: '0.75rem',
  padding: '0.125rem 0.375rem',
  borderRadius: '0.25rem',
  fontFamily: "'Geist Mono', monospace",
};

const removeButtonStyles = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: '0.25rem',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '44px',
  minHeight: '44px',
};

// Budget bar styles handled inline (≤3 props) or via Tailwind

export function MemoryTab() {
  const t = useTheme();
  const session = useMemoryStore(s => s.session);
  const longTerm = useMemoryStore(s => s.longTerm);
  const working = useMemoryStore(s => s.working);
  const facts = useMemoryStore(s => s.facts);
  const setSessionConfig = useMemoryStore(s => s.setSessionConfig);
  const setLongTermConfig = useMemoryStore(s => s.setLongTermConfig);
  const setRecallConfig = useMemoryStore(s => s.setRecallConfig);
  const setWriteConfig = useMemoryStore(s => s.setWriteConfig);
  const toggleExtractType = useMemoryStore(s => s.toggleExtractType);
  const setWorkingConfig = useMemoryStore(s => s.setWorkingConfig);
  const addFact = useMemoryStore(s => s.addFact);
  const removeFact = useMemoryStore(s => s.removeFact);
  const sandbox = useMemoryStore(s => s.sandbox);
  const setSandboxConfig = useMemoryStore(s => s.setSandboxConfig);
  const setSandboxDomain = useMemoryStore(s => s.setSandboxDomain);

  const responseCache = useMemoryStore(s => s.responseCache);
  const setResponseCacheConfig = useMemoryStore(s => s.setResponseCacheConfig);
  const [sessionCollapsed, setSessionCollapsed] = useState(false);
  const [longTermCollapsed, setLongTermCollapsed] = useState(false);
  const [workingCollapsed, setWorkingCollapsed] = useState(false);
  const [factsCollapsed, setFactsCollapsed] = useState(false);
  const [sandboxCollapsed, setSandboxCollapsed] = useState(false);
  const [cacheCollapsed, setCacheCollapsed] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ totalEntries: number; hitRate: number; estimatedSavings: number } | null>(null);
  const [purging, setPurging] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [newFactDomain, setNewFactDomain] = useState<MemoryDomain>('shared');
  const [generating, setGenerating] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [backendHealth, setBackendHealth] = useState<{ status: string; factCount: number } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const config = await generateMemoryConfig();
      setSessionConfig({ maxMessages: config.maxMessages, summarizeAfter: config.summarizeAfter, summarizeEnabled: config.summarizeEnabled });
      for (const fact of config.suggestedFacts || []) {
        addFact(fact, ['generated']);
      }
    } catch { /* silent */ }
    setGenerating(false);
  }, [setSessionConfig, addFact]);

  const checkBackendHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/memory/health');
      if (!response.ok) {
        // Server error — don't crash, just show degraded status
        setBackendHealth({ status: 'unavailable', factCount: 0 });
        return { status: 'unavailable', factCount: 0 };
      }
      const result = await response.json();
      const health = result.health ?? result.data ?? { status: 'unknown', factCount: 0 };
      setBackendHealth(health);
      return health;
    } catch {
      // Network error or server not running
      setBackendHealth({ status: 'unavailable', factCount: 0 });
      return { status: 'unavailable', factCount: 0 };
    }
  }, []);

  const testConnection = useCallback(async (backend: StoreBackend, connStr?: string) => {
    setTestingConnection(true);
    setConnectionStatus('testing');
    try {
      const response = await fetch('/api/memory/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend, connectionString: connStr })
      });
      const result = await response.json();
      if (result.status === 'success') {
        setConnectionStatus('success');
        setLongTermConfig({ store: backend });
        await checkBackendHealth();
      } else {
        setConnectionStatus('error');
        console.error('Connection test failed:', result.error);
      }
    } catch (error) {
      setConnectionStatus('error');
      console.error('Connection test error:', error);
    }
    setTestingConnection(false);
  }, [setLongTermConfig, checkBackendHealth]);

  const handleStoreChange = useCallback(async (newStore: string) => {
    const storeBackend = newStore as StoreBackend;
    if (storeBackend === 'postgres') {
      // Just update the UI, don't test connection yet
      setLongTermConfig({ store: storeBackend });
      setConnectionStatus('idle');
    } else if (storeBackend === 'local_sqlite') {
      await testConnection(storeBackend);
    } else {
      // For other backends (Redis, ChromaDB, Pinecone), just update UI
      setLongTermConfig({ store: storeBackend });
      setConnectionStatus('idle');
    }
  }, [setLongTermConfig, testConnection]);

  const loadCacheStats = useCallback(async () => {
    try {
      const res = await fetch('/api/cache/stats');
      if (!res.ok) return;
      const data = await res.json() as { totalEntries: number; hitRate: number; estimatedSavings: number };
      setCacheStats(data);
    } catch { /* ignore */ }
  }, []);

  const handlePurgeCache = useCallback(async () => {
    setPurging(true);
    try {
      await fetch('/api/cache/purge', { method: 'DELETE' });
      await loadCacheStats();
    } catch { /* ignore */ }
    setPurging(false);
  }, [loadCacheStats]);

  // Load backend health on mount
  useEffect(() => {
    checkBackendHealth();
    loadCacheStats();
  }, [checkBackendHealth, loadCacheStats]);

  const totalBudget = session.tokenBudget + longTerm.tokenBudget + working.tokenBudget;
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  // Compute a simple summary line for the badge
  const features: string[] = [];
  if (longTerm.enabled) features.push('long-term');
  if (working.enabled) features.push('scratchpad');


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Memory Configuration
        </h2>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Configure how your agent remembers and manages information across conversations. Set up session memory, long-term storage, working memory, and seed facts.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Session Memory + Seed Facts + Sandbox */}
        <div className="space-y-6">
          {/* Session Memory */}
      <Section
        icon={Brain} label="Session Memory" color="#3498db"
        badge={`${session.windowSize} messages · ${session.strategy}`}
        collapsed={sessionCollapsed} onToggle={() => setSessionCollapsed(!sessionCollapsed)}
      >
        <div className="flex justify-end mb-4">
          <GenerateBtn loading={generating} onClick={handleGenerate} label="Configure" />
        </div>
        
        <SliderRow 
          label="Window Size" 
          value={session.windowSize} 
          min={5} 
          max={100} 
          step={5}
          onChange={v => setSessionConfig({ windowSize: v })} 
        />
        
        <div className="mb-4">
          <Select 
            options={STRATEGY_OPTIONS} 
            value={session.strategy}
            onChange={v => setSessionConfig({ strategy: v as SessionStrategy })}
            label="Strategy" 
          />
          {STRATEGY_OPTIONS.find(opt => opt.value === session.strategy)?.description && (
            <p className="text-xs mt-1" style={{ color: t.textSecondary }}>
              {STRATEGY_OPTIONS.find(opt => opt.value === session.strategy)?.description}
            </p>
          )}
        </div>

        {(session.strategy === 'summarize_and_recent') && (
          <SliderRow 
            label="Summarize After" 
            value={session.summarizeAfter} 
            min={5} 
            max={session.windowSize} 
            step={5}
            onChange={v => setSessionConfig({ summarizeAfter: v })} 
          />
        )}

        <div className="mb-4">
          <Toggle 
            checked={session.summarizeEnabled} 
            onChange={v => setSessionConfig({ summarizeEnabled: v })}
            label="Enable summarization of older messages" 
          />
        </div>

        <SliderRow 
          label="Token Budget" 
          value={session.tokenBudget} 
          min={1000} 
          max={60000} 
          step={1000}
          onChange={v => setSessionConfig({ tokenBudget: v })} 
          suffix="K" 
        />
      </Section>

          {/* Seed Facts */}
          <Section
            icon={Brain} label="Seed Facts" color="#e74c3c"
            badge={`${facts.length} facts`}
            collapsed={factsCollapsed} onToggle={() => setFactsCollapsed(!factsCollapsed)}
          >
            <div className="space-y-2 mb-4">
              {facts.map(fact => {
                const domainColor = DOMAIN_COLORS[fact.domain] || '#999';
                return (
                  <div key={fact.id} 
                    style={{ ...factItemStyles, background: t.surfaceElevated }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: FACT_TYPE_COLORS[fact.type] || '#999', flexShrink: 0 }} />
                    <span className="flex-1 truncate" style={{ color: t.textPrimary }}>
                      {fact.content}
                    </span>
                    <span 
                      style={{ 
                        ...factDomainBadgeStyles,
                        background: `${domainColor}15`, 
                        color: domainColor 
                      }}>
                      {fact.domain.replace('_', ' ')}
                    </span>
                    {fact.tags.length > 0 && fact.tags.map(tag => (
                      <span key={tag} 
                        style={{ 
                          ...factTagStyles,
                          background: `${FACT_TYPE_COLORS[fact.type] || '#999'}15`, 
                          color: FACT_TYPE_COLORS[fact.type] || '#999' 
                        }}>
                        {tag}
                      </span>
                    ))}
                    <button type="button" aria-label="Remove fact" title="Remove fact" onClick={() => removeFact(fact.id)}
                      style={{ ...removeButtonStyles, color: t.textFaint }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#ef444420';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = t.textFaint;
                      }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              {facts.length === 0 && (
                <div className="text-center py-8 text-sm" style={{ color: t.textDim }}>
                  No seed facts added yet. Add facts that your agent should always remember.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input 
                value={newFactText} 
                onChange={e => setNewFactText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newFactText.trim()) { addFact(newFactText.trim(), [], 'fact', newFactDomain); setNewFactText(''); } }}
                placeholder="Add a seed fact..." 
                className="flex-1"
              />
              <select 
                value={newFactDomain} 
                onChange={e => setNewFactDomain(e.target.value as MemoryDomain)}
                aria-label="Fact domain"
                title="Select fact domain"
                className="text-sm px-3 rounded border-none cursor-pointer"
                style={{ background: t.surfaceElevated, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}
              >
                <option value="shared">shared</option>
                <option value="agent_private">private</option>
                <option value="run_scratchpad">scratch</option>
              </select>
              <button 
                type="button" 
                aria-label="Add fact"
                title="Add new fact"
                onClick={() => { if (newFactText.trim()) { addFact(newFactText.trim(), [], 'fact', newFactDomain); setNewFactText(''); } }}
                className="px-3 border-none rounded cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{ background: '#FE5000', color: '#fff' }}
              >
                <Plus size={12} />
              </button>
            </div>
          </Section>

          {/* Sandbox Configuration */}
          <Section
            icon={Brain} label="Sandbox Configuration" color="#9b59b6"
            badge={sandbox.isolation}
            collapsed={sandboxCollapsed} onToggle={() => setSandboxCollapsed(!sandboxCollapsed)}
          >
            <div className="space-y-4">
              <Select 
                options={SANDBOX_OPTIONS} 
                value={sandbox.isolation}
                onChange={v => setSandboxConfig({ isolation: v as SandboxIsolation })}
                label="Isolation" 
              />

              <div>
                <Toggle 
                  checked={sandbox.allowPromoteToShared} 
                  onChange={v => setSandboxConfig({ allowPromoteToShared: v })}
                  label="Allow promote to shared memory" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>
                  Memory Domains
                </label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'shared' as const, label: 'Shared', color: DOMAIN_COLORS.shared },
                    { key: 'agentPrivate' as const, label: 'Agent Private', color: DOMAIN_COLORS.agent_private },
                    { key: 'runScratchpad' as const, label: 'Run Scratchpad', color: DOMAIN_COLORS.run_scratchpad },
                  ]).map(d => {
                    const active = sandbox.domains[d.key].enabled;
                    return (
                      <button 
                        key={d.key} 
                        type="button" 
                        aria-label={`Toggle ${d.label}`} 
                        title={`Toggle ${d.label}`}
                        aria-pressed={active}
                        onClick={() => setSandboxDomain(d.key, !active)}
                        className="text-sm px-3 py-2 rounded-full cursor-pointer border-none min-h-[44px]"
                        style={{
                          fontFamily: "'Geist Sans', sans-serif",
                          background: active ? `${d.color}20` : t.isDark ? '#1c1c20' : '#f0f0f5',
                          color: active ? d.color : t.textDim,
                          border: `1px solid ${active ? `${d.color}40` : 'transparent'}`,
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Right column - Long-Term + Working Memory + Budget */}
        <div className="space-y-6">
          {/* Long-Term Memory */}
          <Section
            icon={Brain} label="Long-Term Memory" color="#2ecc71"
            badge={longTerm.enabled 
              ? `${longTerm.store}${backendHealth ? ` · ${backendHealth.factCount} facts` : ` · ${longTerm.maxEntries} max`}`
              : 'disabled'
            }
            collapsed={longTermCollapsed} onToggle={() => setLongTermCollapsed(!longTermCollapsed)}
          >
        <div className="mb-4">
          <Toggle 
            checked={longTerm.enabled} 
            onChange={v => setLongTermConfig({ enabled: v })} 
            label="Enable long-term memory" 
          />
        </div>

        {longTerm.enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select 
                options={STORE_OPTIONS} 
                value={longTerm.store}
                onChange={handleStoreChange} 
                label="Store" 
              />
              <Select 
                options={SCOPE_OPTIONS} 
                value={longTerm.scope}
                onChange={v => setLongTermConfig({ scope: v as MemoryScope })}
                label="Scope" 
              />
            </div>

            {longTerm.store === 'postgres' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input 
                    value={connectionString}
                    onChange={e => setConnectionString(e.target.value)}
                    placeholder="postgresql://user:password@localhost:5432/database"
                    className="flex-1"
                    type="password"
                  />
                  <button 
                    type="button" 
                    onClick={() => testConnection('postgres', connectionString)}
                    disabled={!connectionString || testingConnection}
                    className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] flex items-center justify-center gap-2"
                    style={{ 
                      background: connectionStatus === 'success' ? '#2ecc71' : '#FE5000', 
                      color: '#fff' 
                    }}
                  >
                    {testingConnection ? (
                      <>
                        <Loader size={14} className="animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {connectionStatus === 'success' && (
                    <>
                      <CheckCircle size={14} style={{ color: '#2ecc71' }} />
                      <span style={{ color: '#2ecc71' }}>Connected successfully</span>
                    </>
                  )}
                  {connectionStatus === 'error' && (
                    <>
                      <XCircle size={14} style={{ color: '#e74c3c' }} />
                      <span style={{ color: '#e74c3c' }}>Connection failed</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {(['redis', 'chromadb', 'pinecone', 'custom'].includes(longTerm.store)) && (
              <div className="flex items-center gap-2 p-3 rounded" style={{ background: '#f39c1220', border: '1px solid #f39c1240' }}>
                <AlertCircle size={16} style={{ color: '#f39c12' }} />
                <span className="text-sm" style={{ color: '#f39c12' }}>Coming soon</span>
              </div>
            )}

            {backendHealth && (
              <div className="flex items-center gap-2 p-3 rounded" 
                style={{ 
                  background: backendHealth.status === 'healthy' ? '#2ecc7120' : '#e74c3c20',
                  border: `1px solid ${backendHealth.status === 'healthy' ? '#2ecc7140' : '#e74c3c40'}`
                }}>
                <Database size={16} style={{ 
                  color: backendHealth.status === 'healthy' ? '#2ecc71' : '#e74c3c' 
                }} />
                <span className="text-sm" style={{ 
                  color: backendHealth.status === 'healthy' ? '#2ecc71' : '#e74c3c' 
                }}>
                  {backendHealth.status === 'healthy' 
                    ? `${backendHealth.factCount} facts stored`
                    : 'Backend unavailable'
                  }
                </span>
              </div>
            )}

            <Select 
              options={EMBEDDING_OPTIONS} 
              value={longTerm.embeddingModel}
              onChange={v => setLongTermConfig({ embeddingModel: v as EmbeddingModel })}
              label="Embedding Model" 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select 
                options={RECALL_OPTIONS} 
                value={longTerm.recall.strategy}
                onChange={v => setRecallConfig({ strategy: v as RecallStrategy })}
                label="Recall Strategy" 
              />
              <SliderRow 
                label="K" 
                value={longTerm.recall.k} 
                min={1} 
                max={20} 
                step={1}
                onChange={v => setRecallConfig({ k: v })} 
              />
            </div>

            <SliderRow 
              label="Min Score" 
              value={Math.round(longTerm.recall.minScore * 100)} 
              min={0} 
              max={100} 
              step={5}
              onChange={v => setRecallConfig({ minScore: v / 100 })} 
            />

            <Select 
              options={WRITE_MODE_OPTIONS} 
              value={longTerm.write.mode}
              onChange={v => setWriteConfig({ mode: v as WriteMode })}
              label="Write Mode" 
            />

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>
                Extract Types
              </label>
              <div className="flex flex-wrap gap-2">
                {EXTRACT_TYPES.map(et => {
                  const active = longTerm.write.extractTypes.includes(et.value);
                  return (
                    <button 
                      key={et.value} 
                      type="button" 
                      aria-label={`Toggle ${et.label}`} 
                      aria-pressed={active}
                      onClick={() => toggleExtractType(et.value)}
                      className="text-sm px-3 py-2 rounded-full cursor-pointer border-none min-h-[44px]"
                      style={{
                        fontFamily: "'Geist Sans', sans-serif",
                        background: active ? `${et.color}20` : t.isDark ? '#1c1c20' : '#f0f0f5',
                        color: active ? et.color : t.textDim,
                        border: `1px solid ${active ? `${et.color}40` : 'transparent'}`,
                      }}
                    >
                      {et.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <SliderRow 
              label="Max Entries" 
              value={longTerm.maxEntries} 
              min={100} 
              max={10000} 
              step={100}
              onChange={v => setLongTermConfig({ maxEntries: v })} 
            />

            <SliderRow 
              label="Token Budget" 
              value={longTerm.tokenBudget} 
              min={1000} 
              max={30000} 
              step={1000}
              onChange={v => setLongTermConfig({ tokenBudget: v })} 
              suffix="K" 
            />
          </div>
        )}
      </Section>

          {/* Working Memory */}
      <Section
        icon={Brain} label="Working Memory" color="#f1c40f"
        badge={working.enabled ? `${fmtTokens(working.maxTokens)} max` : 'disabled'}
        collapsed={workingCollapsed} onToggle={() => setWorkingCollapsed(!workingCollapsed)}
      >
        <div className="mb-4">
          <Toggle 
            checked={working.enabled} 
            onChange={v => setWorkingConfig({ enabled: v })} 
            label="Enable working memory scratchpad" 
          />
        </div>

        {working.enabled && (
          <SliderRow 
            label="Max Tokens" 
            value={working.maxTokens} 
            min={500} 
            max={8000} 
            step={500}
            onChange={v => setWorkingConfig({ maxTokens: v })} 
          />
        )}
      </Section>

          {/* Response Cache */}
          <Section
            icon={Zap} label="Response Cache" color="#FE5000"
            badge={responseCache?.enabled ? `enabled · TTL ${responseCache.ttlSeconds}s` : 'disabled'}
            collapsed={cacheCollapsed} onToggle={() => setCacheCollapsed(!cacheCollapsed)}
          >
            <div className="space-y-4">
              <Toggle
                checked={responseCache?.enabled ?? false}
                onChange={v => setResponseCacheConfig({ enabled: v })}
                label="Enable semantic response caching"
              />
              {responseCache?.enabled && (
                <>
                  <SliderRow
                    label="TTL"
                    value={responseCache.ttlSeconds}
                    min={60}
                    max={86400}
                    step={60}
                    onChange={v => setResponseCacheConfig({ ttlSeconds: v })}
                    suffix="s"
                  />
                  {cacheStats && (
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { label: 'Entries', value: String(cacheStats.totalEntries) },
                        { label: 'Hit Rate', value: `${(cacheStats.hitRate * 100).toFixed(1)}%` },
                        { label: 'Saved', value: `$${cacheStats.estimatedSavings.toFixed(4)}` },
                      ] as const).map(item => (
                        <div key={item.label} className="p-3 rounded text-center" style={{ background: t.surfaceElevated }}>
                          <div className="text-lg font-semibold" style={{ color: '#FE5000', fontFamily: "'Geist Mono', monospace" }}>{item.value}</div>
                          <div className="text-xs" style={{ color: t.textDim }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handlePurgeCache}
                    disabled={purging}
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-50 border-none cursor-pointer"
                    style={{ background: '#e74c3c20', color: '#e74c3c', border: '1px solid #e74c3c40' }}
                  >
                    {purging ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Purge Cache
                  </button>
                </>
              )}
            </div>
          </Section>

          {/* Memory Budget Allocation */}
          {totalBudget > 0 && (
            <div className="mt-6 p-4 rounded-lg" style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                Memory Budget Allocation
              </h3>
              <div 
                className="flex gap-1 h-2 rounded overflow-hidden mb-3"
                aria-label={`Memory budget allocation: Session ${fmtTokens(session.tokenBudget)}, ${longTerm.enabled ? `Long-term ${fmtTokens(longTerm.tokenBudget)}, ` : ''}${working.enabled ? `Working ${fmtTokens(working.tokenBudget)}, ` : ''}Total ${fmtTokens(totalBudget)}`}
                role="img"
              >
                <div style={{ width: `${(session.tokenBudget / totalBudget) * 100}%`, background: '#3498db', borderRadius: 2 }}
                  title={`Session: ${fmtTokens(session.tokenBudget)}`} />
                {longTerm.enabled && (
                  <div style={{ width: `${(longTerm.tokenBudget / totalBudget) * 100}%`, background: '#2ecc71', borderRadius: 2 }}
                    title={`Long-term: ${fmtTokens(longTerm.tokenBudget)}`} />
                )}
                {working.enabled && (
                  <div style={{ width: `${(working.tokenBudget / totalBudget) * 100}%`, background: '#f1c40f', borderRadius: 2 }}
                    title={`Working: ${fmtTokens(working.tokenBudget)}`} />
                )}
              </div>
              <div className="flex justify-between">
                <div className="flex gap-4">
                  {[
                    { label: 'Session', color: '#3498db', tokens: session.tokenBudget },
                    ...(longTerm.enabled ? [{ label: 'Long-term', color: '#2ecc71', tokens: longTerm.tokenBudget }] : []),
                    ...(working.enabled ? [{ label: 'Working', color: '#f1c40f', tokens: working.tokenBudget }] : []),
                  ].map(item => (
                    <span key={item.label} className="flex items-center gap-2 text-sm"
                      style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-semibold" style={{ fontFamily: "'Geist Mono', monospace", color: '#FE5000' }}>
                  {fmtTokens(totalBudget)} total
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}