import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedBehavior: string;
  lastResult?: string;
  passed?: boolean | null; // null = not run, true = pass, false = fail
}

export interface ConversationState {
  // Panel
  panelOpen: boolean;
  panelHeight: number; // percentage of viewport
  activeTab: 'chat' | 'tests' | 'history';

  // Chat
  messages: ChatMessage[];
  inputText: string;
  streaming: boolean;

  // Test cases
  testCases: TestCase[];
  runningTests: boolean;

  // Actions
  setPanelOpen: (open: boolean) => void;
  setPanelHeight: (height: number) => void;
  setActiveTab: (tab: 'chat' | 'tests' | 'history') => void;
  setInputText: (text: string) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistant: (content: string) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;

  // Test cases
  addTestCase: (tc: Omit<TestCase, 'id'>) => void;
  updateTestCase: (id: string, patch: Partial<TestCase>) => void;
  removeTestCase: (id: string) => void;
  setRunningTests: (running: boolean) => void;
  saveCurrentAsTest: (name: string, expectedBehavior: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  panelOpen: false,
  panelHeight: 40,
  activeTab: 'chat',
  messages: [],
  inputText: '',
  streaming: false,
  testCases: [],
  runningTests: false,

  setPanelOpen: (open) => set({ panelOpen: open }),
  setPanelHeight: (height) => set({ panelHeight: Math.max(20, Math.min(80, height)) }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setInputText: (text) => set({ inputText: text }),

  addMessage: (msg) => set({
    messages: [...get().messages, {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }],
  }),

  updateLastAssistant: (content) => {
    const msgs = [...get().messages];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        msgs[i] = { ...msgs[i], content };
        break;
      }
    }
    set({ messages: msgs });
  },

  clearMessages: () => set({ messages: [] }),
  setStreaming: (streaming) => set({ streaming }),

  addTestCase: (tc) => set({
    testCases: [...get().testCases, {
      ...tc,
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }],
  }),

  updateTestCase: (id, patch) => set({
    testCases: get().testCases.map((tc) => tc.id === id ? { ...tc, ...patch } : tc),
  }),

  removeTestCase: (id) => set({ testCases: get().testCases.filter((tc) => tc.id !== id) }),
  setRunningTests: (running) => set({ runningTests: running }),

  saveCurrentAsTest: (name, expectedBehavior) => {
    const msgs = get().messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    get().addTestCase({ name, input: lastUser.content, expectedBehavior, passed: null });
  },
}));
