import { create } from 'zustand';
import type { PipelineChatStats } from '../services/pipelineChat';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4800' : '';

interface ConversationSummary {
  id: string;
  title: string;
  lastModified: number;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  pipelineStats?: PipelineChatStats;
  traceId?: string;
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
  conversationId: string | null;
  conversations: ConversationSummary[];
  messages: ChatMessage[];
  inputText: string;
  streaming: boolean;

  // Pipeline
  lastPipelineStats: PipelineChatStats | null;

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
  updateMessagePipelineStats: (messageId: string, stats: PipelineChatStats) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  setLastPipelineStats: (stats: PipelineChatStats | null) => void;
  
  // Persistence
  saveToServer: () => Promise<void>;
  listFromServer: () => Promise<void>;
  loadFromServer: (id: string) => Promise<void>;

  // Test cases
  addTestCase: (tc: Omit<TestCase, 'id'>) => void;
  updateTestCase: (id: string, patch: Partial<TestCase>) => void;
  removeTestCase: (id: string) => void;
  setRunningTests: (running: boolean) => void;
  saveCurrentAsTest: (name: string, expectedBehavior: string) => void;
}

let saveTimeout: NodeJS.Timeout | null = null;

export const useConversationStore = create<ConversationState>((set, get) => ({
  panelOpen: false,
  panelHeight: 40,
  activeTab: 'chat',
  conversationId: null,
  conversations: [],
  messages: [],
  inputText: '',
  streaming: false,
  lastPipelineStats: null,
  testCases: [],
  runningTests: false,

  setPanelOpen: (open) => set({ panelOpen: open }),
  setPanelHeight: (height) => set({ panelHeight: Math.max(20, Math.min(80, height)) }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setInputText: (text) => set({ inputText: text }),

  addMessage: (msg) => {
    const state = get();
    const newMsg = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    
    // Generate conversation ID on first message
    let conversationId = state.conversationId;
    if (!conversationId && state.messages.length === 0) {
      conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    
    set({
      messages: [...state.messages, newMsg],
      conversationId,
    });
    
    // Debounced save to server
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      get().saveToServer().catch(console.error);
    }, 1000);
  },

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

  updateMessagePipelineStats: (messageId, stats) => {
    set({
      messages: get().messages.map(msg => 
        msg.id === messageId ? { ...msg, pipelineStats: stats } : msg
      ),
    });
  },

  clearMessages: () => set({ messages: [], lastPipelineStats: null }),
  setStreaming: (streaming) => set({ streaming }),
  setLastPipelineStats: (stats) => set({ lastPipelineStats: stats }),

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

  // Persistence actions
  saveToServer: async () => {
    const state = get();
    if (!state.conversationId || state.messages.length === 0) return;
    
    try {
      const title = state.messages[0]?.content?.slice(0, 50) || 'Untitled Conversation';
      await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: state.conversationId,
          title,
          messages: state.messages,
          lastModified: Date.now(),
        }),
      });
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  },

  listFromServer: async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/conversations`);
      if (resp.ok) {
        const conversations = await resp.json();
        set({ conversations });
      }
    } catch (error) {
      console.error('Failed to list conversations:', error);
    }
  },

  loadFromServer: async (id: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/conversations/${id}`);
      if (resp.ok) {
        const conversation = await resp.json();
        set({
          conversationId: conversation.id,
          messages: conversation.messages || [],
          lastPipelineStats: null,
        });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  },
}));
