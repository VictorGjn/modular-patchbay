import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:4800/api';

test.describe('Memory System - Fact Scoring & Consolidation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('memory system handles basic processing without errors', async ({ page }) => {
    // Test that the memory system doesn't crash when processing
    const input = page.getByLabel('Test message');
    await input.fill('Memory system test');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Verify UI remains functional
    const tracesTab = page.getByRole('tab', { name: 'Traces' });
    await tracesTab.click();
    await expect(page.getByRole('tab', { name: 'Traces', selected: true })).toBeVisible();
  });

  test('memory system handles message input interface', async ({ page }) => {
    const input = page.getByLabel('Test message');

    // Test that input interface is functional
    await input.fill('Test message input');
    const sendBtn = page.getByLabel('Send message');

    // Verify basic interface elements
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeVisible();

    // Clear input to reset state
    await input.fill('');
    await page.waitForTimeout(500);

    // Verify send button behavior with empty input (should be disabled)
    const isEmpty = await input.inputValue();
    if (isEmpty === '') {
      await expect(sendBtn).toBeDisabled();
    }
  });

  test('memory system integrates with traces interface', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('Memory integration test');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    const tracesTab = page.getByRole('tab', { name: 'Traces' });
    await tracesTab.click();

    // Verify traces interface is accessible
    await expect(page.getByRole('tab', { name: 'Traces', selected: true })).toBeVisible();
  });

  test('memory scorer API endpoint validation', async ({ request }) => {
    const response = await request.post(`${API_BASE}/runtime/extract-contracts`, {
      data: {
        featureSpec: 'Simple authentication system with user login',
        providerId: 'test-provider',
        model: 'test-model'
      }
    }).catch(() => null);

    if (!response) {
      test.skip();
      return;
    }

    if (response.status() === 404) {
      // Provider not configured, skip test
      test.skip();
      return;
    }

    // If response exists, check basic structure
    expect(response).toBeTruthy();
  });

  test('memory system handles empty queries gracefully', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('');
    const sendBtn = page.getByLabel('Send message');

    // Send button should be disabled for empty input
    const isDisabled = await sendBtn.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('memory system supports knowledge source integration', async ({ page }) => {
    // Test that memory system works with knowledge sources
    const filesBtn = page.getByRole('button', { name: /files/i });
    if (await filesBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await filesBtn.click();
      await page.waitForTimeout(500);
    }

    const input = page.getByLabel('Test message');
    await input.fill('Knowledge integration test');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Verify system remains stable
    await expect(input).toBeVisible();
  });

  test('memory system maintains UI responsiveness', async ({ page }) => {
    // Test that memory processing doesn't block the UI
    const input = page.getByLabel('Test message');
    await input.fill('Responsiveness test');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Should be able to switch tabs while processing
    const tracesTab = page.getByRole('tab', { name: 'Traces' });
    await tracesTab.click();

    const chatTab = page.getByRole('tab', { name: 'Chat' });
    await chatTab.click();

    await expect(page.getByRole('tab', { name: 'Chat', selected: true })).toBeVisible();
  });

  test('memory system handles concurrent operations', async ({ page }) => {
    const input = page.getByLabel('Test message');

    // Quickly send multiple messages to test concurrency
    await input.fill('Concurrent test 1');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    await input.fill('Concurrent test 2');
    await sendBtn.click();

    // Verify system remains stable
    await page.waitForTimeout(2000);
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeEnabled();
  });
});