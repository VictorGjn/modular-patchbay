/**
 * Lesson Extractor — uses an LLM to derive an actionable rule from a correction signal.
 *
 * Accepts provider params directly so it can be called from both server and browser contexts.
 */
import type { CorrectionSignal } from './correctionDetector.js';

export type LessonCategory = 'style' | 'format' | 'factual' | 'behavioral' | 'domain';
export type InstinctDomain = 'accuracy' | 'output-style' | 'safety' | 'workflow' | 'general';

export interface ExtractedLesson {
  rule: string;
  category: LessonCategory;
  domain: InstinctDomain;
  confidence: number;
}

export interface LlmProviderConfig {
  type: string;
  baseUrl: string;
  apiKey: string;
}

const VALID_CATEGORIES: LessonCategory[] = ['style', 'format', 'factual', 'behavioral', 'domain'];
const VALID_DOMAINS: InstinctDomain[] = ['accuracy', 'output-style', 'safety', 'workflow', 'general'];

const EXTRACTION_PROMPT = (correction: CorrectionSignal): string =>
  `Given this user correction, extract a behavioral rule in the format: "When X, do Y instead of Z".

User correction: ${correction.userMessage}

Previous assistant response (first 300 chars): ${correction.previousAssistant.slice(0, 300)}

Return a JSON object with:
- rule: the behavioral rule string (max 120 chars, "When X, do Y instead of Z")
- category: one of "style" | "format" | "factual" | "behavioral" | "domain"
- domain: one of "accuracy" | "output-style" | "safety" | "workflow" | "general"
  (accuracy=factual correctness, output-style=formatting/tone, safety=harm avoidance, workflow=process/steps, general=other)
- confidence: number 0-1 reflecting how clear the correction signal is

Return only valid JSON, no other text.`;

function parseLesson(text: string): ExtractedLesson | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const raw: unknown = JSON.parse(jsonMatch[0]);
    if (typeof raw !== 'object' || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    const rule = typeof obj.rule === 'string' ? obj.rule.trim() : '';
    const cat = typeof obj.category === 'string' ? obj.category : '';
    const dom = typeof obj.domain === 'string' ? obj.domain : '';
    const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
    if (!rule || !VALID_CATEGORIES.includes(cat as LessonCategory)) return null;
    const domain: InstinctDomain = VALID_DOMAINS.includes(dom as InstinctDomain) ? (dom as InstinctDomain) : 'general';
    return { rule, category: cat as LessonCategory, domain, confidence };
  } catch {
    return null;
  }
}

async function callAnthropicLlm(
  cfg: LlmProviderConfig,
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM call failed (${res.status})`);
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || !('content' in data)) return '';
  const content = (data as { content: unknown }).content;
  if (!Array.isArray(content)) return '';
  const textBlock = content.find(
    (c): c is { type: string; text: string } =>
      typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text',
  );
  return textBlock?.text ?? '';
}

async function callOpenAiLlm(
  cfg: LlmProviderConfig,
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM call failed (${res.status})`);
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || !('choices' in data)) return '';
  const choices = (data as { choices: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const msg = (choices[0] as Record<string, unknown>).message;
  if (typeof msg !== 'object' || msg === null) return '';
  return String((msg as Record<string, unknown>).content ?? '');
}

async function callLlm(
  cfg: LlmProviderConfig,
  model: string,
  prompt: string,
): Promise<string> {
  if (cfg.type === 'anthropic') return callAnthropicLlm(cfg, model, prompt);
  return callOpenAiLlm(cfg, model, prompt);
}

export async function extractLesson(
  correction: CorrectionSignal,
  provider: LlmProviderConfig,
  model: string,
): Promise<ExtractedLesson | null> {
  try {
    const text = await callLlm(provider, model, EXTRACTION_PROMPT(correction));
    return parseLesson(text);
  } catch {
    return null;
  }
}
