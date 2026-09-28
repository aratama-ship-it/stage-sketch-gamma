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
    const initialShow = await H.documentValue(page);
    const instrumentPoses = new Set(['guitar', 'bassguitar', 'violin', 'trumpet', 'accordion',
      'flute_play', 'saxophone_play', 'shamisen_play', 'cello_play', 'doublebass_play']);
    for (const scene of initialShow.project.scenes) for (const piece of scene.pieces || [])
      assert.equal(instrumentPoses.has(piece.pose), false, `${scene.id}: instrument playing is not an initial pose`);
    await H.scene(page, 'ft-scene-c2');
    const expected = { p04: 'guitar', p05: 'violin', p06: 'bassguitar', p07: 'accordion', p08: 'doublebass_play' };
    const inspect = () => page.evaluate(() => {
      const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString());
      const scene = doc.project.scenes.find(row => row.id === 'ft-scene-c2');
      const result = {};
      for (const key of ['p04', 'p05', 'p06', 'p07', 'p08']) {
        const piece = scene.pieces.find(row => row.castId === `ft-cast-${key}`);
        result[key] = { stored: piece.pose, drawn: SHOSAI_STAGE_BODY.resolvePoseId(piece, scene.pieces),
          held: scene.pieces.filter(row => row.heldBy === piece.id).length };
      }
      return result;
    });
    const initial = await inspect();
    for (const key of Object.keys(expected))
      assert.deepEqual(initial[key], { stored: 'stand', drawn: 'stand', held: 0 }, `C-2: ${key} initially stands without an instrument`);
    if (process.env.GAMMA_EVIDENCE_PATH) await page.locator('#stage-canvas').screenshot({ path: process.env.GAMMA_EVIDENCE_PATH });
    for (const [key, pose] of Object.entries(expected)) {
      await page.locator(`#stage-cast-list [data-roster-id="ft-cast-${key}"] .stage-kind-swatch`).click();
      const shape = pose === 'doublebass_play' ? 'doublebass' : pose;
      const instrument = await page.evaluate(shape => {
        const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString());
        return doc.project.scenes.find(row => row.id === 'ft-scene-c2').pieces
          .find(piece => piece.setId === `ft-set-instrument-${shape}`).id;
      }, shape);
      const choice = await page.locator('#stage-hold-select').evaluate((select, value) => ({
        selected: document.getElementById('stage-selected-name').textContent,
        option: [...select.options].filter(option => option.value === value).map(option => ({ text: option.textContent, disabled: option.disabled })),
      }), `hold:piece:${instrument}`);
      assert.deepEqual(choice.option.length, 1, `${key}: instrument choice exists (${JSON.stringify(choice)})`);
      assert.equal(choice.option[0].disabled, false, `${key}: instrument choice enabled (${JSON.stringify(choice)})`);
      await page.locator('#stage-hold-select').selectOption(`hold:piece:${instrument}`);
    }
    const holding = await inspect();
    for (const key of Object.keys(expected))
      assert.deepEqual(holding[key], { stored: 'stand', drawn: 'stand', held: 1 }, `C-2: ${key} keeps standing after holding its instrument`);
    if (process.env.GAMMA_HELD_EVIDENCE_PATH)
      await page.locator('#stage-canvas').screenshot({ path: process.env.GAMMA_HELD_EVIDENCE_PATH });
    if (process.env.GAMMA_CONTROL_EVIDENCE_PATH)
      await page.locator('#stage-held-list').screenshot({ path: process.env.GAMMA_CONTROL_EVIDENCE_PATH });
    for (const [key, pose] of Object.entries(expected)) {
      await page.locator(`#stage-cast-list [data-roster-id="ft-cast-${key}"] .stage-kind-swatch`).click();
      assert.equal(await page.locator('#stage-piece-pose').isDisabled(), false, `${key}: ordinary pose choices stay available`);
      await page.locator('#stage-held-list .stage-held-use').filter({ hasText: '演奏する' }).click();
      assert.deepEqual((await inspect())[key], { stored: pose, drawn: pose, held: 1 }, `C-2: ${key} plays only after explicit use`);
    }
    const neckDirection = await page.evaluate(() => Object.fromEntries(['guitar', 'bassguitar'].map(id => {
      const read = suffix => {
        const pose = SHOSAI_STAGE_BODY.poseById(id + suffix);
        return { neck: pose.props.find(prop => prop.kind === 'line').a[0],
          body: pose.props.find(prop => prop.kind === 'dot').c[0] };
      };
      return [id, { right: read(''), left: read('@left') }];
    })));
    for (const [id, direction] of Object.entries(neckDirection)) {
      assert.ok(direction.right.neck > direction.right.body, `${id}: held on the right, the neck points to audience-right`);
      assert.ok(direction.left.neck < direction.left.body, `${id}: left-hand hold mirrors the neck`);
    }
    if (process.env.GAMMA_EVIDENCE_AFTER_PATH) {
      await page.locator('#stage-canvas').click({ position: { x: 5, y: 5 } });
      await page.locator('#stage-canvas').screenshot({ path: process.env.GAMMA_EVIDENCE_AFTER_PATH });
    }
    await page.locator('#stage-freecam-open').click();
    await page.locator('#stage-fpv-view').waitFor({ state: 'visible' });
    if (process.env.GAMMA_3D_EVIDENCE_PATH)
      await page.locator('#stage-fpv-view').screenshot({ path: process.env.GAMMA_3D_EVIDENCE_PATH });
    await page.locator('#stage-workspace-normal').click();
    await H.scene(page, 'ft-scene-c2');
    await page.locator('#stage-cast-list [data-roster-id="ft-cast-p07"] .stage-kind-swatch').click();
    assert.equal(await page.locator('#stage-piece-pose').isDisabled(), false, 'ordinary pose chooser remains enabled while playing');
    await page.locator('#stage-held-list .stage-held-use').filter({ hasText: '演奏をやめる' }).click();
    assert.deepEqual((await inspect()).p07, { stored: 'stand', drawn: 'stand', held: 1 }, 'C-2: stop playing keeps the accordion held');
    await page.locator('#stage-piece-pose').click();
    assert.equal(await page.locator('#stage-pose-grid [data-pose-search*="accordion"]').count(), 0, 'C-2: accordion is absent from the regular pose chooser');
    assert.equal(await page.locator('#stage-pose-grid [data-pose-search*="doublebass_play"]').count(), 0, 'C-2: double bass is absent from the regular pose chooser');
    await page.locator('#stage-pose-grid .stage-pose-tile').filter({ hasText: '歩く' }).first().click();
    assert.deepEqual((await inspect()).p07, { stored: 'walk', drawn: 'walk', held: 1 }, 'C-2: ordinary pose can be chosen while holding an instrument');
    await page.locator('#stage-held-list .stage-held-use').filter({ hasText: '演奏する' }).click();
    await page.locator('#stage-held-list button').filter({ hasText: '手放す' }).first().click();
    const released = await inspect();
    assert.deepEqual(released.p07, { stored: 'stand', drawn: 'stand', held: 0 }, 'C-2: releasing the played accordion stops its playing pose');
    const accordionId = await page.evaluate(() => {
      const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString());
      return doc.project.scenes.find(row => row.id === 'ft-scene-c2').pieces
        .find(piece => piece.setId === 'ft-set-instrument-accordion').id;
    });
    assert.match(await page.locator(`#stage-hold-select option[value="pose:accordion:piece:${accordionId}"]`).textContent(),
      /演奏する/, 'C-2: direct use is clearly labelled as playing');
    await page.locator('#stage-hold-select').selectOption(`pose:accordion:piece:${accordionId}`);
    assert.deepEqual((await inspect()).p07, { stored: 'accordion', drawn: 'accordion', held: 1 },
      'C-2: direct use from a floor prop explicitly holds and plays');
    await page.locator('#stage-held-list button').filter({ hasText: '手放す' }).first().click();
    const clubId = await page.evaluate(() => {
      const doc = JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString());
      return doc.project.scenes.find(row => row.id === 'ft-scene-c2').pieces
        .find(piece => piece.setId === 'ft-set-prop-club').id;
    });
    await page.locator('#stage-hold-select').selectOption(`hold:piece:${clubId}`);
    assert.deepEqual((await inspect()).p07, { stored: 'stand', drawn: 'stand', held: 1 },
      'C-2: holding a non-instrument prop also leaves the pose alone');
    await page.locator('#stage-held-list button').filter({ hasText: '手放す' }).first().click();
    await H.reloadFixture(page);
    await H.scene(page, 'ft-scene-c2');
    assert.deepEqual((await inspect()).p07, released.p07, 'C-2: released state persists after reload');
    assert.deepEqual((await inspect()).p04, { stored: 'guitar', drawn: 'guitar', held: 1 }, 'C-2: explicit playing survives save and reload');
    assert.deepEqual(errors, []);
    console.log('A-1/A-2/H-4/J-1: no initial instrument pose; C-2: hold, explicit play, ordinary pose, release and reload passed');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
