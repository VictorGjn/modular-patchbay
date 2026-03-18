import type { Fact } from '../../../src/store/memoryStore.js';
import type { StorageAdapter } from './storageAdapter.js';
import { ModularHindsightClient } from '../hindsightClient.js';
import type { HindsightMemoryItem } from '../hindsightClient.js';

const DEFAULT_BANK = 'modular-studio';
const FALLBACK_SCORE = 0.8;

function toFact(item: HindsightMemoryItem): Fact {
  return {
    id: item.id,
    content: item.content,
    tags: [],
    type: 'fact',
    timestamp: Date.now(),
    domain: 'shared',
    granularity: 'fact',
  };
}

function buildFactMeta(fact: Fact): Record<string, string> {
  const meta: Record<string, string> = {
    id: fact.id,
    type: fact.type,
    domain: fact.domain,
    granularity: fact.granularity,
  };
  if (fact.ownerAgentId) meta.ownerAgentId = fact.ownerAgentId;
  return meta;
}

export class HindsightAdapter implements StorageAdapter {
  private readonly client: ModularHindsightClient;
  private readonly bank: string;
  private lastWrite = 0;

  constructor(baseUrl: string, bank = DEFAULT_BANK) {
    this.client = new ModularHindsightClient(baseUrl);
    this.bank = bank;
  }

  async initialize(): Promise<void> {}

  async storeFact(fact: Fact): Promise<void> {
    await this.client.retain(this.bank, fact.content, buildFactMeta(fact));
    this.lastWrite = Date.now();
  }

  async getFacts(options?: { domain?: string; limit?: number; offset?: number }): Promise<Fact[]> {
    const query = options?.domain ? `domain:${options.domain}` : '*';
    const items = await this.client.recall(this.bank, query, options?.limit ?? 50);
    return items.map(toFact);
  }

  async searchFacts(query: string, k = 5): Promise<Array<Fact & { score: number }>> {
    const items = await this.client.recall(this.bank, query, k);
    return items.map(item => ({ ...toFact(item), score: FALLBACK_SCORE }));
  }

  // Hindsight is append-only — delete and update are no-ops
  async deleteFact(_id: string): Promise<void> {}
  async updateFact(_id: string, _patch: Partial<Fact>): Promise<void> {}

  async reflect(query: string): Promise<string> {
    return this.client.reflect(this.bank, query);
  }

  async getHealth(): Promise<{ status: string; factCount: number; lastWrite?: number }> {
    const ok = await this.client.healthCheck();
    return {
      status: ok ? 'healthy' : 'unavailable',
      factCount: 0,
      ...(this.lastWrite > 0 && { lastWrite: this.lastWrite }),
    };
  }

  async close(): Promise<void> {}
}
