/**
 * Reactive Compaction — dynamically adjust depth levels based on runtime signals.
 *
 * Monitors token pressure, hedging detection, topic shifts, tool-heavy turns,
 * and error recovery to decide when to compact context.
 */

export type ContextSignal =
  | { type: 'token_pressure'; ratio: number }
  | { type: 'hedging_detected'; confidence: number }
  | { type: 'topic_shift'; newTopic: string }
  | { type: 'tool_heavy'; toolCount: number }
  | { type: 'error_recovery'; errorType: string };

export type DepthLevel = 'full' | 'detail' | 'summary' | 'headlines' | 'mention';

export interface DepthAdjustment {
  fileId: string;
  currentDepth: DepthLevel;
  newDepth: DepthLevel;
  reason: string;
}

export interface PackedFile {
  fileId: string;
  path: string;
  depth: DepthLevel;
  tokens: number;
  relevanceScore: number;
}

export interface AssembledContext {
  files: PackedFile[];
  totalTokens: number;
}

export interface CompactionConfig {
  pressureThreshold: number;
  emergencyThreshold: number;
  depthOrder: DepthLevel[];
}

const DEFAULT_CONFIG: CompactionConfig = {
  pressureThreshold: 0.8,
  emergencyThreshold: 0.95,
  depthOrder: ['full', 'detail', 'summary', 'headlines', 'mention'],
};

export class ReactiveCompaction {
  private config: CompactionConfig;

  constructor(config: Partial<CompactionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  processSignals(signals: ContextSignal[], currentFiles: PackedFile[]): DepthAdjustment[] {
    const adjustments: DepthAdjustment[] = [];
    const sorted = this.prioritizeForDowngrade(currentFiles);

    for (const signal of signals) {
      switch (signal.type) {
        case 'token_pressure': {
          if (signal.ratio >= this.config.emergencyThreshold) {
            // Emergency: downgrade all non-mention files
            for (const f of sorted) {
              if (f.depth !== 'mention') {
                adjustments.push({ fileId: f.fileId, currentDepth: f.depth, newDepth: 'mention', reason: 'emergency_pressure' });
              }
            }
          } else if (signal.ratio >= this.config.pressureThreshold) {
            // Pressure: downgrade least-relevant half by one level
            const half = Math.ceil(sorted.length / 2);
            for (let i = 0; i < half; i++) {
              const f = sorted[i];
              const next = this.nextDepth(f.depth);
              if (next) adjustments.push({ fileId: f.fileId, currentDepth: f.depth, newDepth: next, reason: 'token_pressure' });
            }
          }
          break;
        }
        case 'hedging_detected': {
          if (signal.confidence < 0.5) {
            // Upgrade top files for more context
            const top = sorted.slice(0, Math.min(3, sorted.length));
            for (const f of top) {
              const prev = this.prevDepth(f.depth);
              if (prev) adjustments.push({ fileId: f.fileId, currentDepth: f.depth, newDepth: prev, reason: 'hedging_upgrade' });
            }
          }
          break;
        }
        case 'topic_shift': {
          // Downgrade all files by one level on topic shift
          for (const f of sorted) {
            const next = this.nextDepth(f.depth);
            if (next) adjustments.push({ fileId: f.fileId, currentDepth: f.depth, newDepth: next, reason: `topic_shift:${signal.newTopic}` });
          }
          break;
        }
        case 'tool_heavy': {
          if (signal.toolCount > 5) {
            // Many tools = less context needed, downgrade bottom third
            const third = Math.ceil(sorted.length * 2 / 3);
            for (let i = third; i < sorted.length; i++) {
              const f = sorted[i];
              const next = this.nextDepth(f.depth);
              if (next) adjustments.push({ fileId: f.fileId, currentDepth: f.depth, newDepth: next, reason: 'tool_heavy' });
            }
          }
          break;
        }
        case 'error_recovery': {
          // Upgrade top files for more context after error
          const top = sorted.slice(0, Math.min(5, sorted.length));
          for (const f of top) {
            const prev = this.prevDepth(f.depth);
            if (prev) adjustments.push({ fileId: f.fileId, currentDepth: f.depth, newDepth: prev, reason: `error_recovery:${signal.errorType}` });
          }
          break;
        }
      }
    }
    return adjustments;
  }

  /** Sort files by relevance ascending (least relevant first for downgrade). */
  prioritizeForDowngrade(files: PackedFile[]): PackedFile[] {
    return [...files].sort((a, b) => a.relevanceScore - b.relevanceScore);
  }

  /** Micro-compact: truncate text to fit target reduction in estimated tokens. */
  microcompact(section: string, targetReduction: number): string {
    const sentences = section.split(/(?<=\.)\s+/);
    if (sentences.length <= 1) return section;

    const kept: string[] = [sentences[0]]; // Always keep first sentence
    let tokensKept = Math.ceil(sentences[0].split(/\s+/).length * 1.3);
    const totalTokens = Math.ceil(section.split(/\s+/).length * 1.3);
    const targetTokens = totalTokens - targetReduction;

    for (let i = 1; i < sentences.length; i++) {
      const sentenceTokens = Math.ceil(sentences[i].split(/\s+/).length * 1.3);
      if (tokensKept + sentenceTokens <= targetTokens) {
        kept.push(sentences[i]);
        tokensKept += sentenceTokens;
      }
    }

    return kept.join(' ') + (kept.length < sentences.length ? ' [...]' : '');
  }

  /** Auto-compact: reduce context to fit within token budget. */
  autoCompact(context: AssembledContext, tokenBudget: number): AssembledContext {
    if (context.totalTokens <= tokenBudget) return context;

    const sorted = this.prioritizeForDowngrade(context.files);
    const result = [...sorted];
    let total = context.totalTokens;

    for (let i = result.length - 1; i >= 0 && total > tokenBudget; i--) {
      const file = result[i];
      const next = this.nextDepth(file.depth);
      if (next) {
        const reduction = Math.floor(file.tokens * 0.4);
        result[i] = { ...file, depth: next, tokens: file.tokens - reduction };
        total -= reduction;
      }
    }

    return { files: result, totalTokens: total };
  }

  private nextDepth(depth: DepthLevel): DepthLevel | null {
    const order = this.config.depthOrder;
    const idx = order.indexOf(depth);
    return idx < order.length - 1 ? order[idx + 1] : null;
  }

  private prevDepth(depth: DepthLevel): DepthLevel | null {
    const order = this.config.depthOrder;
    const idx = order.indexOf(depth);
    return idx > 0 ? order[idx - 1] : null;
  }
}
