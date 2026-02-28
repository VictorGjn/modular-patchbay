import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1000 } });
const page = await ctx.newPage();

// Set light theme before loading
await page.addInitScript(() => {
  localStorage.setItem('modular-theme', 'light');
});

await page.goto('http://localhost:5173');
await page.waitForTimeout(4000);

// Full view
await page.screenshot({ path: 'prototypes/light-full.png' });
console.log('light-full.png done');

// Zoomed out
await page.evaluate(() => {
  const rf = document.querySelector('.react-flow');
  if (rf) {
    for (let i = 0; i < 5; i++) {
      rf.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, ctrlKey: true, bubbles: true }));
    }
  }
});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'prototypes/light-zoomed.png' });
console.log('light-zoomed.png done');

await browser.close();
