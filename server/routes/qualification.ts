import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readConfig } from '../config.js';
import { loadAgent, saveAgent, createAgentVersion } from '../services/agentStore.js';
import { saveQualificationRun, getQualificationHistory } from '../services/sqliteStore.js';
import type { Request, Response } from 'express';

const router = Router();

/* ── Provider helpers (mirrors server/routes/llm.ts logic) ── */

function normalizeBaseUrl(providerId: string, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    // Default base URLs for known providers
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

interface ResolvedLlm {
  baseUrl: string;
  type: string;
  apiKey: string;
}

function buildLlmHeaders(resolved: ResolvedLlm): Record<string, string> {
  if (resolved.type === 'anthropic') {
    return { 'x-api-key': resolved.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  }
  return { 'Authorization': `Bearer ${resolved.apiKey}`, 'Content-Type': 'application/json' };
}

function buildLlmBody(resolved: ResolvedLlm, model: string, messages: Array<{ role: string; content: string }>, maxTokens: number): string {
  if (resolved.type === 'anthropic') {
    const system = messages.find(m => m.role === 'system')?.content;
    const nonSystem = messages.filter(m => m.role !== 'system');
    return JSON.stringify({ model, max_tokens: maxTokens, messages: nonSystem, ...(system && { system }) });
  }
  return JSON.stringify({ model, max_tokens: maxTokens, messages });
}

function buildLlmUrl(resolved: ResolvedLlm): string {
  return resolved.type === 'anthropic'
    ? `${resolved.baseUrl}/messages`
    : `${resolved.baseUrl}/chat/completions`;
}

function extractLlmContent(data: unknown, isAnthropic: boolean): string {
  if (typeof data !== 'object' || data === null) return '';
  type Resp = { content?: Array<{ text?: string }>; choices?: Array<{ message?: { content?: string } }> };
  const d = data as Resp;
  if (isAnthropic && Array.isArray(d.content) && d.content.length > 0) return d.content[0]?.text ?? '';
  if (!isAnthropic && Array.isArray(d.choices) && d.choices.length > 0) return d.choices[0]?.message?.content ?? '';
  return '';
}

async function callLlm(resolved: ResolvedLlm, model: string, messages: Array<{ role: string; content: string }>, maxTokens = 4000): Promise<string> {
  const url = buildLlmUrl(resolved);
  const headers = buildLlmHeaders(resolved);
  const body = buildLlmBody(resolved, model, messages, maxTokens);
  const response = await fetch(url, { method: 'POST', headers, body });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }
  const data: unknown = await response.json();
  return extractLlmContent(data, resolved.type === 'anthropic');
}

/* ── Types ── */

interface TestCase {
  id: string;
  type: 'nominal' | 'edge' | 'anti';
  label: string;
  input: string;
  expectedBehavior: string;
}

interface ScoringDimension {
  id: string;
  name: string;
  weight: number;
}

interface GenerateSuiteRequest {
  agentId: string;
  missionBrief: string;
  persona?: string;
  constraints?: string;
  objectives?: string;
  providerId?: string;
  model?: string;
}

interface GenerateSuiteResponse {
  testCases: TestCase[];
  scoringDimensions: ScoringDimension[];
}

interface RunRequest {
  agentId: string;
  providerId: string;
  model: string;
  suite: {
    missionBrief: string;
    testCases: TestCase[];
    scoringDimensions: ScoringDimension[];
    passThreshold: number;
  };
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

interface ApplyPatchesRequest {
  agentId: string;
  runId: string;
  patchIds: string[];
  patches?: PatchSuggestion[];
}

/* ── Prompt builders ── */

function buildGenerateSuitePrompt(body: GenerateSuiteRequest): string {
  return `You are a qualification test case generator. Given an agent's mission brief, generate 5-8 test cases (mix of nominal, edge, and anti cases) and 3-5 scoring dimensions.

Mission Brief: "${body.missionBrief}"
${body.persona ? `Persona: "${body.persona}"` : ''}
${body.constraints ? `Constraints: "${body.constraints}"` : ''}
${body.objectives ? `Objectives: "${body.objectives}"` : ''}

Generate test cases that evaluate accuracy, edge case handling, constraint compliance, and failure modes.

Return JSON in this exact format:
{
  "testCases": [
    { "type": "nominal|edge|anti", "label": "Brief description", "input": "Agent input", "expectedBehavior": "What the agent should do" }
  ],
  "scoringDimensions": [
    { "name": "Dimension name", "weight": 0.25 }
  ]
}

Ensure weights sum to 1.0. Generate specific, realistic test inputs that challenge the agent.`;
}

function buildJudgePrompt(testCase: TestCase, agentContent: string, dims: ScoringDimension[]): string {
  return `You are evaluating an AI agent's response for a qualification test.

TEST CASE:
Type: ${testCase.type}
Input: "${testCase.input}"
Expected Behavior: "${testCase.expectedBehavior}"

AGENT'S ACTUAL RESPONSE:
"${agentContent}"

SCORING DIMENSIONS:
${dims.map(d => `- ${d.name} (weight: ${Math.round(d.weight * 100)}%)`).join('\n')}

Score the agent's response on a scale of 0-100 for each dimension:
- accuracy: factual correctness and completeness
- tone: adherence to expected persona and communication style
- constraint compliance: does it stay within defined boundaries
- hallucination: does it avoid making up unsupported claims

For "anti" cases: a high score means the agent CORRECTLY refused the request.
For "nominal" cases: score how well the response matches expected behavior.
For "edge" cases: score how gracefully it handles ambiguity.

Return JSON:
{
  "dimensionScores": { ${dims.map(d => `"${d.id}": 0`).join(', ')} },
  "overallScore": 0,
  "feedback": "Brief explanation"
}`;
}

function buildPatchPrompt(suite: RunRequest['suite'], failedTests: TestResult[]): string {
  const failedSummary = failedTests.slice(0, 5).map(t => {
    const tc = suite.testCases.find(c => c.id === t.testCaseId);
    return `- [${tc?.type}] "${tc?.label}": score ${t.score}, feedback: ${t.feedback}`;
  }).join('\n');

  return `An AI agent scored below the pass threshold. Generate 2-3 targeted improvement patches.

Mission: "${suite.missionBrief}"
Failed tests:
${failedSummary}

Return JSON with patches that fix the specific failures:
{
  "patches": [
    {
      "targetField": "instructionState.persona|constraints.customConstraints|instructionState.objectives",
      "description": "What this fixes",
      "diff": "+ Specific text to add to the field"
    }
  ]
}`;
}

/* ── Test case execution ── */

interface TestResultWithDimScores extends TestResult {
  dimensionScores: Record<string, number>;
}

async function runSingleTestCase(
  resolved: ResolvedLlm,
  model: string,
  systemPrompt: string,
  testCase: TestCase,
  dims: ScoringDimension[],
  passThreshold: number,
): Promise<TestResultWithDimScores> {
  const agentMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: testCase.input },
  ];
  const agentContent = await callLlm(resolved, model, agentMessages, 1000);

  const judgeMessages = [{ role: 'user', content: buildJudgePrompt(testCase, agentContent, dims) }];
  const judgeContent = await callLlm(resolved, model, judgeMessages, 1000);

  return parseJudgeResponse(judgeContent, testCase.id, passThreshold, dims);
}

function parseJudgeResponse(content: string, testCaseId: string, passThreshold: number, dims: ScoringDimension[]): TestResultWithDimScores {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return { testCaseId, score: 50, passed: false, feedback: 'Failed to parse judge response', dimensionScores: {} };
  }
  try {
    const data = JSON.parse(match[0]);
    const score = Math.max(0, Math.min(100, Math.round(data.overallScore ?? 50)));
    const dimScores: Record<string, number> = {};
    for (const dim of dims) {
      dimScores[dim.id] = Math.max(0, Math.min(100, Math.round(data.dimensionScores?.[dim.id] ?? score)));
    }
    return { testCaseId, score, passed: score >= passThreshold, feedback: data.feedback ?? '', dimensionScores: dimScores };
  } catch {
    return { testCaseId, score: 50, passed: false, feedback: 'Judge parse error', dimensionScores: {} };
  }
}

async function generateLlmPatches(resolved: ResolvedLlm, model: string, suite: RunRequest['suite'], results: TestResult[]): Promise<PatchSuggestion[]> {
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length === 0) return [];
  try {
    const content = await callLlm(resolved, model, [{ role: 'user', content: buildPatchPrompt(suite, failedTests) }], 1000);
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const data = JSON.parse(match[0]);
    return (data.patches ?? []).map((p: { targetField?: string; description?: string; diff?: string }) => ({
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

/* ── Validation schemas ── */
const generateSuiteSchema = z.object({
  agentId: z.string().min(1),
  missionBrief: z.string().min(1),
  persona: z.string().optional(),
  constraints: z.string().optional(),
  objectives: z.string().optional(),
  providerId: z.string().optional(),
  model: z.string().optional(),
});

const testCaseSchema = z.object({
  id: z.string(),
  type: z.enum(['nominal', 'edge', 'anti']),
  label: z.string(),
  input: z.string(),
  expectedBehavior: z.string(),
});

const runSchema = z.object({
  agentId: z.string().min(1),
  providerId: z.string().min(1),
  model: z.string().min(1),
  suite: z.object({
    missionBrief: z.string().min(1),
    testCases: z.array(testCaseSchema),
    scoringDimensions: z.array(z.object({ id: z.string(), name: z.string(), weight: z.number() })),
    passThreshold: z.number(),
  }),
});

/* ── POST /generate-suite ── */
router.post('/generate-suite', async (req: Request, res: Response) => {
  const parsed = generateSuiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: 'error', error: parsed.error.issues.map(i => i.message).join(', ') });
    return;
  }
  const body = parsed.data as GenerateSuiteRequest;
  try {
    const config = readConfig();
    // Find a provider: prefer one with explicit apiKey, then any configured provider
    const configProvider = body.providerId
      ? config.providers.find(p => p.id === body.providerId)
      : config.providers.find(p => !!p.apiKey) ?? config.providers.find(p => !!p.id);
    if (!configProvider) {
      res.status(400).json({ status: 'error', error: 'No LLM provider found. Configure one in Settings → Providers.' });
      return;
    }

    // Resolve API key: config → env var
    let apiKey = (configProvider.apiKey || '').trim();
    if (!apiKey) {
      apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '';
    }
    const baseUrl = normalizeBaseUrl(configProvider.id, configProvider.baseUrl);
    const type = inferType(configProvider.id, baseUrl, configProvider.type);
    if (!apiKey) {
      res.status(400).json({
        status: 'error',
        error: type === 'anthropic'
          ? 'No Anthropic API key found. The Claude SDK uses OAuth (not an API key), but Qualification needs a direct API key. Add one in Settings → Providers, or set ANTHROPIC_API_KEY env var.'
          : 'No API key found. Set one in Settings → Providers or via env var.',
      });
      return;
    }
    const model = body.model ?? (type === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini');
    const resolved: ResolvedLlm = { baseUrl, type, apiKey };

    const content = await callLlm(resolved, model, [{ role: 'user', content: buildGenerateSuitePrompt(body) }]);
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in LLM response');

    const generated = JSON.parse(match[0]);
    const testCases: TestCase[] = (generated.testCases ?? []).map((tc: { type?: string; label?: string; input?: string; expectedBehavior?: string }) => ({
      id: randomUUID(),
      type: (tc.type as TestCase['type']) ?? 'nominal',
      label: tc.label ?? '',
      input: tc.input ?? '',
      expectedBehavior: tc.expectedBehavior ?? '',
    }));
    const rawDims: ScoringDimension[] = (generated.scoringDimensions ?? []).map((d: { name?: string; weight?: number }) => ({
      id: randomUUID(),
      name: d.name ?? 'Dimension',
      weight: d.weight ?? 0.25,
    }));
    const totalWeight = rawDims.reduce((s, d) => s + d.weight, 0);
    if (totalWeight > 0) rawDims.forEach(d => { d.weight = d.weight / totalWeight; });

    const response: GenerateSuiteResponse = { testCases, scoringDimensions: rawDims };
    res.json({ status: 'ok', data: response });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

/* ── POST /run (SSE) ── */
router.post('/run', async (req: Request, res: Response) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: 'error', error: parsed.error.issues.map(i => i.message).join(', ') });
    return;
  }
  const body = parsed.data as RunRequest;

  const config = readConfig();
  const provider = config.providers.find(p => p.id === body.providerId);
  if (!provider?.apiKey) {
    res.status(400).json({ status: 'error', error: `Provider ${body.providerId} not found or not configured` });
    return;
  }

  const baseUrl = normalizeBaseUrl(provider.id, provider.baseUrl);
  const type = inferType(provider.id, baseUrl, provider.type);
  const resolved: ResolvedLlm = { baseUrl, type, apiKey: provider.apiKey };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const emit = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const runId = randomUUID();
  const { suite } = body;
  emit({ type: 'start', runId, totalCases: suite.testCases.length });

  // Load agent state to build a proper system prompt
  const agentState = loadAgent(body.agentId);
  const persona = agentState?.instructionState?.['persona'] as string ?? '';
  const systemPrompt = [
    `You are an AI assistant. Mission: ${suite.missionBrief}`,
    persona ? `Persona: ${persona}` : '',
    'Stay within your defined mission. Refuse out-of-scope requests politely.',
  ].filter(Boolean).join('\n\n');

  const testResults: TestResult[] = [];
  const dimAccum: Record<string, number[]> = {};

  try {
    for (let i = 0; i < suite.testCases.length; i++) {
      const tc = suite.testCases[i];
      emit({ type: 'case_start', testCaseId: tc.id, label: tc.label, index: i + 1 });

      let result: TestResultWithDimScores;
      try {
        result = await runSingleTestCase(resolved, body.model, systemPrompt, tc, suite.scoringDimensions, suite.passThreshold);
      } catch (err) {
        result = {
          testCaseId: tc.id, score: 0, passed: false,
          feedback: err instanceof Error ? err.message : String(err),
          dimensionScores: {},
        };
      }

      testResults.push({ testCaseId: result.testCaseId, score: result.score, passed: result.passed, feedback: result.feedback });
      for (const [dimId, score] of Object.entries(result.dimensionScores)) {
        dimAccum[dimId] = dimAccum[dimId] ?? [];
        dimAccum[dimId].push(score);
      }
      emit({ type: 'case_done', testCaseId: tc.id, score: result.score, passed: result.passed, feedback: result.feedback });
    }

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

    const patches = globalScore < suite.passThreshold
      ? await generateLlmPatches(resolved, body.model, suite, testResults)
      : [];

    await saveQualificationRun(body.agentId, { runId, timestamp: Date.now(), globalScore, passThreshold: suite.passThreshold });

    emit({ type: 'done', runId, globalScore, dimensionScores, testResults, patches });
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }

  res.end();
});

/* ── POST /apply-patches ── */

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  const last = parts.pop();
  if (!last) return;
  let cur: Record<string, unknown> = obj;
  for (const part of parts) {
    if (typeof cur[part] !== 'object' || cur[part] === null) cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[last] = value;
}

function extractPatchContent(diff: string): string {
  return diff.split('\n')
    .filter(line => line.startsWith('+ '))
    .map(line => line.slice(2).trim())
    .join('\n');
}

router.post('/apply-patches', async (req: Request, res: Response) => {
  const body = req.body as ApplyPatchesRequest;
  if (!body.agentId || !body.runId || !body.patchIds?.length) {
    res.status(400).json({ status: 'error', error: 'agentId, runId, and patchIds are required' });
    return;
  }
  try {
    const agentState = loadAgent(body.agentId);
    if (!agentState) {
      res.status(404).json({ status: 'error', error: `Agent ${body.agentId} not found` });
      return;
    }
    const toApply = (body.patches ?? []).filter(p => body.patchIds.includes(p.id));
    const configUpdates: Record<string, unknown> = {};

    for (const patch of toApply) {
      const newContent = extractPatchContent(patch.diff);
      if (!newContent) continue;
      const path = patch.targetField.startsWith('instructionState.')
        ? patch.targetField.slice('instructionState.'.length)
        : patch.targetField;
      const current = agentState.instructionState[path];
      const updated = typeof current === 'string' && current ? `${current}\n${newContent}` : newContent;
      setNestedValue(agentState.instructionState, path, updated);
      configUpdates[patch.targetField] = updated;
    }

    createAgentVersion(body.agentId, agentState.version, `qual-patch-${body.runId.slice(0, 8)}`);
    saveAgent(body.agentId, agentState);

    res.json({ status: 'ok', data: { applied: body.patchIds, configUpdates, message: `Applied ${body.patchIds.length} patch(es) to agent ${body.agentId}` } });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

/* ── GET /:agentId/history ── */
router.get('/:agentId/history', async (req: Request, res: Response) => {
  const agentId = String(req.params['agentId'] ?? '');
  const history = await getQualificationHistory(agentId);
  res.json({ status: 'ok', data: history });
});

export default router;
