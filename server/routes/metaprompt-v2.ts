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
  const { prompt, tokenBudget, providerId, model } = req.body as {
    prompt: string;
    tokenBudget?: number;
    providerId?: string;
    model?: string;
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
      "../../src/metaprompt/v2/index.js"
    );

    sendEvent({ phase: "start", status: "running", totalPhases: 7 });

    // Use client-provided provider/model, fall back to Agent SDK
    const effectiveProvider = providerId || "claude-agent-sdk";
    const effectiveModel = model || "claude-sonnet-4-20250514";

    // Track tool discovery separately so we can emit its SSE event independently
    let toolDiscoveryDone = false;
    
    const result = await runV2Pipeline(prompt, {
      providerId: effectiveProvider,
      sonnetModel: effectiveModel,
      opusModel: effectiveProvider === "claude-agent-sdk" ? "claude-opus-4-20250514" : effectiveModel,
      tokenBudget: tokenBudget ?? 4000,
      onPhaseComplete: (phase: string, elapsed: number) => {
        sendEvent({
          phase,
          status: "complete",
          elapsed,
          phaseNumber: getPhaseNumber(phase),
        });
        // After parse, signal that tool discovery is running in parallel
        if (phase === "parse") {
          sendEvent({ phase: "tool_discovery", status: "running" });
        }
      },
      // New: callback when tool discovery resolves (before pipeline ends)
      onToolDiscoveryComplete: (tools: unknown[]) => {
        if (!toolDiscoveryDone) {
          toolDiscoveryDone = true;
          sendEvent({
            phase: "tool_discovery",
            status: "complete",
            phaseNumber: getPhaseNumber("tool_discovery"),
            tools,
          });
        }
      },
    });

    // Fallback: if tool discovery callback wasn't fired, emit it now
    if (!toolDiscoveryDone) {
      sendEvent({
        phase: "tool_discovery",
        status: "complete",
        phaseNumber: getPhaseNumber("tool_discovery"),
        tools: result.discoveredTools ?? [],
      });
    }

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
        discoveredTools: result.discoveredTools ?? [],
        nativeTools: result.nativeTools ?? [],
      },
    });

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[V2 Pipeline Error]", msg);
    sendEvent({ phase: "error", status: "failed", error: msg });
    res.end();
  }
});

function getPhaseNumber(phase: string): number {
  const map: Record<string, number> = {
    parse: 1,
    tool_discovery: 2,
    research: 3,
    pattern: 4,
    context: 5,
    assemble: 6,
    evaluate: 7,
  };
  return map[phase] ?? 0;
}

export default router;
