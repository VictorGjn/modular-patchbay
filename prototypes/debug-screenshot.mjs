import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2500);

// Check all button text
const buttons = await page.locator('button').all();
console.log(`Found ${buttons.length} buttons`);
for (let i = 0; i < Math.min(buttons.length, 40); i++) {
  const text = (await buttons[i].textContent()).trim().slice(0, 50);
  const visible = await buttons[i].isVisible();
  if (text) console.log(`  [${i}] ${visible ? '✓' : '✗'} "${text}"`);
}

// Check if VIEW text exists anywhere
const viewText = await page.locator('text=VIEW').count();
console.log(`\nVIEW text count: ${viewText}`);
const cardText = await page.locator('text=Card').count();
console.log(`Card text count: ${cardText}`);

// Full page height
const height = await page.evaluate(() => document.body.scrollHeight);
console.log(`Page height: ${height}`);

await browser.close();
