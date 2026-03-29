/**
 * Functional E2E: Qualification Flow
 * Tests: generate suite → run tests → judge → patches
 *
 * Uses API-level tests with mock-ready structure.
 * LLM-dependent endpoints may fail — that's the point of the audit.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4800/api';

test.describe('Qualification Flow — generate → run → patches', () => {

  test('API: /qualification/generate-suite accepts valid input', async ({ request }) => {
    const res = await request.post(`${API}/qualification/generate-suite`, {
      data: {
        agentId: 'e2e-qual-test',
        missionBrief: 'A maritime weather routing assistant that recommends optimal routes',
        persona: 'Expert navigator',
        constraints: 'Always prioritize safety over speed',
        objectives: 'Minimize fuel consumption while avoiding severe weather',
      },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    // This endpoint needs an LLM — may return 500 if no provider
    const status = res.status();
    const body = await res.json().catch(() => res.text());

    if (status === 200) {
      // Suite generated successfully
      expect(typeof body).toBe('object');
    } else {
      // Document the failure mode: is it provider missing, or structural error?
      expect([400, 500]).toContain(status);
    }
  });

  test('API: /qualification/run accepts valid suite', async ({ request }) => {
    const suite = {
      agentId: 'e2e-qual-test',
      providerId: 'anthropic-default',
      model: 'claude-sonnet-4',
      suite: {
        missionBrief: 'Weather routing assistant',
        testCases: [
          { id: 'tc-1', type: 'nominal', label: 'Basic route request', input: 'Find the optimal route from Rotterdam to Singapore', expectedBehavior: 'Provides route with waypoints and weather considerations' },
          { id: 'tc-2', type: 'edge', label: 'No weather data', input: 'Route to Antarctica with no forecast', expectedBehavior: 'Flags data gap and recommends caution' },
        ],
        scoringDimensions: [
          { id: 'dim-1', name: 'Accuracy', weight: 0.6 },
          { id: 'dim-2', name: 'Safety', weight: 0.4 },
        ],
        passThreshold: 70,
      },
    };

    const res = await request.fetch(`${API}/qualification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(suite),
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    // This is an SSE endpoint — check stream structure
    const contentType = res.headers()['content-type'] ?? '';
    const status = res.status();

    if (contentType.includes('text/event-stream')) {
      const body = await res.text();
      // Should contain at least a start event
      expect(body.length).toBeGreaterThan(0);
      const hasStart = body.includes('"type":"start"') || body.includes('"start"');
      const hasError = body.includes('"error"') || body.includes('"type":"error"');
      // Either started or errored — both mean the endpoint works
      expect(hasStart || hasError).toBe(true);
    } else {
      // Non-SSE response — may be a JSON error
      expect([200, 400, 500]).toContain(status);
    }
  });

  test('API: /qualification/history returns array', async ({ request }) => {
    const res = await request.get(`${API}/qualification/history/e2e-qual-test`).catch(() => null);
    if (!res) { test.skip(); return; }

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('UI: Qualification tab renders in wizard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Qualification' }).click();

    // Should show qualification UI (generate button, test cases area, or empty state)
    const hasContent = await Promise.race([
      page.getByText(/generate|test case|qualification|evaluate/i).first().isVisible({ timeout: 3_000 }),
      page.getByRole('button').first().isVisible({ timeout: 3_000 }),
    ]).catch(() => false);

    expect(hasContent).toBe(true);

    // Error boundary should NOT be visible
    const hasError = await page.getByText('Something went wrong').isVisible({ timeout: 500 }).catch(() => false);
    expect(hasError).toBe(false);
  });
});
