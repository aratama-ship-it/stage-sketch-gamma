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
    await H.scene(page, 'ft-scene-f2');
    await page.locator('#gamma-design').click();
    await page.waitForFunction(() => [...document.querySelectorAll('iframe')]
      .some(iframe => iframe.contentWindow?.__RIG));
    const frame = page.frames().find(item => item.url().includes('light-design/index'));
    assert.ok(frame, 'embedded lighting editor opened');
    await frame.waitForFunction(() => window.GAMMA_LIGHT_EDITOR?.status().showId);
    const apply = frame.locator('#apply');
    assert.equal(await apply.isDisabled(), true);
    assert.equal(await apply.evaluate(button => button.classList.contains('needs-apply')), false);

    await frame.locator('#list [data-fixture-id] .fixture-power').first().click();
    assert.equal(await apply.isEnabled(), true);
    assert.equal(await apply.evaluate(button => button.classList.contains('needs-apply')), true);
    await page.locator('#stage-undo').click();
    assert.equal(await apply.isDisabled(), true, 'undo back to host lighting clears pending state');
    await page.locator('#stage-redo').click();
    assert.equal(await apply.isEnabled(), true);
    await apply.click();
    await frame.waitForFunction(() => document.querySelector('#apply').disabled);
    assert.equal(await frame.evaluate(() => GAMMA_LIGHT_EDITOR.status().dirty), false);

    await page.locator('#gamma-placement').click();
    await frame.locator('#list [data-fixture-id]').first().click({ button: 'right' });
    await frame.getByRole('menuitem', { name: 'コピー（複製）', exact: true }).click();
    assert.equal(await apply.isEnabled(), true, 'a shared fixture change needs applying');
    await page.locator('#stage-undo').click();
    assert.equal(await apply.isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('F-2 LX apply state: cue edit, undo/redo, host apply, global fixture edit passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
