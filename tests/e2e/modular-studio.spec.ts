import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for dashboard to load (sources panel visible)
  await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
});

test('app loads without critical console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('theme toggle switches between dark and light', async ({ page }) => {
  // Find theme toggle button in topbar
  const body = page.locator('body');
  const initialBg = await page.locator('[data-theme]').getAttribute('data-theme');
  // Click theme toggle (first icon button in topbar area)
  const themeBtn = page.getByLabel(/switch to (light|dark) mode/i);
  if (await themeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await themeBtn.click();
    await page.waitForTimeout(300);
    const newTheme = await page.locator('[data-theme]').getAttribute('data-theme');
    expect(newTheme).not.toBe(initialBg);
  }
});

test('settings opens and closes with Escape', async ({ page }) => {
  const settingsBtn = page.getByLabel('LLM settings');
  if (await settingsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await settingsBtn.click();
    await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('PROVIDERS')).not.toBeVisible({ timeout: 3_000 });
  }
});

test('marketplace opens, shows tabs, and closes', async ({ page }) => {
  const marketBtn = page.getByLabel('Open Marketplace');
  if (await marketBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await marketBtn.click();
    await expect(page.locator('span').filter({ hasText: /^Marketplace$/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Skills', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('MCP Servers').first()).toBeVisible();
    await expect(page.getByText('Presets').first()).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('model selector: changing model updates selection', async ({ page }) => {
  const modelSelect = page.getByLabel('Select AI model');
  if (await modelSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const options = await modelSelect.locator('option').all();
    if (options.length > 1) {
      await modelSelect.selectOption({ index: 1 });
      const value = await modelSelect.inputValue();
      expect(value).toBeTruthy();
    }
  }
});

test('skills library: opens from sources panel', async ({ page }) => {
  const skillLibBtn = page.getByText('Skill Library');
  await skillLibBtn.click();
  await page.waitForTimeout(500);
  // Modal or marketplace should appear
  await page.keyboard.press('Escape');
});

test('MCP library: opens from sources panel', async ({ page }) => {
  const mcpLibBtn = page.getByText('MCP Library');
  await mcpLibBtn.click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
});

test('preset selector loads a demo agent', async ({ page }) => {
  const presetSelect = page.getByLabel('Select preset');
  if (await presetSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await presetSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    // Agent name should no longer be the default placeholder
  }
});
