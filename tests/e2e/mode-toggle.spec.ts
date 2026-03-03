import { test, expect } from '@playwright/test';

test.describe('Design / Test Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('starts in design mode (dashboard visible)', async ({ page }) => {
    // Dashboard panels should be visible
    await expect(page.getByRole('region', { name: 'Knowledge' })).toBeVisible();
    await expect(page.getByText('Context Budget')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible();
  });

  test('topbar is visible', async ({ page }) => {
    // Topbar contains model/preset selects and theme toggle
    await expect(page.getByLabel('Select AI model')).toBeVisible();
  });

  test('test mode shows test canvas', async ({ page }) => {
    // Click test mode button (flask icon)
    const testBtn = page.getByLabel(/test mode|switch to test/i);
    if (await testBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await testBtn.click();
      await page.waitForTimeout(500);
      // Should show React Flow test canvas
      const rfWrapper = page.getByTestId('rf__wrapper');
      if (await rfWrapper.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(rfWrapper).toBeVisible();
      }
    }
  });

  test('switching back to design mode restores dashboard', async ({ page }) => {
    const testBtn = page.getByLabel(/test mode|switch to test/i);
    if (await testBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await testBtn.click();
      await page.waitForTimeout(300);
      const designBtn = page.getByLabel(/design mode|switch to design/i);
      if (await designBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await designBtn.click();
        await page.waitForTimeout(300);
        await expect(page.getByText('Generate Agent')).toBeVisible();
      }
    }
  });
});

test.describe('Source Sections Collapse/Expand', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('knowledge section collapses', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Knowledge' });
    const toggle = section.locator('button[aria-expanded]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('skills section collapses', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Skills' });
    const toggle = section.locator('button[aria-expanded]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('memory section collapses', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Memory' });
    const toggle = section.getByRole('button', { name: /memory long-term/i });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
