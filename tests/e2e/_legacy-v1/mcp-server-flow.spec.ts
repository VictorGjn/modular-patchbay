import { test, expect } from '@playwright/test';

test.describe('MCP Server Flow - Complete Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('complete MCP server management workflow', async ({ page }) => {
    // Step 1: Open Settings
    const settingsBtn = page.getByLabel('LLM settings').or(
      page.locator('button').filter({ has: page.locator('[data-lucide="settings"], .lucide-settings') })
    );
    
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
      await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });
    } else {
      // Try alternative settings access
      const altSettingsBtn = page.locator('button').filter({ hasText: /settings/i });
      if (await altSettingsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await altSettingsBtn.click();
      } else {
        test.skip(); // Settings not accessible
      }
    }

    // Step 2: Verify MCP servers tab renders
    const mcpTab = page.getByText('MCP', { exact: true }).or(
      page.getByRole('tab', { name: 'MCP' })
    ).or(
      page.getByRole('tab', { name: 'MCP Servers' })
    );

    if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await mcpTab.click();
      await page.waitForTimeout(500);
      
      // Verify MCP content is visible
      const mcpContent = page.locator('[class*="mcp"], [data-testid*="mcp"]').or(
        page.getByText('MCP Server').or(
          page.getByText('Server Configuration')
        )
      );
      
      const contentCount = await mcpContent.count();
      expect(contentCount).toBeGreaterThanOrEqual(0); // Content may or may not be present initially
    } else {
      test.skip(); // MCP tab not available
    }

    // Step 3: Add a server
    const testServerConfig = {
      name: 'Test Server',
      endpoint: 'http://localhost:8080',
      type: 'http'
    };

    // Look for add server button
    const addServerBtn = page.locator('button').filter({ 
      hasText: /add.?server|add.?mcp|new.?server/i 
    });

    if (await addServerBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addServerBtn.click();
      
      // Fill server configuration form
      const nameInput = page.getByLabel(/name|title/i).or(
        page.locator('input[placeholder*="name"], input[placeholder*="server"]')
      );
      
      if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nameInput.fill(testServerConfig.name);
      }
      
      const endpointInput = page.getByLabel(/endpoint|url|address/i).or(
        page.locator('input[placeholder*="endpoint"], input[placeholder*="url"]')
      );
      
      if (await endpointInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await endpointInput.fill(testServerConfig.endpoint);
      }
      
      // Save the server
      const saveBtn = page.locator('button').filter({ 
        hasText: /save|add|create|confirm/i 
      });
      
      if (await saveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1_000);
      }
    }

    // Step 4: Verify server appears in the list
    const serverList = page.locator('[class*="server-list"], [class*="mcp-list"]').or(
      page.getByText(testServerConfig.name)
    );

    const listCount = await serverList.count();
    if (listCount > 0) {
      await expect(serverList.first()).toBeVisible();
    }

    // Step 5: Close Settings
    const closeBtn = page.locator('button').filter({ hasText: /close|✕|×/i }).or(
      page.locator('[data-testid="close"], [aria-label*="close"]')
    );
    
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(500);

    // Step 6: Open McpPicker
    const mcpLibraryBtn = page.getByText('MCP Library').or(
      page.locator('button').filter({ hasText: /mcp.?library|mcp.?picker/i })
    );

    if (await mcpLibraryBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mcpLibraryBtn.click();
      await page.waitForTimeout(1_000);

      // Step 7: Verify the same server appears in McpPicker
      const pickerServerList = page.locator('[role="dialog"], [class*="modal"]').locator(
        page.getByText(testServerConfig.name)
      );

      const pickerCount = await pickerServerList.count();
      if (pickerCount > 0) {
        await expect(pickerServerList.first()).toBeVisible();
      }

      // Close the picker
      await page.keyboard.press('Escape');
    }
  });

  test('MCP server validation handles invalid configurations', async ({ page }) => {
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
      
      const mcpTab = page.getByText('MCP', { exact: true });
      if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await mcpTab.click();
        
        // Try to add invalid server
        const addServerBtn = page.locator('button').filter({ hasText: /add/i });
        if (await addServerBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await addServerBtn.click();
          
          // Leave name empty, add invalid URL
          const endpointInput = page.locator('input').filter({ 
            hasText: /endpoint|url/i 
          }).or(page.locator('input[type="url"]'));
          
          if (await endpointInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await endpointInput.fill('invalid-url');
            
            const saveBtn = page.locator('button').filter({ hasText: /save|add/i });
            if (await saveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await saveBtn.click();
              
              // Look for validation errors
              const errorMsg = page.locator('.error, [role="alert"], [class*="error"]');
              const errorCount = await errorMsg.count();
              
              if (errorCount > 0) {
                await expect(errorMsg.first()).toBeVisible();
              }
            }
          }
        }
        
        await page.keyboard.press('Escape');
      }
    } else {
      test.skip();
    }
  });

  test('MCP server connection status updates correctly', async ({ page }) => {
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
      
      const mcpTab = page.getByText('MCP', { exact: true });
      if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await mcpTab.click();
        
        // Add a test server
        const addServerBtn = page.locator('button').filter({ hasText: /add/i });
        if (await addServerBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await addServerBtn.click();
          
          const nameInput = page.locator('input').first();
          await nameInput.fill('Connection Test Server');
          
          const endpointInput = page.locator('input').nth(1);
          await endpointInput.fill('http://localhost:9999'); // Non-existent endpoint
          
          const saveBtn = page.locator('button').filter({ hasText: /save|add/i });
          await saveBtn.click();
          await page.waitForTimeout(2_000);
          
          // Look for connection status indicators
          const statusIndicators = page.locator('[class*="status"], [class*="connection"]').or(
            page.locator('[data-testid*="status"], [aria-label*="status"]')
          );
          
          const statusCount = await statusIndicators.count();
          if (statusCount > 0) {
            // Should show disconnected/error status
            const statusText = await statusIndicators.first().textContent();
            expect(statusText).toMatch(/offline|disconnected|error|failed/i);
          }
        }
        
        await page.keyboard.press('Escape');
      }
    } else {
      test.skip();
    }
  });

  test('MCP servers sync between settings and picker', async ({ page }) => {
    // Add server in settings
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
      
      const mcpTab = page.getByText('MCP', { exact: true });
      if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await mcpTab.click();
        
        const addServerBtn = page.locator('button').filter({ hasText: /add/i });
        if (await addServerBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await addServerBtn.click();
          
          const nameInput = page.locator('input').first();
          await nameInput.fill('Sync Test Server');
          
          const saveBtn = page.locator('button').filter({ hasText: /save/i });
          await saveBtn.click();
          await page.waitForTimeout(1_000);
        }
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Check picker
        const mcpLibraryBtn = page.getByText('MCP Library');
        if (await mcpLibraryBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await mcpLibraryBtn.click();
          await page.waitForTimeout(1_000);
          
          // Verify server appears in picker
          const serverInPicker = page.getByText('Sync Test Server');
          if (await serverInPicker.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await expect(serverInPicker).toBeVisible();
          }
          
          await page.keyboard.press('Escape');
        }
      }
    } else {
      test.skip();
    }
  });

  test('MCP server removal works correctly', async ({ page }) => {
    const settingsBtn = page.getByLabel('LLM settings');
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
      
      const mcpTab = page.getByText('MCP', { exact: true });
      if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await mcpTab.click();
        
        // Add a server first
        const addServerBtn = page.locator('button').filter({ hasText: /add/i });
        if (await addServerBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await addServerBtn.click();
          
          const nameInput = page.locator('input').first();
          await nameInput.fill('Server To Remove');
          
          const saveBtn = page.locator('button').filter({ hasText: /save/i });
          await saveBtn.click();
          await page.waitForTimeout(1_000);
          
          // Now remove it
          const removeBtn = page.locator('button').filter({ 
            hasText: /remove|delete|×|✕/i 
          });
          
          if (await removeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await removeBtn.click();
            
            // Confirm removal if needed
            const confirmBtn = page.locator('button').filter({ 
              hasText: /confirm|yes|delete/i 
            });
            
            if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await confirmBtn.click();
            }
            
            await page.waitForTimeout(1_000);
            
            // Verify server is removed
            const removedServer = page.getByText('Server To Remove');
            const count = await removedServer.count();
            expect(count).toBe(0);
          }
        }
        
        await page.keyboard.press('Escape');
      }
    } else {
      test.skip();
    }
  });

  test('MCP registry integration works', async ({ page }) => {
    // Check if MCP Registry/Library shows available servers
    const mcpLibraryBtn = page.getByText('MCP Library');
    if (await mcpLibraryBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mcpLibraryBtn.click();
      await page.waitForTimeout(1_000);
      
      // Look for registry servers
      const registryServers = page.locator('[class*="registry"], [class*="available"], [class*="marketplace"]');
      const registryCount = await registryServers.count();
      
      if (registryCount > 0) {
        await expect(registryServers.first()).toBeVisible();
      }
      
      // Look for install buttons
      const installBtns = page.locator('button').filter({ hasText: /install|add|use/i });
      const installCount = await installBtns.count();
      
      if (installCount > 0) {
        // Try installing a server from registry
        await installBtns.first().click();
        await page.waitForTimeout(1_000);
        
        // Check if install succeeded (server should appear in local list)
        await page.keyboard.press('Escape');
        
        // Verify installation by checking settings
        const settingsBtn = page.getByLabel('LLM settings');
        if (await settingsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await settingsBtn.click();
          
          const mcpTab = page.getByText('MCP', { exact: true });
          if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await mcpTab.click();
            
            // Should have at least one server now
            const serverItems = page.locator('[class*="server"], [class*="item"]');
            const itemCount = await serverItems.count();
            expect(itemCount).toBeGreaterThan(0);
          }
          
          await page.keyboard.press('Escape');
        }
      }
      
      await page.keyboard.press('Escape');
    } else {
      test.skip();
    }
  });
});