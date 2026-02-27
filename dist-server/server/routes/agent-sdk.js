import { query } from "@anthropic-ai/claude-agent-sdk";
import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const router = Router();
// POST /api/agent-sdk/chat — streaming chat via Agent SDK
router.post("/chat", async (req, res) => {
    const { prompt, model, mcpServers, systemPrompt, maxTurns } = req.body;
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
                        res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
                    }
                    else if ("name" in block) {
                        const toolBlock = block;
                        res.write(`data: ${JSON.stringify({ type: "tool_use", name: toolBlock.name, input: toolBlock.input })}\n\n`);
                    }
                }
            }
            else if (message.type === "result") {
                res.write(`data: ${JSON.stringify({ type: "result", subtype: message.subtype })}\n\n`);
            }
        }
        res.write("data: [DONE]\n\n");
        res.end();
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
        res.end();
    }
});
// GET /api/agent-sdk/status — check if Claude Code is authenticated
router.get("/status", async (_req, res) => {
    try {
        // Check for Claude Code credentials on disk (no CLI process needed)
        const home = homedir();
        const credPath = join(home, ".claude", ".credentials.json");
        const configPath = join(home, ".claude.json");
        if (!existsSync(configPath)) {
            res.json({
                status: "ok",
                data: { authenticated: false, error: "Claude Code not installed — run: curl -fsSL https://claude.ai/install.sh | bash" },
            });
            return;
        }
        if (!existsSync(credPath)) {
            res.json({
                status: "ok",
                data: { authenticated: false, error: "Not logged in — run: claude login" },
            });
            return;
        }
        // Read config for account info
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        const account = config?.oauthAccount;
        res.json({
            status: "ok",
            data: {
                authenticated: true,
                email: account?.emailAddress,
                displayName: account?.displayName,
                organization: account?.organizationUuid,
            },
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        res.json({
            status: "ok",
            data: { authenticated: false, error: msg },
        });
    }
});
export default router;
//# sourceMappingURL=agent-sdk.js.map