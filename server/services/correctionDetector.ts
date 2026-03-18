/**
 * Correction Detector — identifies when a user is correcting the assistant.
 *
 * Two signal types:
 *   direct   — regex patterns: "no", "wrong", "not like that", "actually", "instead", "I said"
 *   rephrase — consecutive user messages with cosine similarity > 0.85
 */

export interface CorrectionSignal {
  type: 'direct' | 'rephrase' | 'override';
  confidence: number;
  userMessage: string;
  previousAssistant: string;
  correctedBehavior: string;
}

interface PatternRule {
  pattern: RegExp;
  type: CorrectionSignal['type'];
  confidence: number;
}

const PATTERNS: PatternRule[] = [
  { pattern: /^\s*no[,.]?\s/i, type: 'direct', confidence: 0.9 },
  { pattern: /\b(wrong|that'?s wrong|not right|incorrect)\b/i, type: 'direct', confidence: 0.9 },
  { pattern: /\bnot like that\b/i, type: 'direct', confidence: 0.95 },
  { pattern: /\bactually[,]?\s/i, type: 'rephrase', confidence: 0.75 },
  { pattern: /\binstead[,]?\s/i, type: 'override', confidence: 0.8 },
  { pattern: /\bi said\b/i, type: 'override', confidence: 0.85 },
  { pattern: /\bi meant\b/i, type: 'rephrase', confidence: 0.85 },
];

function extractCorrectedBehavior(userMessage: string): string {
  const trimmed = userMessage.trim();
  return trimmed.length > 200 ? trimmed.slice(0, 200) + '…' : trimmed;
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

async function fetchEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch('/api/knowledge/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text] }),
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    if (typeof raw !== 'object' || raw === null || !('embeddings' in raw)) return null;
    const embs = (raw as { embeddings: unknown }).embeddings;
    if (!Array.isArray(embs) || !Array.isArray(embs[0])) return null;
    return embs[0] as number[];
  } catch {
    return null;
  }
}

/** Sync direct-signal detection — regex only, no async needed. */
export function detectCorrection(
  userMessage: string,
  previousAssistant: string,
): CorrectionSignal | null {
  if (!previousAssistant) return null;

  for (const rule of PATTERNS) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(userMessage)) {
      return {
        type: rule.type,
        confidence: rule.confidence,
        userMessage,
        previousAssistant,
        correctedBehavior: extractCorrectedBehavior(userMessage),
      };
    }
  }

  return null;
}

/**
 * Async rephrase detection — cosine similarity > 0.85 between consecutive user messages.
 * Falls back to null if embeddings are unavailable.
 */
export async function detectRephrase(
  userMessage: string,
  previousAssistant: string,
  previousUserMessage: string,
): Promise<CorrectionSignal | null> {
  const [embA, embB] = await Promise.all([
    fetchEmbedding(userMessage),
    fetchEmbedding(previousUserMessage),
  ]);
  if (!embA || !embB) return null;
  const sim = cosineSim(embA, embB);
  if (sim <= 0.85) return null;
  return {
    type: 'rephrase',
    confidence: sim,
    userMessage,
    previousAssistant,
    correctedBehavior: extractCorrectedBehavior(userMessage),
  };
}
