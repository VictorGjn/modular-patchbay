/**
 * Qualification Dual-Agent Loop Route
 *
 * POST /api/qualification/auto-improve
 *
 * Orchestrates: run test suite → if score < threshold → generate patches →
 * apply patches → re-run (max 3 iterations).
 *
 * Samuel Neveu pattern: Agent Testeur + Agent Correcteur in auto-fix loop.
 * Issue #137
 */

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readConfig } from '../config.js';
import { loadAgent, saveAgent, createAgentVersion } from '../services/agentStore.js';
import { saveQualificationRun } from '../services/sqliteStore.js';
import type { Request, Response } from 'express';

const router = Router();

// ── Types ──

interface ResolvedLlm {
  baseUrl: string;
  type: string;
  apiKey: string;
}

interface TestCase {
  id: string;
  type: string;
  label: string;
  input: string;
  expectedBehavior: string;
}

interface ScoringDimension {
  id: string;
  name: string;
  weight: number;
}

interface TestResult {
  testCaseId: string;
  score: number;
  passed: boolean;
  feedback: string;
}

interface PatchSuggestion {
  id: string;
  targetField: string;
  description: string;
  diff: string;
  applied: boolean;
}

interface LoopIteration {
  iteration: number;
  globalScore: number;
  passed: boolean;
  testResults: TestResult[];
  patches: PatchSuggestion[];
  patchesApplied: boolean;
}

// ── LLM Helpers (mirrors qualification.ts) ──

function normalizeBaseUrl(providerId: string, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    if (providerId.includes('anthropic')) return 'https://api.anthropic.com/v1';
    return trimmed;
  }
  const isOpenAi = providerId.includes('openai') || trimmed.includes('api.openai.com');
  if (isOpenAi && !/\/v1$/i.test(trimmed)) return `${trimmed}/v1`;
  return trimmed;
}

function inferType(providerId: string, baseUrl: string, configType?: string): string {
  if (configType === 'anthropic' || providerId.includes('anthropic') || baseUrl.includes('anthropic.com')) {
    return 'anthropic';
  }
  return configType || 'openai';
}

function buildHeaders(resolved: ResolvedLlm): Record<string, string> {
  if (resolved.type === 'anthropic') {
    return { 'x-api-key': resolved.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  }
  return { 'authorization': `Bearer ${resolved.apiKey}`, 'content-type': 'application/json' };
}

async function callLlm(resolved: ResolvedLlm, model: string, messages: Array<{ role: string; content: string }>, maxTokens = 1000): Promise<string> {
  const isAnthropic = resolved.type === 'anthropic';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = isAnthropic
    ? { model, max_tokens: maxTokens, messages: nonSystemMsgs, ...(systemMsg ? { system: systemMsg.content } : {}) }
    : { model, max_tokens: maxTokens, messages };

  const url = isAnthropic ? `${resolved.baseUrl}/messages` : `${resolved.baseUrl}/chat/completions`;
  const res = await fetch(url, { method: 'POST', headers: buildHeaders(resolved), body: JSON.stringify(body) });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as Record<string, unknown>;
  if (isAnthropic) {
    const blocks = data.content as Array<{ type: string; text?: string }>;
    return blocks?.find(b => b.type === 'text')?.text ?? '';
  }
  const choices = data.choices as Array<{ message: { content: string } }>;
  return choices?.[0]?.message?.content ?? '';
}

// ── Test Runner ──

function buildJudgePrompt(tc: TestCase, agentResponse: string, dims: ScoringDimension[]): string {
  const dimList = dims.map(d => `- ${d.name} (id: ${d.id}, weight: ${d.weight})`).join('\n');
  return `Judge this AI agent response.

Test: "${tc.label}" (${tc.type})
Input: "${tc.input}"
Expected: "${tc.expectedBehavior}"
Agent response: "${agentResponse}"

Scoring dimensions:
${dimList}

Return JSON:
{
  "dimensionScores": { "${dims[0]?.id}": 0-100, ... },
  "overallScore": 0-100,
  "feedback": "One sentence"
}`;
}

async function runTestCase(
  resolved: ResolvedLlm, model: string, systemPrompt: string,
  tc: TestCase, dims: ScoringDimension[], passThreshold: number,
): Promise<TestResult & { dimensionScores: Record<string, number> }> {
  const agentContent = await callLlm(resolved, model, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: tc.input },
  ]);
  const judgeContent = await callLlm(resolved, model, [
    { role: 'user', content: buildJudgePrompt(tc, agentContent, dims) },
  ]);

  const match = judgeContent.match(/\{[\s\S]*\}/);
  if (!match) return { testCaseId: tc.id, score: 50, passed: false, feedback: 'Judge parse failed', dimensionScores: {} };

  try {
    const data = JSON.parse(match[0]);
    const score = Math.max(0, Math.min(100, Math.round(data.overallScore ?? 50)));
    const dimScores: Record<string, number> = {};
    for (const dim of dims) dimScores[dim.id] = Math.max(0, Math.min(100, Math.round(data.dimensionScores?.[dim.id] ?? score)));
    return { testCaseId: tc.id, score, passed: score >= passThreshold, feedback: data.feedback ?? '', dimensionScores: dimScores };
  } catch {
    return { testCaseId: tc.id, score: 50, passed: false, feedback: 'Judge JSON error', dimensionScores: {} };
  }
}

// ── Patch Generator (Agent Correcteur) ──

async function generatePatches(
  resolved: ResolvedLlm, model: string,
  missionBrief: string, systemPrompt: string, failedTests: TestResult[],
): Promise<PatchSuggestion[]> {
  const failedSummary = failedTests.slice(0, 5).map(t =>
    `- score ${t.score}: ${t.feedback}`
  ).join('\n');

  const prompt = `You are the Agent Correcteur. An AI agent scored below the pass threshold.

Current system prompt:
---
${systemPrompt.slice(0, 2000)}
---

Mission: "${missionBrief}"

Failed tests:
${failedSummary}

Generate 2-3 TARGETED patches to fix the specific failures. Each patch adds text to the agent's config.

Return ONLY JSON:
{
  "patches": [
    {
      "targetField": "instructionState.constraints",
      "description": "What this fixes",
      "diff": "+ Specific text to add"
    }
  ]
}`;

  try {
    const content = await callLlm(resolved, model, [{ role: 'user', content: prompt }], 1500);
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const data = JSON.parse(match[0]);
    return (data.patches ?? []).map((p: any) => ({
      id: randomUUID(),
      targetField: p.targetField ?? 'instructionState.persona',
      description: p.description ?? '',
      diff: p.diff ?? '',
      applied: false,
    }));
  } catch {
    return [];
  }
}

// ── Patch Applier ──

function applyPatchesToAgent(agentState: any, patches: PatchSuggestion[]): void {
  for (const patch of patches) {
    const newContent = patch.diff.split('\n')
      .filter((line: string) => line.startsWith('+ '))
      .map((line: string) => line.slice(2).trim())
      .join('\n');
    if (!newContent) continue;

    const path = patch.targetField.startsWith('instructionState.')
      ? patch.targetField.slice('instructionState.'.length)
      : patch.targetField;

    const current = agentState.instructionState?.[path];
    agentState.instructionState = agentState.instructionState ?? {};
    agentState.instructionState[path] = typeof current === 'string' && current
      ? `${current}\n${newContent}`
      : newContent;
    patch.applied = true;
  }
}

// ── Validation ──

const autoImproveSchema = z.object({
  agentId: z.string().min(1),
  providerId: z.string().min(1),
  model: z.string().min(1),
  maxIterations: z.number().min(1).max(5).optional(),
  suite: z.object({
    missionBrief: z.string().min(1),
    testCases: z.array(z.object({
      id: z.string(), type: z.string(), label: z.string(),
      input: z.string(), expectedBehavior: z.string(),
    })).min(1),
    scoringDimensions: z.array(z.object({
      id: z.string(), name: z.string(), weight: z.number(),
    })).min(1),
    passThreshold: z.number().min(0).max(100),
  }),
});

// ── Main Route ──

/**
 * POST /api/qualification/auto-improve
 *
 * Dual-agent loop: Agent Testeur runs test cases, Agent Correcteur patches failures.
 * Streams SSE events for each iteration.
 * Stops when: score >= threshold, max iterations reached, or no patches generated.
 */
router.post('/auto-improve', async (req: Request, res: Response) => {
  const parsed = autoImproveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: 'error', error: parsed.error.issues.map(i => i.message).join(', ') });
    return;
  }

  const body = parsed.data;
  const maxIterations = body.maxIterations ?? 3;

  // Resolve LLM provider
  const config = readConfig();
  const provider = config.providers?.find((p: any) => p.id === body.providerId);
  if (!provider?.apiKey) {
    res.status(400).json({ status: 'error', error: `Provider "${body.providerId}" not found or missing API key` });
    return;
  }

  const baseUrl = normalizeBaseUrl(provider.id, provider.baseUrl);
  const type = inferType(provider.id, baseUrl, provider.type);
  const resolved: ResolvedLlm = { baseUrl, type, apiKey: provider.apiKey };

  // Load agent
  const agentState = loadAgent(body.agentId);
  if (!agentState) {
    res.status(404).json({ status: 'error', error: `Agent "${body.agentId}" not found` });
    return;
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const emit = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const loopId = randomUUID();
  const { suite } = body;

  emit({ type: 'loop_start', loopId, maxIterations, totalCases: suite.testCases.length });

  const iterations: LoopIteration[] = [];

  try {
    for (let iter = 1; iter <= maxIterations; iter++) {
      emit({ type: 'iteration_start', iteration: iter, maxIterations });

      // Build system prompt from current agent state
      const persona = agentState.instructionState?.['persona'] as string ?? '';
      const constraints = agentState.instructionState?.['constraints'] as string ??
                          agentState.instructionState?.['customConstraints'] as string ?? '';
      const objectives = agentState.instructionState?.['objectives'] as string ?? '';
      const systemPrompt = [
        `You are an AI assistant. Mission: ${suite.missionBrief}`,
        persona ? `Persona: ${persona}` : '',
        constraints ? `Constraints: ${constraints}` : '',
        objectives ? `Objectives: ${objectives}` : '',
        'Stay within your defined mission. Refuse out-of-scope requests politely.',
      ].filter(Boolean).join('\n\n');

      // Run all test cases (Agent Testeur)
      const testResults: TestResult[] = [];
      const dimAccum: Record<string, number[]> = {};

      for (let i = 0; i < suite.testCases.length; i++) {
        const tc = suite.testCases[i];
        emit({ type: 'case_start', iteration: iter, testCaseId: tc.id, label: tc.label, index: i + 1 });

        try {
          const result = await runTestCase(resolved, body.model, systemPrompt, tc, suite.scoringDimensions, suite.passThreshold);
          testResults.push(result);
          for (const [dimId, score] of Object.entries(result.dimensionScores)) {
            dimAccum[dimId] = dimAccum[dimId] ?? [];
            dimAccum[dimId].push(score);
          }
          emit({ type: 'case_done', iteration: iter, testCaseId: tc.id, score: result.score, passed: result.passed, feedback: result.feedback });
        } catch (err) {
          const errResult: TestResult = { testCaseId: tc.id, score: 0, passed: false, feedback: err instanceof Error ? err.message : String(err) };
          testResults.push(errResult);
          emit({ type: 'case_done', iteration: iter, testCaseId: tc.id, score: 0, passed: false, feedback: errResult.feedback });
        }
      }

      // Calculate global score
      const dimensionScores: Record<string, number> = {};
      for (const dim of suite.scoringDimensions) {
        const scores = dimAccum[dim.id] ?? [];
        dimensionScores[dim.id] = scores.length > 0
          ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
          : Math.round(testResults.reduce((s, r) => s + r.score, 0) / (testResults.length || 1));
      }
      const globalScore = Math.round(
        suite.scoringDimensions.reduce((sum, dim) => sum + (dimensionScores[dim.id] ?? 0) * dim.weight, 0),
      );
      const passed = globalScore >= suite.passThreshold;

      emit({ type: 'iteration_score', iteration: iter, globalScore, passed, dimensionScores });

      // If passed, we're done
      if (passed) {
        iterations.push({ iteration: iter, globalScore, passed, testResults, patches: [], patchesApplied: false });
        emit({ type: 'loop_passed', iteration: iter, globalScore });
        break;
      }

      // Agent Correcteur: generate patches for failures
      const failedTests = testResults.filter(r => !r.passed);
      emit({ type: 'corrector_start', iteration: iter, failedCount: failedTests.length });

      const patches = await generatePatches(resolved, body.model, suite.missionBrief, systemPrompt, failedTests);
      emit({ type: 'corrector_done', iteration: iter, patchCount: patches.length, patches });

      if (patches.length === 0) {
        iterations.push({ iteration: iter, globalScore, passed, testResults, patches: [], patchesApplied: false });
        emit({ type: 'loop_no_patches', iteration: iter, globalScore });
        break;
      }

      // Auto-apply patches (last iteration won't re-run, so no point applying)
      if (iter < maxIterations) {
        // Save version before patching
        createAgentVersion(body.agentId, agentState.version ?? '1.0.0', `qual-loop-iter-${iter}`);
        applyPatchesToAgent(agentState, patches);
        saveAgent(body.agentId, agentState);
        emit({ type: 'patches_applied', iteration: iter, patchCount: patches.length });
      }

      iterations.push({ iteration: iter, globalScore, passed, testResults, patches, patchesApplied: iter < maxIterations });

      // Save run history
      await saveQualificationRun(body.agentId, {
        runId: `${loopId}-iter${iter}`, timestamp: Date.now(), globalScore, passThreshold: suite.passThreshold,
      });
    }

    // Final summary
    const lastIteration = iterations[iterations.length - 1];
    emit({
      type: 'loop_done', loopId,
      totalIterations: iterations.length,
      finalScore: lastIteration?.globalScore ?? 0,
      passed: lastIteration?.passed ?? false,
      iterations: iterations.map(i => ({ iteration: i.iteration, score: i.globalScore, passed: i.passed, patchCount: i.patches.length })),
    });
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

export default router;
