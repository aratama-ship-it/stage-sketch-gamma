const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const { chromium, webkit } = requireFromRoot('./tests/regression/node_modules/playwright');
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filename = path.resolve(root, pathname || 'stage.html');
    if (!filename.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
    fs.stat(filename, (error, stat) => {
      if (error || !stat.isFile()) return response.writeHead(404).end();
      response.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
      fs.createReadStream(filename).pipe(response);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function boot(page, base) {
  await page.addInitScript(() => {
    localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
    localStorage.setItem('gamma:shosai-stage-lang', 'ja');
  });
  await page.goto(`${base}/stage.html?feature-test`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.GAMMA_WORKSPACE && window.SHOSAI_STAGE_SESSION_BRIDGE);
  const backup = page.locator('#stage-launch-backup-close');
  if (await backup.isVisible().catch(() => false)) await backup.click();
  await page.waitForFunction(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === 'gamma-feature-test-v31');
  await page.evaluate(() => {
    GAMMA_WORKSPACE.normal();
    if (!SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-a1')) throw new Error('A-1を開けません');
  });
  await page.waitForTimeout(250);
}

(async () => {
  const server = await serve();
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const results = [];
  try {
    for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const width of [1500, 1200]) {
          const page = await browser.newPage({ viewport: { width, height: 900 }, locale: 'ja-JP' });
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await boot(page, base);
          const groups = await page.evaluate(() => {
            const selector = '.stage-canvas-toggle.is-icon, .stage-canvas-tool.is-icon, .stage-canvas-close';
            return ['stage-front-cell', 'stage-plan-cell'].map((id) => ({
              id,
              rows: [...document.querySelectorAll(`#${id} .stage-canvas-tools :is(${selector})`)]
                .filter((element) => {
                  const box = element.getBoundingClientRect();
                  const style = getComputedStyle(element);
                  return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                })
                .map((element) => {
                  const box = element.getBoundingClientRect();
                  const glyph = element.querySelector(':scope > svg, :scope > .stage-tool-icon');
                  const glyphBox = glyph && glyph.getBoundingClientRect();
                  return { name: element.id || element.className, width: box.width, height: box.height, glyphWidth: glyphBox?.width || 0, glyphHeight: glyphBox?.height || 0 };
                }),
            }));
          });
          for (const group of groups) {
            assert.ok(group.rows.length >= 3, `${engine} ${width}px ${group.id}: アイコンが少なすぎます`);
            for (const row of group.rows) {
              assert.ok(Math.abs(row.width - 34) <= 0.5, `${engine} ${width}px ${group.id} ${row.name}: 幅 ${row.width}`);
              assert.ok(Math.abs(row.height - 34) <= 0.5, `${engine} ${width}px ${group.id} ${row.name}: 高さ ${row.height}`);
              assert.ok(Math.abs(row.glyphWidth - 23.1) <= 0.6, `${engine} ${width}px ${group.id} ${row.name}: 絵幅 ${row.glyphWidth}`);
              assert.ok(Math.abs(row.glyphHeight - 23.1) <= 0.6, `${engine} ${width}px ${group.id} ${row.name}: 絵高 ${row.glyphHeight}`);
            }
          }
          assert.deepEqual(errors, [], `${engine} ${width}px pageerror`);
          results.push({ engine, width, front: groups[0].rows.length, plan: groups[1].rows.length, box: '34x34', glyph: '23.1x23.1' });
          await page.close();
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
