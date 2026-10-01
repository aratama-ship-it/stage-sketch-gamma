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
const currentKey = 'gamma:scene-alternatives-v1:shosai-stage-sketch-v1';
const shelfKey = 'gamma:scene-alternatives-v1:shosai-stage-shows-v1';
const second = JSON.parse(fs.readFileSync(path.join(root, 'stage-samples/romeo-juliet-second.json'), 'utf8')).project;
const context = { window: {} }; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'stage-samples/romeo-juliet-cued.js'), 'utf8'), context);
const cued = context.window.SHOSAI_STAGE_BUNDLED_PROJECT_LIBRARY.samples[0].project;
const oldReasons = {
  [second.id]: '既存のロミオとジュリエット見本を残し、身体表現・照明・配置・台詞を再構成した第2の同梱ショー。10人、宴のバー、床上中心、悲劇の結末は演出上の暫定条件。',
  [cued.id]: '旧ショー原本を保持した独立サンプル。既存台本47行と照明・音楽案をγのキューへ接続。時刻と仕込みは仮案。',
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
const clone = value => JSON.parse(JSON.stringify(value));
async function waitProject(page, id) {
  await page.waitForFunction(expected => window.SHOSAI_STAGE_SESSION_BRIDGE && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === expected, id);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address(); const results = [];
  try {
    for (const engine of ['chromium', 'webkit']) {
      const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
      try {
        const base = `http://127.0.0.1:${port}/stage.html`;
        const freshContext = await browser.newContext({ locale: 'ja-JP' });
        const fresh = await freshContext.newPage();
        await fresh.addInitScript(() => { localStorage.setItem('gamma:shosai-stage-tour-v1', 'done'); localStorage.setItem('gamma:shosai-stage-lang', 'ja'); });
        await fresh.goto(base); await waitProject(fresh, second.id);
        assert.equal(await fresh.locator('#stage-version-note').evaluate(element => element.hidden), true, `${engine} RJ second note`);
        await freshContext.close();

        const migratedContext = await browser.newContext({ locale: 'ja-JP' });
        const migrated = await migratedContext.newPage();
        const openCued = clone(cued); openCued.branchReason = oldReasons[cued.id];
        const shelfSecond = clone(second); shelfSecond.branchReason = oldReasons[second.id];
        await migrated.addInitScript(({ current, shelf, currentStorage, shelfStorage }) => {
          localStorage.setItem('gamma:shosai-stage-tour-v1', 'done'); localStorage.setItem('gamma:shosai-stage-lang', 'ja');
          localStorage.setItem(currentStorage, JSON.stringify({ project: current }));
          localStorage.setItem(shelfStorage, JSON.stringify({ [shelf.id]: { savedAt: '2026-10-01T00:00:00Z', state: { project: shelf } } }));
        }, { current: openCued, shelf: shelfSecond, currentStorage: currentKey, shelfStorage: shelfKey });
        await migrated.goto(base); await waitProject(migrated, cued.id);
        await migrated.waitForFunction(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.branchReason === '');
        assert.equal(await migrated.locator('#stage-version-note').evaluate(element => element.hidden), true, `${engine} cued note ja`);
        const shelf = await migrated.evaluate(key => JSON.parse(GAMMA_LARGE_PROJECT_STORAGE.values()[key]), shelfKey);
        assert.equal(shelf[second.id].state.project.branchReason, '', `${engine} shelf backfill`);
        await migrated.locator('#stage-lang').selectOption('en', { force: true });
        assert.equal(await migrated.locator('#stage-version-note').evaluate(element => element.hidden), true, `${engine} cued note en`);
        await migratedContext.close();

        const derivative = clone(second); derivative.id = 'user-derived-version-note-test'; derivative.title = '試験場・自作の版注記'; derivative.branchReason = '自分で書いた派生理由';
        const userContext = await browser.newContext({ locale: 'ja-JP' });
        const userPage = await userContext.newPage();
        await userPage.addInitScript(({ project, key }) => {
          localStorage.setItem('gamma:shosai-stage-tour-v1', 'done'); localStorage.setItem('gamma:shosai-stage-lang', 'ja');
          localStorage.setItem(key, JSON.stringify({ project }));
        }, { project: derivative, key: currentKey });
        await userPage.goto(base); await waitProject(userPage, derivative.id);
        assert.equal(await userPage.locator('#stage-version-note').evaluate(element => element.hidden), false, `${engine} user note visible`);
        assert.match(await userPage.locator('#stage-version-note').textContent(), /自分で書いた派生理由（元の版から派生）/);
        await userPage.locator('#stage-lang').selectOption('en', { force: true });
        assert.equal(await userPage.locator('#stage-version-note').evaluate(element => element.hidden), false, `${engine} user note en visible`);
        assert.match(await userPage.locator('#stage-version-note').textContent(), /derived from an earlier version/);
        await userContext.close();

        const editedBundled = clone(second); editedBundled.branchReason = '本人が書き換えた同梱ショーの理由';
        const editedContext = await browser.newContext({ locale: 'ja-JP' });
        const editedPage = await editedContext.newPage();
        await editedPage.addInitScript(({ project, key }) => {
          localStorage.setItem('gamma:shosai-stage-tour-v1', 'done'); localStorage.setItem('gamma:shosai-stage-lang', 'ja');
          localStorage.setItem(key, JSON.stringify({ project }));
        }, { project: editedBundled, key: currentKey });
        await editedPage.goto(base); await waitProject(editedPage, second.id);
        const editedExport = await editedPage.evaluate(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project);
        assert.equal(editedExport.branchReason, editedBundled.branchReason, `${engine} edited bundled reason preserved`);
        assert.equal(await editedPage.locator('#stage-version-note').evaluate(element => element.hidden), true, `${engine} edited bundled note row hidden`);
        await editedContext.close();
        results.push({ engine, secondHidden: true, cuedHiddenJaEn: true, currentAndShelfBackfilled: true, userDerivativePreservedJaEn: true, editedBundledReasonPreserved: true });
      } finally { await browser.close(); }
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
