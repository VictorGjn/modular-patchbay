import { create } from 'zustand';

export type LessonCategory = 'style' | 'format' | 'factual' | 'behavioral' | 'domain';

export interface Lesson {
  id: string;
  agentId: string;
  rule: string;
  category: LessonCategory;
  /** pending = proposed (awaiting review); approved = active; rejected = dismissed */
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  appliedCount: number;
  sourceUserMessage: string;
  sourcePreviousAssistant: string;
}

export interface LessonState {
  lessons: Lesson[];
  addLesson: (data: Omit<Lesson, 'id' | 'createdAt' | 'appliedCount' | 'status'>) => void;
  approveLesson: (id: string) => void;
  rejectLesson: (id: string) => void;
  removeLesson: (id: string) => void;
  updateLesson: (id: string, rule: string) => void;
  incrementApplied: (id: string) => void;
  getPendingLessons: (agentId: string) => Lesson[];
  getApprovedLessons: (agentId: string) => Lesson[];
}

const STORAGE_KEY = 'modular-lessons-v2';

function load(): Lesson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Lesson[]) : [];
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

export const useLessonStore = create<LessonState>((set, get) => ({
  lessons: load(),

  addLesson: (data) => {
    const lesson: Lesson = {
      ...data,
      id: genId(),
      status: 'pending',
      createdAt: Date.now(),
      appliedCount: 0,
    };
    set((s) => {
      const lessons = [...s.lessons, lesson];
      persist(lessons);
      return { lessons };
    });
  },

  approveLesson: (id) => set((s) => {
    const lessons = s.lessons.map((l) => l.id === id ? { ...l, status: 'approved' as const } : l);
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
      l.id === id ? { ...l, appliedCount: l.appliedCount + 1 } : l,
    );
    persist(lessons);
    return { lessons };
  }),

  getPendingLessons: (agentId) =>
    get().lessons.filter((l) => l.agentId === agentId && l.status === 'pending'),

  getApprovedLessons: (agentId) =>
    get().lessons.filter((l) => l.agentId === agentId && l.status === 'approved'),
}));
