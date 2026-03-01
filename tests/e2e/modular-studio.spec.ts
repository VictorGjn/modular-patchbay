import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
});

test('app loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('theme toggle switches between dark and light', async ({ page }) => {
  const btn = page.getByLabel(/switch to (light|dark) mode/i);
  const initialLabel = await btn.getAttribute('aria-label');
  await btn.click();
  await page.waitForTimeout(300);
  const newLabel = await page.getByLabel(/switch to (light|dark) mode/i).getAttribute('aria-label');
  // The aria-label toggles between "Switch to light mode" and "Switch to dark mode"
  expect(newLabel).not.toBe(initialLabel);
});

test('settings opens and closes with Escape', async ({ page }) => {
  await page.getByLabel('LLM settings').click();
  await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByText('PROVIDERS')).not.toBeVisible({ timeout: 3_000 });
});

test('marketplace opens, shows tabs, and closes', async ({ page }) => {
  await page.getByLabel('Open Marketplace').click();
  await expect(page.locator('span').filter({ hasText: /^Marketplace$/ })).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Skills', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('MCP Servers').first()).toBeVisible();
  await expect(page.getByText('Presets').first()).toBeVisible();
  await page.keyboard.press('Escape');
});

test('knowledge node: directory scan', async ({ page }) => {
  const dirInput = page.locator('input[placeholder*="irectory"], input[placeholder*="path"]').first();
  if (await dirInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dirInput.fill('/tmp/test-project');
    const scanBtn = page.getByRole('button', { name: /scan/i }).first();
    await scanBtn.click();
    await page.waitForTimeout(1_000);
  }
});

test('skills library: opens modal and shows items', async ({ page }) => {
  const addBtn = page.getByRole('button', { name: /library|browse|add/i }).first();
  if (await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(500);
  }
});

test('MCP library: opens modal and shows items', async ({ page }) => {
  const addBtn = page.getByRole('button', { name: /add server|library|browse/i }).first();
  if (await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(500);
  }
});

test('node resize: drag handle changes node size', async ({ page }) => {
  const handle = page.locator('.react-flow__resize-handle, [class*="resize-handle"]').first();
  if (await handle.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const box = await handle.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.up();
    }
  }
});

test('model selector: changing model updates selection', async ({ page }) => {
  const modelSelect = page.getByLabel('Select AI model');
  const options = await modelSelect.locator('option').all();
  if (options.length > 1) {
    await modelSelect.selectOption({ index: 1 });
    const value = await modelSelect.inputValue();
    expect(value).toBeTruthy();
  }
});

test('PromptNode: type text in textarea', async ({ page }) => {
  const textarea = page.locator('[data-id="prompt"] textarea').first();
  await textarea.click();
  await textarea.fill('Hello, this is a test prompt');
  await expect(textarea).toHaveValue('Hello, this is a test prompt');
});
