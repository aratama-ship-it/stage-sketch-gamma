const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fixture = JSON.parse(fs.readFileSync('stage-samples/feature-test-show.json', 'utf8'));
const mainId = 'romeo-juliet-rj-second-v1', retiredId = 'romeo-juliet-gamma-cued-2026-09-21';
const shelfKey = 'gamma:scene-alternatives-v1:shosai-stage-shows-v1';
(async () => {
  const results = [];
  for (const engine of ['chromium', 'webkit']) {
    const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, locale: 'ja-JP' });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    const url = process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8979/stage.html';
    const project = () => page.evaluate(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project);
    const waitMain = () => page.waitForFunction(id => window.SHOSAI_STAGE_SESSION_BRIDGE && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === id, mainId);
    await page.goto(url); await waitMain();
    assert.equal((await project()).scenes.filter(s => s.kind === 'scene').length, 34);
    assert.equal((await project()).activeSceneId, (await project()).scenes.find(s => s.kind === 'scene').id);
    assert.equal(await page.evaluate(() => GAMMA_WORKSPACE.mode()), 'normal');
    await page.locator('#stage-shows-open').click();
    const rows = await page.locator('#stage-show-list .stage-show-row').allTextContents();
    assert(rows.some(t => t.includes('RJセカンド') && t.includes('34シーン')));
    assert(!rows.some(t => t.includes('33シーン') && t.includes('ロミオとジュリエット')));
    await page.locator('#stage-show-list .stage-show-open').filter({ hasText: '全機能の試験場' }).click();
    await page.waitForFunction(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id.startsWith('gamma-feature-test-'));
    await page.evaluate(() => SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-intro'));
    // Edit only the bundled feature-test show's 0-1 scene context, never a production show.
    await page.locator('#stage-project-title').fill('試験場・起動時の復元確認');
    await page.locator('#stage-project-title').dispatchEvent('change');
    await page.waitForTimeout(1000); await page.reload();
    await page.waitForFunction(() => window.SHOSAI_STAGE_SESSION_BRIDGE && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.title === '試験場・起動時の復元確認');
    assert.equal((await project()).activeSceneId, 'ft-scene-intro');
    await page.locator('#stage-prefs-btn').click(); await page.locator('#stage-reset-all').click();
    await page.locator('#stage-reset-cancel').click();
    assert.equal((await project()).title, '試験場・起動時の復元確認');
    await page.locator('#stage-reset-all').click(); await page.locator('#stage-reset-confirm').click(); await page.locator('#stage-reset-confirm').click();
    await waitMain(); assert.equal((await project()).scenes.filter(s => s.kind === 'scene').length, 34);
    await page.screenshot({ path: '/private/tmp/rj-default-' + engine + '.png' });
    assert.deepEqual(errors, []); await page.close();
    // Use fixture copies to test filtering and preservation of an already-saved retired ID.
    const savedOld = structuredClone(fixture.project); savedOld.id = retiredId; savedOld.title = '保存済み試験場原本'; savedOld.retainedExtension = { keep: true };
    const savedCopy = structuredClone(fixture.project); savedCopy.id = 'fixture-preserved-copy'; savedCopy.title = '保存済み試験場の複製';
    const preservation = await browser.newPage({ viewport: { width: 1800, height: 1200 }, locale: 'ja-JP' });
    await preservation.addInitScript(({ old, copy, key }) => {
      if (localStorage.getItem('rj-preservation-seeded')) return;
      localStorage.setItem('rj-preservation-seeded', '1');
      localStorage.setItem(key, JSON.stringify({ [old.id]: { savedAt: '2026-09-26T00:00:00Z', state: { project: old } }, [copy.id]: { savedAt: '2026-09-26T00:00:00Z', state: { project: copy } } }));
    }, { old: savedOld, copy: savedCopy, key: shelfKey });
    await preservation.goto(url);
    await preservation.waitForFunction(id => window.SHOSAI_STAGE_SESSION_BRIDGE && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === id, mainId);
    await preservation.locator('#stage-shows-open').click();
    assert.equal(await preservation.locator('#stage-show-list .stage-show-open').filter({ hasText: savedOld.title }).count(), 0);
    assert.equal(await preservation.locator('#stage-show-list .stage-show-open').filter({ hasText: savedCopy.title }).count(), 1);
    const durable = await preservation.evaluate(key => JSON.parse(GAMMA_LARGE_PROJECT_STORAGE.values()[key]), shelfKey);
    assert.deepEqual(durable[retiredId].state.project, savedOld);
    assert.deepEqual(durable[savedCopy.id].state.project, savedCopy);
    await preservation.reload(); await preservation.waitForFunction(() => !!window.GAMMA_LARGE_PROJECT_STORAGE);
    const again = await preservation.evaluate(key => JSON.parse(GAMMA_LARGE_PROJECT_STORAGE.values()[key]), shelfKey);
    assert.deepEqual(again[retiredId].state.project, savedOld);
    results.push({ engine, initialScenes: 34, resetScenes: 34, resumedFixtureScene: '0-1', retiredRowHidden: true, savedOriginalAndCopyPreserved: true });
    await browser.close();
  }
  fs.writeFileSync('/private/tmp/rj-default-browser.json', JSON.stringify(results, null, 2)); console.log(results);
})().catch(e => { console.error(e); process.exit(1); });
