import { useState, useEffect } from 'react';
import { Plus, Clock, Bot } from 'lucide-react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { Button } from './ds/Button';
import { EmptyState } from './ds/EmptyState';
import { Spinner } from './ds/Spinner';
import { API_BASE } from '../config';

interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  tags: string[];
  updatedAt: string;
}

interface AgentLibraryProps {
  onSelectAgent: (agentId: string) => void;
  onNewAgent: () => void;
}

export function AgentLibrary({ onSelectAgent, onNewAgent }: AgentLibraryProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTheme();

  // Load agents from API
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/agents`);
        if (!response.ok) {
          throw new Error('Failed to load agents');
        }
        const json = await response.json();
        const list = (json.data ?? json ?? []) as Array<{
          id: string;
          agentMeta?: { name?: string; description?: string; avatar?: string; tags?: string[] };
          savedAt?: string;
          currentVersion?: string;
        }>;
        setAgents(list.map(a => ({
          id: a.id,
          name: a.agentMeta?.name || a.id,
          description: a.agentMeta?.description || '',
          avatar: a.agentMeta?.avatar || '',
          tags: a.agentMeta?.tags || [],
          updatedAt: a.savedAt || new Date().toISOString(),
        })));
      } catch (err) {
        console.error('Error loading agents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  const handleAgentClick = (agentId: string) => {
    onSelectAgent(agentId);
  };

  const handleNewAgentClick = () => {
    const { resetAgent } = useConsoleStore.getState();
    resetAgent();
    onNewAgent();
  };

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
        <EmptyState
          icon={<Bot size={32} />}
          title="Failed to Load Agents"
          subtitle={error}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: t.bg }}>
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: t.border }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-2xl font-bold mb-1"
              style={{ color: t.textPrimary }}
            >
              Agent Library
            </h1>
            <p 
              className="text-sm"
              style={{ color: t.textSecondary }}
            >
              Manage your AI agents
            </p>
          </div>
          <Button
            onClick={handleNewAgentClick}
            variant="primary"
            size="md"
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            New Agent
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {agents.length === 0 ? (
          <EmptyState
            icon={<Bot size={32} />}
            title="No Agents Yet"
            subtitle="Create your first agent to get started"
            action={
              <Button
                onClick={handleNewAgentClick}
                variant="primary"
                size="md"
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Create Agent
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg"
                onClick={() => handleAgentClick(agent.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAgentClick(agent.id); }}
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
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: '#FE500015' }}>
                      <Bot size={16} style={{ color: '#FE5000' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 
                        className="text-base font-semibold mb-1 truncate"
                        style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
                      >
                        {agent.name}
                      </h3>
                      <p 
                        className="text-sm line-clamp-2"
                        style={{ color: t.textSecondary }}
                      >
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
                        <span className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: t.surfaceElevated, color: t.textFaint }}>
                          +{agent.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Last Modified */}
                  <div className="flex items-center gap-1 text-xs" style={{ color: t.textDim }}>
                    <Clock size={12} />
                    <span style={{ fontFamily: "'Geist Mono', monospace" }}>
                      {formatDate(agent.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}