import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Screenshot full page for Card view (default)
await page.screenshot({ path: 'prototypes/viz-card.png', fullPage: true });
console.log('viz-card.png done');

// Click Circuit button
const circuitBtn = page.locator('button:has-text("Circuit")');
if (await circuitBtn.count() > 0) {
  await circuitBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'prototypes/viz-circuit.png', fullPage: true });
  console.log('viz-circuit.png done');
}

// Click Layers button
const layersBtn = page.locator('button:has-text("Layers")');
if (await layersBtn.count() > 0) {
  await layersBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'prototypes/viz-layers.png', fullPage: true });
  console.log('viz-layers.png done');
}

await browser.close();
