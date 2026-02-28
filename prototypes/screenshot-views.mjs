import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
await page.goto('http://localhost:5173');
await page.waitForTimeout(3000);

// Debug: dump HTML structure
const html = await page.evaluate(() => {
  const el = document.querySelector('[class*="AgentViz"], [class*="agent-viz"]');
  // Check all direct children of root
  const root = document.querySelector('#root');
  if (!root) return 'no #root';
  const children = root.children[0]?.children;
  if (!children) return 'no children';
  let out = '';
  for (let i = 0; i < children.length; i++) {
    out += `[${i}] tag=${children[i].tagName} class="${children[i].className?.slice(0,60)}" h=${children[i].offsetHeight}\n`;
  }
  return out;
});
console.log('Layout:\n' + html);

// Find VIEW button area
const allText = await page.evaluate(() => document.body.innerText.slice(-500));
console.log('Bottom text:', allText.slice(0, 200));

// Try to find the view buttons by looking for all spans/buttons with VIEW or Card text
const viewCount = await page.evaluate(() => {
  const all = document.querySelectorAll('*');
  let count = 0;
  for (const el of all) {
    if (el.children.length === 0 && el.textContent?.includes('VIEW')) count++;
  }
  return count;
});
console.log('VIEW elements:', viewCount);

// Full page screenshot
await page.screenshot({ path: 'prototypes/viz-full.png', fullPage: true });
console.log('viz-full.png done');

await browser.close();
