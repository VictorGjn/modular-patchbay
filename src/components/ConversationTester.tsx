import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';
import { Button, Input, Tabs, IconButton } from './ds';
import {
  MessageSquare, ChevronUp, ChevronDown, RotateCcw, Send, Save,
  Play, CheckCircle, XCircle, Minus, Plus, X, FlaskConical, History,
  GripHorizontal,
} from 'lucide-react';
import { ResponseRenderer } from './ResponseRenderer';
import { resolveProviderAndModel, runPipelineChat } from '../services/pipelineChat';

export function ConversationTester() {
  const t = useTheme();
  const {
    panelOpen, panelHeight, activeTab, messages, inputText, streaming,
    testCases, runningTests: _runningTests,
    setPanelOpen, setPanelHeight, setActiveTab, setInputText,
    addMessage, updateLastAssistant, clearMessages, setStreaming,
    addTestCase, updateTestCase, removeTestCase,
    saveCurrentAsTest,
  } = useConversationStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (panelOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [panelOpen]);

  // Resize drag handler
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startHeight: panelHeight };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - ev.clientY;
      const newHeight = dragRef.current.startHeight + (dy / window.innerHeight) * 100;
      setPanelHeight(newHeight);
    };
    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [panelHeight, setPanelHeight]);

  // Send message (uses pipeline runtime, same as TestPanel)
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || streaming) return;

    addMessage({ role: 'user', content: text });
    addMessage({ role: 'assistant', content: '' });
    setInputText('');
    setStreaming(true);

    try {
      const resolved = resolveProviderAndModel();
      if (resolved.error) {
        updateLastAssistant(resolved.error);
        setStreaming(false);
        return;
      }

      const store = useConsoleStore.getState();
      let accum = '';

      await runPipelineChat({
        userMessage: text,
        channels: store.channels,
        connectors: store.connectors,
        history: messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
        agentMeta: { name: store.agentMeta.name, description: store.agentMeta.description, avatar: store.agentMeta.avatar, tags: store.agentMeta.tags },
        providerId: resolved.providerId,
        model: resolved.model,
        navigationMode: store.navigationMode,
        onChunk: (chunk: string) => { accum += chunk; updateLastAssistant(accum); },
        onDone: () => {},
        onError: (err: Error) => { updateLastAssistant(accum + `\n\n_Error: ${err.message}_`); },
      });
    } catch (err) {
      updateLastAssistant(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStreaming(false);
    }
  }, [inputText, streaming, messages, addMessage, setInputText, setStreaming, updateLastAssistant]);

  // Run all tests state (must be before handleRunAllTests callback)
  const [runningAllTests, setRunningAllTests] = useState(false);

  const handleRunAllTests = useCallback(async () => {
    if (runningAllTests || testCases.length === 0) return;

    setRunningAllTests(true);
    const { updateTestCase } = useConversationStore.getState();

    const resolved = resolveProviderAndModel();
    if (resolved.error) {
      for (const tc of testCases) {
        updateTestCase(tc.id, { lastResult: resolved.error, passed: false });
      }
      setRunningAllTests(false);
      return;
    }

    for (const testCase of testCases) {
      try {
        const store = useConsoleStore.getState();
        let result = '';

        await runPipelineChat({
          userMessage: testCase.input,
          channels: store.channels,
          connectors: store.connectors,
          history: [],
          agentMeta: { name: store.agentMeta.name, description: store.agentMeta.description, avatar: store.agentMeta.avatar, tags: store.agentMeta.tags },
          providerId: resolved.providerId,
          model: resolved.model,
          navigationMode: store.navigationMode,
          onChunk: (chunk: string) => { result += chunk; },
          onDone: () => {},
          onError: (err: Error) => { throw err; },
        });

        const passed = testCase.expectedBehavior
          ? result.toLowerCase().includes(testCase.expectedBehavior.toLowerCase())
          : null;

        updateTestCase(testCase.id, {
          lastResult: result.substring(0, 200) + (result.length > 200 ? '...' : ''),
          passed,
        });

        // Small delay between tests to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Test failed';
        updateTestCase(testCase.id, {
          lastResult: `Error: ${errorMessage}`,
          passed: false,
        });
      }
    }

    setRunningAllTests(false);
  }, [runningAllTests, testCases]);

  // Save test case modal
  const [showSaveTest, setShowSaveTest] = useState(false);
  const [testName, setTestName] = useState('');
  const [testExpected, setTestExpected] = useState('');

  const tabs = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={10} /> },
    { id: 'tests', label: 'Tests', icon: <FlaskConical size={10} />, count: testCases.length },
    { id: 'history', label: 'History', icon: <History size={10} /> },
  ];

  return (
    <>
      {/* Toggle bar */}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="w-full flex items-center justify-center gap-2 py-1.5 cursor-pointer border-none"
        style={{
          background: panelOpen ? '#FE500010' : t.surfaceElevated,
          color: panelOpen ? '#FE5000' : t.textDim,
          borderTop: `1px solid ${t.border}`,
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
        }}
      >
        <MessageSquare size={11} />
        CONVERSATION TESTER
        {panelOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
      </button>

      {/* Panel */}
      {panelOpen && (
        <div
          className="flex flex-col overflow-hidden"
          style={{
            height: `${panelHeight}vh`,
            background: t.surfaceOpaque,
            borderTop: `2px solid #FE5000`,
          }}
        >
          {/* Resize handle */}
          <div
            className="flex items-center justify-center h-3 cursor-ns-resize shrink-0"
            style={{ background: t.surfaceElevated }}
            onMouseDown={handleDragStart}
          >
            <GripHorizontal size={12} style={{ color: t.textDim }} />
          </div>

          {/* Tab bar */}
          <Tabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as typeof activeTab)} />

          {/* Chat tab */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                {messages.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: t.textFaint }}>
                    <MessageSquare size={24} style={{ opacity: 0.3 }} />
                    <span className="text-[10px] tracking-wider uppercase" style={{ fontFamily: "'Space Mono', monospace" }}>
                      Test your agent with a conversation
                    </span>
                    <span className="text-[10px]" style={{ color: t.textMuted }}>
                      Uses assembled context: instructions + workflow + knowledge + skills + tools
                    </span>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[75%] rounded-xl px-3 py-2 text-[12px] leading-relaxed"
                      style={{
                        background: msg.role === 'user' ? '#FE5000' : t.surfaceElevated,
                        color: msg.role === 'user' ? '#fff' : t.textPrimary,
                        border: msg.role === 'user' ? 'none' : `1px solid ${t.borderSubtle}`,
                        fontFamily: msg.role === 'assistant' ? "'Space Mono', monospace" : 'inherit',
                        fontSize: msg.role === 'assistant' ? 11 : 12,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.role === 'assistant' ? (
                        msg.content ? (
                          <ResponseRenderer content={msg.content} />
                        ) : streaming ? '▍' : ''
                      ) : (
                        msg.content || ''
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
                <IconButton icon={<RotateCcw size={13} />} tooltip="Reset conversation" onClick={clearMessages} size="sm" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message to test your agent..."
                  className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.border}`,
                    color: t.textPrimary,
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                  }}
                  disabled={streaming}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Send size={11} />}
                  onClick={handleSend}
                  disabled={!inputText.trim() || streaming}
                >
                  Send
                </Button>
                <IconButton
                  icon={<Save size={13} />}
                  tooltip="Save as test case"
                  onClick={() => setShowSaveTest(true)}
                  size="sm"
                  disabled={messages.filter((m) => m.role === 'user').length === 0}
                />
              </div>
            </div>
          )}

          {/* Tests tab */}
          {activeTab === 'tests' && (
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {/* Run All Tests button */}
              {testCases.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={runningAllTests ? <Play size={10} className="animate-spin" /> : <Play size={10} />}
                  onClick={handleRunAllTests}
                  disabled={runningAllTests}
                  className="self-start"
                >
                  {runningAllTests ? 'Running Tests...' : 'Run All Tests'}
                </Button>
              )}

              {/* Add test form */}
              <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: t.surfaceElevated, border: `1px solid ${t.borderSubtle}` }}>
                <span className="text-[9px] font-semibold tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  Add Test Case
                </span>
                <Input placeholder="Test name" value={testName} onChange={(e) => setTestName(e.target.value)} />
                <Input placeholder="User input to send" value={testExpected} onChange={(e) => setTestExpected(e.target.value)} />
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={10} />}
                  onClick={() => {
                    if (testName && testExpected) {
                      addTestCase({ name: testName, input: testExpected, expectedBehavior: '', passed: null });
                      setTestName('');
                      setTestExpected('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>

              {/* Test case list */}
              {testCases.map((tc) => (
                <div
                  key={tc.id}
                  className="flex items-start gap-2 p-2 rounded-lg"
                  style={{ background: t.surfaceElevated, border: `1px solid ${t.borderSubtle}` }}
                >
                  <div className="mt-0.5">
                    {tc.passed === true && <CheckCircle size={14} style={{ color: t.statusSuccess }} />}
                    {tc.passed === false && <XCircle size={14} style={{ color: t.statusError }} />}
                    {tc.passed === null && <Minus size={14} style={{ color: t.textDim }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold" style={{ color: t.textPrimary }}>{tc.name}</div>
                    <div className="text-[10px] truncate" style={{ color: t.textMuted }}>{tc.input}</div>
                    {tc.lastResult && <div className="text-[10px] mt-1 truncate" style={{ color: t.textSecondary }}>{tc.lastResult}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton
                      icon={<CheckCircle size={11} />}
                      tooltip="Mark pass"
                      size="sm"
                      onClick={() => updateTestCase(tc.id, { passed: true })}
                    />
                    <IconButton
                      icon={<XCircle size={11} />}
                      tooltip="Mark fail"
                      size="sm"
                      onClick={() => updateTestCase(tc.id, { passed: false })}
                    />
                    <IconButton
                      icon={<X size={11} />}
                      tooltip="Remove"
                      size="sm"
                      variant="danger"
                      onClick={() => removeTestCase(tc.id)}
                    />
                  </div>
                </div>
              ))}

              {testCases.length === 0 && (
                <div className="py-6 text-center text-[10px]" style={{ color: t.textFaint }}>
                  <FlaskConical size={20} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <div>No test cases yet</div>
                  <div className="mt-1" style={{ color: t.textMuted }}>Save conversations as tests to build a regression suite</div>
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="py-6 text-center text-[10px]" style={{ color: t.textFaint }}>
                <History size={20} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>Conversation history will appear here</div>
                <div className="mt-1" style={{ color: t.textMuted }}>Every test run is logged for comparison</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save test case mini-modal */}
      {showSaveTest && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowSaveTest(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col gap-3 p-4 rounded-xl"
            style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, width: 360 }}
          >
            <span className="text-xs font-bold" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>Save as Test Case</span>
            <Input label="Name" placeholder="e.g., catches-missing-key-prop" value={testName} onChange={(e) => setTestName(e.target.value)} />
            <Input label="Expected Behavior" placeholder="Should flag missing key prop..." value={testExpected} onChange={(e) => setTestExpected(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowSaveTest(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  saveCurrentAsTest(testName, testExpected);
                  setShowSaveTest(false);
                  setTestName('');
                  setTestExpected('');
                }}
                disabled={!testName}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

