import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'shot-login.png' });
console.log('saved shot-login.png');

await page.fill('input[type=email]', 'admin@library.local');
await page.fill('input[type=password]', 'Passw0rd!');
await page.click('button[type=submit]');
await page.waitForURL('**/catalog', { timeout: 15000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shot-catalog.png' });
console.log('saved shot-catalog.png');

const imgs = await page.locator('img').count();
const withSrc = await page.locator('img[src^="https://covers.openlibrary.org"]').count();
console.log(`catalog imgs: ${imgs}, openlibrary-src: ${withSrc}`);

await page.locator('a[href^="/catalog/"]').first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'shot-book.png' });
console.log('saved shot-book.png');

console.log(errors.length ? 'JS ERRORS:\n' + errors.slice(0,4).join('\n') : 'no JS errors');
await browser.close();
