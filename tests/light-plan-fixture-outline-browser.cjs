'use strict';
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const H = require('./regression/browser-helpers.cjs');

async function main() {
  const browser = await (process.env.GAMMA_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1800, height: 1050 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await H.boot(page, process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8991/stage.html');
    await H.scene(page, 'ft-scene-f1');
    const before = (await H.documentValue(page)).project.lightingDesign;
    await page.locator('#gamma-design').click();
    const frame = page.frameLocator('iframe[src*="light-design/index"]');
    await frame.locator('#plan').waitFor({ state: 'visible' });
    await page.locator('#stage-prefs-btn').click();
    const checkbox = page.locator('.stage-pref-toggle').filter({ hasText: '平面図の照明機材の白い枠を表示' }).locator('input[type=checkbox]');
    assert.equal(await checkbox.isChecked(), true, 'F-1: existing white outline is the default');
    await frame.locator('#plan').evaluate(canvas => {
      const proto = CanvasRenderingContext2D.prototype;
      const old = proto.stroke;
      window.__fixtureOutlineStrokes = { plan: 0, secF: 0 };
      proto.stroke = function (...args) {
        if (String(this.strokeStyle).replaceAll(' ', '') === 'rgba(240,231,214,0.7)' && this.canvas?.id in window.__fixtureOutlineStrokes)
          window.__fixtureOutlineStrokes[this.canvas.id] += 1;
        return old.apply(this, args);
      };
    });
    const strokes = () => frame.locator('#plan').evaluate(canvas => ({ ...canvas.ownerDocument.defaultView.__fixtureOutlineStrokes }));
    await checkbox.uncheck();
    await page.waitForTimeout(250);
    const off = await strokes();
    assert.equal(off.plan, 0, 'F-1: OFF removes unselected fixture outlines from plan');
    assert(off.secF > 0, 'F-1: front fixture outlines remain drawn');
    assert.equal(await frame.locator('#plan').evaluate(canvas => JSON.parse(canvas.ownerDocument.defaultView.localStorage.getItem('gamma:shosai-stage-prefs-v1')).planFixtureOutline), false);
    await frame.locator('#plan').evaluate(canvas => { canvas.ownerDocument.defaultView.__fixtureOutlineStrokes = { plan: 0, secF: 0 }; });
    await checkbox.check();
    await page.waitForTimeout(250);
    const on = await strokes();
    assert(on.plan > 0, 'F-1: ON restores plan fixture outlines');
    await checkbox.uncheck();
    await page.locator('#stage-prefs-close').click();
    assert.deepEqual((await H.documentValue(page)).project.lightingDesign, before, 'visual preference must not edit lighting design');
    await H.reloadFixture(page);
    await H.scene(page, 'ft-scene-f1');
    await page.locator('#stage-prefs-btn').click();
    assert.equal(await checkbox.isChecked(), false, 'F-1: OFF persists after reload');
    assert.deepEqual(errors, []);
    console.log(`F-1 fixture white outline: ON=${on.plan}, OFF=${off.plan}, front=${off.secF}, reload=OFF`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
