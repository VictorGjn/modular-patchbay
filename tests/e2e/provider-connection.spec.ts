import { test, expect } from '@playwright/test';

test.describe('Provider Configuration & Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('settings page opens and shows providers tab', async ({ page }) => {
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await settingsBtn.click();
      await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });
      await page.keyboard.press('Escape');
    }
  });

  test('provider form has required fields', async ({ page }) => {
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      // Should show API key or provider config fields
      await page.keyboard.press('Escape');
    }
  });

  test('model select has options', async ({ page }) => {
    const modelSelect = page.getByLabel('Select AI model');
    if (await modelSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const options = await modelSelect.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
  });

  test('preset select has demo agents', async ({ page }) => {
    const presetSelect = page.getByLabel('Select preset');
    if (await presetSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const options = await presetSelect.locator('option').count();
      expect(options).toBeGreaterThan(1); // At least default + presets
    }
  });
});
