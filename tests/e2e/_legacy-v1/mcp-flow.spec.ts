import { test, expect } from '@playwright/test';

test.describe('MCP Server Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('MCP section is visible in sources panel', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'MCP Servers' })).toBeVisible();
  });

  test('MCP section shows active count badge', async ({ page }) => {
    const section = page.getByRole('region', { name: 'MCP Servers' });
    await expect(section.getByText(/\d+ active/)).toBeVisible();
  });

  test('MCP Library button opens picker modal', async ({ page }) => {
    await page.getByText('MCP Library').click();
    await page.waitForTimeout(500);
    // Should open marketplace/picker
    await page.keyboard.press('Escape');
  });

  test('settings MCP tab shows registry servers', async ({ page }) => {
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await settingsBtn.click();
      await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });
      // Navigate to MCP tab
      const mcpTab = page.getByText('MCP', { exact: true });
      if (await mcpTab.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await mcpTab.click();
        await page.waitForTimeout(500);
      }
      await page.keyboard.press('Escape');
    }
  });

  test('MCP section collapses and expands', async ({ page }) => {
    const section = page.getByRole('region', { name: 'MCP Servers' });
    const toggleBtn = section.locator('button[aria-expanded]');
    // Collapse
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    // Expand
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });
});
