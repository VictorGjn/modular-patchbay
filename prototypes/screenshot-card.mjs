import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

// Scroll to bottom to see the agent card
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: 'prototypes/agent-card-live.png', fullPage: true });
console.log('agent-card-live.png done');
await browser.close();
