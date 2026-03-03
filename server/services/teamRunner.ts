import { readConfig } from '../config.js';
import { extractFacts } from './factExtractor.js';
import { runAgent } from './agentRunner.js';
import type { AgentRunConfig, AgentRunResult, ProgressCallback } from './agentRunner.js';
import type { ExtractedFact } from './factExtractor.js';
import { indexLocalRepo } from './githubIndexer.js';
import { prepareAgentWorktree } from './worktreeManager.js';

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

    // Step 2: Prepare worktree + tree index for each agent repo (prerequisite before execution)
    const repoIndexes = new Map<string, { markdown: string; worktreePath: string; branch: string }>();

    const prepared = await Promise.allSettled(
      config.agents
        .filter((a) => a.repoUrl)
        .map(async (agent) => {
          const wt = prepareAgentWorktree({
            repoUrl: agent.repoUrl!,
            baseRef: agent.repoRef,
            teamId: config.teamId,
            agentId: agent.agentId,
          });

          const indexed = await indexLocalRepo({
            path: wt.worktreePath,
            name: agent.name,
          });

          return {
            agentId: agent.agentId,
            repoUrl: agent.repoUrl!,
            markdown: indexed.fullMarkdown,
            worktreePath: wt.worktreePath,
            branch: wt.branch,
          };
        }),
    );

    for (const item of prepared) {
      if (item.status === 'fulfilled') {
        repoIndexes.set(item.value.agentId, {
          markdown: item.value.markdown,
          worktreePath: item.value.worktreePath,
          branch: item.value.branch,
        });

        contractFacts.push({
          key: `worktree_${item.value.agentId}`,
          value: `${item.value.worktreePath} @ ${item.value.branch}`,
          epistemicType: 'contract',
          confidence: 0.95,
          source: 'worktree_manager',
        });
      }
    }

    // Step 3: Run all agents in parallel, injecting contract facts + repo knowledge
    const agentConfigs = config.agents.map((agent) => {
      const repoData = repoIndexes.get(agent.agentId);
      if (agent.repoUrl && !repoData) {
        throw new Error(`Worktree/index prerequisite failed for agent ${agent.agentId}`);
      }
      const repoDescriptor = repoData
        ? `\n<worktree path="${repoData.worktreePath}" branch="${repoData.branch}" />\n`
        : '';

      return {
        ...agent,
        teamFacts: [...(agent.teamFacts ?? []), ...contractFacts],
        repoKnowledge: repoData ? `${repoDescriptor}${repoData.markdown}` : undefined,
        repoClonePath: repoData?.worktreePath,
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
