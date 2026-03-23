import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Clock, Bot, Search, Trash2, Copy, ArrowUpDown, CheckCircle, XCircle, Rocket } from 'lucide-react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { Button } from './ds/Button';
import { EmptyState } from './ds/EmptyState';
import { Spinner } from './ds/Spinner';
import { Modal } from './ds/Modal';
import { Select } from './ds/Select';
import { API_BASE } from '../config';
import { DEMO_PRESETS } from '../store/demoPresets';
import { TemplateCard } from './TemplateCard';

interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  tags: string[];
  updatedAt: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface AgentLibraryProps {
  onSelectAgent: (agentId: string) => void;
  onNewAgent: () => void;
}

const SORT_OPTIONS = [
  { value: 'modified', label: 'Last Modified' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'created', label: 'Created' },
];

const TEMPLATE_LIST = Object.entries(DEMO_PRESETS).map(([id, preset]) => ({
  id,
  name: preset.agentMeta.name,
  description: preset.agentMeta.description,
  tags: preset.agentMeta.tags,
}));

let _toastSeq = 0;

export function AgentLibrary({ onSelectAgent, onNewAgent }: AgentLibraryProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortBy, setSortBy] = useState('modified');
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTheme();

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++_toastSeq;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const handleUseTemplate = useCallback((presetId: string) => {
    const { loadDemoPreset } = useConsoleStore.getState();
    loadDemoPreset(presetId);
    onNewAgent();
  }, [onNewAgent]);

  const filteredTemplates = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return TEMPLATE_LIST;
    return TEMPLATE_LIST.filter(
      (tpl) => tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q),
    );
  }, [debouncedQuery]);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/agents`);
      if (!response.ok) throw new Error('Failed to load agents');
      const json = await response.json();
      const list = (json.data ?? json ?? []) as Array<{
        id: string;
        agentMeta?: { name?: string; description?: string; avatar?: string; tags?: string[] };
        savedAt?: string;
      }>;
      setAgents(list.map((a) => ({
        id: a.id,
        name: a.agentMeta?.name || a.id,
        description: a.agentMeta?.description || '',
        avatar: a.agentMeta?.avatar || '',
        tags: a.agentMeta?.tags || [],
        updatedAt: a.savedAt || new Date().toISOString(),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleNewAgentClick = () => {
    const { resetAgent } = useConsoleStore.getState();
    resetAgent();
    onNewAgent();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      showToast('success', `"${deleteTarget.name}" deleted`);
    } catch {
      showToast('error', `Failed to delete "${deleteTarget.name}"`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClone = async (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    setCloningId(agent.id);
    try {
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agent.id)}`);
      if (!res.ok) throw new Error('Failed to load agent');
      const json = await res.json();
      const state = json.data ?? json;

      const newId = `agent-${Date.now()}`;
      const cloned = {
        ...state,
        id: newId,
        savedAt: new Date().toISOString(),
        agentMeta: {
          ...state.agentMeta,
          name: `${state.agentMeta?.name || agent.name} (Copy)`,
        },
      };

      const saveRes = await fetch(`${API_BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloned),
      });
      if (!saveRes.ok) throw new Error('Failed to save clone');

      showToast('success', `Cloned as "${cloned.agentMeta.name}"`);
      onSelectAgent(newId);
    } catch {
      showToast('error', `Failed to clone "${agent.name}"`);
    } finally {
      setCloningId(null);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let result = q
      ? agents.filter(
          (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
        )
      : agents;

    if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'modified') {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sortBy === 'created') {
      result = [...result].sort((a, b) => {
        const ta = parseInt(a.id.replace('agent-', '')) || 0;
        const tb = parseInt(b.id.replace('agent-', '')) || 0;
        return ta - tb;
      });
    }
    return result;
  }, [agents, debouncedQuery, sortBy]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 24 * 7) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={<Bot size={32} />} title="Failed to Load Agents" subtitle={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: t.bg }}>
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: t.border }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: t.textPrimary }}>
              Agent Library
            </h1>
            <p className="text-sm" style={{ color: t.textSecondary }}>
              Build, test, and export AI agents with full context engineering.
            </p>
          </div>
          <Button onClick={handleNewAgentClick} variant="primary" size="md" title="Create new agent" className="flex items-center gap-2">
            <Plus size={16} />
            New Agent
          </Button>
        </div>

        {/* Search + Sort row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textDim }} />
            <input
              type="text"
              placeholder="Search agents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg outline-none"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                color: t.textPrimary,
                fontFamily: "'Geist Sans', sans-serif",
                fontSize: 13,
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown size={12} style={{ color: t.textDim }} />
            <div style={{ width: 160 }}>
              <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* First-launch welcome banner — shown when no saved agents and no search query */}
        {agents.length === 0 && !debouncedQuery && !loading && (
          <div
            className="mb-6 flex items-start gap-4 p-5 rounded-xl"
            style={{
              background: t.isDark ? 'rgba(254,80,0,0.07)' : 'rgba(254,80,0,0.05)',
              border: `1px solid ${t.isDark ? 'rgba(254,80,0,0.25)' : 'rgba(254,80,0,0.2)'}`,
            }}
          >
            <Rocket size={28} style={{ color: '#FE5000', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              <div className="text-base font-bold mb-1" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                Welcome to Modular Studio
              </div>
              <div className="text-sm mb-3" style={{ color: t.textSecondary }}>
                Build knowledge-rich AI agents with full context engineering. Start from a template below or create your own.
              </div>
              <button
                type="button"
                onClick={handleNewAgentClick}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer"
                style={{ background: '#FE5000', color: '#fff' }}
              >
                <Plus size={14} aria-hidden="true" />
                Get Started
              </button>
            </div>
          </div>
        )}
        {filteredTemplates.length === 0 && filteredAndSorted.length === 0 && debouncedQuery ? (
          <EmptyState
            icon={<Search size={32} />}
            title="No results match your search"
            subtitle={`No results for "${debouncedQuery}" — try a different keyword`}
          />
        ) : filteredTemplates.length === 0 && filteredAndSorted.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tpl) => (
              <TemplateCard key={tpl.id} {...tpl} onUse={handleUseTemplate} />
            ))}
            {filteredAndSorted.map((agent) => (
              <div
                key={agent.id}
                role="button"
                tabIndex={0}
                title={`Open ${agent.name}`}
                className="cursor-pointer rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg"
                onClick={() => onSelectAgent(agent.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectAgent(agent.id); }}
                style={{
                  background: t.surfaceOpaque,
                  border: `1px solid ${t.border}`,
                  boxShadow: `0 2px 8px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; }}
              >
                <div className="p-4">
                  {/* Avatar and Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FE500015' }}>
                      <Bot size={16} style={{ color: '#FE5000' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold mb-1 truncate" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                        {agent.name}
                      </h3>
                      <p className="text-sm line-clamp-2" style={{ color: t.textSecondary }}>
                        {agent.description || 'No description'}
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  {agent.tags && agent.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: t.surfaceElevated, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                          {tag}
                        </span>
                      ))}
                      {agent.tags.length > 3 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: t.surfaceElevated, color: t.textFaint }}>
                          +{agent.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer: date + actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs" style={{ color: t.textDim }}>
                      <Clock size={12} />
                      <span style={{ fontFamily: "'Geist Mono', monospace" }}>{formatDate(agent.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Clone agent"
                        aria-label={`Clone ${agent.name}`}
                        disabled={cloningId === agent.id}
                        onClick={(e) => handleClone(agent, e)}
                        className="flex items-center justify-center w-6 h-6 rounded cursor-pointer border-none bg-transparent transition-colors"
                        style={{ color: cloningId === agent.id ? t.textFaint : t.textDim }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#FE5000'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = cloningId === agent.id ? t.textFaint : t.textDim; }}
                      >
                        {cloningId === agent.id ? <span className="animate-spin text-[10px]" aria-hidden="true">⟳</span> : <Copy size={13} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        title="Delete agent"
                        aria-label={`Delete ${agent.name}`}
                        disabled={deletingId === agent.id}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(agent); }}
                        className="flex items-center justify-center w-6 h-6 rounded cursor-pointer border-none bg-transparent transition-colors"
                        style={{ color: deletingId === agent.id ? t.textFaint : t.textDim }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4d4f'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = deletingId === agent.id ? t.textFaint : t.textDim; }}
                      >
                        {deletingId === agent.id ? <span className="animate-spin text-[10px]" aria-hidden="true">⟳</span> : <Trash2 size={13} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Agent"
        width={400}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <div className="px-4 py-4 text-sm" style={{ color: t.textSecondary }}>
          Are you sure you want to delete{' '}
          <span className="font-semibold" style={{ color: t.textPrimary }}>"{deleteTarget?.name}"</span>?
          This action cannot be undone.
        </div>
      </Modal>

      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium pointer-events-auto"
            style={{
              background: t.surfaceOpaque,
              border: `1px solid ${toast.type === 'success' ? '#22c55e40' : '#ff4d4f40'}`,
              color: t.textPrimary,
              boxShadow: `0 4px 16px ${t.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}`,
              fontFamily: "'Geist Sans', sans-serif",
            }}
          >
            {toast.type === 'success'
              ? <CheckCircle size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
              : <XCircle size={15} style={{ color: '#ff4d4f', flexShrink: 0 }} />}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
