const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const playwrightRequire = createRequire(path.join(__dirname, 'regression', 'run.cjs'));
const { chromium, webkit } = playwrightRequire('playwright');

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.woff2', 'font/woff2'], ['.mp3', 'audio/mpeg'],
]);

function server() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/stage.html' : pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end(); return;
    }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'content-type': types.get(path.extname(file)) || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function dismiss(page) {
  const backup = page.locator('#stage-launch-backup-close');
  if (await backup.isVisible().catch(() => false)) await backup.click();
  for (let index = 0; index < 4; index += 1) {
    const button = page.getByRole('button', { name: '反映しないで移る', exact: true }).last();
    if (!await button.isVisible().catch(() => false)) break;
    await button.click();
  }
}

async function applyVenue(page) {
  await page.evaluate(() => SHOSAI_VENUE_EDITOR.apply());
  await page.waitForSelector('#stage-venue-apply-modal:not([hidden])');
  await page.locator('#stage-venue-apply-manual').click();
  await page.locator('#stage-venue-apply-confirm').click();
  await page.waitForFunction(() => document.getElementById('stage-venue-editor-modal')?.hidden === true);
  await page.evaluate(() => GAMMA_WORKSPACE.normal());
  await dismiss(page);
  await page.waitForTimeout(250);
}

async function openCurrentVenue(page) {
  await page.evaluate(() => {
    document.querySelector('[data-stage-workspace-mode="venue-setup"]')?.click();
    window.dispatchEvent(new Event('stage-venue-editor-open'));
  });
  await page.waitForSelector('#stage-venue-editor-modal:not([hidden])');
  await page.evaluate(() => {
    const toggle = document.querySelector('.stage-venue-editor-wings-guide .gamma-venue-step-toggle');
    const section = document.querySelector('.stage-venue-editor-wings-guide');
    if (toggle && !section?.classList.contains('is-open')) toggle.click();
  });
}

async function frontPixels(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('stage-canvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (const value of data) { hash ^= value; hash = Math.imul(hash, 16777619); }
    return { hash: hash >>> 0, width: canvas.width, height: canvas.height };
  });
}

async function run(engine, browserType, base) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1800, height: 1100 }, locale: 'ja-JP' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
      localStorage.setItem('gamma:shosai-stage-lang', 'ja');
    });
    await page.goto(`${base}/stage.html?feature-test`);
    await page.waitForFunction(() => window.SHOSAI_VENUE_EDITOR && window.SHOSAI_STAGE_SESSION_BRIDGE &&
      JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === 'gamma-feature-test-v28');
    await dismiss(page);
    await page.evaluate(() => {
      const animation = document.getElementById('stage-anim-scenes');
      if (animation?.checked) animation.click();
      GAMMA_WORKSPACE.normal();
      SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-d4');
    });

    await page.evaluate(() => {
      const source = SHOSAI_VENUES.library.venueV2ById('ft-venue-leg-count-2');
      source.id = 'ft-venue-leg-count-auto';
      source.label = '試験場: 袖幕自動';
      source.stageWings.forEach(wing => delete wing.legCount);
      const imported = SHOSAI_VENUES.library.importVenues([source]);
      if (imported.imported !== 1) throw new Error('自動の複製会場を作れませんでした');
      document.querySelector('[data-stage-workspace-mode="venue-setup"]')?.click();
      SHOSAI_VENUE_EDITOR.loadVenueTemplate({ venueId: source.id }, { force: true });
      SHOSAI_VENUE_EDITOR.open();
    });
    await page.waitForSelector('#stage-venue-editor-modal:not([hidden])');
    assert.equal(await page.locator('#stage-venue-editor-leg-count').isDisabled(), false, `${engine}: custom enabled`);
    await applyVenue(page);
    const before = await frontPixels(page);

    await page.evaluate(() => {
      document.querySelector('[data-stage-workspace-mode="venue-setup"]')?.click();
      SHOSAI_VENUE_EDITOR.loadVenueTemplate({ venueId: 'proscenium', sizeId: 'mid' }, { force: true });
      SHOSAI_VENUE_EDITOR.open();
    });
    assert.equal(await page.locator('#stage-venue-editor-leg-count').isDisabled(), true, `${engine}: preset disabled`);
    assert.equal(await page.locator('#stage-venue-editor-leg-count-help').textContent(),
      '標準の劇場は複製してから変えられます');
    await page.evaluate(() => SHOSAI_VENUE_EDITOR.close());
    await page.waitForFunction(() => document.getElementById('stage-venue-editor-modal')?.hidden === true);

    await openCurrentVenue(page);
    const counts = {};
    for (const count of [2, 4, 10]) {
      const input = page.locator('#stage-venue-editor-leg-count');
      await input.fill(String(count));
      await input.dispatchEvent('change');
      // 反映は change 後に非同期で済むことがある（負荷の高い WebKit で先読みして落ちた）
      await page.waitForFunction((expected) => SHOSAI_VENUE_EDITOR.getVenue().stageWings.every(wing => wing.legCount === expected), count, { timeout: 5000 });
      counts[count] = await page.evaluate((expected) => {
        const venue = SHOSAI_VENUE_EDITOR.getVenue();
        const grouped = (rows) => venue.stageWings.map(wing =>
          rows.filter(row => row.wingId === wing.id).length);
        const shared = GAMMA_VENUE_CURTAINS.forVenue(venue);
        const preview = SHOSAI_VENUE_EDITOR.previewSnapshot().curtains;
        const saved = SHOSAI_VENUE_EDITOR.save(`袖幕${expected}枚の往復試験`);
        const roundTrip = SHOSAI_VENUES.library.venueV2ById(saved.id);
        return {
          front: venue.stageWings.map(wing => GAMMA_VENUE_CURTAINS.frontDepths(wing.legCount).length),
          plan: grouped(shared),
          threeD: grouped(shared),
          preview: grouped(preview),
          saved: roundTrip.stageWings.map(wing => wing.legCount),
        };
      }, count);
      for (const route of ['front', 'plan', 'threeD', 'preview', 'saved']) {
        assert.deepEqual(counts[count][route], [count, count], `${engine}: ${route} ${count}`);
      }
    }
    await applyVenue(page);
    const ten = await frontPixels(page);
    assert.notEqual(ten.hash, before.hash, `${engine}: 10枚で正面図が変わる`);

    await openCurrentVenue(page);
    await page.evaluate(() => document.getElementById('stage-venue-editor-leg-count-auto').click());
    assert.equal(await page.locator('#stage-venue-editor-leg-count').inputValue(), '');
    await applyVenue(page);
    const restored = await frontPixels(page);
    assert.deepEqual(restored, before, `${engine}: 未設定へ戻すと正面図がピクセル一致`);
    assert.deepEqual(errors, [], `${engine}: page errors`);
    return { engine, viewport: '1800x1100', counts, unsetPixelHash: before.hash,
      tenPixelHash: ten.hash, restoredPixelHash: restored.hash };
  } finally {
    await browser.close();
  }
}

(async () => {
  const host = server();
  await new Promise((resolve, reject) => {
    host.once('error', reject);
    host.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = host.address();
    const base = `http://127.0.0.1:${address.port}`;
    const results = [];
    for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
      results.push(await run(name, type, base));
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await new Promise(resolve => host.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
