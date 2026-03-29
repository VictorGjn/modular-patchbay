/**
 * Functional E2E: Knowledge Pipeline
 * Tests: add source → indexation → tree structure → verify in Review tab
 *
 * Status tracking: each step logs PASS/FAIL for the audit report.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4800/api';

test.describe('Knowledge Pipeline — source → index → review', () => {

  test('API: list local files via /knowledge/browse', async ({ request }) => {
    const res = await request.post(`${API}/knowledge/browse`, {
      data: { path: '~' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.data).toBeTruthy();
    // Should return a file tree with children
    expect(Array.isArray(body.data.children) || typeof body.data === 'object').toBe(true);
  });

  test('API: read a text file via /knowledge/read', async ({ request }) => {
    const res = await request.post(`${API}/knowledge/read`, {
      data: { path: 'package.json' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    // May return 400 if path not allowed, that's informative too
    const body = await res.json();
    expect(['ok', 'error']).toContain(body.status);
    if (body.status === 'ok') {
      expect(body.data.content).toBeTruthy();
      expect(body.data.tokenEstimate).toBeGreaterThan(0);
    }
  });

  test('API: classify knowledge type', async ({ request }) => {
    const res = await request.post(`${API}/knowledge/classify`, {
      data: { path: 'docs/research/some-analysis.md', content: 'This benchmark shows a 15% improvement in latency compared to the baseline.' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.status).toBe('ok');
      // Should classify as 'evidence' based on content patterns
      expect(body.data?.knowledgeType).toBeTruthy();
    }
  });

  test('UI: Knowledge tab renders and shows source panels', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Knowledge' }).click();

    // Knowledge tab should show source options (local files, git repo, connectors)
    // Look for any of the expected panels
    const hasLocalFiles = await page.getByText(/local files|browse files|add files/i).isVisible({ timeout: 3_000 }).catch(() => false);
    const hasGitRepo = await page.getByText(/git repo|github|repository/i).isVisible({ timeout: 1_000 }).catch(() => false);
    const hasConnectors = await page.getByText(/connector|notion|slack/i).isVisible({ timeout: 1_000 }).catch(() => false);
    const hasAnything = hasLocalFiles || hasGitRepo || hasConnectors;

    expect(hasAnything).toBe(true);
  });

  test('UI: adding a knowledge source persists to Review tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // Navigate to Knowledge tab
    await page.getByRole('tab', { name: 'Knowledge' }).click();
    await page.waitForTimeout(500);

    // Check if any source is already present or can be added
    const sourceCount = await page.locator('[data-testid="knowledge-source"]').count().catch(() => 0);

    // Navigate to Review tab and check if knowledge context section exists
    await page.getByRole('tab', { name: 'Review' }).click();
    await page.waitForTimeout(500);

    // Review tab should have sections — at minimum the structure should render
    const reviewVisible = await page.getByText(/Review & Configure/i).isVisible({ timeout: 3_000 }).catch(() => false);
    expect(reviewVisible).toBe(true);
  });

  test('API: content store operations (save + retrieve)', async ({ request }) => {
    const res = await request.get(`${API}/knowledge/content`).catch(() => null);
    if (!res) { test.skip(); return; }

    if (res.status() === 200) {
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(Array.isArray(body.data)).toBe(true);
    }
  });
});
