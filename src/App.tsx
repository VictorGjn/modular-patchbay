import { useState, useEffect, useCallback, useRef } from 'react';
import { Topbar } from './components/Topbar';
import { PromptArea } from './components/PromptArea';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { ResponseArea } from './components/ResponseArea';
import { SignalFlow } from './components/SignalFlow';
import { AgentPreview } from './components/AgentPreview';
import { Section } from './components/Section';
import { Tile } from './components/Tile';
import { useConsoleStore, getEffectiveTokens } from './store/consoleStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, OUTPUT_FORMATS, type OutputFormat } from './store/knowledgeBase';
import { importAgent } from './utils/agentImport';

export default function App() {
  const channels = useConsoleStore((s) => s.channels);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const setOutputFormat = useConsoleStore((s) => s.setOutputFormat);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const agents = useConsoleStore((s) => s.agents);
  const toggleMcp = useConsoleStore((s) => s.toggleMcp);
  const toggleSkill = useConsoleStore((s) => s.toggleSkill);
  const loadAgent = useConsoleStore((s) => s.loadAgent);

  // Depth popup state
  const [depthPopup, setDepthPopup] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);

  // Agent import
  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const partial = importAgent(text);
      const store = useConsoleStore.getState();
      if (partial.channels) {
        store.clearChannels();
        for (const ch of partial.channels) {
          store.addChannel(ch);
        }
      }
      if (partial.selectedModel) store.setModel(partial.selectedModel);
      if (partial.outputFormat) store.setOutputFormat(partial.outputFormat);
      if (partial.prompt) store.setPrompt(partial.prompt);
      if (partial.tokenBudget) store.setTokenBudget(partial.tokenBudget);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowFilePicker(!showFilePicker);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!running) run();
      }
      if (e.key === 'Escape') {
        setShowFilePicker(false);
        setDepthPopup(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, run, running]);

  // Close depth popup on outside click
  useEffect(() => {
    if (!depthPopup) return;
    const handler = () => setDepthPopup(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [depthPopup]);

  const activeChannels = channels.filter((c) => c.enabled);

  const handleTileDoubleClick = (sourceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDepthPopup({ sourceId, x: rect.left, y: rect.bottom + 4 });
  };

  // Format tokens nicely
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  return (
    <div className="gradient-mesh-bg w-full h-full flex flex-col" style={{ background: '#0f0f0f' }}>
      <input
        ref={importInputRef}
        type="file"
        accept=".md"
        onChange={handleImportFile}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* TOPBAR */}
      <Topbar onImportClick={handleImportClick} />

      {/* PROMPT AREA */}
      <PromptArea />

      {/* SECTIONS GRID */}
      <div
        className="flex-1 overflow-hidden px-4 pb-2 relative"
        style={{ zIndex: 1 }}
      >
        <div
          className="grid gap-2 h-full"
          style={{
            gridTemplateColumns: 'repeat(5, 1fr)',
            minHeight: 0,
          }}
        >
          {/* Section 1: KNOWLEDGE */}
          <Section
            title="Knowledge"
            emoji="📚"
            count={activeChannels.length}
            actionLabel="+ ADD  ⌘K"
            onAction={() => setShowFilePicker(true)}
          >
            {channels.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-6">
                <span
                  className="text-[9px] tracking-[1px] uppercase"
                  style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
                >
                  No sources loaded
                </span>
              </div>
            ) : (
              channels.map((ch) => {
                const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
                const eff = getEffectiveTokens(ch);
                return (
                  <Tile
                    key={ch.sourceId}
                    name={ch.name}
                    active={ch.enabled}
                    badge={kt.icon}
                    subtitle={`${fmtTokens(eff)} · ${DEPTH_LEVELS[ch.depth].label}`}
                    colorStripe={kt.color}
                    onClick={() => toggleChannel(ch.sourceId)}
                    onDoubleClick={(e) => {
                      if (e) handleTileDoubleClick(ch.sourceId, e);
                    }}
                  />
                );
              })
            )}
          </Section>

          {/* Section 2: MCP */}
          <Section
            title="MCP"
            emoji="🔌"
            count={mcpServers.filter((s) => s.enabled).length}
            actionLabel="+ FIND"
            onAction={() => {}}
          >
            {mcpServers.map((server) => {
              const statusColor = server.connected
                ? (server.enabled ? '#00ff88' : '#5a4e42')
                : '#ff3344';
              return (
                <Tile
                  key={server.id}
                  name={server.name}
                  active={server.enabled}
                  badge={server.icon}
                  subtitle={server.connected ? 'connected' : 'offline'}
                  statusColor={statusColor}
                  onClick={() => toggleMcp(server.id)}
                />
              );
            })}
          </Section>

          {/* Section 3: SKILLS */}
          <Section
            title="Skills"
            emoji="⚡"
            count={skills.filter((s) => s.enabled).length}
            actionLabel="+ FIND"
            onAction={() => {}}
          >
            {skills.map((skill) => (
              <Tile
                key={skill.id}
                name={skill.name}
                active={skill.enabled}
                subtitle={skill.description}
                onClick={() => toggleSkill(skill.id)}
              />
            ))}
          </Section>

          {/* Section 4: AGENTS */}
          <Section
            title="Agents"
            emoji="🤖"
            count={agents.length}
            actionLabel="+ NEW"
            onAction={() => {}}
          >
            {agents.map((agent) => (
              <Tile
                key={agent.id}
                name={agent.name}
                active={false}
                badge={agent.emoji}
                subtitle={agent.model}
                onClick={() => loadAgent(agent.id)}
              />
            ))}
          </Section>

          {/* Section 5: OUTPUT */}
          <Section
            title="Output"
            emoji="📤"
            count={1}
          >
            {OUTPUT_FORMATS.map((fmt) => (
              <Tile
                key={fmt.id}
                name={fmt.label}
                active={outputFormat === fmt.id}
                badge={fmt.icon}
                radioMode
                onClick={() => setOutputFormat(fmt.id as OutputFormat)}
              />
            ))}
          </Section>
        </div>
      </div>

      {/* SIGNAL FLOW */}
      <SignalFlow />

      {/* RESPONSE AREA */}
      <ResponseArea />
      <AgentPreview />
      <TokenBudget />
      <FilePicker />

      {/* Depth popup */}
      {depthPopup && (
        <div
          className="fixed z-50 rounded-md py-1 px-1"
          style={{
            left: depthPopup.x,
            top: depthPopup.y,
            background: '#1e1a17',
            border: '1px solid #2d2720',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            animation: 'fade-in-up 0.15s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {DEPTH_LEVELS.map((level, i) => (
            <button
              key={level.label}
              type="button"
              className="block w-full text-left px-3 py-1 rounded text-[9px] cursor-pointer border-none"
              style={{
                fontFamily: "'Space Mono', monospace",
                background: 'transparent',
                color: '#b5a898',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2d2720'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => {
                setChannelDepth(depthPopup.sourceId, i);
                setDepthPopup(null);
              }}
            >
              {level.label} ({Math.round(level.pct * 100)}%)
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
