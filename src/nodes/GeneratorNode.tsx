import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tooltip } from '../components/ds/Tooltip';
import { TextArea } from '../components/ds/TextArea';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { useTheme } from '../theme';
import { Sparkles, Loader2, Wand2, RotateCcw } from 'lucide-react';

const HANDLE: React.CSSProperties = { width: 8, height: 8, border: 'none', borderRadius: '50%' };

export const GeneratorNode = memo(function GeneratorNode() {
  const t = useTheme();
  const hydrateFromGenerated = useConsoleStore(s => s.hydrateFromGenerated);
  const setSessionConfig = useMemoryStore(s => s.setSessionConfig);
  const addFact = useMemoryStore(s => s.addFact);

  const [brainDump, setBrainDump] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastConfig, setLastConfig] = useState<GeneratedAgentConfig | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!brainDump.trim() || generating) return;
    setGenerating(true);
    setError('');
    try {
      const config = await generateFullAgent(brainDump);
      setLastConfig(config);

      // Hydrate all canvas nodes
      hydrateFromGenerated(config);

      // Hydrate memory store
      if (config.memoryConfig) {
        setSessionConfig({
          maxMessages: config.memoryConfig.maxMessages,
          summarizeAfter: config.memoryConfig.summarizeAfter,
          summarizeEnabled: config.memoryConfig.summarizeEnabled,
        });
        for (const fact of config.memoryConfig.suggestedFacts || []) {
          addFact(fact, ['generated']);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [brainDump, generating, hydrateFromGenerated, setSessionConfig, addFact]);

  const handleReset = useCallback(() => {
    setBrainDump('');
    setLastConfig(null);
    setError('');
  }, []);

  const stats = lastConfig ? {
    mcp: lastConfig.mcpServerIds?.length || 0,
    skills: lastConfig.skillIds?.length || 0,
    steps: lastConfig.workflowSteps?.length || 0,
    knowledge: lastConfig.knowledgeSuggestions?.length || 0,
  } : null;

  return (
    <div
      className="rounded-xl overflow-visible"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
        width: '100%',
      }}
    >
      <Handle type="source" position={Position.Right} id="generator-out" style={{ ...HANDLE, background: '#FE5000', top: '50%', right: -4 }} />
        {/* Header */}
        <div className="flex items-center justify-center px-5" style={{ height: 40, background: t.surfaceElevated, borderBottom: `1px solid ${t.border}`, borderRadius: '12px 12px 0 0' }}>
          <Tooltip content="Describe your agent — AI generates the full configuration for every node on the canvas">
            <div className="flex items-center gap-2">
              <Wand2 size={13} style={{ color: '#FE5000' }} />
              <span
                className="font-bold uppercase"
                style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary, fontSize: 10, letterSpacing: '0.08em' }}
              >
                GENERATOR
              </span>
            </div>
          </Tooltip>
        </div>

        {/* Brain dump input */}
        <div className="px-5 py-3">
          <TextArea
            value={brainDump}
            onChange={e => setBrainDump(e.target.value)}
            placeholder="Describe your agent in plain language...&#10;&#10;e.g. &quot;A PM agent that tracks competitors, uses GitHub and Notion, searches the web, and outputs weekly reports to Slack&quot;"
            rows={5}
          />

          {error && (
            <div className="mt-2 text-[10px] px-2 py-1 rounded" style={{ background: '#ff000015', color: '#ff4444', border: '1px solid #ff000020' }}>
              {error}
            </div>
          )}

          {/* Stats after generation */}
          {stats && (
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                { label: 'MCP', count: stats.mcp, color: '#2ecc71' },
                { label: 'Skills', count: stats.skills, color: '#f1c40f' },
                { label: 'Steps', count: stats.steps, color: '#e67e22' },
                { label: 'Knowledge', count: stats.knowledge, color: '#3498db' },
              ].map(s => (
                <span
                  key={s.label}
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    background: `${s.color}15`,
                    color: s.color,
                    border: `1px solid ${s.color}30`,
                  }}
                >
                  {s.count} {s.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-5 pb-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !brainDump.trim()}
            className="flex items-center gap-1.5 px-5 py-3 rounded text-[11px] font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center nodrag"
            style={{
              background: generating ? '#CC4000' : '#FE5000',
              color: '#fff',
              opacity: generating || !brainDump.trim() ? 0.6 : 1,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {generating ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={11} />}
            {generating ? 'Generating...' : lastConfig ? 'Regenerate' : 'Generate'}
          </button>
          {lastConfig && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-2 rounded text-[10px] tracking-wide nodrag"
              style={{
                background: 'transparent',
                border: `1px solid ${t.border}`,
                color: t.textDim,
                cursor: 'pointer',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
    </div>
  );
});
