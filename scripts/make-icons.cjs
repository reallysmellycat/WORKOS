// Renders public/favicon.svg into the PNG icons the PWA manifest needs.
// Run with: node scripts/make-icons.cjs  (needs Playwright; only required if you change the icon)
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');
(async () => {
const svg = readFileSync(path.join(__dirname, '../public/favicon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, name, pad] of [[192, 'pwa-192.png', 0], [512, 'pwa-512.png', 0], [180, 'apple-touch-icon.png', 0]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#2F3A33">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(__dirname, '../public', name), omitBackground: false });
}
await browser.close();
console.log('icons written');
})();
