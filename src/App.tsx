import { useState, useEffect, useCallback, useRef } from 'react';
import { Topbar } from './components/Topbar';
import { PromptArea } from './components/PromptArea';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { McpPicker } from './components/McpPicker';
import { SkillPicker } from './components/SkillPicker';
import { ResponseArea } from './components/ResponseArea';
import { CableLayer } from './components/CableLayer';
import { AgentPreview } from './components/AgentPreview';
import { Section } from './components/Section';
import { Tile } from './components/Tile';
import { useConsoleStore, getEffectiveTokens } from './store/consoleStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, OUTPUT_FORMATS, MOCK_AGENTS, type OutputFormat } from './store/knowledgeBase';
import { importAgent } from './utils/agentImport';
import { McpIcon, SkillIcon, OutputIcon } from './components/icons/SectionIcons';

export default function App() {
  const channels = useConsoleStore((s) => s.channels);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const setOutputFormat = useConsoleStore((s) => s.setOutputFormat);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const toggleMcp = useConsoleStore((s) => s.toggleMcp);
  const toggleSkill = useConsoleStore((s) => s.toggleSkill);

  const [depthPopup, setDepthPopup] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);

  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportClick = useCallback(() => importInputRef.current?.click(), []);
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
        for (const ch of partial.channels) store.addChannel(ch);
      }
      if (partial.selectedModel) store.setModel(partial.selectedModel);
      if (partial.outputFormat) store.setOutputFormat(partial.outputFormat);
      if (partial.prompt) store.setPrompt(partial.prompt);
      if (partial.tokenBudget) store.setTokenBudget(partial.tokenBudget);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowFilePicker(!showFilePicker); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) run(); }
      if (e.key === 'Escape') { setShowFilePicker(false); setShowMcpPicker(false); setShowSkillPicker(false); setDepthPopup(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, setShowMcpPicker, setShowSkillPicker, run, running]);

  useEffect(() => {
    if (!depthPopup) return;
    const handler = () => setDepthPopup(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [depthPopup]);

  const activeChannels = channels.filter((c) => c.enabled);
  const addedMcps = mcpServers.filter((s) => s.added);
  const addedSkills = skills.filter((s) => s.added);

  const handleTileDoubleClick = (sourceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDepthPopup({ sourceId, x: rect.left, y: rect.bottom + 4 });
  };

  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  const getLinkedAgents = (skillId: string): string[] =>
    MOCK_AGENTS.filter((a) => a.linkedSkills?.includes(skillId)).map((a) => a.name);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#111114' }}>
      <input ref={importInputRef} type="file" accept=".md" onChange={handleImportFile} style={{ display: 'none' }} aria-hidden="true" />

      <Topbar onImportClick={handleImportClick} />

      {/* CABLE LAYER */}
      <CableLayer />

      {/* HUB LAYOUT: sections around prompt */}
      <div className="flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>
        <div
          className="h-full grid gap-3 p-4"
          style={{
            gridTemplateColumns: '1fr 2fr 1fr',
            gridTemplateRows: '1fr 1fr',
            minHeight: 0,
          }}
        >
          {/* TOP LEFT: Knowledge */}
          <Section
            title="Knowledge"
            sectionId="knowledge"
            count={activeChannels.length}
            active={activeChannels.length > 0}
            actionLabel="+ Add  ⌘K"
            onAction={() => setShowFilePicker(true)}
          >
            {channels.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-6">
                <span className="text-xs" style={{ color: '#444' }}>No sources loaded</span>
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
                    icon={<span className="w-2 h-2 rounded-full inline-block" style={{ background: kt.color }} />}
                    subtitle={`${fmtTokens(eff)} · ${DEPTH_LEVELS[ch.depth].label}`}
                    colorStripe={kt.color}
                    onClick={() => toggleChannel(ch.sourceId)}
                    onDoubleClick={(e) => { if (e) handleTileDoubleClick(ch.sourceId, e); }}
                  />
                );
              })
            )}
          </Section>

          {/* CENTER: Prompt + Response (spans 2 rows) */}
          <div className="row-span-2 flex flex-col gap-3 min-h-0">
            <PromptArea />
            <div className="flex-1 min-h-0 overflow-auto">
              <ResponseArea />
            </div>
          </div>

          {/* TOP RIGHT: MCP */}
          <Section
            title="MCP"
            sectionId="mcp"
            count={addedMcps.filter((s) => s.enabled).length}
            active={addedMcps.some((s) => s.enabled)}
            actionLabel="+ Add"
            onAction={() => setShowMcpPicker(true)}
          >
            {addedMcps.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-6">
                <span className="text-xs" style={{ color: '#444' }}>No servers added</span>
              </div>
            ) : (
              addedMcps.map((server) => {
                const statusColor = server.connected ? (server.enabled ? '#00ff88' : '#555') : '#ff3344';
                return (
                  <Tile
                    key={server.id}
                    name={server.name}
                    active={server.enabled}
                    icon={<McpIcon icon={server.icon} size={14} />}
                    subtitle={server.connected ? 'connected' : 'offline'}
                    statusColor={statusColor}
                    onClick={() => toggleMcp(server.id)}
                  />
                );
              })
            )}
          </Section>

          {/* BOTTOM LEFT: Skills */}
          <Section
            title="Skills"
            sectionId="skills"
            count={addedSkills.filter((s) => s.enabled).length}
            active={addedSkills.some((s) => s.enabled)}
            actionLabel="+ Add"
            onAction={() => setShowSkillPicker(true)}
          >
            {addedSkills.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-6">
                <span className="text-xs" style={{ color: '#444' }}>No skills added</span>
              </div>
            ) : (
              addedSkills.map((skill) => {
                const linked = getLinkedAgents(skill.id);
                return (
                  <Tile
                    key={skill.id}
                    name={skill.name}
                    active={skill.enabled}
                    icon={<SkillIcon icon={skill.icon} size={14} />}
                    subtitle={linked.length > 0 ? `Used by: ${linked.join(', ')}` : skill.description}
                    onClick={() => toggleSkill(skill.id)}
                  />
                );
              })
            )}
          </Section>

          {/* BOTTOM RIGHT: Output */}
          <Section
            title="Output"
            sectionId="output"
            count={1}
            active={outputFormat !== 'markdown'}
          >
            {OUTPUT_FORMATS.map((fmt) => (
              <Tile
                key={fmt.id}
                name={fmt.label}
                active={outputFormat === fmt.id}
                icon={<OutputIcon formatId={fmt.id} size={14} />}
                radioMode
                onClick={() => setOutputFormat(fmt.id as OutputFormat)}
              />
            ))}
          </Section>
        </div>
      </div>

      <AgentPreview />
      <TokenBudget />
      <FilePicker />
      <McpPicker />
      <SkillPicker />

      {/* Depth popup */}
      {depthPopup && (
        <div
          className="fixed z-50 rounded-lg py-1 px-1"
          style={{
            left: depthPopup.x,
            top: depthPopup.y,
            background: '#1c1c20',
            border: '1px solid #2a2a30',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            animation: 'fade-in-up 0.15s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {DEPTH_LEVELS.map((level, i) => (
            <button
              key={level.label}
              type="button"
              className="block w-full text-left px-3 py-1.5 rounded-md text-xs cursor-pointer border-none hover-row"
              style={{ background: 'transparent', color: '#888' }}
              onClick={() => { setChannelDepth(depthPopup.sourceId, i); setDepthPopup(null); }}
            >
              {level.label} ({Math.round(level.pct * 100)}%)
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
