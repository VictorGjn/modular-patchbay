import { HindsightClient } from '@vectorize-io/hindsight-client';
import type { RecallResult } from '@vectorize-io/hindsight-client';

export interface HindsightMemoryItem {
  id: string;
  content: string;
  type: string | null;
}

function toMemoryItem(r: RecallResult): HindsightMemoryItem {
  return { id: r.id, content: r.text, type: r.type ?? null };
}

export class ModularHindsightClient {
  private readonly client: HindsightClient;
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:8888') {
    this.baseUrl = baseUrl;
    this.client = new HindsightClient(baseUrl);
  }

  async retain(agentId: string, content: string, metadata?: Record<string, string>): Promise<void> {
    await this.client.retain(agentId, content, metadata ? { metadata } : undefined);
  }

  async recall(agentId: string, query: string, k = 5): Promise<HindsightMemoryItem[]> {
    try {
      const result = await this.client.recall(agentId, query, { budget: 'mid' });
      return result.results.slice(0, k).map(toMemoryItem);
    } catch {
      return [];
    }
  }

  async reflect(agentId: string, query: string): Promise<string> {
    try {
      const result = await this.client.reflect(agentId, query, { budget: 'low' });
      return result.text;
    } catch {
      return '';
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
