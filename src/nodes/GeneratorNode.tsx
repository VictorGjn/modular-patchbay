import { memo, useState, useCallback } from 'react';
import { JackGutter, type JackDef } from '../components/JackGutter';
import { Tooltip } from '../components/ds/Tooltip';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { useTheme } from '../theme';
import { Sparkles, Loader2, Wand2, RotateCcw } from 'lucide-react';

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

  const rightJacks: JackDef[] = [
    { id: 'generator-out', type: 'source', label: 'AGENT', color: '#FE5000' },
  ];

  const stats = lastConfig ? {
    mcp: lastConfig.mcpServerIds?.length || 0,
    skills: lastConfig.skillIds?.length || 0,
    steps: lastConfig.workflowSteps?.length || 0,
    knowledge: lastConfig.knowledgeSuggestions?.length || 0,
  } : null;

  return (
    <div
      className="rounded-xl flex overflow-visible"
      style={{
        background: t.surface,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${t.border}`,
        width: 280,
      }}
    >
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-center px-3 py-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <Tooltip content="Describe your agent — AI generates the full configuration for every node on the canvas">
            <div className="flex items-center gap-2">
              <Wand2 size={13} style={{ color: '#FE5000' }} />
              <span
                className="text-xs font-bold tracking-[3px] uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary, fontSize: 11 }}
              >
                GENERATOR
              </span>
            </div>
          </Tooltip>
        </div>

        {/* Brain dump input */}
        <div className="p-3">
          <textarea
            value={brainDump}
            onChange={e => setBrainDump(e.target.value)}
            placeholder="Describe your agent in plain language...&#10;&#10;e.g. &quot;A PM agent that tracks competitors, uses GitHub and Notion, searches the web, and outputs weekly reports to Slack&quot;"
            className="w-full resize-none outline-none text-xs nodrag nowheel"
            rows={5}
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              color: t.textPrimary,
              fontFamily: "'Inter', sans-serif",
              padding: '8px 10px',
              lineHeight: 1.5,
            }}
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
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: "'Space Mono', monospace",
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
        <div className="flex items-center gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !brainDump.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-[11px] font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center nodrag"
            style={{
              background: generating ? '#CC4000' : '#FE5000',
              color: '#fff',
              opacity: generating || !brainDump.trim() ? 0.6 : 1,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
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
                fontFamily: "'Space Mono', monospace",
              }}
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      </div>

      <JackGutter jacks={rightJacks} side="right" />
    </div>
  );
});
