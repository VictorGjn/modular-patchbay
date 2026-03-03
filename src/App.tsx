import { useCallback, useEffect, useRef } from 'react';
import { Topbar } from './components/Topbar';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { McpPicker } from './components/McpPicker';
import { SkillPicker } from './components/SkillPicker';
import { Marketplace } from './components/Marketplace';
import { ConnectorPicker } from './components/ConnectorPicker';
// AgentViz moved to canvas node (AgentPreviewNode)
import { SettingsPage } from './components/SettingsPage';
import { SaveAgentModal } from './components/SaveAgentModal';
import { ConversationTester } from './components/ConversationTester';
import './store/versionStore'; // activate version subscription
import { useConsoleStore } from './store/consoleStore';
import { useTheme } from './theme';
import { importAgent } from './utils/agentImport';

import { DashboardLayout } from './layouts/DashboardLayout';

export default function App() {
  const t = useTheme();

  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);

  const showSettings = useConsoleStore((s) => s.showSettings);
  const setShowSettings = useConsoleStore((s) => s.setShowSettings);
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
      if (partial.channels) { store.clearChannels(); for (const ch of partial.channels) store.addChannel(ch); }
      if (partial.selectedModel) store.setModel(partial.selectedModel);
      if (partial.outputFormat) store.setOutputFormat(partial.outputFormat);
      if (partial.prompt) store.setPrompt(partial.prompt);
      if (partial.tokenBudget) store.setTokenBudget(partial.tokenBudget);
      if (partial.agentMeta) store.setAgentMeta(partial.agentMeta);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowFilePicker(!showFilePicker); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) run(); }
      if (e.key === 'Escape') { setShowFilePicker(false); setShowMcpPicker(false); setShowSkillPicker(false); setShowConnectorPicker(false); setShowMarketplace(false); setShowSettings(false); useConsoleStore.getState().setShowSaveModal(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, setShowMcpPicker, setShowSkillPicker, setShowConnectorPicker, setShowMarketplace, run, running]);

  return (
    <div className="w-full h-full flex flex-col" data-theme={t.isDark ? 'dark' : 'light'} style={{ background: t.bg }}>
      <input ref={importInputRef} type="file" accept=".md,.yaml,.yml,.json" onChange={handleImportFile} style={{ display: 'none' }} aria-hidden="true" />
      <Topbar onImportClick={handleImportClick} onSettingsClick={() => setShowSettings(true, 'providers')} />

      <DashboardLayout />

      {/* Accessibility: aria-live region for canvas state announcements */}
      <div aria-live="polite" className="sr-only" id="canvas-announcements" />
      {/* AgentViz is now a canvas node (AgentPreviewNode) — no longer here */}
      <ConversationTester />
      <TokenBudget />
      <FilePicker />
      <McpPicker />
      <SkillPicker />
      <ConnectorPicker />
      <Marketplace />
      <SettingsPage open={showSettings} onClose={() => setShowSettings(false)} />
      <SaveAgentModal />
    </div>
  );
}
