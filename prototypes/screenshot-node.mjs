import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
page.on('pageerror', err => console.log('ERROR:', err.message));
await page.goto('http://localhost:5173');
await page.waitForTimeout(3500);

// Check if rendered
const btnCount = await page.locator('button').count();
console.log(`Found ${btnCount} buttons`);

// Full page screenshot
await page.screenshot({ path: 'prototypes/agent-node-full.png', fullPage: true });
console.log('agent-node-full.png done');

// Try to zoom out to see the agent preview node on the far right
await page.evaluate(() => {
  // Trigger fitView via keyboard shortcut or scroll
  const canvas = document.querySelector('.react-flow');
  if (canvas) {
    // Zoom out with mouse wheel
    for (let i = 0; i < 5; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, ctrlKey: true, bubbles: true }));
    }
  }
});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'prototypes/agent-node-zoomed.png', fullPage: true });
console.log('agent-node-zoomed.png done');

await browser.close();
