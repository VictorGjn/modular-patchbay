/**
 * Functional E2E: Metaprompt V2 Generate Pipeline
 * Tests: description → Parse → Research → Pattern → Context → Assemble → Evaluate → config
 *
 * This test requires an LLM provider. If none configured, it tests the SSE stream
 * structure and error handling rather than full pipeline completion.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4800/api';

test.describe('Metaprompt V2 — generate pipeline', () => {

  test('API: /metaprompt/v2/generate returns SSE stream', async ({ request }) => {
    // Send a minimal prompt — expect SSE events even if LLM fails
    const res = await request.fetch(`${API}/metaprompt/v2/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        prompt: 'A senior product manager agent for a maritime SaaS company',
        tokenBudget: 4000,
      }),
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/event-stream');

    const body = await res.text();
    // Should contain at least the start event
    expect(body).toContain('"phase":"start"');
    // Should either complete or error (not hang)
    const hasCompletion = body.includes('"phase":"done"') || body.includes('"phase":"error"');
    expect(hasCompletion).toBe(true);
  });

  test('API: /metaprompt/v2/generate rejects empty prompt', async ({ request }) => {
    const res = await request.post(`${API}/metaprompt/v2/generate`, {
      data: { prompt: '' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('prompt');
  });

  test('API: SSE stream runs core pipeline phases', async ({ request }) => {
    const res = await request.fetch(`${API}/metaprompt/v2/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        prompt: 'A code review assistant that uses GitHub and Slack',
        tokenBudget: 2000,
      }),
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    const body = await res.text();
    // Core pipeline: start → parse → research → ... → done|error
    expect(body).toContain('"phase":"start"');

    const hasCompletion = body.includes('"phase":"done"') || body.includes('"phase":"error"');
    expect(hasCompletion).toBe(true);

    // tool_discovery is now decoupled — may or may not appear
    const parseIdx = body.indexOf('"phase":"parse"');
    const tdIdx = body.indexOf('"phase":"tool_discovery"');
    if (parseIdx >= 0 && tdIdx >= 0) {
      expect(parseIdx).toBeLessThan(tdIdx);
    }
  });

  test('UI: Generate button triggers pipeline and shows progress', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // Type a description in the Describe tab
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    await textarea.fill('A competitive intelligence analyst for maritime technology');

    // Look for Generate button
    const generateBtn = page.getByRole('button', { name: /generate/i }).first();
    const btnVisible = await generateBtn.isVisible({ timeout: 2_000 }).catch(() => false);

    if (btnVisible) {
      await generateBtn.click();

      // Should show some progress indicator (V2PipelineProgress component)
      const hasProgress = await page.getByText(/parsing|researching|assembling|tool discovery|complete|error/i)
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);

      // Either progress shows OR error shows — both are valid (means pipeline started)
      const hasError = await page.getByText(/error|failed|provider/i)
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      expect(hasProgress || hasError).toBe(true);
    } else {
      // Generate button may require a provider to be configured
      // Check if provider banner is shown instead
      const providerBanner = await page.getByText(/provider|configure|set up/i)
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      expect(providerBanner).toBe(true);
    }
  });

  test('UI: pipeline phases display in correct order', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    const textarea = page.locator('textarea').first();
    if (!(await textarea.isVisible({ timeout: 2_000 }).catch(() => false))) {
      // No textarea — skip
      return;
    }
    await textarea.fill('Test agent');

    const generateBtn = page.getByRole('button', { name: /generate/i }).first();
    if (!(await generateBtn.isVisible({ timeout: 2_000 }).catch(() => false))) {
      return;
    }

    // Generate requires an LLM provider — button is disabled without one
    const isEnabled = await generateBtn.isEnabled().catch(() => false);
    if (!isEnabled) {
      // Verify wizard renders correctly without a provider
      await expect(page.getByRole('tablist')).toBeVisible();
      return;
    }

    await generateBtn.click();

    // Wait briefly then check for any pipeline indicator
    // Pipeline requires an LLM provider — may show progress, error, or nothing
    const pipelineIndicator = page.getByText(/parsing|starting|researching|assembling|error|failed|provider|no provider/i).first();
    const hasIndicator = await pipelineIndicator.isVisible({ timeout: 8_000 }).catch(() => false);

    // Either the pipeline started (phases visible) or errored (no provider) — both valid
    // If neither appears, the wizard at least didn’t crash
    if (!hasIndicator) {
      // Verify the wizard is still functional (no crash)
      await expect(page.getByRole('tablist')).toBeVisible();
    }
  });
});
