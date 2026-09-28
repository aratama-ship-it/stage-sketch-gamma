'use strict';
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const H = require('./regression/browser-helpers.cjs');

async function main() {
  const browser = await (process.env.GAMMA_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1800, height: 1050 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await H.boot(page, process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8991/stage.html');
    await H.scene(page, 'ft-scene-j2');

    async function addPosition(label, distanceM, offsetM) {
      await page.locator('[data-stage-workspace-mode=venue-setup]').click();
      await page.waitForFunction(() => !document.querySelector('#stage-venue-editor-modal').hidden);
      if (!await page.locator('#venue-viewpoints-step').evaluate(step => step.classList.contains('is-open'))) {
        await page.locator('#venue-viewpoints-step .gamma-venue-step-toggle').click();
      }
      const result = await page.evaluate(({ label, distanceM, offsetM }) => {
        const editor = SHOSAI_VENUE_EDITOR;
        editor.setViewpointMode(true);
        const before = editor.viewpointPlot().points;
        const removed = before.length >= 5 ? editor.removeViewpoint(before[0].key) : true;
        const venue = editor.getVenue(), outline = venue.floor.outline;
        const minX = Math.min(...outline.map(point => point[0]));
        const maxX = Math.max(...outline.map(point => point[0]));
        const maxY = Math.max(...outline.map(point => point[1]));
        const world = [(minX + maxX) / 2 + offsetM, maxY + distanceM];
        const canvas = document.getElementById('stage-venue-editor-canvas');
        const rect = canvas.getBoundingClientRect(), view = editor.viewLayout();
        const id = editor.addViewpointAt(rect.left + view.offsetX + (world[0] - view.minX) * view.scale,
          rect.top + view.offsetY + (world[1] - view.minY) * view.scale);
        if (!id || !editor.renameViewpoint(id, label)) throw Error(JSON.stringify({ before: before.length,
          removed, after: editor.viewpointPlot().points.length, editing: editor.viewpointPlot().editing,
          modalHidden: document.querySelector('#stage-venue-editor-modal').hidden,
          conflictHidden: document.querySelector('#stage-venue-conflict-modal').hidden,
          id, world, view, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }));
        return { id, removed: before.length >= 5 ? before[0].point.label : null };
      }, { label, distanceM, offsetM });
      await page.locator('#stage-venue-editor-apply').click();
      await page.locator('#stage-venue-apply-modal:not([hidden])').waitFor();
      await page.locator('#stage-venue-apply-manual').click();
      await page.locator('#stage-venue-apply-confirm').click();
      await page.locator('#stage-venue-apply-modal').waitFor({ state: 'hidden' });
      return result;
    }

    const front = await addPosition('追加テスト位置', 6, 0);
    const labels = await page.locator('#stage-seat-list button').allTextContents();
    assert.ok(labels.some(label => label.includes('追加テスト位置')), labels.join(','));
    if (front.removed) assert.ok(!labels.some(label => label.includes(front.removed)));
    assert.ok(labels.length <= 5);
    await page.locator('#stage-seat-list button').filter({ hasText: '追加テスト位置' }).click();
    assert.match(await page.locator('#stage-canvas').getAttribute('aria-label'), /追加テスト位置/);
    const copiedProjectId = await page.evaluate(() =>
      JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id);
    await page.reload();
    await page.waitForFunction(() => window.SHOSAI_STAGE_SESSION_BRIDGE && document.querySelector('#stage-seat-list'));
    assert.equal(await page.evaluate(() =>
      JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id), copiedProjectId);
    assert.ok((await page.locator('#stage-seat-list button').allTextContents())
      .some(label => label.includes('追加テスト位置')));

    const rear = await addPosition('舞台奥のテスト位置', -3, 0);
    const rearButton = page.locator('#stage-seat-list button').filter({ hasText: '舞台奥のテスト位置' });
    assert.equal(await rearButton.count(), 1);
    assert.match(await rearButton.getAttribute('aria-label'), /3D/);
    const expected = await page.evaluate(id => {
      const project = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
      const venue = SHOSAI_VENUES.byId(project.venue);
      const point = venue.venueV2.viewPositions.find(row => row.id === id);
      const size = SHOSAI_VENUES.sizeById(venue, project.venueSize);
      return { x: point.offsetM, y: Math.max(.2, point.eyeM),
        z: (project.venueDims?.depth ?? size.depth) / 2 + point.distanceM };
    }, rear.id);
    await rearButton.click();
    await page.waitForFunction(() => !document.getElementById('stage-fpv-overlay').hidden);
    const actual = await page.evaluate(() => SHOSAI_STAGE_FPV._probe().camera);
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(actual[axis] - expected[axis]) < .001,
      `${axis}: ${actual[axis]} should be ${expected[axis]}`);
    assert.deepEqual(errors, []);
    console.log(`J-2 venue view positions appear in front chooser and rear opens 3D (${front.id}, ${rear.id})`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
