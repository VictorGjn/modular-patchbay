import { runAgent } from './agentRunner.js';
import { prepareAgentWorktree } from './worktreeManager.js';
import type { AgentRunConfig, AgentRunResult, ProgressCallback } from './agentRunner.js';
import type { ExtractedFact } from './factExtractor.js';

export interface TeamRunConfig {
  teamId: string;
  /** Shared instruction / system prompt for all agents */
  systemPrompt: string;
  /** The task to execute */
  task: string;
  /** Agent definitions */
  agents: Array<{
    agentId: string;
    name: string;
    /** Full custom system prompt (overrides shared systemPrompt if set) */
    systemPrompt?: string;
    /** Optional role-specific addition appended to the system prompt */
    rolePrompt?: string;
    /** GitHub repo URL — cloned and available as context */
    repoUrl?: string;
    providerId?: string;
    model?: string;
    maxTurns?: number;
  }>;
  /** Default provider + model (agents inherit unless overridden) */
  providerId: string;
  model: string;
  /** Pre-existing shared facts (e.g., from previous runs) */
  initialFacts?: ExtractedFact[];
  /** MCP tools available to all agents */
  tools?: AgentRunConfig['tools'];
}

export interface TeamRunResult {
  teamId: string;
  agentResults: AgentRunResult[];
  sharedFacts: ExtractedFact[];
  durationMs: number;
  status: 'completed' | 'partial' | 'error';
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
  const sharedFacts: ExtractedFact[] = [...(config.initialFacts ?? [])];

  try {
    // Build agent configs — each gets its own or shared system prompt + optional role overlay
    const agentConfigs: AgentRunConfig[] = config.agents.map((agent) => {
      let systemPrompt = agent.systemPrompt || config.systemPrompt;
      if (agent.rolePrompt) {
        systemPrompt += `\n\n## Your Role\n${agent.rolePrompt}`;
      }
      if (agent.repoUrl) {
        // Phase 3: Prepare isolated worktree for this agent
        try {
          const wt = prepareAgentWorktree({
            repoUrl: agent.repoUrl,
            baseRef: 'main',
            teamId: config.teamId,
            agentId: agent.agentId,
          });
          systemPrompt += `\n\n## Working Directory\nWorking directory: ${wt.worktreePath}\nBranch: ${wt.branch}\nBase ref: ${wt.baseRef}`;
        } catch (wtErr) {
          // Fallback: just note the repo URL if worktree fails
          systemPrompt += `\n\n## Repository\nYou are working on: ${agent.repoUrl}\n(Worktree preparation failed: ${wtErr instanceof Error ? wtErr.message : String(wtErr)})`;
        }
      }

      return {
        agentId: agent.agentId,
        name: agent.name,
        systemPrompt,
        task: config.task,
        providerId: agent.providerId || config.providerId,
        model: agent.model || config.model,
        teamFacts: [...sharedFacts],
        maxTurns: agent.maxTurns ?? 10,
        tools: config.tools,
      };
    });

    // Run all agents in parallel
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

    // Merge all extracted facts into shared pool
    const allFacts = agentResults.flatMap((r) => r.facts);
    const mergedFacts = deduplicateFacts([...sharedFacts, ...allFacts]);

    const hasErrors = agentResults.some((r) => r.status === 'error');
    const allErrors = agentResults.every((r) => r.status === 'error');

    return {
      teamId: config.teamId,
      agentResults,
      sharedFacts: mergedFacts,
      durationMs: Date.now() - start,
      status: allErrors ? 'error' : hasErrors ? 'partial' : 'completed',
    };
  } catch (err) {
    return {
      teamId: config.teamId,
      agentResults: [],
      sharedFacts,
      durationMs: Date.now() - start,
      status: 'error',
    };
  }
}
