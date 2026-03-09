import { readConfig } from '../config.js';

export interface ExtractedFact {
  key: string;
  value: string;
  epistemicType: 'observation' | 'inference' | 'decision' | 'hypothesis' | 'contract';
  confidence: number;
  source: string;
  importance?: number;
  created_at?: number;
  accessed_at?: number;
  access_count?: number;
}

interface PatternRule {
  pattern: RegExp;
  epistemicType: ExtractedFact['epistemicType'];
  confidence: number;
  keyPrefix: string;
}

const PATTERNS: PatternRule[] = [
  // Decisions
  { pattern: /I (?:decided|chose|picked|selected|went with|will use|am going to use) (?:to )?(.+?)(?:\.|$)/gim, epistemicType: 'decision', confidence: 0.9, keyPrefix: 'decision' },
  { pattern: /(?:Let's|We should|I'll|I will) (?:use|go with|implement|create|build) (.+?)(?:\.|$)/gim, epistemicType: 'decision', confidence: 0.8, keyPrefix: 'decision' },
  // Observations
  { pattern: /The (?:file|directory|folder|API|endpoint|function|module|class) (.+?) (?:exports?|contains?|has|returns?|provides?) (.+?)(?:\.|$)/gim, epistemicType: 'observation', confidence: 0.85, keyPrefix: 'observation' },
  { pattern: /I (?:found|noticed|observed|see|saw) (?:that )?(.+?)(?:\.|$)/gim, epistemicType: 'observation', confidence: 0.8, keyPrefix: 'observation' },
  { pattern: /I (?:created|wrote|added|updated|modified|deleted|removed) (?:the )?(?:file )?(.+?)(?:\.|$)/gim, epistemicType: 'observation', confidence: 0.95, keyPrefix: 'file_action' },
  // Inferences
  { pattern: /(?:This means|Therefore|So|Thus|Hence|It follows that|This implies) (.+?)(?:\.|$)/gim, epistemicType: 'inference', confidence: 0.7, keyPrefix: 'inference' },
  { pattern: /(?:It (?:seems|appears|looks) (?:like|that)) (.+?)(?:\.|$)/gim, epistemicType: 'inference', confidence: 0.5, keyPrefix: 'inference' },
  // Hypotheses
  { pattern: /(?:I think|I believe|I suspect|Maybe|Perhaps|Possibly|My guess is) (.+?)(?:\.|$)/gim, epistemicType: 'hypothesis', confidence: 0.4, keyPrefix: 'hypothesis' },
  // Contracts — interfaces, types, schemas
  { pattern: /(?:^|\n)((?:export )?interface \w+[\s\S]*?\n\})/gm, epistemicType: 'contract', confidence: 0.95, keyPrefix: 'contract' },
  { pattern: /(?:^|\n)((?:export )?type \w+ = [\s\S]*?(?:;|\n\}))/gm, epistemicType: 'contract', confidence: 0.95, keyPrefix: 'contract' },
];

function makeKey(prefix: string, index: number, value: string): string {
  const slug = value.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/_$/, '').toLowerCase();
  return `${prefix}_${index}_${slug}`;
}

export function extractFacts(agentOutput: string, agentId: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  let globalIdx = 0;

  for (const rule of PATTERNS) {
    // Reset regex state
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(agentOutput)) !== null) {
      const value = (match[2] ?? match[1] ?? match[0]).trim();
      if (!value || value.length < 3) continue;
      const dedupKey = `${rule.epistemicType}:${value.slice(0, 80)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const now = Date.now();
      facts.push({
        key: makeKey(rule.keyPrefix, globalIdx++, value),
        value,
        epistemicType: rule.epistemicType,
        confidence: rule.confidence,
        source: agentId,
        importance: rule.confidence * 0.8,
        created_at: now,
        accessed_at: now,
        access_count: 0,
      });
    }
  }

  return facts;
}

export async function extractFactsWithLlm(
  agentOutput: string,
  agentId: string,
  providerId: string,
  model: string,
): Promise<ExtractedFact[]> {
  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found`);
  if (!provider.baseUrl) throw new Error(`Provider "${providerId}" has no baseUrl`);

  const extractionPrompt = `Extract structured facts from the following agent output. Return a JSON array of objects with these fields:
- key: short snake_case identifier
- value: the fact content
- epistemicType: one of "observation", "inference", "decision", "hypothesis", "contract"
- confidence: number 0-1

Only return the JSON array, no other text.

Agent output:
${agentOutput}`;

  const messages = [{ role: 'user', content: extractionPrompt }];

  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (provider.type === 'anthropic') {
    url = `${provider.baseUrl}/messages`;
    headers = {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    body = JSON.stringify({ model, max_tokens: 4096, messages });
  } else {
    url = `${provider.baseUrl}/chat/completions`;
    headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = JSON.stringify({ model, messages });
  }

  const response = await fetch(url, { method: 'POST', headers, body });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM extraction failed (${response.status}): ${errText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  let text: string;
  if (provider.type === 'anthropic') {
    const content = data.content as Array<{ type: string; text: string }>;
    text = content?.find((c) => c.type === 'text')?.text ?? '';
  } else {
    const choices = data.choices as Array<{ message: { content: string } }>;
    text = choices?.[0]?.message?.content ?? '';
  }

  // Parse JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    key: string; value: string;
    epistemicType: ExtractedFact['epistemicType'];
    confidence: number;
  }>;

  const now = Date.now();
  return parsed.map((f) => ({
    key: f.key,
    value: f.value,
    epistemicType: f.epistemicType,
    confidence: f.confidence,
    source: agentId,
    importance: f.confidence * 0.8,
    created_at: now,
    accessed_at: now,
    access_count: 0,
  }));
}
