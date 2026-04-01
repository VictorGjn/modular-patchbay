/**
 * MemoryStore Integration — bridges MemoryStore (filesystem-backed)
 * with the context assembly pipeline.
 *
 * - Creates a memory context section for SystemPromptBuilder
 * - Extracts memories from agent output after runs
 * - Provides search during context assembly
 */

import { MemoryStore, MemoryExtractor } from '../memory/MemoryStore.js';
import type { Memory } from '../memory/MemoryStore.js';

let _storeInstance: MemoryStore | null = null;

/**
 * Get or create the singleton MemoryStore instance.
 * Default path: .modular-studio/memories (project-level)
 */
export function getMemoryStore(basePath?: string): MemoryStore {
  if (!_storeInstance || basePath) {
    const path = basePath ?? '.modular-studio/memories';
    _storeInstance = new MemoryStore(path);
  }
  return _storeInstance;
}

/**
 * Create a memory context section for injection into the system prompt.
 * Searches for relevant memories based on the task/query and formats
 * them as an XML block.
 *
 * Usage with SystemPromptBuilder:
 *   const memorySection = createMemoryContextSection(task);
 *   builder.addDynamic('memory', memorySection);
 */
export function createMemoryContextSection(
  query: string,
  options: { limit?: number; basePath?: string } = {},
): string {
  const store = getMemoryStore(options.basePath);
  const memories = store.search(query, options.limit ?? 10);

  if (memories.length === 0) return '';

  const lines: string[] = ['Relevant memories from previous sessions:'];
  for (const m of memories) {
    const tags = m.tags.length > 0 ? ' [' + m.tags.join(', ') + ']' : '';
    lines.push('- [' + m.type + '] ' + m.content + tags);
  }
  return lines.join('\n');
}

/**
 * Extract and store memories from an agent's output.
 * Called after agent runs complete.
 *
 * Returns the newly stored memories.
 */
export function extractAndStoreMemories(
  agentId: string,
  output: string,
  options: { basePath?: string } = {},
): Memory[] {
  const store = getMemoryStore(options.basePath);
  return store.extractFromAgentOutput(agentId, output);
}

/**
 * Search memories and return formatted results.
 */
export function searchMemories(
  query: string,
  options: { limit?: number; basePath?: string } = {},
): Memory[] {
  const store = getMemoryStore(options.basePath);
  return store.search(query, options.limit ?? 10);
}

/**
 * Run memory consolidation (dedup + prune).
 */
export function consolidateMemories(
  options: { basePath?: string } = {},
): { merged: number; pruned: number; new: number } {
  const store = getMemoryStore(options.basePath);
  return store.consolidate();
}
