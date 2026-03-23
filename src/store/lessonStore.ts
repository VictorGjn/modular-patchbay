import { create } from 'zustand';

export type LessonCategory = 'style' | 'format' | 'factual' | 'behavioral' | 'domain';
export type InstinctDomain = 'accuracy' | 'output-style' | 'safety' | 'workflow' | 'general';

export interface EvidenceEntry {
  type: 'correction' | 'approval' | 'positive_run';
  timestamp: string;
  description: string;
}

export interface Lesson {
  id: string;
  agentId: string;
  rule: string;
  category: LessonCategory;
  /** Instinct model fields */
  confidence: number;          // 0.0–1.0, default 0.30
  domain: InstinctDomain;      // maps from category
  evidence: EvidenceEntry[];   // audit trail
  lastSeenAt: string;          // ISO string
  /** pending = proposed; approved = active; rejected = dismissed; archived = promoted to Knowledge */
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  createdAt: number;
  appliedCount: number;
  sourceUserMessage: string;
  sourcePreviousAssistant: string;
}

export interface LessonState {
  lessons: Lesson[];
  addLesson: (data: Omit<Lesson, 'id' | 'createdAt' | 'appliedCount' | 'status' | 'confidence' | 'evidence' | 'lastSeenAt'> & { confidence?: number; domain?: InstinctDomain }) => void;
  approveLesson: (id: string) => void;
  rejectLesson: (id: string) => void;
  removeLesson: (id: string) => void;
  updateLesson: (id: string, rule: string) => void;
  incrementApplied: (id: string) => void;
  bumpConfidence: (id: string, delta?: number) => void;
  decayConfidence: (id: string, delta?: number) => void;
  archiveLessons: (ids: string[]) => void;
  getPendingLessons: (agentId: string) => Lesson[];
  getApprovedLessons: (agentId: string) => Lesson[];
  getActiveInstincts: (agentId: string) => Lesson[];
}

/** Map legacy category → domain */
function categoryToDomain(category: LessonCategory): InstinctDomain {
  switch (category) {
    case 'style':
    case 'format':
      return 'output-style';
    case 'factual':
      return 'accuracy';
    case 'behavioral':
      return 'workflow';
    case 'domain':
    default:
      return 'general';
  }
}

const STORAGE_KEY = 'modular-lessons-v2';
const SYNC_FLAG_KEY = 'modular-lessons-v2-synced';

function load(): Lesson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Lesson[];
    // Back-fill new fields for existing lessons.
    // F7: use ?? after spread so null/undefined from old lessons get safe defaults
    //     while explicitly-set values from new lessons are preserved.
    return parsed.map((l) => ({
      ...l,
      confidence: l.confidence ?? 0.30,
      domain: l.domain ?? categoryToDomain(l.category),
      evidence: l.evidence ?? [],
      lastSeenAt: l.lastSeenAt ?? new Date(l.createdAt).toISOString(),
    }));
  } catch {
    return [];
  }
}

function persist(lessons: Lesson[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  } catch { /* storage unavailable */ }
}

function genId(): string {
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** One-time migration: push localStorage lessons to SQLite on first load. */
async function syncToServer(lessons: Lesson[]): Promise<void> {
  try {
    if (localStorage.getItem(SYNC_FLAG_KEY) === '1') return;
    if (lessons.length === 0) { localStorage.setItem(SYNC_FLAG_KEY, '1'); return; }
    const res = await fetch('/api/lessons/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons }),
    });
    if (res.ok) localStorage.setItem(SYNC_FLAG_KEY, '1');
  } catch { /* best-effort — will retry next load */ }
}

const _initialLessons = load();
void syncToServer(_initialLessons);

export const useLessonStore = create<LessonState>((set, get) => ({
  lessons: _initialLessons,

  addLesson: (data) => {
    const now = Date.now();
    const domain = data.domain ?? categoryToDomain(data.category);
    const lesson: Lesson = {
      ...data,
      id: genId(),
      status: 'pending',
      createdAt: now,
      appliedCount: 0,
      confidence: data.confidence ?? 0.30,
      domain,
      evidence: [{ type: 'correction', timestamp: new Date(now).toISOString(), description: 'Extracted from user correction' }],
      lastSeenAt: new Date(now).toISOString(),
    };
    set((s) => {
      const lessons = [...s.lessons, lesson];
      persist(lessons);
      return { lessons };
    });
  },

  approveLesson: (id) => set((s) => {
    const lessons = s.lessons.map((l) =>
      l.id === id
        ? {
            ...l,
            status: 'approved' as const,
            confidence: Math.min(1, l.confidence + 0.2),
            evidence: [...l.evidence, { type: 'approval' as const, timestamp: new Date().toISOString(), description: 'User approved' }],
          }
        : l,
    );
    persist(lessons);
    return { lessons };
  }),

  rejectLesson: (id) => set((s) => {
    const lessons = s.lessons.map((l) => l.id === id ? { ...l, status: 'rejected' as const } : l);
    persist(lessons);
    return { lessons };
  }),

  removeLesson: (id) => set((s) => {
    const lessons = s.lessons.filter((l) => l.id !== id);
    persist(lessons);
    return { lessons };
  }),

  updateLesson: (id, rule) => set((s) => {
    const lessons = s.lessons.map((l) => l.id === id ? { ...l, rule } : l);
    persist(lessons);
    return { lessons };
  }),

  incrementApplied: (id) => set((s) => {
    const lessons = s.lessons.map((l) =>
      l.id === id ? { ...l, appliedCount: l.appliedCount + 1, lastSeenAt: new Date().toISOString() } : l,
    );
    persist(lessons);
    return { lessons };
  }),

  bumpConfidence: (id, delta = 0.05) => set((s) => {
    const lessons = s.lessons.map((l) =>
      l.id === id
        ? {
            ...l,
            confidence: Math.min(1, l.confidence + delta),
            evidence: [...l.evidence, { type: 'positive_run' as const, timestamp: new Date().toISOString(), description: 'Run completed without correction' }],
          }
        : l,
    );
    persist(lessons);
    return { lessons };
  }),

  decayConfidence: (id, delta = 0.05) => set((s) => {
    const lessons = s.lessons.map((l) =>
      l.id === id ? { ...l, confidence: Math.max(0, l.confidence - delta) } : l,
    );
    persist(lessons);
    return { lessons };
  }),

  archiveLessons: (ids) => set((s) => {
    const idSet = new Set(ids);
    const lessons = s.lessons.map((l) => idSet.has(l.id) ? { ...l, status: 'archived' as const } : l);
    persist(lessons);
    return { lessons };
  }),

  getPendingLessons: (agentId) =>
    get().lessons.filter((l) => l.agentId === agentId && l.status === 'pending'),

  getApprovedLessons: (agentId) =>
    get().lessons.filter((l) => l.agentId === agentId && l.status === 'approved'),

  getActiveInstincts: (agentId) =>
    get().lessons.filter((l) => l.agentId === agentId && l.status === 'approved' && l.confidence >= 0.5),
}));
