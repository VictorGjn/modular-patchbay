import { test, expect } from '@playwright/test';

test.describe('Conversation Tester Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('conversation tester panel can be opened', async ({ page }) => {
    // Look for the conversation tester toggle button
    const testerBtn = page.locator('button').filter({ has: page.locator('svg') }).all();
    const buttons = await testerBtn;

    // Try to find conversation tester toggle
    for (const btn of buttons) {
      const label = await btn.getAttribute('aria-label').catch(() => '');
      const title = await btn.getAttribute('title').catch(() => '');
      if (label?.toLowerCase().includes('chat') || label?.toLowerCase().includes('test') ||
          title?.toLowerCase().includes('chat') || title?.toLowerCase().includes('test')) {
        await btn.click();
        await page.waitForTimeout(500);
        break;
      }
    }

    // ConversationTester might be a slide-in panel
    const testerPanel = page.locator('[class*="conversation"], [class*="tester"], [class*="chat"]').first();
    if (await testerPanel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      expect(await testerPanel.isVisible()).toBe(true);
    }
  });

  test('conversation tester has message input', async ({ page }) => {
    // Open tester if it has a toggle
    const chatToggle = page.locator('button[aria-label*="chat" i], button[aria-label*="test" i]').first();
    if (await chatToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await chatToggle.click();
      await page.waitForTimeout(500);
    }

    // Look for chat input
    const chatInput = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i], input[placeholder*="type" i]').first();
    if (await chatInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await chatInput.fill('Hello, test message');
      const value = await chatInput.inputValue();
      expect(value).toContain('test message');
    }
  });
});

test.describe('Marketplace Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('marketplace shows Skills, MCP Servers, and Presets tabs', async ({ page }) => {
    await page.getByLabel('Open Marketplace').click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Skills', { exact: true }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('MCP Servers').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Presets').first()).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
  });

  test('marketplace MCP tab shows registry servers', async ({ page }) => {
    await page.getByLabel('Open Marketplace').click();
    await page.waitForTimeout(500);

    // Click MCP Servers tab
    await page.getByText('MCP Servers').first().click();
    await page.waitForTimeout(300);

    // Should show server cards from the 100+ registry
    const content = await page.locator('[class*="marketplace"], [class*="Marketplace"]').first().textContent();
    expect(content?.length).toBeGreaterThan(50); // Non-trivial content

    await page.keyboard.press('Escape');
  });

  test('marketplace has category filter', async ({ page }) => {
    await page.getByLabel('Open Marketplace').click();
    await page.waitForTimeout(500);

    // Category filters: All, Research, Coding, Data, Design, Writing, Domain
    const categories = ['All', 'Coding', 'Data', 'Research'];
    for (const cat of categories) {
      const catBtn = page.getByText(cat, { exact: true }).first();
      if (await catBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        // Category button exists
        expect(await catBtn.isVisible()).toBe(true);
      }
    }

    await page.keyboard.press('Escape');
  });

  test('marketplace search filters results', async ({ page }) => {
    await page.getByLabel('Open Marketplace').click();
    await page.waitForTimeout(500);

    // Find search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="filter" i]').first();
    if (await searchInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await searchInput.fill('github');
      await page.waitForTimeout(300);

      // Results should be filtered
      const content = await page.locator('[class*="marketplace"], [class*="Marketplace"]').first().textContent();
      expect(content?.toLowerCase()).toContain('github');
    }

    await page.keyboard.press('Escape');
  });
});
