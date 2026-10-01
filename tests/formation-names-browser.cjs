'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const requirePlaywright = createRequire(path.join(root, 'tests/regression/node_modules/playwright/package.json'));
const { chromium, webkit } = requirePlaywright('playwright');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
  const { port } = server.address(); const results = [];
  try {
    for (const engine of ['chromium', 'webkit']) {
      const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
      try {
        for (const count of [2, 6, 20]) {
          const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, locale: 'ja-JP' });
          const members = Array.from({ length: count }, (_, index) => ({ id: `member-${index + 1}`, name: `長い演者名${String(index + 1).padStart(2, '0')}テスト` }));
          await page.addInitScript(context => {
            window.GAMMA_FORMATION_HOST = { context: () => context, apply: () => ({ ok: true }) };
            window.GAMMA_FORMATION_UI = { close() {} };
          }, { members, stage: { width: 12, depth: 9 }, sceneName: `試験場 B-${count}`, basis: {} });
          await page.goto(`http://127.0.0.1:${port}/formation/presets/editor.html`, { waitUntil: 'load' });
          await page.locator('[data-preset]').first().click();
          const measurement = await page.evaluate(() => {
            const people = [...document.querySelectorAll('#board .person')];
            const names = people.map(person => person.querySelector('.person-name'));
            const rects = names.map(element => element.getBoundingClientRect());
            const overlaps = [];
            rects.forEach((a, i) => rects.slice(i + 1).forEach((b, offset) => {
              if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0
                  && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0) overlaps.push([i, i + 1 + offset]);
            }));
            return {
              hitBoxes: people.map(person => { const rect = person.getBoundingClientRect(); return [rect.width, rect.height]; }),
              names: names.map(element => element.textContent), overlaps,
              overview: document.querySelector('#overview').textContent,
            };
          });
          assert.deepEqual(measurement.overlaps, [], `${engine} ${count} names overlap`);
          assert(measurement.hitBoxes.every(([width, height]) => width === 44 && height === 44), `${engine} ${count} hit target changed`);
          assert(measurement.names.every(name => /^長い演者…$/.test(name)), `${engine} ${count} ellipsis`);
          assert(!measurement.overview.includes('長い演者'), `${engine} ${count} overview keeps numbers only`);
          const first = page.locator('#board .person').first(); await first.scrollIntoViewIfNeeded(); const box = await first.boundingBox();
          await first.hover(); await page.mouse.down(); await page.mouse.move(box.x + 42, box.y + 42, { steps: 3 });
          const ghost = page.locator('.drag-ghost'); await ghost.waitFor();
          assert.equal(await ghost.locator('.person-name').textContent(), '長い演者…', `${engine} ${count} ghost name`);
          const ghostBox = await ghost.boundingBox(); assert.equal(ghostBox.width, 44); assert.equal(ghostBox.height, 44);
          await page.mouse.up();
          results.push({ engine, count, preset: await page.locator('#editor-title').textContent(), namesOverlap: 0, hitTargetPx: 44, overviewNumbersOnly: true, dragGhostNamed: true });
          await page.close();
        }
      } finally { await browser.close(); }
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
