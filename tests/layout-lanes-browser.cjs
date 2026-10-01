'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireFromHere = createRequire(__filename);
const { chromium, webkit } = requireFromHere('./regression/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'stage.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function waitForEditor(page) {
  await page.waitForFunction(() => Boolean(window.SHOSAI_STAGE_SESSION_BRIDGE && window.GAMMA_WORKSPACE));
}

(async () => {
  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/stage.html`;
  const results = [];
  try {
    for (const [name, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await launcher.launch({ headless: true });
      try {
        const context = await browser.newContext({ viewport: { width: 1700, height: 900 }, locale: 'ja-JP', serviceWorkers: 'block' });
        await context.addInitScript(() => {
          if (window !== top) return;
          const prefs = { panelLayoutMode: 'split', panelLayoutByWorkspace: { normal: 'triple' }, panelSingleSide: 'right', panelSingleSideByWorkspace: { normal: 'right' } };
          localStorage.setItem('gamma:shosai-stage-prefs-v1', JSON.stringify(prefs));
          localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
          if (!sessionStorage.getItem('layout-lanes-started')) {
            localStorage.removeItem('gamma:shosai-stage-layout-auto-tablet-v1');
            sessionStorage.setItem('layout-lanes-started', '1');
          }
          sessionStorage.setItem('layout-lanes-loads', String(Number(sessionStorage.getItem('layout-lanes-loads') || '0') + 1));
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}?feature-test`);
        await waitForEditor(page);
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'three');
        assert.equal(await page.locator('#stage-cue-sheet-open').isVisible(), false, `${name}: PC Q sheet icon hidden`);

        const seen = [];
        async function resize(width, layout) {
          await page.setViewportSize({ width, height: 900 });
          await page.waitForFunction((expected) => document.documentElement.dataset.stageLayout === expected, layout);
          await waitForEditor(page);
          const state = await page.evaluate(() => ({
            width: innerWidth,
            layout: document.documentElement.dataset.stageLayout,
            side: document.documentElement.dataset.stageLayoutSide,
            loads: Number(sessionStorage.getItem('layout-lanes-loads')),
            tablet: document.documentElement.classList.contains('stage-pwa-tablet'),
          }));
          seen.push(state);
          return state;
        }

        assert.equal((await resize(1300, 'two')).loads, 1);
        const boxes = await page.evaluate(() => Object.fromEntries(['stage-col-left', 'stage-col-center', 'stage-col-right'].map((id) => {
          const rect = document.getElementById(id).getBoundingClientRect();
          return [id, { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width }];
        })));
        assert(boxes['stage-col-left'].right <= boxes['stage-col-center'].left + 1, `${name}: left panel beside canvas`);
        assert(boxes['stage-col-center'].right <= boxes['stage-col-right'].left + 1, `${name}: right panel beside canvas`);
        assert(boxes['stage-col-left'].width > 0 && boxes['stage-col-right'].width > 0, `${name}: split panels visible`);
        assert.equal((await resize(900, 'one')).loads, 1);
        const ipad = await resize(600, 'ipad');
        assert.equal(ipad.loads, 2, `${name}: one reload entering iPad shell`);
        assert.equal(ipad.tablet, true);
        await page.locator('#stage-cue-sheet-open').waitFor({ state: 'visible' });
        const backToOne = await resize(900, 'one');
        assert.equal(backToOne.loads, 3, `${name}: one reload leaving iPad shell`);
        assert.equal(backToOne.tablet, false);
        assert.equal(await page.locator('#stage-cue-sheet-open').isVisible(), false);
        assert.equal((await resize(1300, 'two')).loads, 3);
        assert.equal((await resize(1700, 'three')).loads, 3);
        await page.locator('#stage-panels-toggle').click();
        const tripleChoice = page.locator('.stage-panel-visibility-layout button').nth(1);
        assert.equal(await tripleChoice.isEnabled(), true, `${name}: triple choice enabled at 1700px`);
        await tripleChoice.click();
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'three');
        assert.equal(await page.locator('#stage-col-right2').isVisible(), true, `${name}: triple available`);

        await page.setViewportSize({ width: 900, height: 900 });
        await page.goto(`${base}?feature-test&layout-thresholds=500,800,1200`);
        await waitForEditor(page);
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'two');
        await page.locator('.stage-layout-threshold-panel').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => localStorage.getItem('gamma:shosai-stage-layout-thresholds-v1')), '500,800,1200');
        const inputs = page.locator('.stage-layout-threshold-fields input');
        await inputs.nth(1).fill('1000');
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'one');
        await inputs.nth(1).fill('800');
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'two');
        await page.goto(`${base}?feature-test&layout-dev=1`);
        await waitForEditor(page);
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'two');
        await page.getByRole('button', { name: '既定へ戻す' }).click();
        await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'one');
        assert.equal(await page.evaluate(() => localStorage.getItem('gamma:shosai-stage-layout-thresholds-v1')), null);
        assert.deepEqual(errors, [], `${name}: page errors`);
        results.push({ browser: name, scene: 'A-1', widths: seen, automaticReloads: 2, customThresholds: '500,800,1200', errors });
        await context.close();
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
