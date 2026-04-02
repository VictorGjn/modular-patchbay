/**
 * Memory Adapter.
 */

import { MemoryStore, MemoryExtractor } from '../memory/MemoryStore.js';

let _store: MemoryStore | null = null;
const _extractor = new MemoryExtractor();

export function getMemoryStore(basePath?: string): MemoryStore {
  if (!_store) _store = new MemoryStore(basePath ?? './memory');
  return _store;
}

export function createMemoryContextSection(
  query: string,
  maxTokens: number = 2000,
): string {
  const store = getMemoryStore();
  const memories = store.search(query, 10);
  if (!memories.length) return '';
  let section = '## Relevant Memories\n\n';
  let tokens = 30;
  for (const m of memories) {
    const entry = `- **[${m.type}]** ${m.content} *(confidence: ${m.confidence.toFixed(1)})*\n`;
    const t = Math.ceil(entry.length / 4);
    if (tokens + t > maxTokens) break;
    section += entry;
    tokens += t;
  }
  return section;
}

export function extractAndStoreMemories(agentId: string, output: string): number {
  const store = getMemoryStore();
  const extracted = _extractor.extract(output);
  let count = 0;
  for (const mem of extracted) {
    store.save({ ...mem, source: agentId });
    count++;
  }
  return count;
}
