'use strict';
// Run with Playwright available to Node and GAMMA_TEST_URL pointing to this checkout.
// The only edited show is this checkout's bundled feature-test fixture, scene B-3.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'stage-samples/feature-test-show.json')));
const fixtureId = fs.readFileSync(path.join(root, 'stage-samples/build-feature-test-show.mjs'), 'utf8').match(/const PROJECT_ID = "([^"]+)"/)[1];
assert.equal(fixture.project.id, fixtureId);
const output = process.env.GAMMA_TEST_OUTPUT || '/private/tmp/gamma-panel-bottom';
fs.mkdirSync(output, { recursive: true });
const base = process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8975/stage.html';
const results = [];

async function run(name, launcher) {
  const browser = await launcher.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1900, height: 1050 }, locale: 'ja-JP', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('gamma:shosai-stage-tour-v1', 'done');
    localStorage.setItem('gamma:shosai-stage-lang', 'ja');
    window.__selectionBoxes = {};
    const prototype = CanvasRenderingContext2D.prototype;
    const original = prototype.strokeRect;
    prototype.strokeRect = function(x, y, w, h) {
      if (this.getLineDash().join(',') === '8,7') {
        const m = this.getTransform();
        window.__selectionBoxes[this.canvas.id] = { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, w: w * m.a, h: h * m.d };
      }
      return original.call(this, x, y, w, h);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  try {
    const ready = async () => {
      await page.waitForFunction(id => window.GAMMA_WORKSPACE && window.SHOSAI_STAGE_SESSION_BRIDGE
        && JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id === id, fixtureId);
      await page.evaluate(() => GAMMA_WORKSPACE.normal());
      await page.locator('#stage-prefs-btn').click();
      await page.locator('#stage-anim-scenes').uncheck();
      await page.locator('#stage-prefs-close').click();
      await page.evaluate(() => { if (!SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-b3')) throw new Error('B-3 unavailable'); });
      await page.waitForFunction(() => JSON.parse(GAMMA_LARGE_PROJECT_STORAGE.storage.getItem(SHOSAI_GAMMA_STORAGE_KEYS.currentShow) || '{}').layout);
    };
    const documentValue = () => page.evaluate(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()));
    const savedLayout = async () => {
      await page.waitForFunction(() => document.getElementById('stage-save-status')?.dataset.level !== 'saving');
      return page.evaluate(() => JSON.parse(GAMMA_LARGE_PROJECT_STORAGE.storage.getItem(SHOSAI_GAMMA_STORAGE_KEYS.currentShow)).layout);
    };
    const choose = async value => {
      await page.locator('#stage-panels-toggle').click();
      await page.locator(`.stage-panel-visibility-layout [data-panel-layout="${value}"]`).click();
      await page.locator('#stage-panels-toggle').click();
    };
    const collapse = async (id, wanted) => {
      const head = page.locator(`[data-panel-head="${id}"]`);
      if (!await head.isVisible()) return;
      if ((await head.getAttribute('aria-expanded') === 'false') !== wanted) await head.click();
    };
    const geometry = () => page.evaluate(() => {
      const box = id => {
        const el = document.getElementById(id), r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
      };
      const cols = getComputedStyle(document.getElementById('stage-bottom-panels')).gridTemplateColumns.split(' ').length;
      const icons = [...document.querySelectorAll('.stage-canvas-tools :is(.stage-canvas-toggle.is-icon,.stage-canvas-tool.is-icon,.stage-canvas-close)')]
        .filter(el => el.getBoundingClientRect().width > 0).map(el => ({ id: el.id || el.getAttribute('aria-label'), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));
      return { width: innerWidth, cols, front: box('stage-canvas'), plan: box('stage-plan-canvas'), frontCell: box('stage-front-cell'), planCell: box('stage-plan-cell'), dock: box('stage-bottom-panels'), columns: [1,2,3,4].map(i => box('stage-col-bottom'+i)), icons, scrollWidth: document.getElementById('view-stage').scrollWidth, clientWidth: document.getElementById('view-stage').clientWidth };
    });
    await page.goto(base + '?feature-test');
    await ready();
    assert.equal(await page.locator('html').getAttribute('data-stage-layout'), 'two', name + ': existing default');
    const originalDocument = await documentValue();
    const originalLayout = await savedLayout();
    await choose('bottom');
    await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'bottom');
    assert.deepEqual(await documentValue(), originalDocument, name + ': mode choice keeps show JSON');
    assert.deepEqual(await savedLayout(), originalLayout, name + ': mode choice keeps old layout');
    assert.equal(await page.locator('.stage-panel-width-handle:visible').count(), 0, name + ': no side width handles');
    for (const [width, columns] of [[1440,4],[1280,4],[1024,3],[960,2]]) {
      await page.setViewportSize({ width, height: 1050 });
      await page.waitForFunction(() => document.documentElement.dataset.stageLayout === 'bottom');
      await page.locator('#view-stage').evaluate(el => el.scrollTop = 0);
      const g = await geometry();
      assert.equal(g.cols, columns, name + ': bottom columns ' + width);
      assert(g.front.x < g.plan.x, name + ': default front then plan');
      assert(Math.abs(g.front.y - g.plan.y) < 1, name + ': canvas top alignment ' + width);
      assert(Math.abs(g.front.width - g.plan.width) < 1, name + ': equal view widths');
      assert(Math.abs(g.front.width / g.front.height - 16/9) < .002, name + ': front ratio');
      assert(Math.abs(g.plan.width / g.plan.height - 16/9) < .002, name + ': plan ratio');
      assert(g.dock.y >= Math.max(g.frontCell.bottom, g.planCell.bottom), name + ': panels below views');
      assert(g.scrollWidth <= g.clientWidth + 1, name + ': no horizontal page overflow');
      assert(g.icons.every(icon => icon.w === 44 && icon.h === 44), name + ': equal 44px canvas icons ' + JSON.stringify(g.icons));
      if (columns === 3) assert(g.columns[3].y > g.columns[0].y, name + ': fourth column wraps');
      if (columns === 2) assert(g.columns[2].y > g.columns[0].y, name + ': lower row wraps');
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
      results.push({ browser:name, scene:'B-3', check:'geometry', ...g });
    }
    await page.setViewportSize({ width:1440, height:1050 });
    await page.locator('#stage-view-select').selectOption('both-plan');
    let g = await geometry(); assert(g.plan.x < g.front.x, name + ': reverse order still works');
    await page.locator('#stage-view-select').selectOption('front');
    assert.equal(await page.locator('#stage-plan-inner').isVisible(), false);
    assert((await page.locator('#stage-canvas').boundingBox()).width > 1300, name + ': one view expands');
    await page.locator('#stage-view-select').selectOption('both-front');

    // Real pointer selection/move in the plan; the same selected piece is drawn in both canvases.
    const pieceBefore = (await documentValue()).project.scenes.find(s=>s.id==='ft-scene-b3').pieces.find(p=>p.castId==='ft-cast-p01');
    await page.locator('#stage-plan-canvas').scrollIntoViewIfNeeded();
    const point = await page.evaluate(() => {
      const p=JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
      const piece=p.scenes.find(s=>s.id==='ft-scene-b3').pieces.find(p=>p.castId==='ft-cast-p01');
      const venue=SHOSAI_VENUES.byId(p.venue), size={...SHOSAI_VENUES.sizeById(venue,p.venueSize),...p.venueDims};
      const fit=SHOSAI_STAGE_PLAN_FIT.rect({W:1280,H:720,venue,size});
      const r=document.getElementById('stage-plan-canvas').getBoundingClientRect();
      return {x:r.x+(fit.x+piece.u*fit.w)*r.width/1280,y:r.y+(fit.y+piece.v*fit.h)*r.height/720};
    });
    await page.mouse.click(point.x,point.y);
    await page.waitForFunction(() => document.getElementById('stage-selected-name').textContent.includes('演者01'));
    assert.equal(await page.locator('[data-panel="inspector"]').evaluate(el=>el.parentElement.id), 'stage-col-bottom3');
    assert.equal(await page.locator('.gamma-selection-floating:visible').count(),0);
    await page.mouse.move(point.x,point.y); await page.mouse.down();
    await page.mouse.move(point.x+22,point.y+16,{steps:8}); await page.mouse.up();
    const pieceAfter=(await documentValue()).project.scenes.find(s=>s.id==='ft-scene-b3').pieces.find(p=>p.id===pieceBefore.id);
    assert(pieceAfter.u!==pieceBefore.u || pieceAfter.v!==pieceBefore.v, name+': real drag writes the fixture piece');
    assert(await page.evaluate(()=>Boolean(__selectionBoxes['stage-canvas']&&__selectionBoxes['stage-plan-canvas'])), name+': shared selection drawn twice');
    const frontBox=await page.evaluate(()=>__selectionBoxes['stage-canvas']);
    const front=page.locator('#stage-canvas'); const dims=await front.evaluate(el=>({w:el.width,h:el.height}));
    await front.scrollIntoViewIfNeeded(); const r=await front.boundingBox();
    await page.mouse.click(r.x+5,r.y+5);
    await page.mouse.click(r.x+(frontBox.x+frontBox.w/2)*r.width/dims.w,r.y+(frontBox.y+frontBox.h/2)*r.height/dims.h);
    await page.waitForFunction(()=>document.getElementById('stage-selected-name').textContent.includes('演者01'));
    results.push({browser:name,scene:'B-3',check:'selection and pointer move',before:pieceBefore,after:pieceAfter});

    // Visibility and collapse use the existing controls.
    await page.locator('#stage-panels-toggle').click();
    await page.locator('.stage-panel-visibility-item').filter({hasText:/^音楽$/}).locator('input').check();
    await page.locator('#stage-panels-toggle').click();
    await collapse('music', false); await collapse('music',true);
    assert.equal(await page.locator('[data-panel="music"] .stage-panel-body').isVisible(),false);
    await page.locator('#stage-panels-toggle').click();
    const musicToggle=page.locator('.stage-panel-visibility-item').filter({hasText:/^音楽$/}).locator('input');
    await musicToggle.uncheck(); assert.equal(await page.locator('[data-panel="music"]').isVisible(),false);
    await musicToggle.check(); await page.locator('#stage-panels-toggle').click();

    // Drag between wrapped columns sharing the same X coordinate.
    await page.setViewportSize({width:960,height:1050});
    const ids=await page.locator('#stage-bottom-panels [data-panel-head]').evaluateAll(heads=>heads.map(h=>h.dataset.panelHead));
    for(const id of ids) await collapse(id,true);
    const beforeOrder=await savedLayout();
    const grip=page.locator('[data-panel="music"] .stage-panel-grip');
    await grip.scrollIntoViewIfNeeded(); const from=await grip.boundingBox();
    const target=await page.locator('[data-panel="cast"] .stage-panel-head').boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2); await page.mouse.down();
    await page.mouse.move(target.x+target.width/2,target.y+10,{steps:15}); await page.mouse.up();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gamma:shosai-stage-prefs-v1')).panelBottomLayout?.cols.music==='bottom2');
    assert.deepEqual(await savedLayout(),beforeOrder,name+': bottom drag preserves show layout');
    await page.reload(); await ready();
    await page.waitForFunction(()=>document.documentElement.dataset.stageLayout==='bottom');
    assert.equal(await page.locator('[data-panel="music"]').evaluate(el=>el.parentElement.id),'stage-col-bottom2');
    const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('gamma:shosai-stage-prefs-v1')));
    assert.equal(prefs.panelLayoutMode,'split',name+': old-version fallback');
    assert.equal(prefs.panelLayoutByWorkspace.normal,'bottom');
    await page.locator('#stage-prefs-btn').click();
    assert.equal(await page.locator('[data-stage-workspace-panel-layout="normal"]').inputValue(),'bottom');
    await page.locator('#stage-prefs-close').click();
    results.push({browser:name,scene:'B-3',check:'wrapped drag, reload and shared preference',saved:prefs.panelBottomLayout});

    await page.setViewportSize({width:900,height:1050});
    await page.waitForFunction(()=>document.documentElement.classList.contains('stage-pwa-tablet')&&document.documentElement.dataset.stageLayout==='ipad');
    await ready();
    await page.setViewportSize({width:960,height:1050});
    await page.waitForFunction(()=>!document.documentElement.classList.contains('stage-pwa-tablet')&&document.documentElement.dataset.stageLayout==='bottom');
    await ready();
    await page.setViewportSize({width:1440,height:1050});
    await page.locator('#stage-present-btn').click();
    await page.waitForFunction(()=>document.body.classList.contains('stage-fullscreen'));
    await page.locator('#stage-present-drawer-toggle').click();
    assert.equal(await page.locator('#stage-present-drawer-body [data-panel="music"]').isVisible(),true,name+': full-screen drawer retains bottom panels');
    await page.locator('#stage-present-close').click();
    await page.waitForFunction(()=>!document.body.classList.contains('stage-fullscreen'));
    assert.equal(await page.locator('#stage-col-bottom2').evaluate(el=>el.parentElement.id),'stage-bottom-panels');
    const beforeTimeline=await geometry();
    await page.locator('#stage-timeline-grip').click();
    await page.waitForFunction(()=>!document.getElementById('stage-timeline-panel').classList.contains('is-collapsed'));
    const separator=page.locator('#stage-timeline-resize');
    await separator.focus(); await page.keyboard.press('ArrowUp');
    const afterTimeline=await geometry();
    assert.equal(afterTimeline.front.width,beforeTimeline.front.width);
    assert.equal(afterTimeline.front.height,beforeTimeline.front.height);
    assert.equal(afterTimeline.plan.width,beforeTimeline.plan.width);
    const timeline=await page.locator('#stage-timeline-panel').boundingBox();
    assert(timeline.y>=afterTimeline.dock.bottom,name+': expanded timeline follows panels');
    await page.locator('#stage-timeline-play').click();
    await page.waitForFunction(()=>document.getElementById('stage-timeline-play').getAttribute('aria-pressed')==='true');
    await page.waitForTimeout(250);
    await page.locator('#stage-timeline-play').click();
    results.push({browser:name,scene:'B-3',check:'narrow recovery, fullscreen, timeline resize and playback',canvasSize:[afterTimeline.front.width,afterTimeline.front.height]});

    await page.setViewportSize({width:1900,height:1050});
    const beforeReturn=await savedLayout();
    await choose('split');
    await page.waitForFunction(()=>document.documentElement.dataset.stageLayout==='two');
    assert.deepEqual(await savedLayout(),beforeReturn,name+': old layout restored');
    assert.equal(await page.locator('#stage-bottom-panels').isVisible(),false);
    assert.equal(await page.locator('.stage-center-bar').evaluate(el=>el.parentElement.id),'stage-col-left');
    assert.equal(await page.locator('[data-panel="music"]').evaluate(el=>el.parentElement.id),beforeReturn.cols.music==='right'?'stage-col-right':'stage-col-left');
    assert.deepEqual(errors,[],name+': no script errors');
    results.push({browser:name,scene:'B-3',check:'return to original layout',errors});
  } catch(error) {
    await page.screenshot({path:path.join(output,`${name}-failure.png`)}).catch(()=>{});
    throw error;
  } finally { await browser.close(); }
}
(async()=>{
  for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]) await run(name,launcher);
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({fixtureId,base,results},null,2)+'\n');
  console.log(JSON.stringify({fixtureId,browsers:['chromium','webkit'],passedChecks:results.length,output}));
})().catch(error=>{console.error(error);process.exit(1)});
