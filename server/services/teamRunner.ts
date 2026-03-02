import { readConfig } from '../config.js';
import { extractFacts } from './factExtractor.js';
import { runAgent } from './agentRunner.js';
import type { AgentRunConfig, AgentRunResult, ProgressCallback } from './agentRunner.js';
import type { ExtractedFact } from './factExtractor.js';
import { indexGitHubRepo } from './githubIndexer.js';

export interface TeamRunConfig {
  teamId: string;
  featureSpec: string;
  agents: AgentRunConfig[];
  providerId: string;
  model: string;
  extractContracts?: boolean;
}

export interface TeamRunResult {
  teamId: string;
  agentResults: AgentRunResult[];
  sharedFacts: ExtractedFact[];
  contractFacts: ExtractedFact[];
  durationMs: number;
  status: 'completed' | 'partial' | 'error';
}

async function extractContractsFromSpec(
  featureSpec: string,
  providerId: string,
  model: string,
): Promise<ExtractedFact[]> {
  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found`);
  if (!provider.baseUrl) throw new Error(`Provider "${providerId}" has no baseUrl`);

  const prompt = `Analyze the following feature specification and extract all data contracts, types, interfaces, API schemas, and DTOs. Return them as TypeScript interfaces/types.

Feature specification:
${featureSpec}

Return ONLY the TypeScript types/interfaces, nothing else.`;

  const messages = [{ role: 'user', content: prompt }];

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
    throw new Error(`Contract extraction failed (${response.status}): ${errText}`);
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

  return extractFacts(text, 'contract_extractor');
}

function deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const seen = new Map<string, ExtractedFact>();
  for (const fact of facts) {
    const existing = seen.get(fact.key);
    if (!existing || existing.confidence < fact.confidence) {
      seen.set(fact.key, fact);
    }
  }
  return Array.from(seen.values());
}

export async function runTeam(config: TeamRunConfig, onProgress?: ProgressCallback): Promise<TeamRunResult> {
  const start = Date.now();

  let contractFacts: ExtractedFact[] = [];

  try {
    // Step 1: Extract contracts if requested
    if (config.extractContracts) {
      contractFacts = await extractContractsFromSpec(config.featureSpec, config.providerId, config.model);
    }

    // Step 2: Index repos for agents that have repoUrl
    const agentsWithRepos = config.agents.filter((a) => a.repoUrl);
    const repoIndexes = new Map<string, string>();

    if (agentsWithRepos.length > 0) {
      const indexResults = await Promise.allSettled(
        agentsWithRepos.map(async (agent) => {
          const result = await indexGitHubRepo({
            url: agent.repoUrl!,
            ref: agent.repoRef,
          });
          return { url: agent.repoUrl!, markdown: result.fullMarkdown };
        }),
      );
      for (const r of indexResults) {
        if (r.status === 'fulfilled') {
          repoIndexes.set(r.value.url, r.value.markdown);
        }
      }
    }

    // Step 3: Run all agents in parallel, injecting contract facts + repo knowledge
    const agentConfigs = config.agents.map((agent) => ({
      ...agent,
      teamFacts: [...(agent.teamFacts ?? []), ...contractFacts],
      repoKnowledge: agent.repoUrl ? repoIndexes.get(agent.repoUrl) : undefined,
    }));

    const results = await Promise.allSettled(
      agentConfigs.map((agent) => runAgent(agent, onProgress)),
    );

    const agentResults: AgentRunResult[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        agentId: config.agents[i].agentId,
        output: '',
        facts: [],
        turns: 0,
        tokens: { input: 0, output: 0 },
        durationMs: 0,
        status: 'error' as const,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });

    // Step 3: Merge and deduplicate facts
    const allFacts = agentResults.flatMap((r) => r.facts);
    const sharedFacts = deduplicateFacts([...contractFacts, ...allFacts]);

    const hasErrors = agentResults.some((r) => r.status === 'error');
    const allErrors = agentResults.every((r) => r.status === 'error');

    return {
      teamId: config.teamId,
      agentResults,
      sharedFacts,
      contractFacts,
      durationMs: Date.now() - start,
      status: allErrors ? 'error' : hasErrors ? 'partial' : 'completed',
    };
  } catch (err) {
    return {
      teamId: config.teamId,
      agentResults: [],
      sharedFacts: [],
      contractFacts,
      durationMs: Date.now() - start,
      status: 'error',
    };
  }
}
