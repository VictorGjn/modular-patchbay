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

function isBackendAgent(agent: AgentRunConfig): boolean {
  const marker = `${agent.agentId} ${agent.name}`.toLowerCase();
  return /backend|api|server/.test(marker);
}

function isFrontendAgent(agent: AgentRunConfig): boolean {
  const marker = `${agent.agentId} ${agent.name}`.toLowerCase();
  return /frontend|ui|client/.test(marker);
}

function hasFactMatch(facts: ExtractedFact[], patterns: RegExp[]): boolean {
  return facts.some((fact) => {
    const blob = `${fact.key} ${fact.value}`.toLowerCase();
    return patterns.some((pattern) => pattern.test(blob));
  });
}

function validateAgentMemoryExchange(agent: AgentRunConfig, result: AgentRunResult): string[] {
  if (result.status === 'error') return [];

  const errors: string[] = [];
  if (result.facts.length === 0) {
    errors.push('No facts extracted from agent output');
    return errors;
  }

  if (isBackendAgent(agent)) {
    const backendPatterns = [/api/, /endpoint/, /contract/, /schema/, /dto/, /response/, /request/];
    if (!hasFactMatch(result.facts, backendPatterns)) {
      errors.push('Backend agent did not publish API/contract memory facts');
    }
  }

  if (isFrontendAgent(agent)) {
    const frontendPatterns = [/ui/, /component/, /state/, /binding/, /view/, /screen/, /fallback/];
    if (!hasFactMatch(result.facts, frontendPatterns)) {
      errors.push('Frontend agent did not publish UI/state memory facts');
    }
  }

  return errors;
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
    // Persist clones when using Claude SDK so agents can edit files
    const useSdk = config.providerId === 'claude-agent-sdk';
    const agentsWithRepos = config.agents.filter((a) => a.repoUrl);
    const repoIndexes = new Map<string, { markdown: string; clonePath?: string }>();

    if (agentsWithRepos.length > 0) {
      const indexResults = await Promise.allSettled(
        agentsWithRepos.map(async (agent) => {
          const result = await indexGitHubRepo({
            url: agent.repoUrl!,
            ref: agent.repoRef,
            persist: useSdk, // keep clone on disk for SDK agents to edit
          });
          return { url: agent.repoUrl!, markdown: result.fullMarkdown, clonePath: result.clonePath };
        }),
      );
      for (const r of indexResults) {
        if (r.status === 'fulfilled') {
          repoIndexes.set(r.value.url, { markdown: r.value.markdown, clonePath: r.value.clonePath });
        }
      }
    }

    // Step 3: Run all agents in parallel, injecting contract facts + repo knowledge
    const agentConfigs = config.agents.map((agent) => {
      const repoData = agent.repoUrl ? repoIndexes.get(agent.repoUrl) : undefined;
      return {
        ...agent,
        teamFacts: [...(agent.teamFacts ?? []), ...contractFacts],
        repoKnowledge: repoData?.markdown,
        repoClonePath: repoData?.clonePath,
      };
    });

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

    // Step 4: Validate cross-agent memory exchange contracts
    const validatedResults = agentResults.map((result, index) => {
      const agentConfig = config.agents[index];
      const validationErrors = validateAgentMemoryExchange(agentConfig, result);
      if (validationErrors.length === 0) return result;
      return {
        ...result,
        status: 'error' as const,
        error: validationErrors.join(' | '),
      };
    });

    // Step 5: Merge and deduplicate facts
    const allFacts = validatedResults.flatMap((r) => r.facts);
    const sharedFacts = deduplicateFacts([...contractFacts, ...allFacts]);

    const hasErrors = validatedResults.some((r) => r.status === 'error');
    const allErrors = validatedResults.every((r) => r.status === 'error');

    return {
      teamId: config.teamId,
      agentResults: validatedResults,
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
