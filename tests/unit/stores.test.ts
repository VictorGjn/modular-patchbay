import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../../src/store/themeStore';
import { useConversationStore } from '../../src/store/conversationStore';

// ─── Theme Store ─────────────────────────────────────────────

describe('useThemeStore', () => {
  it('has a theme property', () => {
    const theme = useThemeStore.getState().theme;
    expect(['dark', 'light']).toContain(theme);
  });

  it('toggleTheme switches theme', () => {
    const initial = useThemeStore.getState().theme;
    useThemeStore.getState().toggleTheme();
    const toggled = useThemeStore.getState().theme;
    expect(toggled).not.toBe(initial);
    // Toggle back
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe(initial);
  });
});

// ─── Conversation Store ──────────────────────────────────────

describe('useConversationStore', () => {
  beforeEach(() => {
    useConversationStore.setState({
      messages: [],
      testCases: [],
      inputText: '',
      panelOpen: false,
      streaming: false,
      runningTests: false,
    });
  });

  it('defaults to closed panel', () => {
    expect(useConversationStore.getState().panelOpen).toBe(false);
  });

  it('setPanelOpen toggles panel', () => {
    useConversationStore.getState().setPanelOpen(true);
    expect(useConversationStore.getState().panelOpen).toBe(true);
  });

  it('setActiveTab changes tab', () => {
    useConversationStore.getState().setActiveTab('tests');
    expect(useConversationStore.getState().activeTab).toBe('tests');
  });

  it('addMessage adds a message with id and timestamp', () => {
    useConversationStore.getState().addMessage({ role: 'user', content: 'Hello' });
    const msgs = useConversationStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('Hello');
    expect(msgs[0].id).toBeTruthy();
    expect(msgs[0].timestamp).toBeGreaterThan(0);
  });

  it('updateLastAssistant updates the last assistant message', () => {
    useConversationStore.getState().addMessage({ role: 'assistant', content: 'Hi' });
    useConversationStore.getState().updateLastAssistant('Hello there!');
    expect(useConversationStore.getState().messages[0].content).toBe('Hello there!');
  });

  it('clearMessages empties messages', () => {
    useConversationStore.getState().addMessage({ role: 'user', content: 'test' });
    useConversationStore.getState().clearMessages();
    expect(useConversationStore.getState().messages).toHaveLength(0);
  });

  it('addTestCase creates test with id', () => {
    useConversationStore.getState().addTestCase({ name: 'Test 1', input: 'hi', expectedBehavior: 'greet' });
    const cases = useConversationStore.getState().testCases;
    expect(cases).toHaveLength(1);
    expect(cases[0].name).toBe('Test 1');
    expect(cases[0].id).toBeTruthy();
  });

  it('updateTestCase patches a test case', () => {
    useConversationStore.getState().addTestCase({ name: 'Test', input: 'hi', expectedBehavior: 'greet' });
    const id = useConversationStore.getState().testCases[0].id;
    useConversationStore.getState().updateTestCase(id, { passed: true });
    expect(useConversationStore.getState().testCases[0].passed).toBe(true);
  });

  it('removeTestCase removes by id', () => {
    useConversationStore.getState().addTestCase({ name: 'Test', input: 'hi', expectedBehavior: 'greet' });
    const id = useConversationStore.getState().testCases[0].id;
    useConversationStore.getState().removeTestCase(id);
    expect(useConversationStore.getState().testCases).toHaveLength(0);
  });

  it('setInputText updates input', () => {
    useConversationStore.getState().setInputText('new prompt');
    expect(useConversationStore.getState().inputText).toBe('new prompt');
  });

  it('setStreaming toggles streaming state', () => {
    useConversationStore.getState().setStreaming(true);
    expect(useConversationStore.getState().streaming).toBe(true);
  });

  it('setPanelHeight sets height', () => {
    useConversationStore.getState().setPanelHeight(60);
    expect(useConversationStore.getState().panelHeight).toBe(60);
  });
});
