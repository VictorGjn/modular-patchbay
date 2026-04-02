/**
 * Prompt Router — claw-code pattern: Fuzzy Prompt Routing.
 *
 * Instead of injecting ALL available tools into the context window,
 * tokenize the user prompt and score each tool/channel by token overlap.
 * Only relevant tools enter the context — less noise = better LLM output.
 *
 * This is the key insight from claw-code: the harness decides WHICH tools
 * the model sees on each turn, based on the prompt content.
 */

export interface RoutableItem {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface RoutedMatch<T extends RoutableItem = RoutableItem> {
  item: T;
  score: number;
  matchedTokens: string[];
}

/**
 * Tokenize a prompt into scorable tokens.
 * Strips punctuation, lowercases, splits on whitespace/slashes/dashes.
 */
export function tokenizePrompt(prompt: string): Set<string> {
  return new Set(
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s\/_-]/g, '')
      .split(/[\s\/_-]+/)
      .filter(t => t.length >= 2)
  );
}

/**
 * Score an item against prompt tokens.
 * Checks name, description, and tags for token overlap.
 */
export function scoreItem(tokens: Set<string>, item: RoutableItem): { score: number; matched: string[] } {
  const haystacks = [
    item.name.toLowerCase(),
    item.description.toLowerCase(),
    ...(item.tags ?? []).map(t => t.toLowerCase()),
  ].join(' ');

  let score = 0;
  const matched: string[] = [];

  for (const token of tokens) {
    if (haystacks.includes(token)) {
      score++;
      matched.push(token);
    }
  }

  // Bonus for exact name match
  const nameLower = item.name.toLowerCase();
  for (const token of tokens) {
    if (nameLower === token) {
      score += 2;
      break;
    }
  }

  return { score, matched };
}

/**
 * Route a prompt to the most relevant items from a registry.
 * Returns items sorted by relevance score, limited to `limit`.
 *
 * If `minScore` is set, items below that score are excluded.
 * If `guaranteeOnePerCategory` is set, at least one item from each
 * category (derived from tags[0]) is included if it has any match.
 */
export function routePrompt<T extends RoutableItem>(
  prompt: string,
  registry: T[],
  options: {
    limit?: number;
    minScore?: number;
    guaranteeOnePerCategory?: boolean;
  } = {},
): RoutedMatch<T>[] {
  const { limit = 10, minScore = 1, guaranteeOnePerCategory = false } = options;
  const tokens = tokenizePrompt(prompt);

  const scored = registry
    .map(item => {
      const { score, matched } = scoreItem(tokens, item);
      return { item, score, matchedTokens: matched };
    })
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score);

  if (!guaranteeOnePerCategory) {
    return scored.slice(0, limit);
  }

  // Guarantee at least one per category
  const selected: RoutedMatch<T>[] = [];
  const seenCategories = new Set<string>();

  for (const match of scored) {
    const category = match.item.tags?.[0] ?? 'default';
    if (!seenCategories.has(category)) {
      selected.push(match);
      seenCategories.add(category);
    }
    if (selected.length >= limit) break;
  }

  // Fill remaining slots with top scorers
  for (const match of scored) {
    if (selected.length >= limit) break;
    if (!selected.includes(match)) selected.push(match);
  }

  return selected.slice(0, limit);
}

/**
 * Build a minimal tool description for context injection.
 * Only includes matched tools, keeping context window lean.
 */
export function renderRoutedTools<T extends RoutableItem>(matches: RoutedMatch<T>[]): string {
  if (!matches.length) return '';
  const lines = ['## Available Tools (matched for this query)', ''];
  for (const m of matches) {
    lines.push(`- **${m.item.name}** — ${m.item.description} (relevance: ${m.score})`);
  }
  return lines.join('
');
}
