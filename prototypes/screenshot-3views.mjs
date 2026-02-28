import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

async function screenshotBottom(name) {
  // Get page dimensions and clip just the bottom portion (agent viz area)
  const dims = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  // Clip bottom 400px
  const clipH = 400;
  await page.screenshot({
    path: `prototypes/${name}.png`,
    clip: { x: 0, y: Math.max(0, dims.h - clipH), width: dims.w, height: clipH },
  });
  console.log(`${name}.png done`);
}

// Card view (default)
await screenshotBottom('viz-1-card');

// Switch to Circuit
await page.evaluate(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent?.includes('Circuit')) { b.click(); break; } }
});
await page.waitForTimeout(500);
await screenshotBottom('viz-2-circuit');

// Switch to Layers
await page.evaluate(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) { if (b.textContent?.includes('Layers')) { b.click(); break; } }
});
await page.waitForTimeout(500);
await screenshotBottom('viz-3-layers');

await browser.close();
