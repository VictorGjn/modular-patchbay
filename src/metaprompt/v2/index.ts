/**
 * Metaprompt V2 Pipeline Orchestrator
 *
 * Runs the 6-phase research-augmented agent generation pipeline:
 * Parse → Research → Pattern Select → Context Strategy → Assemble → Evaluate
 *
 * Tool discovery runs in parallel after Parse and emits its result independently
 * so the SSE stream can show progress accurately.
 */

import { runParser } from './parser.js';
import { runResearcher } from './researcher.js';
import { runPatternSelector } from './pattern-selector.js';
import { runContextStrategist } from './context-strategist.js';
import { runAssembler } from './assembler.js';
import { runEvaluator } from './evaluator.js';
import { discoverTools } from './tool-discovery.js';
import type { V2PipelineConfig, V2PipelineResult, LLMCallConfig } from './types.js';
import type { DiscoveredTool } from './tool-discovery.js';

export type { V2PipelineConfig, V2PipelineResult };

export interface PipelineOptions {
  /** Provider ID for LLM calls */
  providerId: string;
  /** Model for fast phases (1,2,3,4,6) — typically Sonnet */
  sonnetModel: string;
  /** Model for assembly phase (5) — typically Opus */
  opusModel: string;
  /** Token budget for context strategy. Default: 4000 */
  tokenBudget?: number;
  /** Progress callback — called after each phase completes */
  onPhaseComplete?: (phase: string, elapsed: number) => void;
  /** Warning callback — called when a phase fails non-fatally (e.g. tool discovery) */
  onPhaseWarning?: (phase: string, message: string) => void;
  /** Callback when tool discovery resolves (fires independently of pipeline completion) */
  onToolDiscoveryComplete?: (tools: DiscoveredTool[]) => void;
  /** Already-installed IDs to exclude from suggestions */
  installed?: { skillIds: string[]; mcpIds: string[]; connectorIds: string[] };
  /** Server port for internal API calls (used when running server-side). Default: 4800 */
  serverPort?: number;
}

function sonnetConfig(opts: PipelineOptions): LLMCallConfig {
  return { providerId: opts.providerId, model: opts.sonnetModel };
}

function opusConfig(opts: PipelineOptions): LLMCallConfig {
  return { providerId: opts.providerId, model: opts.opusModel };
}

/**
 * Run the full V2 metaprompt pipeline.
 *
 * @param userInput - Natural language description of the desired agent
 * @param options - Pipeline configuration (models, budget, callbacks)
 * @returns Full pipeline result with timing data
 */
export async function runV2Pipeline(
  userInput: string,
  options: PipelineOptions,
): Promise<V2PipelineResult> {
  if (!userInput.trim()) throw new Error('Agent description cannot be empty');

  const timing: Record<string, number> = {};
  const tokenBudget = options.tokenBudget ?? 4000;

  const notify = options.onPhaseComplete ?? (() => {});
  const warn = options.onPhaseWarning ?? ((phase: string, msg: string) => console.warn(`[V2:${phase}] ${msg}`));

  // Phase 1: Parse
  let t = Date.now();
  const parsed = await runParser(userInput, sonnetConfig(options));
  timing.parse = Date.now() - t;
  notify('parse', timing.parse);

  // Start tool discovery in parallel (best-effort, won't block pipeline)
  // Fire onToolDiscoveryComplete as soon as it resolves, don't wait for pipeline end
  const toolDiscoveryStart = Date.now();
  const toolPromise = discoverTools(
    parsed,
    options.installed ?? { skillIds: [], mcpIds: [], connectorIds: [] },
    undefined,
    options.serverPort,
  ).then((tools) => {
    timing.tool_discovery = Date.now() - toolDiscoveryStart;
    if (options.onToolDiscoveryComplete) {
      options.onToolDiscoveryComplete(tools);
    }
    return tools;
  }).catch((err) => {
    timing.tool_discovery = Date.now() - toolDiscoveryStart;
    warn('tool_discovery', err instanceof Error ? err.message : String(err));
    if (options.onToolDiscoveryComplete) {
      options.onToolDiscoveryComplete([]);
    }
    return [] as DiscoveredTool[];
  });

  // Phase 2: Research
  t = Date.now();
  const research = await runResearcher(parsed, sonnetConfig(options));
  timing.research = Date.now() - t;
  notify('research', timing.research);

  // Phase 3: Pattern Selection
  t = Date.now();
  const pattern = await runPatternSelector(parsed, research, sonnetConfig(options));
  timing.pattern = Date.now() - t;
  notify('pattern', timing.pattern);

  // Phase 4: Context Strategy
  t = Date.now();
  const context = await runContextStrategist(parsed, tokenBudget, sonnetConfig(options));
  timing.context = Date.now() - t;
  notify('context', timing.context);

  // Phase 5: Assembly (uses Opus for depth)
  t = Date.now();
  const assembled = await runAssembler(
    parsed, research, pattern, context, opusConfig(options),
    options.installed?.mcpIds,
    options.installed?.connectorIds,
  );
  timing.assemble = Date.now() - t;
  notify('assemble', timing.assemble);

  // Phase 6: Evaluate
  t = Date.now();
  const evaluation = await runEvaluator(parsed, research, assembled, context, sonnetConfig(options));
  timing.evaluate = Date.now() - t;
  notify('evaluate', timing.evaluate);

  timing.total = Object.values(timing).reduce((a, b) => a + b, 0) - (timing.total ?? 0);

  // Await tool discovery (started after Phase 1, should be done by now)
  const discoveredTools = await toolPromise;

  return {
    parsed,
    research,
    pattern,
    context,
    assembled,
    evaluation,
    timing,
    discoveredTools,
    nativeTools: assembled.native_tools,
  };
}

/**
 * Quick convenience: run pipeline and return just the YAML.
 */
export async function generateAgentV2(
  userInput: string,
  options: PipelineOptions,
): Promise<string> {
  const result = await runV2Pipeline(userInput, options);
  return result.evaluation.final_yaml;
}
