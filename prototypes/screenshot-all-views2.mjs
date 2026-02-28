import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Scroll to bottom to find the view switcher
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);

// Screenshot Card view
await page.screenshot({ path: 'prototypes/viz-card.png', fullPage: true });
console.log('viz-card.png done');

// Find and click Circuit
try {
  const buttons = await page.locator('button').all();
  for (const btn of buttons) {
    const text = await btn.textContent();
    if (text && text.includes('Circuit')) {
      await btn.click();
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'prototypes/viz-circuit.png', fullPage: true });
      console.log('viz-circuit.png done');
      break;
    }
  }
} catch(e) { console.log('Circuit click failed:', e.message); }

// Find and click Layers
try {
  const buttons = await page.locator('button').all();
  for (const btn of buttons) {
    const text = await btn.textContent();
    if (text && text.includes('Layers')) {
      await btn.click();
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'prototypes/viz-layers.png', fullPage: true });
      console.log('viz-layers.png done');
      break;
    }
  }
} catch(e) { console.log('Layers click failed:', e.message); }

await browser.close();
