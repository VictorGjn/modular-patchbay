import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('ERROR:', err.message));
await page.goto('http://localhost:5173');
await page.waitForTimeout(4000);
await browser.close();
