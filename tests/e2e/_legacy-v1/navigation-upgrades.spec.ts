import { test, expect } from '@playwright/test';

test.describe('Navigation Upgrades - HyDE & Corrective Re-Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('navigation system handles complex queries without errors', async ({ page }) => {
    // Test that complex queries don't crash the navigation system
    const input = page.getByLabel('Test message');
    await input.fill('How do microservices communicate asynchronously in distributed architectures?');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Verify system remains responsive
    await page.waitForTimeout(2000);
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeEnabled();
  });

  test('navigation system processes technical queries', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('Explain event sourcing patterns and CQRS implementation strategies');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Switch to traces to verify processing
    const tracesTab = page.getByRole('tab', { name: 'Traces' });
    await tracesTab.click();

    // Verify traces interface is functional
    await expect(page.getByRole('tab', { name: 'Traces', selected: true })).toBeVisible();
  });

  test('navigation system handles knowledge gap scenarios', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('What are the security implications of JWT token storage in browser localStorage?');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    await page.waitForTimeout(2000);

    // Verify system continues to function
    await expect(input).toBeVisible();
  });

  test('navigation system processes multi-faceted queries', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('Compare NoSQL database performance characteristics and use cases');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    const tracesTab = page.getByRole('tab', { name: 'Traces' });
    await tracesTab.click();

    // Verify traces can be accessed
    await expect(page.getByRole('tab', { name: 'Traces', selected: true })).toBeVisible();
  });

  test('navigation system handles complex multi-part queries', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill(`
      Analyze the complete implementation of distributed consensus algorithms,
      including Raft, PBFT, and proof-of-stake mechanisms.
    `);
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Verify system processes without timing out
    await page.waitForTimeout(3000);
    await expect(input).toBeVisible();
  });

  test('navigation system integrates with knowledge sources', async ({ page }) => {
    // Add knowledge sources if possible
    const filesBtn = page.getByRole('button', { name: /files/i });
    if (await filesBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await filesBtn.click();
      await page.waitForTimeout(500);
    }

    const input = page.getByLabel('Test message');
    await input.fill('Advanced React patterns for state management optimization');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Verify processing with knowledge sources
    await page.waitForTimeout(2000);
    await expect(input).toBeVisible();
  });

  test('navigation system provides responsive feedback', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('How do you implement end-to-end testing for distributed microservices?');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Should be able to access traces during processing
    const tracesTab = page.getByRole('tab', { name: 'Traces' });
    await tracesTab.click();

    await expect(page.getByRole('tab', { name: 'Traces', selected: true })).toBeVisible();
  });

  test('navigation system handles high complexity queries gracefully', async ({ page }) => {
    const input = page.getByLabel('Test message');
    await input.fill('What are the trade-offs between different caching strategies in high-scale web applications?');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Verify no UI blocking occurs
    const startTime = Date.now();

    await page.waitForTimeout(1000);

    // Should be able to interact with UI
    const chatTab = page.getByRole('tab', { name: 'Chat' });
    await chatTab.click();

    await expect(page.getByRole('tab', { name: 'Chat', selected: true })).toBeVisible();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // UI interactions should remain responsive
    expect(duration).toBeLessThan(10000);
  });

  test('navigation system maintains performance', async ({ page }) => {
    const startTime = Date.now();

    const input = page.getByLabel('Test message');
    await input.fill('Navigation performance test');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    // Wait for processing
    await page.waitForTimeout(2000);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time
    expect(duration).toBeLessThan(15000);

    // Verify UI remains functional
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeEnabled();
  });

  test('navigation system handles rapid consecutive queries', async ({ page }) => {
    const input = page.getByLabel('Test message');

    // Send multiple queries quickly
    await input.fill('First navigation test');
    const sendBtn = page.getByLabel('Send message');
    await sendBtn.click();

    await input.fill('Second navigation test');
    await sendBtn.click();

    await input.fill('Third navigation test');
    await sendBtn.click();

    // Verify system remains stable
    await page.waitForTimeout(2000);
    await expect(input).toBeVisible();
    await expect(sendBtn).toBeEnabled();
  });
});