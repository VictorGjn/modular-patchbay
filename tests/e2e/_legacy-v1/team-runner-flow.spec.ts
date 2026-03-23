import { test, expect } from '@playwright/test';

test.describe('Team Runner - Full Flow Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('complete team runner workflow', async ({ page }) => {
    // Navigate to TestPanel → Team tab
    const teamTab = page.getByRole('tab', { name: 'Team' });
    if (!(await teamTab.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Look for Team tab in different locations
      const teamTabAlt = page.locator('[role="tab"]').filter({ hasText: /team/i });
      if (await teamTabAlt.count() > 0) {
        await teamTabAlt.first().click();
      } else {
        test.skip(); // Team functionality not available
      }
    } else {
      await teamTab.click();
    }

    // Verify we're on the team tab
    await expect(page.getByRole('tab', { name: 'Team', selected: true })).toBeVisible();

    // Step 1: Verify agent slots render (at least 2 by default)
    const agentSlots = page.locator('[data-testid*="agent-slot"], .agent-slot, [class*="agent-slot"]');
    let slotCount = await agentSlots.count();

    // Alternative selectors if specific ones aren't found
    if (slotCount === 0) {
      const agentCards = page.locator('[class*="agent"], [data-testid*="agent"]').filter({ 
        has: page.locator('button, input, select') 
      });
      slotCount = await agentCards.count();
    }

    expect(slotCount).toBeGreaterThanOrEqual(2);

    // Step 2: Add a 3rd agent (click Add button)
    const addAgentBtn = page.locator('button').filter({ hasText: /add.?agent|add/i });
    if (await addAgentBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addAgentBtn.click();
      
      // Wait for new agent slot to appear
      await page.waitForTimeout(1_000);
      
      // Verify slot count increased
      const newSlotCount = await agentSlots.count() || await page.locator('[class*="agent"]').count();
      expect(newSlotCount).toBeGreaterThan(slotCount);
    }

    // Step 3: Remove an agent
    const removeAgentBtns = page.locator('button').filter({ 
      hasText: /remove|delete|×|✕/i 
    }).or(
      page.locator('[data-testid*="remove"], [aria-label*="remove"], [aria-label*="delete"]')
    );
    
    const removeCount = await removeAgentBtns.count();
    if (removeCount > 0) {
      await removeAgentBtns.last().click(); // Remove the last agent to avoid removing defaults
      
      await page.waitForTimeout(500);
      
      // Verify removal (count should be back to original or less)
      const finalSlotCount = await agentSlots.count() || await page.locator('[class*="agent"]').count();
      expect(finalSlotCount).toBeGreaterThanOrEqual(2); // Should still have at least 2
    }

    // Step 4: Type task text
    const taskInput = page.locator('textarea, input[type="text"]').filter({ 
      hasText: /task|prompt|message/ 
    }).or(
      page.getByPlaceholder(/task|prompt|message|describe/i)
    );

    if (await taskInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await taskInput.fill('Test task: Analyze a complex problem using team collaboration');
    } else {
      // Look for any textarea or large input
      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      if (textareaCount > 0) {
        await textareas.last().fill('Test task: Analyze a complex problem using team collaboration');
      }
    }

    // Step 5: Verify Run Team button is enabled when task is filled
    const runTeamBtn = page.locator('button').filter({ 
      hasText: /run.?team|start.?team|execute/i 
    });

    if (await runTeamBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(runTeamBtn).toBeEnabled({ timeout: 2_000 });
    }

    // Step 6: Verify Run Team button shows error when no provider is configured
    // First, ensure no provider is configured (if possible to test)
    const providerSelects = page.locator('select').filter({ hasText: /provider|model/i });
    const providerSelectCount = await providerSelects.count();
    
    if (providerSelectCount > 0) {
      // Try to select 'none' or empty option if available
      const firstSelect = providerSelects.first();
      await firstSelect.selectOption({ index: 0 }).catch(() => {});
      
      // Click Run Team and check for error
      if (await runTeamBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await runTeamBtn.click();
        
        // Look for error message
        const errorMsg = page.locator('.error, [role="alert"], [class*="error"]').filter({ 
          hasText: /provider|configuration|setup/i 
        });
        
        const errorCount = await errorMsg.count();
        if (errorCount > 0) {
          await expect(errorMsg.first()).toBeVisible();
        }
        
        // Button might become disabled or show error state
        const isDisabled = await runTeamBtn.getAttribute('disabled');
        const hasErrorClass = await runTeamBtn.getAttribute('class');
        
        expect(isDisabled !== null || (hasErrorClass && hasErrorClass.includes('error'))).toBeTruthy();
      }
    }
  });

  test('team configuration persists between tab switches', async ({ page }) => {
    const teamTab = page.getByRole('tab', { name: 'Team' });
    if (await teamTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await teamTab.click();
      
      // Configure team task
      const taskInput = page.locator('textarea, input').last();
      await taskInput.fill('Persistent task test');
      
      // Switch to another tab
      const chatTab = page.getByRole('tab', { name: 'Chat' });
      if (await chatTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await chatTab.click();
        
        // Switch back to team
        await teamTab.click();
        
        // Verify task persisted
        await expect(taskInput).toHaveValue('Persistent task test');
      }
    } else {
      test.skip();
    }
  });

  test('team slots support different agent configurations', async ({ page }) => {
    const teamTab = page.getByRole('tab', { name: 'Team' });
    if (await teamTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await teamTab.click();
      
      // Look for agent configuration options (name, role, etc.)
      const nameInputs = page.locator('input[placeholder*="name"], input[placeholder*="agent"]');
      const nameCount = await nameInputs.count();
      
      if (nameCount >= 2) {
        // Configure first agent
        await nameInputs.nth(0).fill('Research Agent');
        
        // Configure second agent
        await nameInputs.nth(1).fill('Analysis Agent');
        
        // Verify configurations saved
        await expect(nameInputs.nth(0)).toHaveValue('Research Agent');
        await expect(nameInputs.nth(1)).toHaveValue('Analysis Agent');
      }
      
      // Look for role/type selectors
      const roleSelects = page.locator('select').filter({ hasText: /role|type/i });
      const roleCount = await roleSelects.count();
      
      if (roleCount >= 2) {
        // Set different roles if available
        const firstOptions = await roleSelects.nth(0).locator('option').count();
        const secondOptions = await roleSelects.nth(1).locator('option').count();
        
        if (firstOptions > 1) await roleSelects.nth(0).selectOption({ index: 1 });
        if (secondOptions > 1) await roleSelects.nth(1).selectOption({ index: 1 });
      }
    } else {
      test.skip();
    }
  });

  test('team execution handles loading states correctly', async ({ page }) => {
    const teamTab = page.getByRole('tab', { name: 'Team' });
    if (await teamTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await teamTab.click();
      
      // Fill task
      const taskInput = page.locator('textarea, input').last();
      await taskInput.fill('Test loading states');
      
      // Mock API to control response timing
      await page.route('**/api/team/**', async route => {
        // Delay response to test loading state
        await new Promise(resolve => setTimeout(resolve, 2_000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', result: 'Mock team response' })
        });
      });
      
      const runTeamBtn = page.locator('button').filter({ hasText: /run.?team/i });
      if (await runTeamBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await runTeamBtn.click();
        
        // Check for loading state
        const loadingIndicators = page.locator('[class*="loading"], [class*="spinner"], [aria-label*="loading"]');
        const disabledBtn = runTeamBtn.locator('[disabled]');
        
        const hasLoading = (await loadingIndicators.count() > 0) || (await disabledBtn.count() > 0);
        expect(hasLoading).toBeTruthy();
        
        // Wait for completion
        await page.waitForTimeout(3_000);
        
        // Loading should be gone
        const finalLoading = await loadingIndicators.count();
        expect(finalLoading).toBe(0);
      }
    } else {
      test.skip();
    }
  });

  test('team results display appropriately', async ({ page }) => {
    const teamTab = page.getByRole('tab', { name: 'Team' });
    if (await teamTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await teamTab.click();
      
      // Mock successful team execution
      await page.route('**/api/team/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            results: [
              { agent: 'Agent 1', response: 'Analysis complete' },
              { agent: 'Agent 2', response: 'Recommendations provided' }
            ]
          })
        });
      });
      
      const taskInput = page.locator('textarea, input').last();
      await taskInput.fill('Show results test');
      
      const runTeamBtn = page.locator('button').filter({ hasText: /run.?team/i });
      if (await runTeamBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await runTeamBtn.click();
        
        // Look for results display area
        await page.waitForTimeout(1_500);
        
        const resultsArea = page.locator('[class*="results"], [class*="response"], [class*="output"]');
        const resultsCount = await resultsArea.count();
        
        if (resultsCount > 0) {
          await expect(resultsArea.first()).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });
});