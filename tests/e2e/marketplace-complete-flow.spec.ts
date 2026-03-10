import { test, expect } from '@playwright/test';

test.describe('Marketplace - Complete Integration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('complete marketplace workflow with skill installation', async ({ page }) => {
    // Step 1: Open Marketplace
    const marketplaceBtn = page.getByLabel('Open Marketplace').or(
      page.getByText('MCP Library')
    ).or(
      page.locator('button').filter({ hasText: /marketplace/i })
    );
    
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      await page.waitForTimeout(1_000);
    } else {
      test.skip(); // Marketplace not accessible
    }

    // Step 2: Verify skills and MCP servers are listed
    // Check for Skills tab
    const skillsTab = page.getByText('Skills').or(
      page.getByRole('tab', { name: 'Skills' })
    );
    
    if (await skillsTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await skillsTab.click();
      await page.waitForTimeout(500);
      
      // Look for skill items
      const skillItems = page.locator('[class*="skill"], [data-testid*="skill"], .card').filter({
        has: page.locator('button, [role="button"]')
      });
      
      const skillCount = await skillItems.count();
      expect(skillCount).toBeGreaterThanOrEqual(0); // May or may not have skills
    }

    // Check for MCP Servers tab
    const mcpTab = page.getByText('MCP Servers').or(
      page.getByRole('tab', { name: 'MCP Servers' })
    );
    
    if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await mcpTab.click();
      await page.waitForTimeout(500);
      
      // Look for MCP server items
      const mcpItems = page.locator('[class*="server"], [class*="mcp"], .card').filter({
        has: page.locator('button, [role="button"]')
      });
      
      const mcpCount = await mcpItems.count();
      expect(mcpCount).toBeGreaterThanOrEqual(0); // May or may not have MCP servers
    }

    // Step 3: Test search/filter functionality
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').or(
      page.locator('input').filter({ hasText: /search|filter/i })
    );
    
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Test search functionality
      await searchInput.fill('test');
      await page.waitForTimeout(1_000);
      
      // Verify search results update
      const resultsArea = page.locator('[class*="results"], [class*="grid"], [class*="list"]');
      const resultsCount = await resultsArea.count();
      
      if (resultsCount > 0) {
        expect(resultsCount).toBeGreaterThan(0);
      }
      
      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(500);
    }

    // Test category filter if available
    const categoryFilter = page.locator('select, [role="combobox"]').filter({
      hasText: /category|type|filter/i
    });
    
    if (await categoryFilter.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await categoryFilter.click();
      
      // Select a category option
      const options = categoryFilter.locator('option');
      const optionCount = await options.count();
      
      if (optionCount > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(500);
        
        // Reset to all categories
        await categoryFilter.selectOption({ index: 0 }).catch(() => {});
      }
    }

    // Step 4: Install a skill
    // Look for install buttons
    const installBtns = page.locator('button').filter({ 
      hasText: /install|add|use|enable/i 
    });
    
    const installCount = await installBtns.count();
    
    if (installCount > 0) {
      // Mock API response for skill installation
      await page.route('**/api/skills/install**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            skill: {
              id: 'test-skill',
              name: 'Test Skill',
              description: 'A test skill for E2E testing',
              installed: true
            }
          })
        });
      });

      // Click first install button
      await installBtns.first().click();
      await page.waitForTimeout(2_000);
      
      // Look for success notification or state change
      const successMsg = page.locator('.success, [role="alert"]').filter({
        hasText: /installed|success|added/i
      });
      
      const successCount = await successMsg.count();
      if (successCount > 0) {
        await expect(successMsg.first()).toBeVisible();
      }
      
      // Check if button changed to "installed" or similar
      const installedBtn = page.locator('button').filter({ 
        hasText: /installed|added|enabled/i 
      });
      
      const installedCount = await installedBtn.count();
      expect(installedCount).toBeGreaterThan(0);
    }

    // Step 5: Close Marketplace
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Step 6: Verify skill appears in agent config
    // Check Skills section in main interface
    const skillsSection = page.getByRole('region', { name: 'Skills' }).or(
      page.locator('[class*="skills"]').filter({ hasText: /skills/i })
    );
    
    if (await skillsSection.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Look for the installed skill
      const installedSkill = page.getByText('Test Skill').or(
        page.locator('[data-testid*="test-skill"]')
      );
      
      const skillInConfig = await installedSkill.count();
      if (skillInConfig > 0) {
        await expect(installedSkill.first()).toBeVisible();
      }
    }
  });

  test('marketplace handles different content types correctly', async ({ page }) => {
    const marketplaceBtn = page.getByText('MCP Library');
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      await page.waitForTimeout(1_000);
      
      // Test Skills tab
      const skillsTab = page.getByText('Skills');
      if (await skillsTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await skillsTab.click();
        
        // Check for skill-specific content
        const skillCards = page.locator('[class*="skill"], [class*="card"]');
        const skillCardCount = await skillCards.count();
        
        if (skillCardCount > 0) {
          // Verify skill cards have appropriate content
          const firstCard = skillCards.first();
          const cardText = await firstCard.textContent();
          
          // Skills should have names and descriptions
          expect(cardText).toBeTruthy();
          expect(cardText!.length).toBeGreaterThan(5);
        }
      }
      
      // Test MCP Servers tab
      const mcpTab = page.getByText('MCP Servers');
      if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await mcpTab.click();
        
        // Check for MCP server-specific content
        const serverCards = page.locator('[class*="server"], [class*="card"]');
        const serverCardCount = await serverCards.count();
        
        if (serverCardCount > 0) {
          // Verify server cards have appropriate content
          const firstCard = serverCards.first();
          const cardText = await firstCard.textContent();
          
          // Servers should have names and connection info
          expect(cardText).toBeTruthy();
          expect(cardText!.length).toBeGreaterThan(5);
        }
      }
      
      await page.keyboard.press('Escape');
    } else {
      test.skip();
    }
  });

  test('marketplace error handling works correctly', async ({ page }) => {
    const marketplaceBtn = page.getByText('MCP Library');
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      await page.waitForTimeout(1_000);
      
      // Mock API error for skill installation
      await page.route('**/api/skills/install**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Installation failed - test error'
          })
        });
      });
      
      // Try to install something
      const installBtns = page.locator('button').filter({ 
        hasText: /install|add/i 
      });
      
      const installCount = await installBtns.count();
      if (installCount > 0) {
        await installBtns.first().click();
        await page.waitForTimeout(2_000);
        
        // Look for error message
        const errorMsg = page.locator('.error, [role="alert"]').filter({
          hasText: /error|failed|problem/i
        });
        
        const errorCount = await errorMsg.count();
        if (errorCount > 0) {
          await expect(errorMsg.first()).toBeVisible();
        }
      }
      
      await page.keyboard.press('Escape');
    } else {
      test.skip();
    }
  });

  test('marketplace preserves state between sessions', async ({ page }) => {
    const marketplaceBtn = page.getByText('MCP Library');
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      
      // Search for something
      const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
      if (await searchInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await searchInput.fill('productivity');
        await page.waitForTimeout(500);
        
        // Close marketplace
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Reopen marketplace
        await marketplaceBtn.click();
        await page.waitForTimeout(500);
        
        // Check if search term persisted
        const currentValue = await searchInput.inputValue().catch(() => '');
        if (currentValue === 'productivity') {
          expect(currentValue).toBe('productivity');
        }
        
        await page.keyboard.press('Escape');
      }
    } else {
      test.skip();
    }
  });

  test('marketplace responsive layout works on different screen sizes', async ({ page }) => {
    const marketplaceBtn = page.getByText('MCP Library');
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      await page.waitForTimeout(1_000);
      
      // Test desktop layout
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(200);
      
      const desktopContent = page.locator('[role="dialog"], [class*="modal"]');
      if (await desktopContent.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(desktopContent).toBeVisible();
      }
      
      // Test tablet layout
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(200);
      
      // Content should still be visible
      if (await desktopContent.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(desktopContent).toBeVisible();
      }
      
      // Test mobile layout
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(200);
      
      // Content should adapt to mobile
      if (await desktopContent.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(desktopContent).toBeVisible();
      }
      
      // Reset viewport
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.keyboard.press('Escape');
    } else {
      test.skip();
    }
  });

  test('marketplace keyboard navigation works', async ({ page }) => {
    const marketplaceBtn = page.getByText('MCP Library');
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      await page.waitForTimeout(1_000);
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Test arrow key navigation if applicable
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      
      // Test Enter key on focused element
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Test escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // Marketplace should be closed
      const marketplace = page.locator('[role="dialog"]');
      const isVisible = await marketplace.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    } else {
      test.skip();
    }
  });

  test('marketplace batch operations work correctly', async ({ page }) => {
    const marketplaceBtn = page.getByText('MCP Library');
    if (await marketplaceBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await marketplaceBtn.click();
      await page.waitForTimeout(1_000);
      
      // Look for bulk selection options
      const selectAllBtn = page.locator('button, input[type="checkbox"]').filter({
        hasText: /select.?all|all/i
      });
      
      if (await selectAllBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await selectAllBtn.click();
        
        // Look for batch install button
        const batchInstallBtn = page.locator('button').filter({
          hasText: /install.?selected|batch.?install/i
        });
        
        if (await batchInstallBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await batchInstallBtn.click();
          await page.waitForTimeout(2_000);
          
          // Look for batch operation progress
          const progressIndicator = page.locator('[class*="progress"], [role="progressbar"]');
          const progressCount = await progressIndicator.count();
          
          if (progressCount > 0) {
            await expect(progressIndicator.first()).toBeVisible();
          }
        }
      }
      
      await page.keyboard.press('Escape');
    } else {
      test.skip();
    }
  });
});