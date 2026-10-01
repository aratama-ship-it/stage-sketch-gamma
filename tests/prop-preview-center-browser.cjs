'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const requirePlaywright = createRequire(path.join(root, 'tests/regression/node_modules/playwright/package.json'));
const { chromium, webkit } = requirePlaywright('playwright');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, body) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const results = [];
  try {
    for (const engine of ['chromium', 'webkit']) {
      const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, locale: 'ja-JP' });
        const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
        await page.addInitScript(() => { localStorage.setItem('gamma:shosai-stage-tour-v1', 'done'); localStorage.setItem('gamma:shosai-stage-lang', 'ja'); });
        await page.goto(`http://127.0.0.1:${port}/stage.html?feature-test`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.SHOSAI_STAGE_SESSION_BRIDGE && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === 'gamma-feature-test-v27');
        const started = Date.now();
        await page.locator('button.stage-roster-add-row[data-roster-kind-layer="prop"]').first().click({ force: true });
        await page.waitForSelector('#stage-roster-prop-grid [data-roster-prop-shape] canvas');
        const openedMs = Date.now() - started;
        await page.locator('#stage-roster-prop-grid [data-roster-prop-shape]').evaluateAll(tiles => tiles.forEach(tile => tile.dispatchEvent(new PointerEvent('pointerenter'))));
        const samples = [];
        for (let frame = 0; frame < 8; frame += 1) {
          if (frame) await page.waitForTimeout(1125);
          samples.push(await page.locator('#stage-roster-prop-grid [data-roster-prop-shape]').evaluateAll(tiles => tiles.map(tile => {
            const canvas = tile.querySelector('canvas');
            const width = canvas.width; const height = canvas.height;
            const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
            let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
            for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
              if (data[(y * width + x) * 4 + 3] <= 10) continue;
              x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            }
            return { id: tile.dataset.rosterPropShape, width, height, bounds: x1 < 0 ? null : { x0, y0, x1, y1, dx: (x0 + x1 + 1) / 2 - width / 2, dy: (y0 + y1 + 1) / 2 - height / 2 } };
          })));
        }
        let checked = 0; let maximum = 0;
        samples.forEach((sample, frame) => sample.forEach(item => {
          const bounds = item.bounds;
          assert(bounds, `${engine} ${item.id} frame ${frame}: empty`);
          maximum = Math.max(maximum, Math.abs(bounds.dx), Math.abs(bounds.dy));
          assert(Math.abs(bounds.dx) <= 3 && Math.abs(bounds.dy) <= 3, `${engine} ${item.id} frame ${frame}: center ${bounds.dx},${bounds.dy}`);
          const margins = [bounds.x0, bounds.y0, item.width - 1 - bounds.x1, item.height - 1 - bounds.y1];
          assert(Math.min(...margins) >= 8, `${engine} ${item.id} frame ${frame}: margins ${margins.join(',')}`);
          checked += 1;
        }));
        assert.deepEqual(errors, []);
        results.push({ engine, tiles: samples[0].length, frames: samples.length, checked, maxCenterOffsetPx: maximum, pickerOpenMs: openedMs });
      } finally { await browser.close(); }
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
