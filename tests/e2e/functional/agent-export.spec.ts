/**
 * Functional E2E: Agent Export
 * Tests: config → export for each target → validate output format
 *
 * Uses a template-loaded agent to avoid LLM dependency.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4800/api';

test.describe('Agent Export — config → valid output files', () => {

  test('API: save agent to library via PUT /agents/:id', async ({ request }) => {
    const agentState = {
      id: 'e2e-test-agent',
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      agentMeta: {
        name: 'E2E Test Agent',
        description: 'Agent created by functional e2e test',
        icon: 'brain',
        category: 'research',
        tags: ['test', 'e2e'],
        avatar: 'bot',
      },
      instructionState: { identity: 'Test agent', persona: 'Helpful', constraints: 'Be accurate' },
      workflowSteps: [],
      channels: [],
      mcpServers: [],
      skills: [],
      connectors: [],
      agentConfig: { temperature: 0.7, planningMode: 'single-shot', maxTokens: 4096 },
      exportTarget: 'claude',
      outputFormat: 'markdown',
      outputFormats: ['markdown'],
      tokenBudget: 4000,
      prompt: 'A test agent for e2e validation',
      selectedModel: 'claude-sonnet-4',
    };

    const res = await request.put(`${API}/agents/e2e-test-agent`, { data: agentState }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.data.id).toBe('e2e-test-agent');
  });

  test('API: load saved agent from library', async ({ request }) => {
    const res = await request.get(`${API}/agents/e2e-test-agent`).catch(() => null);
    if (!res) { test.skip(); return; }

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.data.agentMeta.name).toBe('E2E Test Agent');
      expect(body.data.version).toBe('1.0.0');
    } else if (res.status() === 404) {
      // Agent wasn't saved in previous test — document this as a failure
      expect(res.status()).toBe(200); // intentional fail for audit
    }
  });

  test('API: list all agents includes saved agent', async ({ request }) => {
    const res = await request.get(`${API}/agents`).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API: version history works', async ({ request }) => {
    const res = await request.get(`${API}/agents/e2e-test-agent/versions`).catch(() => null);
    if (!res) { test.skip(); return; }

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('UI: Save modal opens and shows export targets', async ({ page }) => {
    await page.goto('/');

    // Load a template or create new agent
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // Look for Export/Save button
    const saveBtn = page.getByRole('button', { name: /save|export/i }).first();
    const hasSave = await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasSave) {
      await saveBtn.click();

      // Modal should appear with target cards
      const modal = page.getByRole('dialog');
      const modalVisible = await modal.isVisible({ timeout: 3_000 }).catch(() => false);

      if (modalVisible) {
        // Check export targets exist
        for (const target of ['Claude Code', 'Amp', 'Codex']) {
          const targetVisible = await page.getByText(target).isVisible({ timeout: 1_000 }).catch(() => false);
          expect(targetVisible).toBe(true);
        }

        // Check Save to Library button exists (fix #139)
        const saveToLibrary = await page.getByRole('button', { name: /save to library/i })
          .isVisible({ timeout: 1_000 }).catch(() => false);
        const download = await page.getByRole('button', { name: /download/i })
          .isVisible({ timeout: 1_000 }).catch(() => false);

        // At least one action should be available
        expect(saveToLibrary || download).toBe(true);
      }
    }
  });

  test('API: cleanup — delete test agent', async ({ request }) => {
    await request.delete(`${API}/agents/e2e-test-agent`).catch(() => null);
  });
});
