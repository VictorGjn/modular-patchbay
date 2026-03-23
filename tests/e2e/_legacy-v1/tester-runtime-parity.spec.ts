import { test, expect } from '@playwright/test';

/**
 * E2E: Verify that tester UI surfaces route through the unified pipeline runtime.
 *
 * ConversationTester and TestPanel both import from pipelineChat and use
 * resolveProviderAndModel + runPipelineChat — no legacy assembleContext path.
 */

test.describe('Tester Runtime Parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('TestPanel chat tab is active and functional', async ({ page }) => {
    const chatTab = page.getByRole('tab', { name: 'Chat' });
    await expect(chatTab).toBeVisible();

    const input = page.getByLabel('Test message');
    await input.fill('Hello agent');
    await expect(input).toHaveValue('Hello agent');

    const sendBtn = page.getByLabel('Send message');
    await expect(sendBtn).toBeEnabled();
  });

  test('no legacy assembleContext import in ConversationTester', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/ConversationTester.tsx'),
      'utf-8',
    );
    expect(content).not.toContain("from '../services/contextAssembler'");
    expect(content).toContain("from '../services/pipelineChat'");
  });

  test('no legacy streamThroughBackend in ConversationTester', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/ConversationTester.tsx'),
      'utf-8',
    );
    expect(content).not.toContain('streamThroughBackend');
  });

  test('both surfaces import from the same pipelineChat module', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const conversationTester = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/ConversationTester.tsx'),
      'utf-8',
    );
    const testPanel = fs.readFileSync(
      path.resolve(__dirname, '../../src/panels/TestPanel.tsx'),
      'utf-8',
    );

    expect(conversationTester).toContain('runPipelineChat');
    expect(conversationTester).toContain('resolveProviderAndModel');
    expect(testPanel).toContain('runPipelineChat');
    expect(testPanel).toContain('resolveProviderAndModel');
  });
});
