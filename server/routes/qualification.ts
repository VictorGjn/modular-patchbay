import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../config.js';
import type { Request, Response } from 'express';

const router = Router();

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

interface RunResponse {
  runId: string;
  globalScore: number;
  dimensionScores: Record<string, number>;
  testResults: TestResult[];
  patches: PatchSuggestion[];
}

interface ApplyPatchesRequest {
  agentId: string;
  runId: string;
  patchIds: string[];
}

/* ── POST /generate-suite ── */
router.post('/generate-suite', async (req: Request, res: Response) => {
  const body = req.body as GenerateSuiteRequest;
  if (!body.agentId || !body.missionBrief) {
    res.status(400).json({ status: 'error', error: 'agentId and missionBrief are required' });
    return;
  }

  try {
    const config = readConfig();
    
    // Find a connected provider for LLM calls
    const connectedProvider = config.providers.find(p => 
      p.status === 'connected' || p.status === 'configured'
    );
    
    if (!connectedProvider) {
      res.status(400).json({ 
        status: 'error', 
        error: 'No connected LLM provider found. Please configure a provider first.' 
      });
      return;
    }

    // Build LLM prompt for test case generation
    const prompt = `You are a qualification test case generator. Given an agent's mission brief, generate 5-10 test cases (mix of nominal, edge, and anti cases) and 3-5 scoring dimensions.

Mission Brief: "${body.missionBrief}"
${body.persona ? `Persona: "${body.persona}"` : ''}
${body.constraints ? `Constraints: "${body.constraints}"` : ''}
${body.objectives ? `Objectives: "${body.objectives}"` : ''}

Generate test cases that thoroughly evaluate this agent's capabilities, edge cases, and failure modes. 

Return JSON in this exact format:
{
  "testCases": [
    {
      "type": "nominal|edge|anti",
      "label": "Brief description of test",
      "input": "Input to send to the agent", 
      "expectedBehavior": "What the agent should do"
    }
  ],
  "scoringDimensions": [
    {
      "name": "Dimension name",
      "weight": 0.25
    }
  ]
}

Ensure weights sum to 1.0. Generate realistic, specific test inputs that would actually challenge the agent.`;

    // Call LLM
    const baseUrl = connectedProvider.baseUrl.replace(/\/+$/, '');
    const isAnthropic = connectedProvider.id.includes('anthropic') || baseUrl.includes('anthropic.com');
    
    const messages = [
      { role: 'user', content: prompt }
    ];

    const requestBody = isAnthropic ? {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages
    } : {
      model: 'gpt-4o',
      max_tokens: 4000,
      messages
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (isAnthropic) {
      headers['x-api-key'] = connectedProvider.apiKey || '';
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${connectedProvider.apiKey || ''}`;
    }

    const llmResponse = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      res.status(502).json({ 
        status: 'error', 
        error: `LLM API error: ${llmResponse.status} ${errorText}` 
      });
      return;
    }

    const llmData = await llmResponse.json();
    
    // Extract content from response
    let content = '';
    if (isAnthropic && llmData.content?.[0]?.text) {
      content = llmData.content[0].text;
    } else if (llmData.choices?.[0]?.message?.content) {
      content = llmData.choices[0].message.content;
    } else {
      throw new Error('Could not extract content from LLM response');
    }

    // Parse JSON from LLM response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const generatedData = JSON.parse(jsonMatch[0]);

    // Transform and validate the generated data
    const testCases: TestCase[] = (generatedData.testCases || []).map((tc: any) => ({
      id: randomUUID(),
      type: tc.type || 'nominal',
      label: tc.label || 'Generated test case',
      input: tc.input || '',
      expectedBehavior: tc.expectedBehavior || '',
    }));

    const scoringDimensions: ScoringDimension[] = (generatedData.scoringDimensions || []).map((dim: any) => ({
      id: randomUUID(),
      name: dim.name || 'Dimension',
      weight: dim.weight || 0.25,
    }));

    // Normalize weights to sum to 1.0
    const totalWeight = scoringDimensions.reduce((sum, dim) => sum + dim.weight, 0);
    if (totalWeight > 0) {
      scoringDimensions.forEach(dim => {
        dim.weight = dim.weight / totalWeight;
      });
    }

    const response: GenerateSuiteResponse = { testCases, scoringDimensions };
    res.json({ status: 'ok', data: response });

  } catch (err) {
    console.error('Error generating test suite:', err);
    res.status(500).json({ 
      status: 'error', 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

/* ── POST /run ── */
router.post('/run', async (req: Request, res: Response) => {
  const body = req.body as RunRequest;
  if (!body.agentId || !body.providerId || !body.model || !body.suite) {
    res.status(400).json({ status: 'error', error: 'agentId, providerId, model, and suite are required' });
    return;
  }

  try {
    const config = readConfig();
    
    // Find the provider
    const provider = config.providers.find(p => p.id === body.providerId);
    if (!provider || !provider.apiKey) {
      res.status(400).json({ 
        status: 'error', 
        error: `Provider ${body.providerId} not found or not configured` 
      });
      return;
    }

    const runId = randomUUID();

    // Build the agent's system prompt from mission brief
    const systemPrompt = `You are an AI assistant. Your mission: ${body.suite.missionBrief}

You must stay within the scope of this mission and follow these guidelines:
- Be helpful and accurate
- Stay within your defined role
- If asked to do something outside your mission, politely decline
- Be consistent with your persona and constraints`;

    const baseUrl = provider.baseUrl.replace(/\/+$/, '');
    const isAnthropic = provider.id.includes('anthropic') || baseUrl.includes('anthropic.com');

    // Process each test case
    const testResults: TestResult[] = [];
    
    for (const testCase of body.suite.testCases) {
      try {
        // 1. Run the test case input against the agent
        const agentMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: testCase.input }
        ];

        const agentRequestBody = isAnthropic ? {
          model: body.model,
          max_tokens: 1000,
          messages: agentMessages.filter(m => m.role !== 'system'),
          system: systemPrompt
        } : {
          model: body.model,
          max_tokens: 1000,
          messages: agentMessages
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (isAnthropic) {
          headers['x-api-key'] = provider.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${provider.apiKey}`;
        }

        const agentResponse = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(agentRequestBody)
        });

        if (!agentResponse.ok) {
          testResults.push({
            testCaseId: testCase.id,
            score: 0,
            passed: false,
            feedback: `Failed to get agent response: ${agentResponse.status}`
          });
          continue;
        }

        const agentData = await agentResponse.json();
        
        // Extract agent's response content
        let agentContent = '';
        if (isAnthropic && agentData.content?.[0]?.text) {
          agentContent = agentData.content[0].text;
        } else if (agentData.choices?.[0]?.message?.content) {
          agentContent = agentData.choices[0].message.content;
        }

        // 2. Use LLM as judge to score the response
        const judgePrompt = `You are evaluating an AI agent's response for a qualification test.

TEST CASE:
Type: ${testCase.type}
Input: "${testCase.input}"
Expected Behavior: "${testCase.expectedBehavior}"

AGENT'S ACTUAL RESPONSE:
"${agentContent}"

SCORING DIMENSIONS:
${body.suite.scoringDimensions.map(d => `- ${d.name} (${Math.round(d.weight * 100)}%)`).join('\n')}

Rate the agent's response on a scale of 0-100 for each dimension. Consider:
- How well did it match the expected behavior?
- For "nominal" cases: Is it accurate and helpful?
- For "edge" cases: Does it handle ambiguity appropriately? 
- For "anti" cases: Does it refuse inappropriate requests and stay in scope?

Return JSON in this exact format:
{
  "dimensionScores": {
    ${body.suite.scoringDimensions.map(d => `"${d.id}": <score 0-100>`).join(',\n    ')}
  },
  "overallScore": <weighted average 0-100>,
  "feedback": "<brief explanation of the score>"
}`;

        const judgeMessages = [
          { role: 'user', content: judgePrompt }
        ];

        const judgeRequestBody = isAnthropic ? {
          model: body.model,
          max_tokens: 1000,
          messages: judgeMessages
        } : {
          model: body.model,
          max_tokens: 1000,
          messages: judgeMessages
        };

        const judgeResponse = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(judgeRequestBody)
        });

        if (!judgeResponse.ok) {
          testResults.push({
            testCaseId: testCase.id,
            score: 50,
            passed: false,
            feedback: `Failed to score response: ${judgeResponse.status}`
          });
          continue;
        }

        const judgeData = await judgeResponse.json();
        
        // Extract judge's scoring
        let judgeContent = '';
        if (isAnthropic && judgeData.content?.[0]?.text) {
          judgeContent = judgeData.content[0].text;
        } else if (judgeData.choices?.[0]?.message?.content) {
          judgeContent = judgeData.choices[0].message.content;
        }

        // Parse scoring JSON
        const jsonMatch = judgeContent.match(/\{[\s\S]*\}/);
        let score = 50;
        let feedback = 'Default scoring due to parsing error';
        
        if (jsonMatch) {
          try {
            const scoreData = JSON.parse(jsonMatch[0]);
            score = Math.round(scoreData.overallScore || 50);
            feedback = scoreData.feedback || 'No feedback provided';
          } catch {
            // Use default values
          }
        }

        testResults.push({
          testCaseId: testCase.id,
          score: Math.max(0, Math.min(100, score)),
          passed: score >= body.suite.passThreshold,
          feedback
        });

      } catch (err) {
        console.error(`Error processing test case ${testCase.id}:`, err);
        testResults.push({
          testCaseId: testCase.id,
          score: 0,
          passed: false,
          feedback: `Error: ${err instanceof Error ? err.message : String(err)}`
        });
      }
    }

    // Calculate dimension scores (simplified - average from test results)
    const dimensionScores: Record<string, number> = {};
    for (const dim of body.suite.scoringDimensions) {
      const avgScore = testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length;
      dimensionScores[dim.id] = Math.round(avgScore);
    }

    // Calculate global score as weighted average
    const globalScore = Math.round(
      body.suite.scoringDimensions.reduce((sum, dim) => {
        return sum + (dimensionScores[dim.id] ?? 0) * dim.weight;
      }, 0)
    );

    // Generate patches if score is below threshold
    const patches: PatchSuggestion[] = [];
    if (globalScore < body.suite.passThreshold) {
      const failedTests = testResults.filter(t => !t.passed);
      const hasAntiFailures = failedTests.some(t => 
        body.suite.testCases.find(tc => tc.id === t.testCaseId)?.type === 'anti'
      );

      if (hasAntiFailures) {
        patches.push({
          id: randomUUID(),
          targetField: 'constraints.customConstraints',
          description: 'Add explicit scope boundary to prevent out-of-scope responses',
          diff: '+ Always refuse requests outside the defined mission brief.',
          applied: false,
        });
      }

      if (failedTests.length > body.suite.testCases.length / 2) {
        patches.push({
          id: randomUUID(),
          targetField: 'instructionState.persona',
          description: 'Enhance persona clarity and instructions',
          diff: '+ Be more explicit about your role and capabilities.',
          applied: false,
        });
      }
    }

    const response: RunResponse = { runId, globalScore, dimensionScores, testResults, patches };
    res.json({ status: 'ok', data: response });

  } catch (err) {
    console.error('Error running qualification:', err);
    res.status(500).json({ 
      status: 'error', 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

/* ── POST /apply-patches ── */
router.post('/apply-patches', async (req: Request, res: Response) => {
  const body = req.body as ApplyPatchesRequest;
  if (!body.agentId || !body.runId || !body.patchIds?.length) {
    res.status(400).json({ status: 'error', error: 'agentId, runId, and patchIds are required' });
    return;
  }

  try {
    // In a real implementation, this would:
    // 1. Load the current agent configuration
    // 2. Apply the specified patches to the config
    // 3. Save the updated configuration
    // 4. Return the updated config

    // For now, we'll simulate the patch application
    const appliedPatches: string[] = [];
    const configUpdates: Record<string, unknown> = {};

    // Note: In a production system, you'd want to:
    // - Load actual patch suggestions from the qualification run
    // - Validate that patches are safe to apply
    // - Update the actual agent configuration in your persistence layer
    // - Provide rollback mechanisms

    for (const patchId of body.patchIds) {
      // Simulate patch application
      appliedPatches.push(patchId);
      
      // Example patch applications (would be specific to each patch):
      // if (patch.targetField === 'constraints.customConstraints') {
      //   configUpdates['constraints.customConstraints'] = updatedConstraints;
      // }
    }

    res.json({
      status: 'ok',
      data: {
        applied: appliedPatches,
        configUpdates,
        message: `Applied ${appliedPatches.length} patch(es) to agent ${body.agentId}`,
        note: 'Patch application is currently simulated. In production, this would modify the actual agent configuration.',
      },
    });

  } catch (err) {
    console.error('Error applying patches:', err);
    res.status(500).json({ 
      status: 'error', 
      error: err instanceof Error ? err.message : String(err) 
    });
  }
});

export default router;
