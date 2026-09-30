const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const H = require('../tests/regression/browser-helpers.cjs');
const out = 'research/stage-shosai-separation-2026-09-30/validation/r5b-playwright.json';
(async () => {
  const results = [];
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1800, height: 1050 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await H.boot(page, 'http://127.0.0.1:8961/stage.html');
      const doc = JSON.parse(fs.readFileSync('stage-samples/feature-test-show.json'));
      assert.equal(doc.project.id, 'gamma-feature-test-v26');
      const d = doc.project.lightingDesign;
      const payload = '<img src=x onerror="parent.__xss=1;window.__xss=1">';
      d.rig.fixtures[0].name = payload; d.rig.fixtures[0].no = payload; d.rig.trusses[0].label = payload;
      d.fixtureGroups[0].name = '<img src=x onerror=x=1>';
      d.scenes.find(s => s.id === 'ft-scene-f2').lxq[0].name = payload;
      await page.locator('#stage-import-json').setInputFiles({ name: 'feature-test-security.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
      await page.getByRole('button', { name: '別のショーとして開く', exact: true }).click();
      await H.scene(page, 'ft-scene-f2');
      await page.locator('#gamma-placement').click();
      await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some(f => f.contentWindow?.__RIG));
      const frame = page.frames().find(f => f.url().includes('light-design/index'));
      await frame.waitForFunction(() => document.querySelector('#list')?.textContent.includes('<img'));
      const checkpoints = [];
      async function check(label) {
        const value = await frame.evaluate(() => ({ xss: typeof window.__xss, img: document.querySelectorAll('img[src="x"]').length, html: document.querySelector('#list').innerHTML }));
        assert.equal(value.xss, 'undefined'); assert.equal(value.img, 0); assert.equal(await page.evaluate(() => typeof window.__xss), 'undefined');
        checkpoints.push({ label, xss: value.xss, imgElements: value.img, escaped: value.html.includes('&lt;img') });
      }
      await check('F-2 機材配置（ファイル取込経由）');
      await frame.locator('#list [data-fixture-id]').first().click();
      await check('F-2 機材配置の灯体詳細');
      await page.locator('#gamma-design').click();
      await check('F-2 照明デザイン');
      // Exercise extra sinks through real UI hooks, with only this fixture clone.
      await frame.evaluate(() => { const r = __RIG; r.state.sel = new Set([r.state.rig.fixtures[0].id]); r.hooks.renderAll(); });
      await check('F-2 照明デザインの灯体詳細');
      const before = await H.documentValue(page);
      for (const key of ['__proto__', 'constructor', 'prototype']) {
        const bad = structuredClone(doc);
        bad.project.securityProbe = JSON.parse(`{"nested":[{"${key}":true}]}`);
        await page.locator('#stage-import-json').setInputFiles({ name: 'feature-test-rejected.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
        await page.locator('#stage-import-notice').filter({ hasText: '使用できないキー' }).waitFor({ state: 'visible' });
        assert.deepEqual(await H.documentValue(page), before);
        checkpoints.push({ label: `F-2 JSON拒否 ${key}`, showUnchanged: true });
      }
      assert.deepEqual(errors, []);
      results.push({ browser: name, projectId: doc.project.id, scene: 'F-2', checkpoints, pageErrors: errors, passed: true });
    } finally { await browser.close(); }
  }
  fs.writeFileSync(out, JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify(results));
})().catch(e => { console.error(e); process.exitCode = 1; });
