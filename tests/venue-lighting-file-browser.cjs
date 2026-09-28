const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8991/stage.html';

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1050 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
      localStorage.setItem('gamma:shosai-stage-lang', 'ja');
    });
    await page.goto(base);
    await page.waitForFunction(() => window.SHOSAI_VENUE_EDITOR && window.GAMMA_LIGHT_MODEL);
    const backup = page.locator('#stage-launch-backup-close');
    if (await backup.isVisible().catch(() => false)) await backup.click();
    await page.locator('#stage-shows-open').click();
    await page.evaluate(() => [...document.querySelectorAll('#stage-show-list .stage-show-open')]
      .find(button => button.textContent.includes('全機能の試験場')).click());
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelector('[data-scene-id=ft-scene-c1] button').click());
    await page.evaluate(() => document.querySelector('[data-stage-workspace-mode=venue-setup]').click());
    await page.waitForTimeout(450);
    const project = () => page.evaluate(() =>
      JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project);
    const before = await project();
    assert.equal(before.id, 'gamma-feature-test-v17');
    assert.equal(await page.locator('.stage-venue-editor-menu > .stage-venue-editor-lighting-step').count(), 1);
    assert.equal(await page.locator('.stage-venue-editor-presets .stage-lighting-source').count(), 0);

    async function chooseFile(name, value) {
      const chooserPromise = page.waitForEvent('filechooser');
      await page.locator('[data-lighting-source=saved]').click();
      const chooser = await chooserPromise;
      await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    }
    await chooseFile('wrong.json', { format: 'other' });
    await page.waitForFunction(() => document.querySelector('#stage-lighting-plan-file-summary').textContent.includes('読み込めません'));
    assert.match(await page.locator('#stage-lighting-plan-file-summary').textContent(), /読み込めません/);
    assert.equal(await page.locator('[data-lighting-source=self]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual((await project()).lightingDesign, before.lightingDesign);

    const imported = structuredClone(before.lightingDesign);
    imported.stage = await page.evaluate(() => {
      const venue = SHOSAI_VENUES.byId(document.querySelector('#stage-venue-select').value);
      const size = SHOSAI_VENUES.sizeById(venue, document.querySelector('#stage-size-select').value);
      return { W: size.width, D: size.depth, H: size.height || 8 };
    });
    await chooseFile('F4.lightdesign.json', imported);
    await page.waitForFunction(() => document.querySelector('#stage-lighting-plan-file-summary').textContent.includes('F4.lightdesign.json'));
    assert.match(await page.locator('#stage-lighting-plan-file-summary').textContent(), /F4\.lightdesign\.json/);
    assert.equal(await page.locator('[data-lighting-source=saved]').getAttribute('aria-pressed'), 'true');
    await page.locator('#stage-venue-editor-apply').click();
    await page.locator('#stage-venue-apply-modal:not([hidden])').waitFor();
    assert.equal(await page.locator('#stage-venue-apply-file').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#stage-venue-apply-confirm').isDisabled(), false);
    await page.locator('#stage-venue-apply-cancel').click();
    assert.deepEqual((await project()).lightingDesign, before.lightingDesign);

    await page.locator('#stage-venue-editor-apply').click();
    await page.locator('#stage-venue-apply-modal:not([hidden])').waitFor();
    await page.locator('#stage-venue-apply-confirm').click();
    await page.locator('#stage-venue-apply-modal').waitFor({ state: 'hidden' });
    const after = await project();
    assert.equal(after.lightingDesign.rig.fixtures.length, before.lightingDesign.rig.fixtures.length);
    assert.deepEqual(after.lightingDesign.stage, imported.stage);
    assert.ok(after.scenes.find(scene => scene.id === 'ft-scene-c1').pieces.length > 0);
    assert.deepEqual(errors, []);
    console.log('C-1 lighting file picker, invalid/cancel, and confirmed import passed');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
