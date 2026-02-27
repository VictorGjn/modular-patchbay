import { query, listSessions } from "@anthropic-ai/claude-agent-sdk";
import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// POST /api/agent-sdk/chat — streaming chat via Agent SDK
router.post("/chat", async (req: Request, res: Response) => {
  const { prompt, model, mcpServers, systemPrompt, maxTurns } = req.body as {
    prompt: string;
    model?: string;
    mcpServers?: Record<string, { command: string; args?: string[] }>;
    systemPrompt?: string;
    maxTurns?: number;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const message of query({
      prompt,
      options: {
        model: model || undefined,
        allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch"],
        permissionMode: "acceptEdits",
        maxTurns: maxTurns || 10,
        systemPrompt: systemPrompt || undefined,
        ...(mcpServers ? { mcpServers } : {}),
      },
    })) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block) {
            res.write(
              `data: ${JSON.stringify({ type: "text", content: (block as { text: string }).text })}\n\n`
            );
          } else if ("name" in block) {
            const toolBlock = block as { name: string; input: unknown };
            res.write(
              `data: ${JSON.stringify({ type: "tool_use", name: toolBlock.name, input: toolBlock.input })}\n\n`
            );
          }
        }
      } else if (message.type === "result") {
        res.write(
          `data: ${JSON.stringify({ type: "result", subtype: (message as { type: string; subtype: string }).subtype })}\n\n`
        );
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
    res.end();
  }
});

// GET /api/agent-sdk/status — check if Claude Code is authenticated
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const sessions = await listSessions({ limit: 1 });
    res.json({
      status: "ok",
      data: { authenticated: true, sessionCount: sessions.length },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.json({
      status: "ok",
      data: { authenticated: false, error: msg },
    });
  }
});

export default router;
