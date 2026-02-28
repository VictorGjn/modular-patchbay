import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });

await page.goto('file:///C:/Users/victo/AppData/Local/Temp/modular-patchbay/prototypes/agent-viz-circuit.html');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'prototypes/circuit-board.png', fullPage: true });
console.log('circuit-board.png done');

await page.goto('file:///C:/Users/victo/AppData/Local/Temp/modular-patchbay/prototypes/agent-viz-layers.html');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'prototypes/layer-cake.png', fullPage: true });
console.log('layer-cake.png done');

await browser.close();
