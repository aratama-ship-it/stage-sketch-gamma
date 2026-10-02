'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const requirePlaywright = createRequire(path.join(root, 'tests/regression/node_modules/playwright/package.json'));
const { chromium, webkit } = requirePlaywright('playwright');
const reportDir = path.join(root, 'REPORT-w4');
const sheetIds = ['lyra_gazelle', 'chest_stand', 'backbend_standing', 'bridge_hold', 'stand', 'walk'];
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

function neckWarnings() {
  const source = fs.readFileSync(path.join(root, 'stage-sketch.js'), 'utf8');
  const start = source.indexOf('  const BASE_JOINTS = {');
  const end = source.indexOf('\n  const POSE_PROPS =', start);
  assert(start >= 0 && end > start, 'pose source block');
  const context = {}; vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nthis.POSES = POSES; this.BASE_JOINTS = BASE_JOINTS;', context);
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const ratio = joints => {
    const shoulder = joints.shL.map((value, index) => (value + joints.shR[index]) / 2);
    const baseShoulder = context.BASE_JOINTS.shL.map((value, index) => (value + context.BASE_JOINTS.shR[index]) / 2);
    return distance(joints.neck, shoulder) / distance(context.BASE_JOINTS.neck, baseShoulder);
  };
  return context.POSES.map(pose => ({ id: pose.id, ratio: ratio(pose.joints) })).filter(row => row.ratio > 2).sort((a, b) => b.ratio - a.ratio);
}

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
        await page.waitForFunction(() => window.SHOSAI_STAGE_SESSION_BRIDGE && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === 'gamma-feature-test-v31');
        await page.locator('button.stage-roster-add-row[data-roster-kind-layer="performer"]').first().click({ force: true });
        await page.waitForSelector('[data-roster-pose] canvas');
        const poses = await page.locator('[data-roster-pose]').evaluateAll((tiles, screenshotIds) => tiles.map(tile => {
          const canvas = tile.querySelector('canvas'); const width = canvas.width; const height = canvas.height;
          const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
          const on = new Uint8Array(width * height); const seen = new Uint8Array(width * height); const components = [];
          for (let index = 0; index < on.length; index += 1) on[index] = rgba[index * 4 + 3] > 40 ? 1 : 0;
          for (let start = 0; start < on.length; start += 1) {
            if (!on[start] || seen[start]) continue;
            let size = 0; const stack = [start]; seen[start] = 1;
            while (stack.length) {
              const current = stack.pop(); size += 1; const x = current % width; const y = Math.floor(current / width);
              for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
                const nx = x + dx; const ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const next = ny * width + nx; if (on[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
              }
            }
            components.push(size);
          }
          components.sort((a, b) => b - a);
          return { id: tile.dataset.rosterPose, components, image: screenshotIds.includes(tile.dataset.rosterPose) ? canvas.toDataURL('image/png') : null };
        }), sheetIds);
        assert(!poses.some(pose => pose.id === 'bridge_hold'), `${engine} bridge_hold is hidden from the pose picker`);
        const disconnected = poses.filter(pose => pose.components.length !== 1).map(pose => ({ id: pose.id, components: pose.components }));
        if (process.env.POSE_ALLOW_BROKEN !== '1') assert.deepEqual(disconnected, [], `${engine} disconnected poses`);
        const viewChecks = await page.evaluate(ids => {
          const countComponents = canvas => {
            const width = canvas.width; const height = canvas.height;
            const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
            const on = new Uint8Array(width * height); const seen = new Uint8Array(width * height); const sizes = [];
            for (let index = 0; index < on.length; index += 1) on[index] = rgba[index * 4 + 3] > 40 ? 1 : 0;
            for (let start = 0; start < on.length; start += 1) {
              if (!on[start] || seen[start]) continue;
              let size = 0; const stack = [start]; seen[start] = 1;
              while (stack.length) {
                const current = stack.pop(); size += 1; const x = current % width; const y = Math.floor(current / width);
                for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
                  const nx = x + dx; const ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                  const next = ny * width + nx; if (on[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
                }
              }
              sizes.push(size);
            }
            return sizes.sort((a, b) => b - a);
          };
          return ids.flatMap(id => [0, Math.PI * 0.24, Math.PI * 0.5].map((yaw, view) => {
            const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
            SHOSAI_STAGE_POSE_PREVIEW_TEST.draw(canvas, id, '#9cabb5', yaw);
            return { id, view, components: countComponents(canvas) };
          }));
        }, sheetIds.slice(0, 4));
        assert.deepEqual(viewChecks.filter(row => row.components.length !== 1), [], `${engine} front/diagonal/side views`);
        if (engine === 'chromium' && process.env.POSE_SHEET_LABEL) {
          fs.mkdirSync(reportDir, { recursive: true });
          const sheet = await browser.newPage({ viewport: { width: 2200, height: 520 } });
          const cards = sheetIds.map(id => poses.find(pose => pose.id === id));
          await sheet.setContent(`<body style="margin:0;background:#2a2622;color:#eee;display:flex;gap:8px;padding:8px;font:14px sans-serif">${cards.map((card, index) => `<div><div>${sheetIds[index]}</div><img src="${card.image}" style="width:350px;background:#3a3530"></div>`).join('')}</body>`);
          await sheet.screenshot({ path: path.join(reportDir, `pose-${process.env.POSE_SHEET_LABEL}.png`), fullPage: true });
          await sheet.close();
        }
        assert.deepEqual(errors, []);
        results.push({ engine, poses: poses.length, disconnected, checkedViews: viewChecks.length });
      } finally { await browser.close(); }
    }
    const warnings = neckWarnings();
    console.log(JSON.stringify({ results, neckWarnings: warnings }, null, 2));
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
