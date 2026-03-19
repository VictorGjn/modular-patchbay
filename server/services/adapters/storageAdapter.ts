import type { Fact } from '../../../src/store/memoryStore.js';

export interface StorageAdapter {
  initialize(): Promise<void>;
  storeFact(fact: Fact): Promise<void>;
  getFacts(options?: { domain?: string; limit?: number; offset?: number }): Promise<Fact[]>;
  searchFacts(query: string, k?: number): Promise<Array<Fact & { score: number }>>;
  deleteFact(id: string): Promise<void>;
  updateFact(id: string, patch: Partial<Fact>): Promise<void>;
  getHealth(): Promise<{ status: string; factCount: number; lastWrite?: number }>;
  close(): Promise<void>;
}