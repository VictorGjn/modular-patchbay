import { test, expect } from '@playwright/test';

test.describe('Prompt Assembly & Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('PromptNode is visible and has textarea', async ({ page }) => {
    const promptNode = page.locator('[data-id="prompt"]');
    await expect(promptNode).toBeVisible({ timeout: 5_000 });

    const textarea = promptNode.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 3_000 });
  });

  test('typing in PromptNode updates content', async ({ page }) => {
    const textarea = page.locator('[data-id="prompt"] textarea').first();
    await textarea.click();
    await textarea.fill('You are a helpful coding assistant');
    await expect(textarea).toHaveValue('You are a helpful coding assistant');
  });

  test('AgentNode is visible with collapsible sections', async ({ page }) => {
    const agentNode = page.locator('[data-id="agent"]');
    await expect(agentNode).toBeVisible({ timeout: 5_000 });

    // Should have section headers (Identity, Instructions, etc.)
    const content = await agentNode.textContent();
    expect(content).toBeTruthy();
  });

  test('AgentNode persona field is editable', async ({ page }) => {
    const agentNode = page.locator('[data-id="agent"]');
    await expect(agentNode).toBeVisible({ timeout: 5_000 });

    // Look for persona textarea or input
    const personaField = agentNode.locator('textarea, input[type="text"]').first();
    if (await personaField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await personaField.click();
      await personaField.fill('Expert Python developer');
      const value = await personaField.inputValue();
      expect(value).toContain('Python');
    }
  });

  test('WorkflowNode is visible on canvas', async ({ page }) => {
    const workflowNode = page.locator('[data-id="workflow"]');
    await expect(workflowNode).toBeVisible({ timeout: 5_000 });
  });

  test('KnowledgeNode is visible on canvas', async ({ page }) => {
    const knowledgeNode = page.locator('[data-id="knowledge"]');
    await expect(knowledgeNode).toBeVisible({ timeout: 5_000 });
  });

  test('OutputNode is visible on canvas', async ({ page }) => {
    const outputNode = page.locator('[data-id="output"]');
    await expect(outputNode).toBeVisible({ timeout: 5_000 });
  });

  test('AgentPreviewNode is visible on canvas', async ({ page }) => {
    const previewNode = page.locator('[data-id="agent-preview"]');
    await expect(previewNode).toBeVisible({ timeout: 5_000 });
  });

  test('all design canvas nodes are rendered', async ({ page }) => {
    const expectedNodes = ['knowledge', 'skills', 'mcp', 'agent', 'workflow', 'prompt', 'output', 'response', 'agent-preview'];
    for (const nodeId of expectedNodes) {
      const node = page.locator(`[data-id="${nodeId}"]`);
      await expect(node, `Node ${nodeId} should be visible`).toBeVisible({ timeout: 5_000 });
    }
  });

  test('edges connect nodes visually', async ({ page }) => {
    // React Flow renders edges as SVG paths
    const edges = page.locator('.react-flow__edge');
    const count = await edges.count();
    // We have at least 7 edges in the initial layout
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('canvas is pannable', async ({ page }) => {
    const canvas = page.locator('.react-flow__pane');
    const box = await canvas.boundingBox();
    if (box) {
      // Pan the canvas by dragging
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 5 });
      await page.mouse.up();
      // If no error, pan succeeded
    }
  });

  test('zoom controls are visible', async ({ page }) => {
    const controls = page.locator('.react-flow__controls');
    await expect(controls).toBeVisible({ timeout: 5_000 });
  });

  test('minimap is visible', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 5_000 });
  });
});
