const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

const base = process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8979/stage.html';

async function main() {
  const browser = await (process.env.GAMMA_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1800, height: 1050 } });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
      localStorage.setItem('gamma:shosai-stage-lang', 'ja');
    });
    await page.goto(base);
    await page.waitForFunction(() => window.SHOSAI_VENUE_EDITOR && window.SHOSAI_STAGE_SESSION_BRIDGE);
    const backup = page.locator('#stage-launch-backup-close');
    if (await backup.isVisible().catch(() => false)) await backup.click();
    await page.locator('#stage-shows-open').click();
    await page.waitForTimeout(300);
    await page.evaluate(() => [...document.querySelectorAll('#stage-show-list .stage-show-open')]
      .find(button => button.textContent.includes('全機能の試験場')).click());
    await page.waitForTimeout(700);
    const projectId = await page.evaluate(() =>
      JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id);
    assert.equal(projectId, 'gamma-feature-test-v9');
    await page.evaluate(() => {
      const scene = document.querySelector('[data-scene-id=ft-scene-c1]');
      (scene.querySelector('button') || scene).click();
    });
    await page.evaluate(() => document.querySelector('[data-stage-workspace-mode=venue-setup]').click());
    await page.waitForTimeout(450);
    const venueChrome = await page.evaluate(() => {
      const menu = document.querySelector('.stage-venue-editor-menu');
      const footer = document.querySelector('.stage-venue-library-footer');
      const backScreen = document.querySelector('.stage-venue-editor-back-screens');
      const wall = document.querySelector('.stage-venue-editor-walls-guide');
      return {
        footerInLeftLane: footer.parentElement.classList.contains('stage-venue-editor-left'),
        footerOutsideScroll: !menu.contains(footer),
        footerVisible: footer.getBoundingClientRect().bottom <= innerHeight,
        buttonCount: footer.querySelectorAll('button, label.stage-import-label').length,
        backScreenBorder: getComputedStyle(backScreen).borderWidth,
        wallBorder: getComputedStyle(wall).borderWidth,
        previewMoveButton: Boolean(document.querySelector('.venue-live-controls [data-action="move"]')),
        previewZoomButtons: document.querySelectorAll('.venue-live-controls [data-action="in"], .venue-live-controls [data-action="out"]').length,
      };
    });
    assert.equal(venueChrome.footerInLeftLane, true);
    assert.equal(venueChrome.footerOutsideScroll, true);
    assert.equal(venueChrome.footerVisible, true);
    assert.equal(venueChrome.buttonCount, 4);
    assert.equal(venueChrome.backScreenBorder, venueChrome.wallBorder);
    assert.notEqual(venueChrome.backScreenBorder, '0px');
    assert.equal(venueChrome.previewMoveButton, false);
    assert.equal(venueChrome.previewZoomButtons, 2);
    await page.evaluate(() => document.querySelector('.stage-venue-editor-back-screens .gamma-venue-step-toggle').click());

    const screens = () => page.evaluate(() => SHOSAI_VENUE_EDITOR.getVenue().backScreens);
    const layout = () => page.evaluate(() => SHOSAI_VENUE_EDITOR.viewLayout());
    const coords = point => page.evaluate(point => {
      const canvas = document.getElementById('stage-venue-editor-canvas');
      const rect = canvas.getBoundingClientRect();
      const view = SHOSAI_VENUE_EDITOR.viewLayout();
      return { x: rect.left + view.offsetX + (point[0] - view.minX) * view.scale,
        y: rect.top + view.offsetY + (point[1] - view.minY) * view.scale };
    }, point);
    const click = async point => {
      const at = await coords(point);
      await page.mouse.click(at.x, at.y);
    };
    const drag = async (from, to) => {
      const start = await coords(from);
      const end = await coords(to);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 10 });
      await page.mouse.up();
    };
    const gridStep = async () => {
      const { scale } = await layout();
      const target = 24 / scale;
      const power = 10 ** Math.floor(Math.log10(target));
      return [1, 2, 5, 10].find(multiplier => multiplier * power >= target) * power;
    };
    const onGrid = (value, step) =>
      assert.ok(Math.abs(value / step - Math.round(value / step)) < 1e-5,
        `${value} should be on a ${step}m grid`);

    await page.locator('#stage-venue-back-screen-place').click();
    await drag([2.31, 1.43], [8.17, 1.43]);
    const step = await gridStep();
    let list = await screens();
    assert.equal(list.length, 1);
    assert.equal(list[0].color, 'gray');
    assert.equal(await page.locator('[data-back-screen-color=gray]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-back-screen-color=black]').click();
    assert.equal((await screens())[0].color, 'black');
    await page.evaluate(() => SHOSAI_VENUE_EDITOR.undo());
    assert.equal((await screens())[0].color, 'gray');
    await page.evaluate(() => SHOSAI_VENUE_EDITOR.redo());
    assert.equal((await screens())[0].color, 'black');
    const colorCentre = await coords([(list[0].from[0] + list[0].to[0]) / 2, list[0].from[1]]);
    await page.touchscreen.tap(colorCentre.x, colorCentre.y + 14);
    await page.locator('[data-back-screen-color=white]').click();
    assert.equal((await screens())[0].color, 'white');
    list = await screens();
    assert.equal(list[0].from[1], list[0].to[1]);
    [...list[0].from, ...list[0].to].forEach(value => onGrid(value, step));
    const firstId = list[0].id;
    await click([10.3, 3.4]); // Empty plan space clears selection without placing another screen.
    assert.equal(await page.locator('#stage-venue-back-screen-edit').isVisible(), false);
    const lineCentre = await coords([(list[0].from[0] + list[0].to[0]) / 2, list[0].from[1]]);
    await page.touchscreen.tap(lineCentre.x, lineCentre.y + 14);
    assert.equal(await page.locator('#stage-venue-back-screen-edit').isVisible(), true);
    assert.equal(Number(await page.locator('#stage-venue-back-screen-length').inputValue()),
      list[0].to[0] - list[0].from[0]);

    await page.locator('#stage-venue-back-screen-length').fill('5.2');
    await page.locator('#stage-venue-back-screen-length').press('Tab');
    list = await screens();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, firstId);
    assert.equal(list[0].to[0] - list[0].from[0], Math.round(5.2 / step) * step);
    assert.deepEqual(await page.evaluate(() => SHOSAI_VENUE_EDITOR.getVenue().backScreen), list[0]);

    const beforeDrag = structuredClone(list[0]);
    await drag(beforeDrag.to, [beforeDrag.to[0] + 1.3, beforeDrag.to[1] + 0.24]);
    list = await screens();
    assert.equal(list[0].id, firstId);
    assert.deepEqual(list[0].from, beforeDrag.from);
    onGrid(list[0].to[0] - list[0].from[0], step);
    assert.ok(list[0].to[0] > beforeDrag.to[0]);
    await page.evaluate(() => SHOSAI_VENUE_EDITOR.undo());
    assert.deepEqual((await screens())[0], beforeDrag);
    await page.evaluate(() => SHOSAI_VENUE_EDITOR.redo());
    assert.deepEqual((await screens())[0], list[0]);

    const unchanged = structuredClone(list[0]);
    await click([(list[0].from[0] + list[0].to[0]) / 2, list[0].from[1]]);
    await page.locator('#stage-venue-back-screen-length').fill('1000');
    await page.locator('#stage-venue-back-screen-length').press('Tab');
    assert.deepEqual((await screens())[0], unchanged);
    assert.equal(Number(await page.locator('#stage-venue-back-screen-length').inputValue()),
      unchanged.to[0] - unchanged.from[0]);

    await drag([9.31, 2.21], [9.31, 7.67]);
    list = await screens();
    assert.equal(list.length, 2);
    assert.equal(list[1].from[0], list[1].to[0]);
    [...list[1].from, ...list[1].to].forEach(value => onGrid(value, step));
    assert.deepEqual(list[0], unchanged);
    const beforeZoom = structuredClone(list);
    await page.evaluate(() => {
      document.getElementById('stage-venue-editor-zoom-in').click();
      document.getElementById('stage-venue-editor-zoom-in').click();
    });
    assert.deepEqual(await screens(), beforeZoom); // Zoom alone never rewrites saved geometry.
    const fineStep = await gridStep();
    assert.ok(fineStep <= step);
    await drag(beforeZoom[1].to, [beforeZoom[1].to[0] + 0.18, beforeZoom[1].to[1] - 0.77]);
    list = await screens();
    assert.equal(list[1].id, beforeZoom[1].id);
    assert.deepEqual(list[1].from, beforeZoom[1].from);
    assert.equal(list[1].to[0], beforeZoom[1].to[0]);
    onGrid(list[1].to[1] - list[1].from[1], fineStep);
    assert.ok(list[1].to[1] < beforeZoom[1].to[1]);
    assert.deepEqual(list[0], unchanged);
    await page.screenshot({ path: '/private/tmp/gamma-back-screen-edit-c1.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#stage-venue-back-screen-length').scrollIntoViewIfNeeded();
    const touchInput = await page.locator('#stage-venue-back-screen-length').boundingBox();
    await page.screenshot({ path: '/private/tmp/gamma-back-screen-edit-c1-mobile.png' });
    assert.ok(touchInput && touchInput.height >= 44 && touchInput.x >= 0 &&
      touchInput.x + touchInput.width <= 390);
    assert.deepEqual(errors, []);
    console.log(`C-1 back screen placement, color, re-selection, input, endpoint drag, undo/redo, invalid length, multiple screens passed (${projectId})`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
