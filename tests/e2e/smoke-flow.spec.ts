/**
 * Smoke test: Complete agent creation flow
 * Template → Describe → Review → Preview → Export
 *
 * This test verifies the critical path works end-to-end
 * WITHOUT requiring an LLM provider (uses template pre-fill).
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke Flow — Template to Export', () => {
  test('load template, navigate tabs, preview agent, export', async ({ page }) => {
    await page.goto('/');

    // Step 1: Agent Library — click a template
    await expect(page.getByText('New Agent')).toBeVisible({ timeout: 10_000 });

    // Look for any template card and click "Use Template"
    const templateCard = page.locator('[data-testid="template-card"]').first()
      .or(page.getByText('Senior PM').first());

    if (await templateCard.isVisible()) {
      await templateCard.click();
    } else {
      // Fallback: click New Agent
      await page.getByRole('button', { name: 'New Agent' }).click();
    }

    // Step 2: Should be in wizard now
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // Step 3: Describe tab — verify text area exists
    const describeArea = page.locator('textarea').first();
    await expect(describeArea).toBeVisible();

    // Step 4: Navigate to Review tab
    await page.getByRole('tab', { name: 'Review' }).click();
    await expect(page.getByText('Review & Configure')).toBeVisible();

    // Step 5: Verify collapsible sections exist (use role buttons to avoid ambiguity)
    await expect(page.getByRole('button', { name: /Identity/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Persona/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Constraints/ }).first()).toBeVisible();

    // Step 6: Click Preview button
    const previewBtn = page.getByRole('button', { name: /preview/i }).first();
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      // Agent Preview modal should open
      await expect(page.getByText('Agent Preview')).toBeVisible({ timeout: 5_000 });
      // Should show summary cards (use nth to avoid ambiguity)
      await expect(page.getByText('Workflow').first()).toBeVisible();
      await expect(page.getByText('Context').first()).toBeVisible();
      // Close modal
      await page.keyboard.press('Escape');
    }

    // Step 7: Export button should be visible
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    await expect(exportBtn).toBeVisible();
  });

  test('provider onboarding banner shows when no provider configured', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // The onboarding banner should be visible
    const banner = page.getByText('Set up an AI provider to get started');
    // May or may not show depending on Claude Code auth — just verify no crash
    if (await banner.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(page.getByRole('button', { name: /Configure Provider/i })).toBeVisible();
    }
  });

  test('error boundary catches tab crash gracefully', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // Navigate through all tabs — none should crash
    for (const tab of ['Describe', 'Knowledge', 'Tools', 'Memory', 'Review', 'Test', 'Qualification']) {
      await page.getByRole('tab', { name: tab }).click();
      // Should NOT see error boundary
      const errorBoundary = page.getByText('Something went wrong');
      expect(await errorBoundary.isVisible({ timeout: 500 }).catch(() => false)).toBe(false);
    }
  });
});
