import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

/**
 * POST /api/metaprompt/v2/generate
 *
 * Runs the 6-phase research-augmented agent generation pipeline.
 * Streams progress events via SSE so the UI can show real-time phase updates.
 *
 * Body: { prompt: string, tokenBudget?: number }
 * Events: { phase, status, elapsed?, data?, error? }
 */
router.post("/generate", async (req: Request, res: Response) => {
  const { prompt, tokenBudget } = req.body as {
    prompt: string;
    tokenBudget?: number;
  };

  if (!prompt?.trim()) {
    res.status(400).json({ status: "error", error: "prompt is required" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Dynamic import to avoid bundling issues
    const { runV2Pipeline } = await import(
      "../../src/metaprompt/v2/index"
    );

    sendEvent({ phase: "start", status: "running", totalPhases: 6 });

    const result = await runV2Pipeline(prompt, {
      // Use Agent SDK provider — it has WebSearch built in
      providerId: "claude-agent-sdk",
      sonnetModel: "claude-sonnet-4-20250514",
      opusModel: "claude-opus-4-20250514",
      tokenBudget: tokenBudget ?? 4000,
      onPhaseComplete: (phase: string, elapsed: number) => {
        sendEvent({
          phase,
          status: "complete",
          elapsed,
          phaseNumber: getPhaseNumber(phase),
        });
      },
    });

    // Send final result
    sendEvent({
      phase: "done",
      status: "complete",
      result: {
        yaml: result.evaluation.final_yaml,
        passed: result.evaluation.passed,
        warnings: result.evaluation.warnings,
        timing: result.timing,
        parsed: {
          role: result.parsed.role,
          domain: result.parsed.domain,
          named_experts: result.parsed.named_experts,
          named_methodologies: result.parsed.named_methodologies,
        },
        pattern: result.pattern,
        research: {
          expert_count: result.research.expert_frameworks.length,
          methodology_count: result.research.methodology_frameworks.length,
          conflicts: result.research.conflicts,
          notes: result.research.research_notes,
        },
        evaluation: result.evaluation.criteria_results,
      },
    });

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendEvent({ phase: "error", status: "failed", error: msg });
    res.end();
  }
});

function getPhaseNumber(phase: string): number {
  const map: Record<string, number> = {
    parse: 1,
    research: 2,
    pattern: 3,
    context: 4,
    assemble: 5,
    evaluate: 6,
  };
  return map[phase] ?? 0;
}

export default router;
