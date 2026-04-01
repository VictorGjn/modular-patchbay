/**
 * Transcript Compaction — claw-code pattern: Sliding Window Compaction.
 *
 * Keeps a fixed window of recent conversation turns, dropping older ones.
 * Combined with the existing ReactiveCompaction (which adjusts depth levels),
 * this handles the MESSAGE dimension of context management.
 *
 * ReactiveCompaction = file depth management (vertical compression)
 * TranscriptCompaction = conversation window management (horizontal compression)
 */

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  tokenEstimate: number;
  metadata?: {
    toolName?: string;
    stepId?: string;
    isKeyDecision?: boolean;  // protected from compaction
  };
}

export interface CompactionResult {
  kept: TranscriptEntry[];
  dropped: TranscriptEntry[];
  tokensRecovered: number;
}

export interface CompactionConfig {
  maxEntries: number;           // hard limit on transcript length
  maxTokens: number;            // soft limit on total tokens
  protectKeyDecisions: boolean; // never drop entries marked as key decisions
  summarizeDropped: boolean;    // generate summary of dropped entries
}

const DEFAULT_CONFIG: CompactionConfig = {
  maxEntries: 50,
  maxTokens: 30000,
  protectKeyDecisions: true,
  summarizeDropped: true,
};

export class TranscriptCompaction {
  private config: CompactionConfig;

  constructor(config: Partial<CompactionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compact transcript to fit within limits.
   * Strategy: keep the NEWEST entries, drop oldest first.
   * Protected entries (key decisions, system messages) are preserved.
   */
  compact(entries: TranscriptEntry[]): CompactionResult {
    if (entries.length <= this.config.maxEntries) {
      const totalTokens = entries.reduce((sum, e) => sum + e.tokenEstimate, 0);
      if (totalTokens <= this.config.maxTokens) {
        return { kept: [...entries], dropped: [], tokensRecovered: 0 };
      }
    }

    // Separate protected and droppable entries
    const isProtected = (e: TranscriptEntry): boolean => {
      if (e.role === 'system') return true;
      if (this.config.protectKeyDecisions && e.metadata?.isKeyDecision) return true;
      return false;
    };

    const protectedEntries = entries.filter(isProtected);
    const droppable = entries.filter(e => !isProtected(e));

    // Keep newest droppable entries that fit
    const maxDroppable = this.config.maxEntries - protectedEntries.length;
    const kept = droppable.slice(-maxDroppable);
    const dropped = droppable.slice(0, droppable.length - maxDroppable);

    // If still over token budget, drop more from oldest kept entries
    let totalTokens = [...protectedEntries, ...kept].reduce((sum, e) => sum + e.tokenEstimate, 0);
    while (totalTokens > this.config.maxTokens && kept.length > 0) {
      const removed = kept.shift()!;
      dropped.push(removed);
      totalTokens -= removed.tokenEstimate;
    }

    const tokensRecovered = dropped.reduce((sum, e) => sum + e.tokenEstimate, 0);
    const finalKept = [...protectedEntries, ...kept].sort((a, b) => a.timestamp - b.timestamp);

    return { kept: finalKept, dropped, tokensRecovered };
  }

  /**
   * Generate a summary line for compacted messages.
   * Injected as a system message to preserve context awareness.
   */
  summarizeDropped(dropped: TranscriptEntry[]): string {
    if (!dropped.length) return '';
    const userMsgs = dropped.filter(e => e.role === 'user');
    const toolMsgs = dropped.filter(e => e.role === 'tool');
    const parts: string[] = [
      `[${dropped.length} earlier messages compacted]`,
    ];
    if (userMsgs.length) {
      parts.push(`User topics: ${userMsgs.map(m => m.content.slice(0, 50)).join('; ')}`);
    }
    if (toolMsgs.length) {
      parts.push(`Tool calls: ${toolMsgs.map(m => m.metadata?.toolName ?? 'unknown').join(', ')}`);
    }
    return parts.join('
');
  }

  /** Estimate tokens for a string (rough approximation). */
  static estimateTokens(text: string): number {
    return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
  }
}
