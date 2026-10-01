const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const { chromium, webkit } = requireFromRoot('./tests/regression/node_modules/playwright');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'icon-size-baseline-2026-10-01.json'), 'utf8'));
const mime = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
// 状態札（文字）と、#5 で PC 表示では隠す右上の Q シート入口（iPad式でだけ出る）は絵の倍率検査の対象外
const excluded = new Set(['.stage-cast-status.is-on', '#stage-cue-sheet-open']);
const canvasIcons = new Set(['#stage-front-note', '#stage-costume-toggle', '.stage-canvas-close', '#stage-plan-route', '#stage-plan-derive-route', '#stage-plan-note']);

function pair(value) { return value.replace(/^font /, '').split('x').map((part) => Number.parseFloat(part)); }
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
  await page.waitForFunction(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === 'gamma-feature-test-v28');
  await page.evaluate(() => {
    GAMMA_WORKSPACE.normal();
    SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-a1');
  });
  await page.waitForTimeout(250);
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const summary = [];
  try {
    for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const width of [1800, 1366]) {
          const page = await browser.newPage({ viewport: { width, height: width === 1800 ? 1050 : 900 }, locale: 'ja-JP' });
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await boot(page, base);
          let checked = 0;
          for (const row of baseline[String(width)].filter((item) => !excluded.has(item.el))) {
            const expectedBox = canvasIcons.has(row.el) ? [34, 34] : pair(row.box);
            const elements = await page.locator(row.el).elementHandles();
            let actual = null;
            for (const element of elements) {
              const measurement = await element.evaluate((node) => {
                const box = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                const picture = node.querySelector(':scope > svg, :scope > img');
                const glyph = picture?.getBoundingClientRect();
                const art = picture ? [...picture.children].map((child) => ({ box: child.getBoundingClientRect(), transform: getComputedStyle(child).transform })) : [];
                return { visible: box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden', box: [box.width, box.height], glyph: glyph ? [glyph.width, glyph.height] : null, font: Number.parseFloat(style.fontSize), inside: glyph ? glyph.left >= box.left - 0.1 && glyph.top >= box.top - 0.1 && glyph.right <= box.right + 0.1 && glyph.bottom <= box.bottom + 0.1 : true, artScaled: art.length > 0 && art.every((item) => item.transform.startsWith('matrix(1.1,')), artInside: art.every((item) => item.box.left >= box.left - 0.1 && item.box.top >= box.top - 0.1 && item.box.right <= box.right + 0.1 && item.box.bottom <= box.bottom + 0.1) };
              });
              if (measurement.visible && Math.abs(measurement.box[0] - expectedBox[0]) <= 0.6 && Math.abs(measurement.box[1] - expectedBox[1]) <= 0.6) { actual = measurement; break; }
            }
            assert.ok(actual, `${engine} ${width}px ${row.el}: 基準の箱が見つかりません`);
            assert.ok(Math.abs(actual.box[0] - expectedBox[0]) <= 0.6 && Math.abs(actual.box[1] - expectedBox[1]) <= 0.6, `${engine} ${width}px ${row.el}: 箱 ${actual.box}`);
            if (row.kind === 'svg') {
              const source = canvasIcons.has(row.el) ? [21, 21] : pair(row.glyph);
              assert.ok(actual.glyph, `${engine} ${width}px ${row.el}: SVGがありません`);
              if (row.el === '#stage-timeline-grip') {
                assert.ok(Math.abs(actual.glyph[0] - source[0]) <= 0.6 && Math.abs(actual.glyph[1] - source[1]) <= 0.6, `${engine} ${width}px ${row.el}: SVG枠 ${actual.glyph}`);
                assert.ok(actual.artScaled, `${engine} ${width}px ${row.el}: 作図が1.1倍ではありません`);
                assert.ok(actual.artInside, `${engine} ${width}px ${row.el}: 作図が箱からはみ出しています`);
              } else {
                assert.ok(Math.abs(actual.glyph[0] - source[0] * 1.1) <= 0.6, `${engine} ${width}px ${row.el}: 絵幅 ${actual.glyph[0]}`);
                assert.ok(Math.abs(actual.glyph[1] - source[1] * 1.1) <= 0.6, `${engine} ${width}px ${row.el}: 絵高 ${actual.glyph[1]}`);
                assert.ok(actual.inside, `${engine} ${width}px ${row.el}: 絵が箱からはみ出しています`);
              }
            } else {
              const sourceFont = Number.parseFloat(row.glyph.replace('font ', ''));
              assert.ok(Math.abs(actual.font - sourceFont * 1.1) <= 0.6, `${engine} ${width}px ${row.el}: 文字 ${actual.font}px`);
              assert.ok(actual.font <= Math.min(...actual.box) + 0.1, `${engine} ${width}px ${row.el}: 文字が箱より大きいです`);
            }
            checked += 1;
          }
          assert.deepEqual(errors, [], `${engine} ${width}px pageerror`);
          summary.push({ engine, width, checked });
          await page.close();
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
