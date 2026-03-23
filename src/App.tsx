import { useCallback, useEffect, useRef, useState } from 'react';
import { Topbar } from './components/Topbar';
import { useVersionStore } from './store/versionStore';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { SkillPicker } from './components/SkillPicker';
import { Marketplace } from './components/Marketplace';
import { ConnectionPicker } from './components/ConnectionPicker';
import { ConnectorPicker } from './components/ConnectorPicker';
// AgentViz moved to canvas node (AgentPreviewNode)
import { SettingsPage } from './components/SettingsPage';
import { SaveAgentModal } from './components/SaveAgentModal';
import { AgentLibrary } from './components/AgentLibrary';
import './store/versionStore'; // activate version subscription
import { useConsoleStore } from './store/consoleStore';
import { useMcpStore } from './store/mcpStore';
import { useTheme } from './theme';
import { importAgent } from './utils/agentImport';

import { WizardLayout } from './layouts/WizardLayout';
import { ToastContainer } from './components/ds/Toast';

export default function App() {
  const t = useTheme();
  const [view, setView] = useState<'library' | 'editor'>('library');

  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const setShowConnectionPicker = useConsoleStore((s) => s.setShowConnectionPicker);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);

  const showSettings = useConsoleStore((s) => s.showSettings);
  const setShowSettings = useConsoleStore((s) => s.setShowSettings);
  const loadServers = useMcpStore((s) => s.loadServers);
  const loadAgent = useConsoleStore((s) => s.loadAgent);
  const saveStatus = useVersionStore((s) => s.saveStatus);
  const importInputRef = useRef<HTMLInputElement>(null);
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
      if (partial.instructionState) store.setInstructionState(partial.instructionState);
      if (partial.workflowSteps) store.setWorkflowSteps(partial.workflowSteps);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowFilePicker(!showFilePicker); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) run(); }
      if (e.key === 'Escape') { setShowFilePicker(false); setShowSkillPicker(false); setShowConnectionPicker(false); setShowMarketplace(false); setShowSettings(false); useConsoleStore.getState().setShowSaveModal(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, setShowSkillPicker, setShowConnectionPicker, setShowMarketplace, run, running]);

  // Load MCP servers on app mount
  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleSelectAgent = (agentId: string) => {
    loadAgent(agentId);
    setView('editor');
  };

  const handleNewAgent = () => {
    setView('editor');
  };

  const handleBackToLibrary = () => {
    if (saveStatus === 'unsaved') {
      const confirmed = window.confirm('You have unsaved changes. Leave anyway?');
      if (!confirmed) return;
    }
    setView('library');
  };

  return (
    <div
      data-theme={t.isDark ? 'dark' : 'light'}
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        background: t.bg
      }}
    >
      <input ref={importInputRef} type="file" accept=".md,.yaml,.yml,.json" onChange={handleImportFile} style={{ display: 'none' }} aria-hidden="true" />
      
      {view === 'library' ? (
        <AgentLibrary
          onSelectAgent={handleSelectAgent}
          onNewAgent={handleNewAgent}
        />
      ) : (
        <>
          <Topbar
            onSettingsClick={() => setShowSettings(true, 'providers')}
            onBack={handleBackToLibrary}
            onImport={() => importInputRef.current?.click()}
          />
          <WizardLayout />
        </>
      )}

      {/* Accessibility: aria-live region for canvas state announcements */}
      <div
        aria-live="polite"
        id="canvas-announcements"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0'
        }}
      />
      <TokenBudget />
      <FilePicker />
      <SkillPicker />
      <ConnectionPicker />
      <ConnectorPicker />
      <Marketplace />
      <SettingsPage open={showSettings} onClose={() => setShowSettings(false)} />
      <SaveAgentModal />
      <ToastContainer />
    </div>
  );
}
